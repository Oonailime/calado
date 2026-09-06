import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BEACH_SAND_COLOR,
  BRIDGE,
  BRIDGE_COLLIDER_CENTER_Y,
  BRIDGE_COLLIDER_HALF_HEIGHT,
  BRIDGE_ORIGIN_Y,
  ISLANDS,
} from "./layout";
import {
  BRIDGE_BUILD_DURATION,
  bridgePieceProgress,
  bridgePieceTransform,
} from "./bridgeAnimation";

export const BRIDGE_MODEL_URL = "/assets/models/log-plank-bridge.glb";
const GHOST_TINT = new Color("#8d9390");
const GHOST_OPACITY = 0.34;

function sourceGeometry(gltf: GLTF) {
  let geometry: BufferGeometry | undefined;
  gltf.scene.traverse((child) => {
    if (!geometry && (child as Mesh).isMesh)
      geometry = (child as Mesh).geometry;
  });
  if (!geometry) throw new Error("Bridge model has no mesh geometry.");
  return geometry;
}

function vertexKey(
  position: ReturnType<BufferGeometry["getAttribute"]>,
  index: number,
) {
  const precision = 100_000;
  return `${Math.round(position.getX(index) * precision)},${Math.round(
    position.getY(index) * precision,
  )},${Math.round(position.getZ(index) * precision)}`;
}

// The exporter combined the bridge into one triangle mesh, but its individual
// timbers are still disconnected geometrically. Reconnect triangles sharing a
// vertex to recover complete planks, posts and rails for the build animation.
export function splitBridgeGeometry(original: BufferGeometry) {
  const source = original.index ? original.toNonIndexed() : original;
  const position = source.getAttribute("position");
  const attributeNames = ["position", "normal", "color", "uv"].filter(
    (name) => !!source.getAttribute(name),
  );
  const triangleCount = Math.floor(position.count / 3);
  const parents = Array.from({ length: triangleCount }, (_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const join = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const vertexOwners = new Map<string, number>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let offset = 0; offset < 3; offset += 1) {
      const key = vertexKey(position, triangle * 3 + offset);
      const owner = vertexOwners.get(key);
      if (owner === undefined) vertexOwners.set(key, triangle);
      else join(triangle, owner);
    }
  }

  const components = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    const component = components.get(root);
    if (component) component.push(triangle);
    else components.set(root, [triangle]);
  }
  const ordered = [...components.values()].sort((left, right) => {
    const centroid = (triangles: number[]) =>
      triangles.reduce(
        (sum, triangle) => sum + position.getX(triangle * 3),
        0,
      ) / triangles.length;
    return centroid(left) - centroid(right);
  });

  const pieces = ordered.map((triangles) => {
    const geometry = new BufferGeometry();
    for (const name of attributeNames) {
      const sourceAttribute = source.getAttribute(name);
      const values: number[] = [];
      for (const triangle of triangles) {
        for (let offset = 0; offset < 3; offset += 1) {
          const start = (triangle * 3 + offset) * sourceAttribute.itemSize;
          for (
            let component = 0;
            component < sourceAttribute.itemSize;
            component += 1
          )
            values.push(Number(sourceAttribute.array[start + component]));
        }
      }
      geometry.setAttribute(
        name,
        new Float32BufferAttribute(
          values,
          sourceAttribute.itemSize,
          sourceAttribute.normalized,
        ),
      );
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  });
  if (source !== original) source.dispose();
  return pieces;
}

export function usesBridgeSandColor(geometry: BufferGeometry) {
  const bounds = geometry.boundingBox;
  if (!bounds) return false;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  const deckBoard = width < 0.5 && depth > 1.3 && bounds.max.y <= 0.65;
  const horizontalHandrail =
    width > 3 && depth < 0.15 && bounds.min.y > 0.75;
  // The two long beams underneath are also longitudinal, but their thicker
  // depth and low Y keep them in the earth-colored structural group.
  return deckBoard || horizontalHandrail;
}

