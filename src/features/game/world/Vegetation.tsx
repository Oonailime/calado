import { useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { InstancedMesh, Mesh, MeshStandardMaterial, Object3D } from "three";
import { islandEdgeDistance } from "./terrain";

const NATURE_DIR = "/assets/models/nature/";

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The source FBX materials reference an external texture atlas that isn't
// bundled here, which left them rendering invisible/untextured — flat
// colors instead, which also matches this game's stylized look.
//
// Extracting `.geometry` alone discards whatever local transform the mesh
// node carries inside the FBX hierarchy (a common baked-in offset/rotation
// from the Blender/FBX export pipeline), which left instances misplaced or
// edge-on to the camera. Baking matrixWorld into a cloned geometry first
// makes the result usable standalone, the same way the source hierarchy
// would have rendered it.
//
// `colors` may be a single flat color, or one color per original material
// slot (e.g. the palm tree keeps its trunk/frond geometry groups even
// though the atlas texture is gone, so index 0 can stay brown while the
// rest stays green instead of tinting the whole tree one color).
export function useNatureMesh(name: string, colors: string | string[]) {
  const template = useLoader(FBXLoader, `${NATURE_DIR}${name}.fbx`);
  const key = Array.isArray(colors) ? colors.join(",") : colors;
  return useMemo(() => {
    template.updateMatrixWorld(true);
    let found: Mesh | undefined;
    template.traverse((child) => {
      if (!found && (child as Mesh).isMesh) found = child as Mesh;
    });
    if (!found) return undefined;
    const geometry = found.geometry.clone();
    geometry.applyMatrix4(found.matrixWorld);
    geometry.computeBoundingBox();
    // Imported mesh origins vary; place the bottom of every asset on the soil.
    geometry.translate(0, -(geometry.boundingBox?.min.y ?? 0), 0);
    const material = Array.isArray(colors)
      ? colors.map((color) => new MeshStandardMaterial({ color, roughness: 0.92 }))
      : new MeshStandardMaterial({ color: colors, roughness: 0.92 });
    return { geometry, material };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, key]);
}

type Placement = { x: number; z: number; scale: number; rotationY: number };
function ring(
  count: number,
  radiusX: number,
  radiusZ: number,
  seed: number,
  scaleRange: [number, number],
  jitter = 0.5,
): Placement[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.3;
    const r = 1 + (random() - 0.5) * jitter;
    return {
      x: Math.cos(angle) * radiusX * r,
      z: Math.sin(angle) * radiusZ * r,
      scale: scaleRange[0] + random() * (scaleRange[1] - scaleRange[0]),
      rotationY: random() * Math.PI * 2,
    };
  });
}
function scatter(
  count: number,
  halfWidth: number,
  halfDepth: number,
  seed: number,
  scaleRange: [number, number],
): Placement[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: (random() - 0.5) * halfWidth * 2,
    z: (random() - 0.5) * halfDepth * 2,
    scale: scaleRange[0] + random() * (scaleRange[1] - scaleRange[0]),
    rotationY: random() * Math.PI * 2,
  }));
}

function Instances({
  name,
  color,
  yOffset = 0,
  places,
}: {
  name: string;
  color: string | string[];
  yOffset?: number;
  places: Placement[];
}) {
  const source = useNatureMesh(name, color);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    places.forEach((place, index) => {
      dummy.position.set(place.x, yOffset, place.z);
      dummy.rotation.set(0, place.rotationY, 0);
      dummy.scale.setScalar(place.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, places, yOffset]);
  if (!source) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[source.geometry, source.material, places.length]}
      castShadow={name.startsWith("PalmTree")}
      receiveShadow={name.startsWith("PalmTree") || name.startsWith("Bush")}
    />
  );
}

export function IslandVegetation({
  x,
  y,
  z,
  halfWidth,
  halfDepth,
  seed,
}: {
  x: number;
  y: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  seed: number;
}) {
  const palms = useMemo(
    () =>
      ring(
        6,
        halfWidth * 0.85,
        halfDepth * 0.85,
        seed + 1,
        [0.0056, 0.01],
        0.4,
      ),
    [halfWidth, halfDepth, seed],
  );
  const rocks = useMemo(
    () =>
      ring(
        10,
        halfWidth * 1.05,
        halfDepth * 1.05,
        seed + 2,
        [0.0034, 0.008],
        0.3,
      ),
    [halfWidth, halfDepth, seed],
  );
  const bushes = useMemo(
    () =>
      scatter(
        8,
        halfWidth * 0.75,
        halfDepth * 0.75,
        seed + 3,
        [0.0032, 0.0056],
      ),
    [halfWidth, halfDepth, seed],
  );
  const grass = useMemo(
    () =>
      scatter(24, halfWidth * 0.9, halfDepth * 0.9, seed + 4, [0.0025, 0.0045]),
    [halfWidth, halfDepth, seed],
  );
  return (
    <group position={[x, y, z]}>
      <Instances
        name="PalmTree_1"
        color={["#6b4a30", "#4c7a4a", "#4c7a4a", "#4c7a4a"]}
        places={palms.filter(
          (p) => islandEdgeDistance(x + p.x, z + p.z) < -0.2,
        )}
      />
      <Instances
        name="Rock_1"
        color="#8a8577"
        yOffset={-0.05}
        places={rocks.filter(
          (p) => islandEdgeDistance(x + p.x, z + p.z) < -0.2,
        )}
      />
      <Instances name="Bush_1" color="#4f7d49" places={bushes} />
      <Instances name="Grass" color="#5c9153" places={grass} />
    </group>
  );
}
