"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  TrimeshCollider,
} from "@react-three/rapier";
import {
  BackSide,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  PointLight,
  ShaderMaterial,
  type WebGLProgramParametersWithUniforms,
  UniformsLib,
  UniformsUtils,
} from "three";
import { useGame } from "../state/store";
import {
  createPhaseTwoChess,
  createPhaseTwoLantern,
  createPhaseTwoLava,
  createPhaseTwoRocks,
  createPhaseTwoTerrain,
  createPhaseTwoTrees,
  createPhaseTwoMotes,
} from "./phaseTwoAssets";
import {
  PHASE_TWO_TABLE,
  PHASE_TWO_CHESS_SCALE,
  PHASE_TWO_STOOLS,
  PHASE_TWO_VOLCANOES,
  phaseTwoGroundHeight as ground,
  phaseTwoRandom as rand,
} from "./phaseTwoLayout";

const NOISE = `
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { float n=0.0; float a=0.5; for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.07+vec3(7.1);a*=0.5;}return n; }
`;

function basaltShader(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader =
    "varying vec3 vBasalt;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvBasalt = position;",
    );
  shader.fragmentShader =
    "varying vec3 vBasalt;\n" +
    NOISE +
    shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
    float grain=noise(vBasalt*21.0);
    float strata=sin(vBasalt.y*17.0+noise(vBasalt*2.0)*7.0);
    diffuseColor.rgb*=0.64+grain*0.52+strata*0.055;
  `,
    );
}

const LAVA_VERTEX = `
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const LAVA_FRAGMENT = `
uniform float uTime; varying vec2 vUv;
#include <fog_pars_fragment>
${NOISE}
void main(){
  float n=fbm(vec3(vUv.x*7.0,vUv.y*1.7-uTime*0.28,uTime*0.035));
  float edge=smoothstep(0.34,0.50,abs(vUv.x-0.5));
  float crust=smoothstep(0.48,0.67,n+edge*0.28);
  vec3 hot=mix(vec3(1.7,0.035,0.001),vec3(2.4,0.32,0.012),smoothstep(0.22,0.49,n));
  gl_FragColor=vec4(mix(hot,vec3(0.045,0.025,0.022),crust*0.94),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function VolcanicAtmosphere({
  running,
  petalSources,
}: {
  running: boolean;
  petalSources: BufferGeometry;
}) {
  const sky = useRef<ShaderMaterial>(null),
    smoke = useRef<ShaderMaterial>(null),
    motes = useRef<ShaderMaterial>(null);
  const reduced = useGame((s) => s.reduced),
    quality = useGame((s) => s.quality);
  const smokeGeometry = useMemo(() => {
    const p: number[] = [],
      seeds: number[] = [],
      sizes: number[] = [];
    for (const v of PHASE_TWO_VOLCANOES)
      for (let i = 0; i < 16; i++) {
        p.push(v.x, ground(v.x, v.z) + 4, v.z);
        seeds.push(i / 16 + rand(v.seed) * 0.2);
        sizes.push(v.height / 40);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    g.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    return g;
  }, []);
  const moteGeometry = useMemo(() => {
    return createPhaseTwoMotes(petalSources, quality === "low" ? 180 : 650);
  }, [quality, petalSources]);
  const skyUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const smokeUniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uScale: { value: 800 } },
      ]),
    [],
  );
  const moteUniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uScale: { value: 800 } },
      ]),
    [],
  );
  useEffect(() => () => smokeGeometry.dispose(), [smokeGeometry]);
  useEffect(() => () => moteGeometry.dispose(), [moteGeometry]);
  useFrame(({ size, gl }, delta) => {
    const dt = running && !reduced ? Math.min(delta, 0.05) : 0;
    for (const ref of [sky, smoke, motes])
      if (ref.current) ref.current.uniforms.uTime.value += dt;
    for (const ref of [smoke, motes])
      if (ref.current)
        ref.current.uniforms.uScale.value = size.height * gl.getPixelRatio();
  });
  return (
    <group name="phase2-atmosphere" userData={{ cameraOccluder: false }}>
      <mesh>
        <sphereGeometry args={[310, 32, 20]} />
        <shaderMaterial
          ref={sky}
          side={BackSide}
          depthWrite={false}
          uniforms={skyUniforms}
          vertexShader={`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
          fragmentShader={`uniform float uTime;varying vec3 vDirection;${NOISE}
          void main(){vec3 d=normalize(vDirection);vec3 p=d*5.0+vec3(uTime*0.007,0,0);
          float n=fbm(p+fbm(p*1.7)*2.0);float horizon=1.0-smoothstep(0.0,0.48,d.y);
          vec3 color=mix(vec3(0.022,0.026,0.035),vec3(0.12,0.12,0.13),smoothstep(0.2,0.73,n));
          color=mix(color,vec3(0.10,0.092,0.10),horizon*0.55);gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`}
        />
      </mesh>
      <points geometry={smokeGeometry} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          ref={smoke}
          transparent
          depthWrite={false}
          fog
          uniforms={smokeUniforms}
          vertexShader={`uniform float uTime;uniform float uScale;attribute float aSeed;attribute float aSize;varying float vAge;varying float vSeed;
          #include <fog_pars_vertex>
          void main(){float age=fract(aSeed+uTime*0.023);vAge=age;vSeed=aSeed;
          vec3 p=position+vec3(age*age*19.0+sin(age*16.0+aSeed*23.0)*2.5,age*43.0*aSize,cos(age*18.0+aSeed*19.0)*2.0);
          vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
          gl_PointSize=clamp(uScale*(3.0+age*13.0)*aSize/-mvPosition.z,1.0,480.0);
          #include <fog_vertex>
          }`}
          fragmentShader={`uniform float uTime;varying float vAge;varying float vSeed;
          #include <fog_pars_fragment>
          ${NOISE}
          void main(){vec2 uv=gl_PointCoord-0.5;vec3 np=vec3(uv*7.0+vSeed*30.0,uTime*0.07);float n=noise(np)*0.65+noise(np*2.1)*0.35;
          float a=(1.0-smoothstep(0.16,0.49,length(uv)+(n-0.5)*0.19))*smoothstep(0.0,0.12,vAge)*(1.0-smoothstep(0.65,1.0,vAge));
          vec3 c=mix(vec3(0.065,0.059,0.063),vec3(0.24,0.22,0.22),n);
          c+=vec3(0.28,0.055,0.006)*(1.0-smoothstep(0.0,0.22,vAge));gl_FragColor=vec4(c,a*0.6);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
          }`}
        />
      </points>
      <points geometry={moteGeometry} frustumCulled={false} renderOrder={3}>
        <shaderMaterial
          ref={motes}
          transparent
          depthWrite={false}
          fog
          uniforms={moteUniforms}
          vertexShader={`uniform float uTime;uniform float uScale;attribute float aSeed;attribute float aType;attribute float aFloor;varying float vType;varying float vSeed;varying float vAlpha;
          #include <fog_pars_vertex>
          void main(){vType=aType;vSeed=aSeed;vec3 p=position;
          vAlpha=1.0;
          if(aType>0.5){
            float age=fract(aSeed+uTime*(0.4+aSeed*0.25)/max(0.1,position.y-aFloor));
            p.y=mix(position.y,aFloor,age);
            p.x+=age*(0.8+sin(age*12.0+aSeed*40.0)*0.55);
            p.z+=age*sin(age*9.0+aSeed*30.0)*0.6;
            vAlpha=smoothstep(0.0,0.025,age)*(1.0-smoothstep(0.91,1.0,age));
          }else{
            p.x+=sin(uTime*0.4+aSeed*40.0)*1.4;
            p.z+=sin(uTime*0.27+aSeed*30.0)*0.9;
            p.y=mod(position.y-uTime*0.5+3200.0,32.0);
          }
          vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
          gl_PointSize=clamp(uScale*(aType>0.5?0.085:0.035)/-mvPosition.z,1.0,12.0);
          #include <fog_vertex>
          }`}
          fragmentShader={`varying float vType;varying float vSeed;varying float vAlpha;
          #include <fog_pars_fragment>
          void main(){vec2 p=gl_PointCoord-0.5;if(length(p*vec2(1.0,1.5))>0.48)discard;
          gl_FragColor=vec4(vType>0.5?mix(vec3(0.95,0.38,0.59),vec3(1.0,0.75,0.82),vSeed):vec3(0.12,0.10,0.11),0.85*vAlpha);
          #include <colorspace_fragment>
          #include <fog_fragment>
          }`}
        />
      </points>
    </group>
  );
}

