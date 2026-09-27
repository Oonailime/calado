import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Mesh, type Group } from "three";

// The carved three wise monkeys (a Meshy AI model prepared for the game by
// scripts/prepare-wisdom-totem.py): the plinth rests on the ground at the
// origin and the monkeys face +z.
export const TOTEM_MODEL_URL = "/assets/models/totem/three-wise-monkeys.glb";

// Left to right, seen from the front, as carved in the model.
export const WISE_MONKEY_GESTURES = ["ears", "mouth", "eyes"] as const;

// The prepared model's extent, in metres.
export const TOTEM_SIZE = {
  halfWidth: 1.15,
  height: 1.458,
  halfDepth: 0.365,
} as const;

export default function WisdomTotem({
  template,
  x = 0,
  z,
}: {
  template: Group;
  x?: number;
  z: number;
}) {
  const model = useMemo(() => {
    const clone = template.clone(true);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [template]);
  return (
    <group name="wisdom-totem" position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[TOTEM_SIZE.halfWidth, TOTEM_SIZE.height / 2, TOTEM_SIZE.halfDepth]}
          position={[0, TOTEM_SIZE.height / 2, 0]}
        />
      </RigidBody>
      <primitive object={model} />
    </group>
  );
}
