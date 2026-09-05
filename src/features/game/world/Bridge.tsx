import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Color, Group, Mesh, MeshStandardMaterial } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BRIDGE,
  BRIDGE_COLLIDER_CENTER_Y,
  BRIDGE_COLLIDER_HALF_HEIGHT,
  BRIDGE_ORIGIN_Y,
} from "./layout";

export const BRIDGE_MODEL_URL = "/assets/models/log-plank-bridge.glb";
const NATURAL_TINT = new Color("#c9a86a");
const REVEALED_TINT = new Color("#e9c77a");

export function Bridge({
  gltf,
  z,
  length,
  built,
  revealed,
}: {
  gltf: GLTF;
  z: number;
  length: number;
  built: boolean;
  revealed: boolean;
}) {
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true) as Group;
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const source = mesh.material as MeshStandardMaterial;
        mesh.material = new MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.92,
          color: source?.color ?? "#ffffff",
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf]);
  const tint = revealed && !built ? REVEALED_TINT : NATURAL_TINT;
  return (
    <group position={[0, BRIDGE_ORIGIN_Y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[BRIDGE.halfWidth, BRIDGE_COLLIDER_HALF_HEIGHT, length / 2]}
          position={[0, BRIDGE_COLLIDER_CENTER_Y, 0]}
        />
      </RigidBody>
      <primitive
        object={scene}
        rotation={[0, Math.PI / 2, 0]}
        scale={[length / 4, 1.05, 1.5]}
      />
      {revealed && (
        <mesh position={[0, 0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.6, length]} />
          <meshBasicMaterial
            color={tint}
            transparent
            opacity={built ? 0 : 0.16}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
