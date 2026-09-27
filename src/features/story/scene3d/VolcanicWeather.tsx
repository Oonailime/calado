import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferGeometry, Float32BufferAttribute, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { PHASE_TWO_VOLCANOES, phaseTwoGroundHeight, phaseTwoRandom as random } from "@/features/game/world/phaseTwoLayout";
import { NOISE } from "./volcanicStoryShaders";
import { STORY_CHERRY, STORY_CHERRY_SCALE, VALLEY_OFFSET, valleyToStory } from "./volcanicStoryAssets";

export default function VolcanicWeather({ active, reduced, petalSources }: { active: boolean; reduced: boolean; petalSources: BufferGeometry }) {
  const sky = useRef<ShaderMaterial>(null);
  const smoke = useRef<ShaderMaterial>(null);
  const petals = useRef<ShaderMaterial>(null);
  const geometries = useMemo(() => {
    const positions: number[] = [], seeds: number[] = [], sizes: number[] = [];
    for (const v of PHASE_TWO_VOLCANOES) for (let i = 0; i < 24; i++) {
      const crater = valleyToStory(v.x, v.z);
      positions.push(crater.x, phaseTwoGroundHeight(v.x, v.z) + VALLEY_OFFSET.y + 1, crater.z);
      seeds.push(i / 24 + random(v.seed) * 0.2);
      sizes.push(v.height / 40);
    }
    const plumes = new BufferGeometry();
    plumes.setAttribute("position", new Float32BufferAttribute(positions, 3));
    plumes.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    plumes.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    const source = petalSources.getAttribute("position");
    const falling: number[] = [], randoms: number[] = [];
    for (let i = 0; i < 220; i++) {
      const index = Math.floor(random(i + 34) * source.count);
      falling.push(source.getX(index) * STORY_CHERRY_SCALE + STORY_CHERRY.x, source.getY(index) * STORY_CHERRY_SCALE, source.getZ(index) * STORY_CHERRY_SCALE + STORY_CHERRY.z);
      randoms.push(random(i + 821));
    }
    const blossoms = new BufferGeometry();
    blossoms.setAttribute("position", new Float32BufferAttribute(falling, 3));
    blossoms.setAttribute("aSeed", new Float32BufferAttribute(randoms, 1));
    return { plumes, blossoms };
  }, [petalSources]);
  const skyUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const smokeUniforms = useMemo(() => UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 900 } }]), []);
  const petalUniforms = useMemo(() => UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 900 } }]), []);
  useEffect(() => () => Object.values(geometries).forEach(g => g.dispose()), [geometries]);
  useFrame(({ size, gl }, delta) => {
    for (const ref of [sky, smoke, petals]) {
      const material = ref.current;
      if (!material) continue;
      if (active && !reduced) material.uniforms.uTime.value += Math.min(delta, 0.05);
      if (material.uniforms.uScale) material.uniforms.uScale.value = size.height * gl.getPixelRatio();
    }
  });
  return <group name="volcanic-weather">
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[400, 24, 16]} />
      <shaderMaterial ref={sky} side={BackSide} depthWrite={false} uniforms={skyUniforms}
        vertexShader={`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.0);gl_Position=p.xyww;}`}
        fragmentShader={`uniform float uTime;varying vec3 vDirection;${NOISE}
          void main(){vec3 d=normalize(vDirection);vec3 p=d*5.0+vec3(uTime*0.006,0,0);
          float n=fbm(p+fbm(p*1.7)*2.0);
          float horizon=1.0-smoothstep(-0.1,0.45,d.y);
          vec3 c=mix(vec3(0.018,0.021,0.026),vec3(0.22,0.22,0.23),smoothstep(0.18,0.76,n));
          c=mix(c,vec3(0.15,0.15,0.16),horizon*0.48);gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`} />
    </mesh>
    <points geometry={geometries.plumes} frustumCulled={false} renderOrder={2}>
      <shaderMaterial ref={smoke} transparent depthWrite={false} fog uniforms={smokeUniforms}
        vertexShader={`uniform float uTime;uniform float uScale;attribute float aSeed;attribute float aSize;varying float vAge;varying float vSeed;
          #include <fog_pars_vertex>
          void main(){float age=fract(aSeed+uTime*0.017);vAge=age;vSeed=aSeed;
          vec3 p=position+vec3(age*age*13.0+sin(age*15.0+aSeed*22.0)*1.3,age*46.0*aSize,cos(age*16.0+aSeed*19.0)*1.1);
          vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
          gl_PointSize=clamp(uScale*(2.0+age*13.0)*aSize/-mvPosition.z,1.0,480.0);
          #include <fog_vertex>
          }`}
        fragmentShader={`uniform float uTime;varying float vAge;varying float vSeed;
          #include <fog_pars_fragment>
          ${NOISE}
          void main(){vec2 uv=gl_PointCoord-0.5;float n=fbm(vec3(uv*8.0+vSeed*30.0,uTime*0.09));
          float a=(1.0-smoothstep(0.10,0.49,length(uv)+(n-0.5)*0.2))*smoothstep(0.0,0.09,vAge)*(1.0-smoothstep(0.68,1.0,vAge));
          vec3 c=mix(vec3(0.018,0.016,0.018),vec3(0.15,0.145,0.15),n);
          c+=vec3(0.2,0.035,0.002)*(1.0-smoothstep(0.0,0.15,vAge));gl_FragColor=vec4(c,a*0.8);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
          }`} />
    </points>
    <points geometry={geometries.blossoms} frustumCulled={false} renderOrder={3}>
      <shaderMaterial ref={petals} transparent depthWrite={false} fog uniforms={petalUniforms}
        vertexShader={`uniform float uTime;uniform float uScale;attribute float aSeed;varying float vAlpha;
          #include <fog_pars_vertex>
          void main(){float age=fract(aSeed+uTime*0.035);vec3 p=position;
          p.y=mix(position.y,0.05,age);p.x+=sin(age*11.0+aSeed*30.0)*0.6+age;p.z+=cos(age*9.0+aSeed*20.0)*0.4;
          vAlpha=smoothstep(0.0,0.04,age)*(1.0-smoothstep(0.91,1.0,age));
          vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
          gl_PointSize=clamp(uScale*0.065/-mvPosition.z,1.0,9.0);
          #include <fog_vertex>
          }`}
        fragmentShader={`varying float vAlpha;
          #include <fog_pars_fragment>
          void main(){vec2 p=(gl_PointCoord-0.5)*vec2(1.0,1.4);if(length(p)>0.46)discard;
          gl_FragColor=vec4(0.96,0.61,0.71,vAlpha*0.8);
          #include <colorspace_fragment>
          #include <fog_fragment>
          }`} />
    </points>
  </group>;
}