function combineBridgePieces(pieces: BufferGeometry[]) {
  const geometry = new BufferGeometry();
  const first = pieces[0];
  if (!first) return geometry;
  for (const name of ["position", "normal", "color", "uv"]) {
    const firstAttribute = first.getAttribute(name);
    if (!firstAttribute) continue;
    const values: number[] = [];
    for (const piece of pieces) {
      const attribute = piece.getAttribute(name);
      for (let index = 0; index < attribute.array.length; index += 1)
        values.push(Number(attribute.array[index]));
    }
    geometry.setAttribute(
      name,
      new Float32BufferAttribute(
        values,
        firstAttribute.itemSize,
        firstAttribute.normalized,
      ),
    );
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function Bridge({
  gltf,
  z,
  length,
  built,
  revealed,
  running,
  reduced,
  contrast,
}: {
  gltf: GLTF;
  z: number;
  length: number;
  built: boolean;
  revealed: boolean;
  running: boolean;
  reduced: boolean;
  contrast: boolean;
}) {
  const geometry = useMemo(() => sourceGeometry(gltf), [gltf]);
  const pieces = useMemo(() => splitBridgeGeometry(geometry), [geometry]);
  const assembledGeometries = useMemo(
    () => ({
      sand: combineBridgePieces(pieces.filter(usesBridgeSandColor)),
      structure: combineBridgePieces(
        pieces.filter((piece) => !usesBridgeSandColor(piece)),
      ),
    }),
    [pieces],
  );
  const sandMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: false,
        roughness: 0.92,
        color: BEACH_SAND_COLOR,
      }),
    [],
  );
  const structureMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: false,
        roughness: 0.96,
        color: ISLANDS[0].earth,
      }),
    [],
  );
  const ghostMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: contrast ? "#f0f2ef" : GHOST_TINT,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
      }),
    [contrast],
  );
  const pieceMeshes = useRef<(Mesh | null)[]>([]);
  const ghost = useRef<Mesh>(null);
  const assembled = useRef<Group>(null);
  const construction = useRef(built ? 1 : 0);
  const previousBuilt = useRef(built);

  useEffect(
    () => () => {
      pieces.forEach((piece) => piece.dispose());
      assembledGeometries.sand.dispose();
      assembledGeometries.structure.dispose();
    },
    [assembledGeometries, pieces],
  );
  useEffect(() => () => sandMaterial.dispose(), [sandMaterial]);
  useEffect(
    () => () => structureMaterial.dispose(),
    [structureMaterial],
  );
  useEffect(() => () => ghostMaterial.dispose(), [ghostMaterial]);

  useFrame((_, delta) => {
    if (built !== previousBuilt.current) {
      construction.current = built && reduced ? 1 : 0;
      previousBuilt.current = built;
    }
    if (built && running)
      construction.current = reduced
        ? 1
        : Math.min(1, construction.current + delta / BRIDGE_BUILD_DURATION);
    if (!built) construction.current = 0;

    pieceMeshes.current.forEach((piece, index) => {
      if (!piece) return;
      const transform = bridgePieceTransform(
        index,
        pieces.length,
        construction.current,
      );
      piece.position.set(...transform.position);
      piece.rotation.set(...transform.rotation);
      piece.visible =
        built &&
        construction.current < 1 &&
        bridgePieceProgress(index, pieces.length, construction.current) > 0;
    });
    if (assembled.current)
      assembled.current.visible = built && construction.current >= 1;
    const ghostMesh = ghost.current;
    if (ghostMesh) {
      const material = ghostMesh.material as MeshBasicMaterial;
      material.opacity = built
        ? GHOST_OPACITY * (1 - construction.current)
        : GHOST_OPACITY;
      ghostMesh.visible = revealed && material.opacity > 0.005;
    }
  });

  return (
    <group position={[0, BRIDGE_ORIGIN_Y, z]}>
      {built && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[BRIDGE.halfWidth, BRIDGE_COLLIDER_HALF_HEIGHT, length / 2]}
            position={[0, BRIDGE_COLLIDER_CENTER_Y, 0]}
          />
        </RigidBody>
      )}
      <group rotation={[0, Math.PI / 2, 0]} scale={[length / 4, 1.05, 1.5]}>
        <mesh ref={ghost} geometry={geometry} material={ghostMaterial} />
        <group ref={assembled} visible={false}>
          <mesh
            geometry={assembledGeometries.sand}
            material={sandMaterial}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={assembledGeometries.structure}
            material={structureMaterial}
            castShadow
            receiveShadow
          />
        </group>
        {pieces.map((piece, index) => {
          const transform = bridgePieceTransform(
            index,
            pieces.length,
            reduced ? 1 : 0,
          );
          return (
            <mesh
              key={index}
              ref={(node) => {
                pieceMeshes.current[index] = node;
              }}
              geometry={piece}
              material={
                usesBridgeSandColor(piece) ? sandMaterial : structureMaterial
              }
              position={transform.position}
              rotation={transform.rotation}
              visible={false}
              castShadow
              receiveShadow
            />
          );
        })}
      </group>
    </group>
  );
}
