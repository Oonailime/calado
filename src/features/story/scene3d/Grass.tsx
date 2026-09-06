import { useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box3,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { CLEARING_RADIUS, CONVERGENCE_POINT, pathSegments } from "./cameraRig";

const GRASS_URL = "/assets/models/grass/grass.glb";
const TARGET_HEIGHT = 0;
const TUFTS_PER_UNIT = 0;
// Grass sits in a band to each side of the path, not on the stones and not
// far off into open ground — a gap right over the tiles, then a border.
const GAP_FROM_PATH = 0;
const BAND_WIDTH = 0;

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The kit's own file bundles two grass variants side by side at odd
// world-scale coordinates (a multi-object export artifact, same story as
// the other Quaternius packs already used in this project) — pick the
// first mesh found and bake+normalize it, the same technique already
// proven in Vegetation.tsx's useNatureMesh.
function useGrassMesh(template: Object3D) {
  return useMemo(() => {
    let found: Mesh | undefined;
    template.traverse((child) => {
      if (!found && (child as Mesh).isMesh) found = child as Mesh;
    });
    if (!found) return undefined;
    found.updateWorldMatrix(true, false);
    const geometry = found.geometry.clone();
    geometry.applyMatrix4(found.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    const size = new Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    geometry.scale(scale, scale, scale);
    geometry.translate(0, -box.min.y * scale, 0);
    const material = new MeshStandardMaterial({
      color: "#5b8a45",
      roughness: 1,
    });
    return { geometry, material };
  }, [template]);
}

// Scattered only in a border alongside the stone path itself (both sides),
// not across the open ground — one tuft batch per path segment.
function buildSeeds() {
  const random = createSeededRandom(7823);
  const seeds: { x: number; z: number; scale: number; rotationY: number }[] = [];
  for (const [from, to] of pathSegments()) {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const dirX = (to.x - from.x) / length;
    const dirZ = (to.z - from.z) / length;
    const perpX = -dirZ;
    const perpZ = dirX;
    const count = Math.max(1, Math.round(length * TUFTS_PER_UNIT));
    for (let i = 0; i < count; i++) {
      const t = random();
      const side = (random() < 0.5 ? -1 : 1) * (GAP_FROM_PATH + random() * BAND_WIDTH);
      const x = from.x + (to.x - from.x) * t + perpX * side;
      const z = from.z + (to.z - from.z) * t + perpZ * side;
      // The last segment runs toward the clearing, so a tuft can still land
      // on the sand even though the path itself now stops short of it.
      if (Math.hypot(x - CONVERGENCE_POINT.x, z - CONVERGENCE_POINT.z) < CLEARING_RADIUS)
        continue;
      seeds.push({
        x,
        z,
        scale: 0.7 + random() * 0.8,
        rotationY: random() * Math.PI * 2,
      });
    }
  }
  return seeds;
}

export default function Grass() {
  const gltf = useLoader(GLTFLoader, GRASS_URL);
  const source = useGrassMesh(gltf.scene);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const seeds = useMemo(() => buildSeeds(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    seeds.forEach((seed, index) => {
      dummy.position.set(seed.x, 0, seed.z);
      dummy.rotation.set(0, seed.rotationY, 0);
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, seeds, source]);
  if (!source) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[source.geometry, source.material, seeds.length]}
    />
  );
}
