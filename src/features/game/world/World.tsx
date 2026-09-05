import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AdditiveBlending,
  Color,
  DodecahedronGeometry,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
} from "three";
import { runtime, useGame } from "../state/store";
import { anchors } from "../state/rules";
import { Water } from "./Water";
import { Bridge, BRIDGE_MODEL_URL } from "./Bridge";
import { IslandVegetation } from "./Vegetation";
import {
  beachRampGeometry,
  islandGeometry,
  organicIslandShape,
} from "./terrain";
import { BRIDGE, ISLANDS, ISLAND_BASE_Y, ISLAND_SURFACE_Y } from "./layout";

function Block({
  position,
  size,
  color = "#73816a",
  collider = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  collider?: boolean;
}) {
  const mesh = (
    <mesh position={position} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.94} />
    </mesh>
  );
  return collider ? (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={position}
      />
      {mesh}
    </RigidBody>
  ) : (
    mesh
  );
}
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
      new MeshStandardMaterial({ color: "#d2b777", roughness: 1 }),
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
function Mechanism({
  z,
  complete,
  running,
}: {
  z: number;
  complete: boolean;
  running: boolean;
}) {
  const rotor = useRef<Group>(null);
  useFrame((_, delta) => {
    if (rotor.current && complete && running)
      rotor.current.rotation.y += Math.min(delta, 0.04) * 0.55;
  });
  return (
    <group position={[0, 0, z]}>
      <Block position={[0, 0.24, 0]} size={[1.8, 0.48, 1.8]} color="#6d7862" />
      <group ref={rotor} position={[0, 1.25, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={
              complete
                ? [0, i * 0.32, 0]
                : [(i - 1) * 0.65, 0.15 + (i % 2) * 0.45, 0]
            }
            rotation={
              complete ? [0, (i * Math.PI) / 3, 0] : [0.3, i * 0.7, 0.4]
            }
            castShadow
          >
            <boxGeometry args={[0.5, 0.25, 0.5]} />
            <meshStandardMaterial
              color={["#c19b55", "#dddcc2", "#976945"][i]}
              emissive={complete ? "#948457" : "#000000"}
              emissiveIntensity={0.45}
            />
          </mesh>
        ))}
        {complete && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.85, 0.025, 8, 48]} />
            <meshStandardMaterial
              color="#dbbc78"
              emissive="#d8ba75"
              emissiveIntensity={0.6}
            />
          </mesh>
        )}
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
const FOG_DEFAULT = "#243e32";
const FOG_REVEALED = "#3a4a52";
const FOG_SILENCED = "#dfe6da";
export function AtmosphereFog() {
  const puzzle = useGame((s) => s.puzzle);
  const fog = useRef<Fog>(null);
  const target = useMemo(() => new Color(), []);
  useFrame((_, delta) => {
    const current = fog.current;
    if (!current) return;
    target.set(
      puzzle.powers[1]
        ? FOG_SILENCED
        : puzzle.powers[0]
          ? FOG_REVEALED
          : FOG_DEFAULT,
    );
    const amount = Math.min(delta * 1.6, 1);
    current.color.lerp(target, amount);
    current.far = MathUtils.lerp(
      current.far,
      puzzle.powers[1] ? 72 : 65,
      amount,
    );
  });
  return <fog ref={fog} attach="fog" args={[FOG_DEFAULT, 22, 65]} />;
}
export default function World({ running }: { running: boolean }) {
  const puzzle = useGame((s) => s.puzzle);
  const contrast = useGame((s) => s.contrast);
  const quality = useGame((s) => s.quality);
  const gate = useRef<Group>(null);
  // Always mounted so the loader resolves during the initial loading screen —
  // mounting it lazily (only once the bridge is revealed) would suspend the
  // whole Physics/Character subtree mid-game and reset everyone to spawn.
  const bridgeModel = useLoader(GLTFLoader, BRIDGE_MODEL_URL);
  useFrame(({ clock }) => {
    if (gate.current && running)
      gate.current.rotation.z =
        puzzle.powers[1] || puzzle.built
          ? 0
          : Math.sin(clock.elapsedTime * 2) * 0.12;
  });
  const bridge = puzzle.bridge || puzzle.powers[0];
  return (
    <>
      {ISLANDS.map((island) => (
        <Island key={island.seed} {...island} />
      ))}
      <group position={[0, ISLAND_SURFACE_Y, 0]}>
        {bridge ? (
          <Bridge
            gltf={bridgeModel}
            z={BRIDGE.z}
            length={BRIDGE.length}
            built={puzzle.bridge}
            revealed={puzzle.powers[0]}
          />
        ) : (
          <mesh position={[0, -0.12, -9.5]}>
            <boxGeometry args={[3.2, 0.28, 7]} />
            <meshBasicMaterial
              wireframe
              color={contrast ? "#fff48f" : "#edc16c"}
              transparent
              opacity={0.07}
            />
          </mesh>
        )}
        <Anchor
          {...anchors.bridge}
          color="#eac369"
          active={puzzle.powers[0] && !puzzle.bridge}
          shape="reveal"
        />
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
        <Mechanism z={-15.5} complete={puzzle.bridge} running={running} />
        <Mechanism z={-26} complete={puzzle.built} running={running} />
        {!puzzle.built && (
          <>
            {!puzzle.powers[1] && (
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[7, 1.1, 0.15]} position={[0, 1, -24]} />
              </RigidBody>
            )}
            <group ref={gate} position={[0, 1.2, -24]}>
              {[0, 1, 2, 3, 4].map((i) => (
                <mesh key={i} position={[0, i * 0.28 - 0.55, 0]}>
                  <boxGeometry args={[13, 0.045, 0.06]} />
                  <meshBasicMaterial
                    color={contrast ? "#ffffff" : "#d8e6cb"}
                    transparent
                    opacity={puzzle.powers[1] ? 0.05 : 0.5}
                  />
                </mesh>
              ))}
            </group>
          </>
        )}
        {[-5.7, 5.7].map((x) => (
          <group key={x}>
            {[-3, 4].map((z) => (
              <group key={z}>
                <Block
                  position={[x, 0.7, z]}
                  size={[0.45, 1.4, 0.45]}
                  color="#596950"
                />
                <mesh position={[x, 1.55, z]}>
                  <octahedronGeometry args={[0.23]} />
                  <meshStandardMaterial
                    color="#d6b779"
                    emissive="#d6b779"
                    emissiveIntensity={0.8}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        {[-6.4, 6.4].map((x) => (
          <group key={x}>
            {[-14, -20, -28].map((z) => (
              <Block
                key={z}
                position={[x, 1.35, z]}
                size={[0.6, 2.7, 0.65]}
                color="#52644e"
              />
            ))}
          </group>
        ))}
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
      {/* Two pieces, deliberately leaving the -13..-6 bridge chasm uncovered. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[19, 0.5, 10]} position={[0, -0.8, 4]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[19, 0.5, 12.5]} position={[0, -0.8, -25.5]} />
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