export default function PhaseTwo({ running }: { running: boolean }) {
  const assets = useMemo(
    () => ({
      terrain: createPhaseTwoTerrain(),
      rocks: createPhaseTwoRocks(),
      ...createPhaseTwoTrees(),
      chess: createPhaseTwoChess(),
      lantern: createPhaseTwoLantern(),
      lava: createPhaseTwoLava(),
    }),
    [],
  );
  const lava = useRef<ShaderMaterial>(null),
    light = useRef<PointLight>(null),
    elapsed = useRef(0);
  const reduced = useGame((s) => s.reduced),
    quality = useGame((s) => s.quality);
  const uniforms = useMemo(
    () => UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
    [],
  );
  useEffect(
    () => () => Object.values(assets).forEach((g) => g.dispose()),
    [assets],
  );
  useFrame((_, delta) => {
    if (!running || reduced) return;
    elapsed.current += Math.min(delta, 0.05);
    if (lava.current) lava.current.uniforms.uTime.value = elapsed.current;
    if (light.current)
      light.current.intensity =
        16 +
        Math.sin(elapsed.current * 8) * 0.6 +
        Math.sin(elapsed.current * 13) * 0.4;
  });
  return (
    <group name="phase2-volcanic-chess-valley">
      <VolcanicAtmosphere
        running={running}
        petalSources={assets.petalSources}
      />
      <RigidBody type="fixed" colliders={false} friction={1}>
        <mesh
          name="phase2-basalt-terrain"
          userData={{ cameraOccluder: false }}
          geometry={assets.terrain}
          receiveShadow
        >
          <meshStandardMaterial
            vertexColors
            roughness={0.99}
            onBeforeCompile={basaltShader}
          />
        </mesh>
        <TrimeshCollider
          args={[
            assets.terrain.getAttribute("position").array as Float32Array,
            assets.terrain.index!.array as Uint32Array,
          ]}
        />
        <TrimeshCollider
          args={[
            assets.rocks.getAttribute("position").array as Float32Array,
            Uint32Array.from(
              { length: assets.rocks.getAttribute("position").count },
              (_, i) => i,
            ),
          ]}
        />
        <CuboidCollider
          args={[
            1.4 * PHASE_TWO_CHESS_SCALE,
            0.7055 * PHASE_TWO_CHESS_SCALE,
            1.4 * PHASE_TWO_CHESS_SCALE,
          ]}
          position={[
            PHASE_TWO_TABLE[0],
            ground(...PHASE_TWO_TABLE) + 0.7055 * PHASE_TWO_CHESS_SCALE,
            PHASE_TWO_TABLE[1],
          ]}
        />
        {PHASE_TWO_STOOLS.map((seat) => (
          <CylinderCollider
            key={seat.z}
            args={[seat.halfHeight, seat.radius]}
            position={[
              seat.x,
              ground(seat.x, seat.z) + seat.halfHeight,
              seat.z,
            ]}
          />
        ))}
        <TrimeshCollider
          args={[
            assets.bark.getAttribute("position").array as Float32Array,
            Uint32Array.from(
              { length: assets.bark.getAttribute("position").count },
              (_, i) => i,
            ),
          ]}
        />
        <CuboidCollider
          args={[0.4, 0.8, 0.4]}
          position={[2.3, ground(2.3, 3) + 0.8, 3]}
        />
      </RigidBody>
      {(["rocks", "bark", "dead", "chess", "lantern"] as const).map((key) => (
        <mesh
          key={key}
          name={`phase2-${key}`}
          userData={{ cameraOccluder: key !== "rocks" && key !== "dead" }}
          geometry={assets[key]}
          castShadow={quality !== "low"}
          receiveShadow
        >
          <meshStandardMaterial
            vertexColors
            onBeforeCompile={
              key === "rocks" || key === "bark" ? basaltShader : undefined
            }
            roughness={key === "lantern" ? 0.4 : 0.9}
            metalness={key === "lantern" ? 0.65 : 0}
          />
        </mesh>
      ))}
      <mesh
        name="phase2-cherry-blossoms"
        geometry={assets.blossoms}
        castShadow={quality !== "low"}
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          side={DoubleSide}
          emissive="#b54f76"
          emissiveIntensity={0.09}
        />
      </mesh>
      <mesh
        name="phase2-lava-rivers"
        geometry={assets.lava}
        userData={{ cameraOccluder: false }}
      >
        <shaderMaterial
          ref={lava}
          uniforms={uniforms}
          vertexShader={LAVA_VERTEX}
          fragmentShader={LAVA_FRAGMENT}
          side={DoubleSide}
          fog
        />
      </mesh>
      {PHASE_TWO_VOLCANOES.map((v) => (
        <group key={v.seed} position={[v.x, ground(v.x, v.z) + 0.6, v.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[v.radius * 0.075, 20]} />
            <meshBasicMaterial color="#ff7026" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group position={[2.3, ground(2.3, 3), 3]} name="phase2-lantern-flame">
        <mesh position={[0, 0.77, 0]} scale={[0.085, 0.24, 0.085]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#ffe8a3" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.73, 0]}>
          <boxGeometry args={[0.52, 0.86, 0.52]} />
          <meshStandardMaterial
            color="#eaa147"
            emissive="#ffb539"
            emissiveIntensity={0.4}
            transparent
            opacity={0.13}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        <pointLight
          ref={light}
          position={[0, 0.9, 0]}
          color="#ffbd68"
          intensity={16}
          distance={12}
          decay={2}
        />
      </group>
      <pointLight
        position={[22, 1, -4]}
        color="#ff4c10"
        intensity={35}
        distance={18}
        decay={2}
      />
      <pointLight
        position={[-6, 13, 5]}
        color="#ffd0df"
        intensity={24}
        distance={18}
        decay={2}
      />
    </group>
  );
}
