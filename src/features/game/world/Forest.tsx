import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box3,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { ISLAND_SURFACE_Y } from "./layout";
import { runtime } from "../state/store";
import type { Vec3 } from "../types";
import {
  ARBOREAL_SITES,
  TREE_MODEL_URL,
  VINE_MODEL_URL,
  vineCurvePoints,
  vineCurvePointsToGrip,
  vineLeafWind,
  type ArborealSite,
} from "./forestLayout";

export type ForestAsset = {
  parts: { geometry: BufferGeometry; material: Material | Material[] }[];
};
type ForestPlacement = {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
};

const ULTRA_TREES: readonly ForestPlacement[] = [
  { x: -8.2, z: 11.7, scale: 0.48, rotationY: 0.2 },
  { x: 8.5, z: 12.3, scale: 0.52, rotationY: 1.1 },
  { x: -8.7, z: 0.2, scale: 0.45, rotationY: 2.4 },
  { x: 8.8, z: -0.1, scale: 0.5, rotationY: -0.5 },
  { x: -4.6, z: 14.1, scale: 0.42, rotationY: 1.9 },
  { x: 4.2, z: 14.6, scale: 0.46, rotationY: 2.8 },
  { x: -8.9, z: -22.4, scale: 0.51, rotationY: 0.7 },
  { x: 8.9, z: -21.7, scale: 0.47, rotationY: 1.6 },
  { x: -9.2, z: -35.1, scale: 0.49, rotationY: -0.3 },
  { x: 9.1, z: -34.4, scale: 0.54, rotationY: 2.2 },
  { x: -4.7, z: -37.1, scale: 0.44, rotationY: 1.3 },
  { x: 4.9, z: -37.4, scale: 0.46, rotationY: 2.9 },
] as const;

const ULTRA_VINES: readonly ForestPlacement[] = [
  { x: -8.1, z: 10.9, scale: 0.17, rotationY: 0.3 },
  { x: 8.2, z: 11.4, scale: 0.18, rotationY: -0.5 },
  { x: -8.1, z: -34.3, scale: 0.17, rotationY: 0.8 },
  { x: 8.1, z: -33.7, scale: 0.18, rotationY: -0.7 },
] as const;

function collectMeshes(scene: Object3D): Mesh[] {
  scene.updateMatrixWorld(true);
  const sources: Mesh[] = [];
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) sources.push(child as Mesh);
  });
  return sources;
}

function partsFromMeshes(meshes: Mesh[], shiftY: number) {
  return meshes.map((mesh) => {
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.translate(0, shiftY, 0);
    const materials = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
    for (const material of Array.isArray(materials) ? materials : [materials]) {
      material.side = DoubleSide;
      material.needsUpdate = true;
    }
    return { geometry, material: materials };
  });
}

export function prepareAsset(scene: Object3D): ForestAsset | undefined {
  const meshes = collectMeshes(scene);
  if (!meshes.length) return undefined;
  const box = new Box3().setFromObject(scene);
  // Trees grow from y=0; vines are rotated 180° and hang down from it.
  return { parts: partsFromMeshes(meshes, -box.min.y) };
}

function ForestPartInstances({
  geometry,
  material,
  placements,
  vine = false,
}: {
  geometry: BufferGeometry;
  material: Material | Material[];
  placements: readonly ForestPlacement[];
  vine?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    placements.forEach((placement, index) => {
      dummy.position.set(
        placement.x,
        vine ? ISLAND_SURFACE_Y + 4.65 : ISLAND_SURFACE_Y,
        placement.z,
      );
      dummy.rotation.set(vine ? Math.PI : 0, placement.rotationY, 0);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, placements, vine]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, placements.length]}
      // These are distant Ultra-only dressing. Interactive trees keep their
      // full shadows; repeating the imported canopy in the 4096px shadow map
      // is disproportionately expensive and barely visible at this distance.
      castShadow={false}
      receiveShadow={!vine}
    />
  );
}

