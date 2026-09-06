import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AdditiveBlending,
  Color,
  DodecahedronGeometry,
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  type BufferGeometry,
} from "three";
import { runtime, useGame } from "../state/store";
import { anchors, LOCK_CODE } from "../state/rules";
import { Water } from "./Water";
import { Bridge, BRIDGE_MODEL_URL } from "./Bridge";
import { IslandVegetation, useNatureMesh } from "./Vegetation";
import {
  beachRampGeometry,
  islandGeometry,
  organicIslandShape,
} from "./terrain";
import {
  BEACH_SAND_COLOR,
  BRIDGE,
  ISLANDS,
  ISLAND_BASE_Y,
  ISLAND_SURFACE_Y,
} from "./layout";
import {
  buildDigitSequence,
  PULSE_MARK,
} from "./soundCode";
import WisdomTotem from "./Totem";
import BananaGroves from "./BananaGroves";

// The collider follows both the height and silhouette of the rendered ground.
function Island({
  x,
  z,
  halfWidth,
  halfDepth,
  seed,
  grass,
  earth,
}: {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  seed: number;
  grass: string;
  earth: string;
}) {
  const soilShape = useMemo(
    () => organicIslandShape(halfWidth, halfDepth, seed),
    [halfWidth, halfDepth, seed],
  );
  const soilGeometry = useMemo(() => islandGeometry(soilShape), [soilShape]);
  const beachGeometry = useMemo(
    () => beachRampGeometry(soilShape, z),
    [soilShape, z],
  );
  const soilMaterials = useMemo(
    () => [
      new MeshStandardMaterial({ color: grass, roughness: 0.98 }),
      new MeshStandardMaterial({ color: earth, roughness: 1 }),
    ],
    [earth, grass],
  );
  const beachMaterials = useMemo(
    () => [
      new MeshStandardMaterial({ color: earth, roughness: 1 }),
      new MeshStandardMaterial({ color: BEACH_SAND_COLOR, roughness: 1 }),
    ],
    [earth],
  );
  return (
    <>
      <RigidBody
        type="fixed"
        colliders="trimesh"
        position={[x, ISLAND_BASE_Y, z]}
      >
        <mesh
          geometry={soilGeometry}
          material={soilMaterials}
          receiveShadow
          castShadow
        />
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" position={[x, 0, z]}>
        <mesh
          geometry={beachGeometry}
          material={beachMaterials}
          receiveShadow
        />
      </RigidBody>
      <IslandVegetation
        x={x}
        y={ISLAND_SURFACE_Y}
        z={z}
        halfWidth={halfWidth}
        halfDepth={halfDepth}
        seed={seed}
      />
    </>
  );
}
function Anchor({
  x,
  z,
  color,
  active,
  shape,
}: {
  x: number;
  z: number;
  color: string;
  active: boolean;
  shape: "reveal" | "silence";
}) {
  return (
    <group position={[x, 0.02, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.23, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 1 : 0.35}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, shape === "reveal" ? 0 : Math.PI / 4]}>
        <ringGeometry args={[0.39, 0.46, shape === "reveal" ? 3 : 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {active && (
        <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.9, 1.94, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

function BridgePlaceholder({ contrast }: { contrast: boolean }) {
  const color = contrast ? "#ffffff" : "#aaa99d";
  return (
    <group position={[0, -0.12, BRIDGE.z]}>
      <mesh>
        <boxGeometry args={[3.2, 0.08, BRIDGE.length]} />
        <meshBasicMaterial
          wireframe
          color={color}
          transparent
          opacity={0.24}
        />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.07, 0.025, BRIDGE.length * 0.76]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} />
      </mesh>
    </group>
  );
}
const PALM_SCALE = 0.0075;
// A palm Calado can harvest for the bridge — glows gold while Mizaru's
// reveal marks it, then becomes a stump once collected.
function LogSite({
  x,
  z,
  collected,
  highlight,
}: {
  x: number;
  z: number;
  collected: boolean;
  highlight: boolean;
}) {
  const source = useNatureMesh("PalmTree_1", [
    "#6b4a30",
    "#4c7a4a",
    "#4c7a4a",
    "#4c7a4a",
  ]);
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    const material = glow.current.material as MeshBasicMaterial;
    if (!highlight || collected) {
      material.opacity = 0;
      return;
    }
    material.opacity = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  return (
    <group position={[x, 0, z]}>
      {collected ? (
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.16, 10]} />
          <meshStandardMaterial color="#6b4a30" roughness={0.95} />
        </mesh>
      ) : (
        source && (
          <mesh
            geometry={source.geometry}
            material={source.material}
            scale={PALM_SCALE}
            castShadow
            receiveShadow
          />
        )
      )}
      {!collected && (
        <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.5, 0.62, 32]} />
          <meshBasicMaterial
            color="#eac369"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
// A cone (not a straight-sided one — the profile rounds off toward the tip,
// like a dome capping a spire) rather than a flat wall of bars.
function noiseConeGeometry(radius: number, height: number) {
  const profile = [
    new Vector2(0, 0),
    new Vector2(radius, 0),
    new Vector2(radius * 0.88, height * 0.42),
    new Vector2(radius * 0.55, height * 0.78),
    new Vector2(radius * 0.22, height * 0.96),
    new Vector2(0, height),
  ];
  return new LatheGeometry(profile, 24);
}
const WAVE_INTERVAL = 0.8;
const WAVE_MAX_RADIUS = 7;
// A single expanding ring, one pulse of the code at a time — not a
// continuous ambient wash. `active` (both keepers in position) drives the
// sequence clock regardless of who's watching; `visible` only gates whether
// this frame's pulse is actually rendered, since only Mizaru can perceive it.
function SoundWaves({
  active,
  visible,
  digit,
  step,
}: {
  active: boolean;
  visible: boolean;
  digit: number;
  step: number;
}) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const sequence = useMemo(() => buildDigitSequence(digit), [digit]);
  useEffect(() => {
    start.current = null;
  }, [step]);
  useFrame(({ clock }) => {
    if (!active) {
      start.current = null;
      return;
    }
    if (start.current === null) start.current = clock.elapsedTime;
    if (!mesh.current) return;
    const elapsed = clock.elapsedTime - start.current;
    const index = Math.floor(elapsed / WAVE_INTERVAL) % sequence.length;
    const phase = (elapsed / WAVE_INTERVAL) % 1;
    mesh.current.scale.setScalar(0.4 + phase * WAVE_MAX_RADIUS);
    const material = mesh.current.material as MeshBasicMaterial;
    material.color.set(sequence[index]);
    material.opacity = Math.max(0, 0.65 * (1 - phase));
  });
  if (!visible) return null;
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial
        color={PULSE_MARK}
        wireframe
        transparent
        opacity={0}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
function NoiseBarrier({
  active,
  visible,
  contrast,
  digit,
  step,
}: {
  active: boolean;
  visible: boolean;
  contrast: boolean;
  digit: number;
  step: number;
}) {
  const geometry = useMemo(() => noiseConeGeometry(1.7, 3.4), []);
  const cone = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (cone.current)
      cone.current.rotation.y += Math.min(delta, 0.04) * (active ? 0.45 : 0.15);
  });
  return (
    <>
      <mesh ref={cone} geometry={geometry} castShadow>
        <meshStandardMaterial
          color={contrast ? "#ffffff" : "#d8e6cb"}
          transparent
          opacity={active ? 0.65 : 0.4}
          roughness={0.35}
        />
      </mesh>
      <SoundWaves active={active} visible={visible} digit={digit} step={step} />
    </>
  );
}
function Padlock({ unlocked }: { unlocked: boolean }) {
  const shackle = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!shackle.current) return;
    const t = Math.min(1, delta * 4);
    const targetY = unlocked ? 0.22 : 0;
    const targetRotation = unlocked ? -0.9 : 0;
    shackle.current.position.y +=
      (targetY - shackle.current.position.y) * t;
    shackle.current.rotation.z +=
      (targetRotation - shackle.current.rotation.z) * t;
  });
  return (
    <group position={[anchors.padlock.x, 0, anchors.padlock.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.82, 40]} />
        <meshBasicMaterial
          color={unlocked ? "#8f9a86" : "#eac369"}
          transparent
          opacity={unlocked ? 0.3 : 0.55}
        />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.6, 0.24]} />
        <meshStandardMaterial color="#8a7a52" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.34, 0.13]}>
        <circleGeometry args={[0.09, 16]} />
        <meshStandardMaterial color="#20201a" />
      </mesh>
      <group ref={shackle} position={[0, 0.62, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.22, 0.045, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#c9c2a5" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
const MOTE_COUNT = 48;

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type MoteSeed = {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  drift: number;
};
type InstanceSeed = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
  rotationX?: number;
  rotationZ?: number;
};
function StaticInstances({
  geometry,
  material,
  seeds,
  castShadow = false,
  receiveShadow = false,
}: {
  geometry: BufferGeometry;
  material: Material | Material[];
  seeds: InstanceSeed[] | readonly InstanceSeed[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    seeds.forEach((seed, index) => {
      dummy.position.set(seed.x, seed.y, seed.z);
      dummy.rotation.set(
        seed.rotationX ?? 0,
        seed.rotationY,
        seed.rotationZ ?? 0,
      );
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, seeds]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, seeds.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
function createMoteSeeds(count: number): MoteSeed[] {
  const random = createSeededRandom(90125);
  return Array.from({ length: count }, () => ({
    x: (random() - 0.5) * 14,
    y: 0.3 + random() * 3,
    z: 5 - random() * 34,
    phase: random() * Math.PI * 2,
    speed: 0.25 + random() * 0.35,
    drift: 0.4 + random() * 0.7,
  }));
}
function Motes() {
  const puzzle = useGame((s) => s.puzzle);
  const quality = useGame((s) => s.quality);
  const mesh = useRef<InstancedMesh>(null);
  const lastUpdate = useRef(0);
  const seeds = useMemo(() => createMoteSeeds(MOTE_COUNT), []);
  const dummy = useMemo(() => new Object3D(), []);
  const revealed = puzzle.powers[0];
  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const t = clock.elapsedTime;
    if (quality !== "high" && t - lastUpdate.current < 1 / 30) return;
    lastUpdate.current = t;
    const boost = revealed ? 1 : 0;
    const count =
      quality === "low" ? 20 : quality === "medium" ? 32 : seeds.length;
    instanced.count = count;
    for (let i = 0; i < count; i++) {
      const seed = seeds[i];
      const speed = seed.speed * (1 + boost * 0.9);
      const angle = t * speed + seed.phase;
      const drift = seed.drift * (1 + boost * 0.5);
      dummy.position.set(
        seed.x + Math.sin(angle) * drift,
        seed.y + Math.sin(angle * 0.6 + seed.phase) * 0.3,
        seed.z + Math.cos(angle * 0.7) * drift,
      );
      dummy.scale.setScalar(1 + boost * 0.35);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MOTE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.045, 6, 6]} />
      <meshBasicMaterial
        color="#e9c77a"
        transparent
        opacity={revealed ? 0.8 : 0.5}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
const SPLASH_POOL = 10;
const SPLASH_PARTICLES = 10;
const SPLASH_LIFETIME = 0.6;
type SplashSlot = { active: boolean; x: number; z: number; age: number };
function Splashes() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const initialized = useRef(false);
  const slots = useMemo<SplashSlot[]>(
    () =>
      Array.from({ length: SPLASH_POOL }, () => ({
        active: false,
        x: 0,
        z: 0,
        age: 0,
      })),
    [],
  );
  useFrame((_, delta) => {
    if (
      initialized.current &&
      runtime.splashes.length === 0 &&
      !slots.some((slot) => slot.active)
    )
      return;
    const dt = Math.min(delta, 0.05);
    while (runtime.splashes.length) {
      const next = runtime.splashes.shift();
      if (!next) break;
      const slot = slots.find((s) => !s.active) ?? slots[0];
      slot.active = true;
      slot.age = 0;
      slot.x = next.x;
      slot.z = next.z;
    }
    const instanced = mesh.current;
    if (!instanced) return;
    let i = 0;
    for (const slot of slots) {
      const t = slot.age / SPLASH_LIFETIME;
      for (let p = 0; p < SPLASH_PARTICLES; p++, i++) {
        if (!slot.active) {
          dummy.scale.setScalar(0);
        } else {
          const angle = (p / SPLASH_PARTICLES) * Math.PI * 2 + p * 1.7;
          const radius = t * 1.5;
          dummy.position.set(
            slot.x + Math.cos(angle) * radius,
            -0.2 + Math.sin(Math.min(1, t * 1.8) * Math.PI) * 0.55,
            slot.z + Math.sin(angle) * radius,
          );
          dummy.scale.setScalar(Math.max(0, 1 - t) * 0.15);
        }
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      if (slot.active) {
        slot.age += dt;
        if (slot.age > SPLASH_LIFETIME) slot.active = false;
      }
    }
    instanced.instanceMatrix.needsUpdate = true;
    initialized.current = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, SPLASH_POOL * SPLASH_PARTICLES]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#eaf6f2"
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
const MOUNTAIN_SEEDS = [
  { x: -46, z: -6, scale: 0.0011, rotationY: 0.4 },
  { x: 44, z: -18, scale: 0.0013, rotationY: 2.1 },
  { x: -30, z: -58, scale: 0.0012, rotationY: 1.1 },
  { x: 34, z: -52, scale: 0.001, rotationY: 3.4 },
  { x: 4, z: 46, scale: 0.0014, rotationY: 0.8 },
  { x: -14, z: -72, scale: 0.0011, rotationY: 4.2 },
];
function Mountains() {
  const template = useLoader(FBXLoader, "/assets/models/mountain.fbx");
  const geometry = useMemo(() => {
    template.updateMatrixWorld(true);
    let found: Mesh | undefined;
    template.traverse((child) => {
      if (!found && (child as Mesh).isMesh && child.name.includes("LOD1"))
        found = child as Mesh;
    });
    if (!found) return undefined;
    const geo = found.geometry.clone();
    geo.applyMatrix4(found.matrixWorld);
    return geo;
  }, [template]);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#3c4a3a", roughness: 1 }),
    [],
  );
  const seeds = useMemo(
    () => MOUNTAIN_SEEDS.map((seed) => ({ ...seed, y: -4 })),
    [],
  );
  if (!geometry) return null;
  return (
    <StaticInstances geometry={geometry} material={material} seeds={seeds} />
  );
}
const BLOB_SEEDS = [
  { x: -14, z: -2, scale: 1.1, rotationY: 0.3 },
  { x: 15, z: -4, scale: 0.9, rotationY: 1.7 },
  { x: -16, z: -20, scale: 1.3, rotationY: 2.4 },
  { x: 17, z: -24, scale: 1.0, rotationY: 0.6 },
  { x: 0, z: 15, scale: 1.2, rotationY: 1.1 },
  { x: 0, z: -37, scale: 1.1, rotationY: 2.9 },
];
function WaterBlobs() {
  const gltf = useLoader(GLTFLoader, "/assets/models/water-blob.glb");
  const blob = useMemo(() => {
    let found: Mesh | undefined;
    gltf.scene.traverse((child) => {
      if (!found && (child as Mesh).isMesh) found = child as Mesh;
    });
    return found;
  }, [gltf]);
  if (!blob) return null;
  const seeds = BLOB_SEEDS.map((seed) => ({ ...seed, y: -0.16 }));
  return (
    <StaticInstances
      geometry={blob.geometry}
      material={blob.material}
      seeds={seeds}
    />
  );
}

const COAST_ROCK_SEEDS = Array.from({ length: 18 }, (_, i) => ({
  x: (i % 2 ? 1 : -1) * (6.8 + (i % 3) * 0.7),
  y: -1.9,
  z: 6 - Math.floor(i / 2) * 4,
  scale: 1.5 + (i % 3) * 0.3,
  rotationX: 0.2,
  rotationY: i * 0.7,
  rotationZ: 0.12,
}));
function CoastRocks() {
  const geometry = useMemo(() => new DodecahedronGeometry(1, 0), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#425641", roughness: 1 }),
    [],
  );
  return (
    <StaticInstances
      geometry={geometry}
      material={material}
      seeds={COAST_ROCK_SEEDS}
      castShadow
    />
  );
}
export const ATMOSPHERE = {
  sky: "#a9d9e8",
  fog: "#c2dde2",
  revealedSky: "#b9dbe3",
  revealedFog: "#c9dfe2",
  denseSky: "#e1ebeb",
  denseFog: "#e1e9e7",
  defaultNear: 26,
  defaultFar: 78,
  revealedNear: 17,
  revealedFar: 68,
  denseNear: 1.5,
  denseFar: 30,
} as const;
export function AtmosphereFog() {
  const puzzle = useGame((s) => s.puzzle);
  const scene = useThree((state) => state.scene);
  const fog = useRef<Fog>(null);
  const fogTarget = useMemo(() => new Color(), []);
  const skyTarget = useMemo(() => new Color(), []);
  useFrame((_, delta) => {
    const current = fog.current;
    if (!current) return;
    const dense = puzzle.powers[1];
    const revealed = puzzle.powers[0];
    fogTarget.set(
      dense
        ? ATMOSPHERE.denseFog
        : revealed
          ? ATMOSPHERE.revealedFog
          : ATMOSPHERE.fog,
    );
    skyTarget.set(
      dense
        ? ATMOSPHERE.denseSky
        : revealed
          ? ATMOSPHERE.revealedSky
          : ATMOSPHERE.sky,
    );
    const amount = 1 - Math.exp(-delta * 1.8);
    current.color.lerp(fogTarget, amount);
    current.near = MathUtils.lerp(
      current.near,
      dense
        ? ATMOSPHERE.denseNear
        : revealed
          ? ATMOSPHERE.revealedNear
          : ATMOSPHERE.defaultNear,
      amount,
    );
    current.far = MathUtils.lerp(
      current.far,
      puzzle.powers[1]
        ? ATMOSPHERE.denseFar
        : puzzle.powers[0]
          ? ATMOSPHERE.revealedFar
          : ATMOSPHERE.defaultFar,
      amount,
    );
    if (scene.background instanceof Color)
      scene.background.lerp(skyTarget, amount);
  });
  return (
    <fog
      ref={fog}
      attach="fog"
      args={[ATMOSPHERE.fog, ATMOSPHERE.defaultNear, ATMOSPHERE.defaultFar]}
    />
  );
}
export default function World({ running }: { running: boolean }) {
  const puzzle = useGame((s) => s.puzzle);
  const contrast = useGame((s) => s.contrast);
  const quality = useGame((s) => s.quality);
  const reduced = useGame((s) => s.reduced);
  // Always mounted so the loader resolves during the initial loading screen —
  // mounting it lazily (only once the bridge is revealed) would suspend the
  // whole Physics/Character subtree mid-game and reset everyone to spawn.
  const bridgeModel = useLoader(GLTFLoader, BRIDGE_MODEL_URL);
  return (
    <>
      {ISLANDS.map((island) => (
        <Island key={island.seed} {...island} />
      ))}
      <BananaGroves />
      <group position={[0, ISLAND_SURFACE_Y, 0]}>
        <Bridge
          gltf={bridgeModel}
          z={BRIDGE.z}
          length={BRIDGE.length}
          built={puzzle.bridge}
          revealed={puzzle.powers[0] || puzzle.bridge}
          running={running}
          reduced={reduced}
          contrast={contrast}
        />
        {!puzzle.powers[0] && !puzzle.bridge && (
          <BridgePlaceholder contrast={contrast} />
        )}
        <Anchor
          {...anchors.bridge}
          color="#eac369"
          active={puzzle.powers[0] && !puzzle.bridge}
          shape="reveal"
        />
        {!puzzle.bridge &&
          anchors.logs.map((log, i) => (
            <LogSite
              key={i}
              x={log.x}
              z={log.z}
              collected={puzzle.logs[i]}
              highlight={puzzle.powers[0]}
            />
          ))}
        {puzzle.bridge && (
          <>
            <Anchor
              {...anchors.reveal}
              color="#eac369"
              active={puzzle.powers[0]}
              shape="reveal"
            />
            <Anchor
              {...anchors.silence}
              color="#e7edd9"
              active={puzzle.powers[1]}
              shape="silence"
            />
          </>
        )}
        <WisdomTotem
          x={anchors.bridgeBuild.x}
          z={anchors.bridgeBuild.z}
          complete={puzzle.bridge}
          running={running}
        />
        <WisdomTotem
          z={anchors.finalBuild.z}
          complete={puzzle.built}
          running={running}
        />
        {puzzle.bridge && !puzzle.built && (
          <>
            {!puzzle.unlocked && (
              <group
                position={[anchors.finalBuild.x, 0, anchors.finalBuild.z]}
              >
                <RigidBody type="fixed" colliders={false}>
                  <CylinderCollider args={[1.7, 1.6]} position={[0, 1.7, 0]} />
                </RigidBody>
                <NoiseBarrier
                  active={puzzle.powers[0] && puzzle.powers[1]}
                  visible={
                    puzzle.powers[0] &&
                    puzzle.powers[1] &&
                    puzzle.selected === 0
                  }
                  contrast={contrast}
                  digit={LOCK_CODE[puzzle.codeProgress]}
                  step={puzzle.codeProgress}
                />
              </group>
            )}
            <Padlock unlocked={puzzle.unlocked} />
          </>
        )}
      </group>
      <CoastRocks />
      <mesh position={[0, -8, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#3a3820" roughness={0.9} />
      </mesh>
      <mesh
        position={[0, 0.03, -10]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.55, 1, 1]}
      >
        <circleGeometry args={[9, 40]} />
        <meshBasicMaterial
          color="#f4cf8a"
          transparent
          opacity={0.09}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Two pieces leave the longer -15..-4 bridge chasm uncovered. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[24, 0.5, 14.5]} position={[0, -0.8, 10.5]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[24, 0.5, 15]} position={[0, -0.8, -30]} />
      </RigidBody>
      {/* Continuous sea surrounding both islands, including the strait under the
          bridge. Sized well past the fog's far distance (~65-72) so the edge
          fades into the horizon instead of showing as a hard line. */}
      <Water width={300} length={300} position={[0, -0.2, -10]} segments={12} />
      {quality !== "low" && <WaterBlobs />}
      <Mountains />
      <Motes />
      <Splashes />
    </>
  );
}
