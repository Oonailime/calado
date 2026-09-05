import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  UniformsLib,
  UniformsUtils,
  type ShaderMaterial,
} from "three";

const VERTEX = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 0.22 + uTime * 0.35) * 0.015
      + sin(pos.y * 0.3 - uTime * 0.22) * 0.01;
    pos.z += wave;
    vWave = wave;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const FRAGMENT = `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uOpacity;
  varying float vWave;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    vec3 color = mix(uDeep, uShallow, clamp(vWave * 12.0 + 0.45, 0.0, 1.0));
    gl_FragColor = vec4(color, uOpacity * mix(0.7, 1.0, edge));
    #include <fog_fragment>
  }
`;

export function Water({
  width,
  length,
  position,
  rotationZ = 0,
  deep = "#1b4a52",
  shallow = "#8fd6c9",
  opacity = 0.82,
  segments = 10,
}: {
  width: number;
  length: number;
  position: [number, number, number];
  rotationZ?: number;
  deep?: string;
  shallow?: string;
  opacity?: number;
  segments?: number;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new Color(deep) },
          uShallow: { value: new Color(shallow) },
          uOpacity: { value: opacity },
        },
      ]),
    [deep, shallow, opacity],
  );
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotationZ]}>
      <planeGeometry args={[width, length, segments, segments]} />
      <shaderMaterial
        ref={material}
        transparent
        side={DoubleSide}
        depthWrite={false}
        fog
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
      />
    </mesh>
  );
}