function ForestInstances({
  asset,
  placements,
  vine = false,
}: {
  asset: ForestAsset;
  placements: readonly ForestPlacement[];
  vine?: boolean;
}) {
  return (
    <group>
      {asset.parts.map((part, index) => (
        <ForestPartInstances
          key={index}
          geometry={part.geometry}
          material={part.material}
          placements={placements}
          vine={vine}
        />
      ))}
    </group>
  );
}

export function TreeMesh({
  asset,
  position,
  scale,
  rotationY = 0,
}: {
  asset: ForestAsset;
  position: [number, number, number];
  scale: number;
  rotationY?: number;
}) {
  return (
    <group position={position} scale={scale} rotation-y={rotationY}>
      {asset.parts.map((part, index) => (
        <mesh
          key={index}
          geometry={part.geometry}
          material={part.material}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

export function VineMesh({
  asset,
  position,
  scale,
  rotationY = 0,
}: {
  asset: ForestAsset;
  position: [number, number, number];
  scale: number;
  rotationY?: number;
}) {
  return (
    <group position={position} scale={scale} rotation={[Math.PI, rotationY, 0]}>
      {asset.parts.map((part, index) => (
        <mesh
          key={index}
          geometry={part.geometry}
          material={part.material}
          castShadow
        />
      ))}
    </group>
  );
}

export function SegmentedVine({
  site,
  grip,
}: {
  site: ArborealSite;
  grip?: Readonly<Vec3>;
}) {
  const segmentRefs = useRef<Array<Mesh | null>>([]);
  const leafRefs = useRef<Array<Mesh | null>>([]);
  const segmentGeometry = useMemo(
    () => new CylinderGeometry(0.035, 0.047, 1, 7),
    [],
  );
  const leafGeometry = useMemo(() => new SphereGeometry(1, 7, 4), []);
  const vineMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#456b32", roughness: 0.96 }),
    [],
  );
  const leafMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#668b42", roughness: 0.9 }),
    [],
  );
  const from = useMemo(() => new Vector3(), []);
  const to = useMemo(() => new Vector3(), []);
  const tangent = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const rotation = useMemo(() => new Quaternion(), []);

  useFrame(({ clock }) => {
    let heldGrip: Readonly<Vec3> | undefined = grip;
    for (const contacts of runtime.vineContacts) {
      for (const hand of [contacts.left, contacts.right])
        if (hand?.siteId === site.id) heldGrip = hand.grip;
    }
    const active = !!heldGrip || runtime.activeVine?.siteId === site.id;
    const elapsed = active
      ? (runtime.activeVine?.elapsed ?? 0)
      : clock.elapsedTime;
    const physicalGrip =
      heldGrip ??
      (runtime.activeVine?.siteId === site.id
        ? runtime.activeVine.grip
        : undefined);
    const points = physicalGrip
      ? vineCurvePointsToGrip(site, physicalGrip, segmentRefs.current.length)
      : vineCurvePoints(site, elapsed, active, segmentRefs.current.length);
    segmentRefs.current.forEach((segment, index) => {
      if (!segment) return;
      const start = points[index];
      const end = points[index + 1];
      from.set(start.x, start.y, start.z);
      to.set(end.x, end.y, end.z);
      tangent.subVectors(to, from);
      const length = tangent.length();
      segment.position.copy(from).add(to).multiplyScalar(0.5);
      rotation.setFromUnitVectors(up, tangent.normalize());
      segment.quaternion.copy(rotation);
      segment.scale.set(1, length, 1);
    });
    leafRefs.current.forEach((leaf, index) => {
      if (!leaf) return;
      const pointIndex = Math.min(points.length - 2, index * 2 + 2);
      const point = points[pointIndex];
      const wind = vineLeafWind(elapsed, index, active);
      leaf.position.set(
        point.x + (index % 2 === 0 ? 0.11 : -0.11),
        point.y,
        point.z,
      );
      leaf.rotation.set(wind.x, wind.y, wind.z + (index % 2 ? -0.55 : 0.55));
    });
  });

  const segmentCount = 14;
  const leafCount = 6;
  return (
    <group
      position={[site.vine.x, site.vine.attachY, site.vine.z]}
      rotation-y={site.vine.rotationY}
    >
      {Array.from({ length: segmentCount }, (_, index) => (
        <mesh
          key={`segment-${index}`}
          ref={(mesh) => {
            segmentRefs.current[index] = mesh;
          }}
          geometry={segmentGeometry}
          material={vineMaterial}
          castShadow
        />
      ))}
      {Array.from({ length: leafCount }, (_, index) => (
        <mesh
          key={`leaf-${index}`}
          ref={(mesh) => {
            leafRefs.current[index] = mesh;
          }}
          geometry={leafGeometry}
          material={leafMaterial}
          scale={[0.13, 0.025, 0.28]}
          castShadow
        />
      ))}
    </group>
  );
}

function TreeCheckpoint({
  site,
  surfaceY,
  radius,
}: {
  site: ArborealSite;
  surfaceY: number;
  radius: number;
}) {
  const halfHeight = 0.22;
  return (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider
        args={[halfHeight, radius]}
        position={[site.tree.x, surfaceY - halfHeight, site.tree.z]}
      />
      <mesh
        position={[site.tree.x, surfaceY - halfHeight, site.tree.z]}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[radius, radius * 1.08, halfHeight * 2, 18]} />
        <meshStandardMaterial color="#745238" roughness={0.98} />
      </mesh>
      <mesh
        position={[site.tree.x, surfaceY + 0.012, site.tree.z]}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry args={[radius * 0.65, radius * 0.9, 20]} />
        <meshStandardMaterial color="#9a7650" roughness={1} />
      </mesh>
    </RigidBody>
  );
}

export function useForestAssets(
  treeUrl: string = TREE_MODEL_URL,
  vineUrl: string = VINE_MODEL_URL,
) {
  const tree = useLoader(GLTFLoader, treeUrl);
  const vine = useLoader(GLTFLoader, vineUrl);
  return useMemo(
    () => ({
      tree: prepareAsset(tree.scene),
      vine: prepareAsset(vine.scene),
    }),
    [tree, vine],
  );
}

export function useTreeAsset(treeUrl: string = TREE_MODEL_URL) {
  const tree = useLoader(GLTFLoader, treeUrl);
  return useMemo(() => prepareAsset(tree.scene), [tree]);
}

// The per-site tree+vine+collider group, shared by the island map and any
// other course built from an ArborealSite list (see Canopy.tsx) — surfaceY
// is the world Y each tree is planted at, since different courses don't
// necessarily share one ground height.
export function ArborealSites({
  sites,
  treeAsset,
  surfaceY = ISLAND_SURFACE_Y,
  trunkRadius = 0.48,
  checkpoints = false,
  checkpointRadius = 2.25,
}: {
  sites: readonly ArborealSite[];
  treeAsset: ForestAsset;
  surfaceY?: number;
  trunkRadius?: number;
  checkpoints?: boolean;
  checkpointRadius?: number;
}) {
  return (
    <>
      {sites.map((site) => (
        <group key={site.id}>
          <TreeMesh
            asset={treeAsset}
            position={[site.tree.x, surfaceY, site.tree.z]}
            scale={site.tree.scale}
            rotationY={site.tree.rotationY}
          />
          <SegmentedVine site={site} />
          {checkpoints && (
            <TreeCheckpoint
              site={site}
              surfaceY={surfaceY}
              radius={checkpointRadius}
            />
          )}
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider
              args={[1.8, trunkRadius]}
              position={[site.tree.x, surfaceY + 1.8, site.tree.z]}
            />
          </RigidBody>
        </group>
      ))}
    </>
  );
}

export default function Forest({ ultra }: { ultra: boolean }) {
  const assets = useForestAssets();
  if (!assets.tree || !assets.vine) return null;
  const treeAsset = assets.tree;
  const vineAsset = assets.vine;
  return (
    <>
      <ArborealSites sites={ARBOREAL_SITES} treeAsset={treeAsset} />
      {ultra && (
        <>
          <ForestInstances asset={treeAsset} placements={ULTRA_TREES} />
          <ForestInstances asset={vineAsset} placements={ULTRA_VINES} vine />
        </>
      )}
    </>
  );
}
