"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  TrimeshCollider,
  useBeforePhysicsStep,
} from "@react-three/rapier";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { runtime, useGame } from "../state/store";
import { type ArborealSite } from "./forestLayout";
import {
  createPhaseFourEnvironment,
  createCanopySupportColliders,
  createPhaseFourPathCollider,
  createPhaseFourVineTieGeometry,
  createPhaseFourVineLeafGeometry,
  PHASE_FOUR_VINE_LEAF_COLORS,
  type AnchorTree,
} from "./phaseFourAssets";
import { createPhaseFourGroundGeometry } from "./phaseFourTerrain";
import {
  PHASE_FOUR_PATHS,
  PHASE_FOUR_PLATFORMS,
  PHASE_FOUR_SWING_SITES,
  PHASE_FOUR_TREES,
} from "./phaseFourLayout";
import TreeEntrance from "./TreeEntrance";
import CanopyCooperation from "./CanopyCooperation";
import { createCanopyWaterGeometry } from "./phaseFourWater";
import RubiksCube from "./RubiksCube";
import {
  createSwingingVine,
  stepSwingingVine,
  swingingVinePoints,
} from "./swingingVine";

const WATER_VERTEX = `
  uniform float uTime;
  attribute float aFalling;
  varying vec2 vUv;
  varying float vFalling;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vFalling = aFalling;
    vec3 p = position;
    float ripple = sin(p.x * 1.5 + uTime) * 0.04 + sin(p.z * 1.1 - uTime) * 0.06;
    p.y += ripple * (1.0 - aFalling);
    p.z += sin(uv.x * 22.0 + uv.y * 13.0 - uTime * 4.0) * 0.07 * aFalling;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const WATER_FRAGMENT = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vFalling;
  #include <fog_pars_fragment>
  void main() {
    float flow = vUv.y * 10.0 - uTime * 2.8;
    float stripe = sin(vUv.x * 89.0 + sin(flow * 0.35) * 2.0);
    float pulse = sin(flow);
    float foam = smoothstep(0.65, 0.98, stripe * 0.4 + pulse * 0.6);
    float bank = smoothstep(0.25, 0.49, abs(vUv.x - 0.5));
    vec3 river = mix(vec3(0.035,0.26,0.25),vec3(0.18,0.58,0.49),bank*0.7+pulse*0.04);
    river += foam * vec3(0.19,0.32,0.27);
    vec3 falls = mix(vec3(0.22,0.58,0.56),vec3(0.85,0.97,0.9),0.45+stripe*0.22+foam*0.4);
    gl_FragColor = vec4(mix(river, falls, vFalling), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function FlowingWater({ running }: { running: boolean }) {
  const geometry = useMemo(() => createCanopyWaterGeometry(), []);
  const material = useRef<ShaderMaterial>(null);
  const reduced = useGame(state => state.reduced);
  const uniforms = useMemo(() => UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]), []);
  useFrame((_, dt) => {
    if (running && !reduced && material.current) material.current.uniforms.uTime.value += Math.min(dt, 0.05);
  });
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="Phase4_ContinuousRiverAndFalls" geometry={geometry}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={WATER_VERTEX}
        fragmentShader={WATER_FRAGMENT} side={DoubleSide} fog />
    </mesh>
  );
}

function WaterfallSpray({ running }: { running: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const elapsed = useRef(0);
  const reduced = useGame((state) => state.reduced);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (running && !reduced) elapsed.current += Math.min(dt, 0.05);
    for (let i = 0; i < 36; i++) {
      const phase = (elapsed.current * 0.26 + i / 36) % 1;
      const angle = i * 2.399;
      dummy.position.set(
        14 + Math.sin(angle) * (1.6 + phase * 4),
        -4.4 + Math.sin(phase * Math.PI) * 2,
        -37.5 + Math.cos(angle) * (1 + phase * 3),
      );
      dummy.scale.setScalar(
        (0.15 + Math.sin(phase * Math.PI) * 0.62) * (i % 2 ? 1 : 0.6),
      );
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 36]}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#d4efe2"
        transparent
        opacity={0.14}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function SwingingVine({
  site,
  running,
  trees = PHASE_FOUR_TREES,
}: {
  site: ArborealSite;
  running: boolean;
  trees?: readonly AnchorTree[];
}) {
  const segments = useRef<InstancedMesh>(null);
  const leaves = useRef<Group>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const axis = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const physics = useRef(createSwingingVine(site));
  const selectionEpoch = useRef(runtime.canopySelectionEpoch);
  const leafGeometry = useMemo(() => createPhaseFourVineLeafGeometry(), []);
  const frontTie = useRef<Mesh>(null);
  const rearTie = useRef<Mesh>(null);
  const ties = useMemo(() => {
    const span = site.vine.twoPoint!;
    return {
      front: createPhaseFourVineTieGeometry(
        trees[span.frontTreeIndex],
        [site.vine.x, site.vine.attachY, site.vine.z],
      ),
      rear: createPhaseFourVineTieGeometry(trees[span.rearTreeIndex], [
        span.rear.x,
        span.rear.y,
        span.rear.z,
      ]),
    };
  }, [site, trees]);
  useBeforePhysicsStep(() => {
    if (!running) return;
    if (selectionEpoch.current !== runtime.canopySelectionEpoch) {
      runtime.swingingVines.set(site.id, createSwingingVine(site));
      selectionEpoch.current = runtime.canopySelectionEpoch;
      for (const hands of runtime.vineContacts) {
        if (hands.left?.siteId === site.id) hands.left = null;
        if (hands.right?.siteId === site.id) hands.right = null;
      }
    }
    const registered = runtime.swingingVines.get(site.id);
    if (registered) physics.current = registered;
    else {
      physics.current = createSwingingVine(site);
      runtime.swingingVines.set(site.id, physics.current);
    }
    const contact = runtime.vineContacts
      .flatMap((hands) => [hands.left, hands.right])
      .find((hand) => hand?.siteId === site.id);
    stepSwingingVine(physics.current, contact?.grip);
  });
  useEffect(
    () => () => {
      runtime.swingingVines.delete(site.id);
      ties.front.dispose();
      ties.rear.dispose();
      leafGeometry.dispose();
    },
    [site.id, ties, leafGeometry],
  );
  useFrame(() => {
    if (!segments.current) return;
    const active = runtime.vineContacts
      .flatMap((hands) => [hands.left, hands.right])
      .find((hand) => hand?.siteId === site.id);
    const points = swingingVinePoints(
      physics.current,
      active?.grip ?? physics.current.grip,
    );
    if (frontTie.current)
      frontTie.current.visible = physics.current.releasedAttachment !== "front";
    if (rearTie.current)
      rearTie.current.visible = physics.current.releasedAttachment !== "rear";
    for (let i = 0; i < 32; i++) {
      const a = points[i],
        b = points[i + 1];
      axis.set(b.x - a.x, b.y - a.y, b.z - a.z);
      dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      const taper = 1.15 - (i / 32) * 0.35;
      dummy.scale.set(taper, axis.length() + 0.025, taper);
      dummy.quaternion.setFromUnitVectors(up, axis.normalize());
      dummy.updateMatrix();
      segments.current.setMatrixAt(i, dummy.matrix);
    }
    segments.current.instanceMatrix.needsUpdate = true;
    leaves.current?.children.forEach((leaf, i) => {
      const p = points[2 + i * 2];
      leaf.position.set(p.x, p.y, p.z);
    });
  });
  return (
    <group name={site.id} userData={{ cameraOccluder: false }}>
      <mesh ref={frontTie} geometry={ties.front}>
        <meshStandardMaterial color="#4b682c" roughness={1} />
      </mesh>
      <mesh ref={rearTie} geometry={ties.rear}>
        <meshStandardMaterial color="#4b682c" roughness={1} />
      </mesh>
      <instancedMesh
        ref={segments}
        args={[undefined, undefined, 32]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.075, 1, 7]} />
        <meshStandardMaterial color="#557331" roughness={1} />
      </instancedMesh>
      <group ref={leaves}>
        {Array.from({ length: 15 }, (_, i) => (
          <mesh key={i} geometry={leafGeometry} rotation={[0, i * 2.4, 0]}>
            <meshStandardMaterial
              color={PHASE_FOUR_VINE_LEAF_COLORS[i % 5]}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function PhaseFour({ running, onPortalEnter }: { running: boolean; onPortalEnter: () => void }) {
  const cubeSolved = useGame((state) => state.puzzle.cubeSolved);
  const scene = useMemo(() => createPhaseFourEnvironment(), []);
  const colliders = useMemo(
    () =>
      PHASE_FOUR_PATHS.map((path) => {
        const geometry = createPhaseFourPathCollider(path);
        const result = {
          id: path.id,
          vertices: Float32Array.from(geometry.getAttribute("position").array),
          indices: Uint32Array.from(geometry.index!.array),
        };
        geometry.dispose();
        return result;
      }),
    [],
  );
  const supports = useMemo(() => createCanopySupportColliders(scene), [scene]);
  const ground = useMemo(() => {
    const geometry = createPhaseFourGroundGeometry();
    const data = {
      vertices: Float32Array.from(geometry.getAttribute("position").array),
      indices: Uint32Array.from(geometry.index!.array),
    };
    geometry.dispose();
    return data;
  }, []);
  useLayoutEffect(() => {
    runtime.yaw = -0.47;
    runtime.pitch = 0.28;
  }, []);
  useEffect(
    () => () =>
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((material) => material.dispose());
        }
      }),
    [scene],
  );
  return (
    <group name="Phase3">
      {/* Opens on arrival, then fades after 3s (lifetime) like phase 2's
          arrival portal — until the shrine is solved, at which point it
          drops the lifetime entirely and simply stays open (presence then
          tracks `open` alone, see TreeEntrance), reusing the same doorway
          as the way back to phase 2. */}
      <TreeEntrance running={running} open lifetime={cubeSolved ? undefined : 3} onEnter={onPortalEnter}
        anchor={{ x: -16.6, y: 8, z: 14, rotationY: Math.PI / 2, halfWidth: 0.95, halfDepth: 0.7, groundInset: 0 }} />
      <primitive object={scene} />
      <CanopyCooperation scene={scene} running={running} />
      <RigidBody type="fixed" colliders={false} friction={0.9}>
        <TrimeshCollider args={[ground.vertices, ground.indices]} />
        {PHASE_FOUR_PLATFORMS.map((deck) => (
          <CuboidCollider
            key={deck.id}
            args={[deck.width / 2, 0.14, deck.depth / 2]}
            position={[deck.center[0], deck.center[1] - 0.14, deck.center[2]]}
          />
        ))}
        {supports.map(support => <TrimeshCollider key={support.name} args={[support.vertices, support.indices]} />)}
        {colliders.map((path) => (
          <TrimeshCollider key={path.id} args={[path.vertices, path.indices]} />
        ))}
        {PHASE_FOUR_TREES.map((tree) => (
          <CylinderCollider
            key={tree.seed}
            args={[tree.height / 2, tree.radius * 0.86]}
            position={[
              tree.position[0],
              tree.position[1] + tree.height / 2,
              tree.position[2],
            ]}
          />
        ))}
      </RigidBody>
      <FlowingWater running={running} />
      <WaterfallSpray running={running} />
      {PHASE_FOUR_SWING_SITES.map((site) => (
        <SwingingVine key={site.id} site={site} running={running} />
      ))}
      <RubiksCube running={running} />
      <pointLight
        position={[-16.6, 9.7, 15.5]}
        color={new Color("#ffb744")}
        intensity={6}
        distance={6}
        decay={2}
      />
    </group>
  );
}
