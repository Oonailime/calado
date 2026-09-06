import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import Monkey from "@/features/game/characters/Monkey";
import type { CharacterId } from "@/features/game/types";

const MAX_SPEED = 3;
const SPEED_RESPONSE = 8;
// Monkey.tsx bakes in a -0.44 vertical offset assuming it's parented at a
// Rapier capsule's center (see Character.tsx) — there's no capsule here, so
// this cancels that offset out to sit the feet on the ground plane.
const GROUND_OFFSET = 0.44;
const TURN_RESPONSE = 10;

export default function StoryMonkey({
  id,
  x,
  z,
  yaw,
  walking,
  power,
}: {
  id: CharacterId;
  x: number;
  z: number;
  yaw: number;
  walking: boolean;
  power: boolean;
}) {
  const group = useRef<Group>(null);
  const locomotion = useRef({ speed: 0, grounded: true });
  const previous = useRef({ x, z });
  const smoothedSpeed = useRef(0);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const dt = Math.max(1e-4, Math.min(delta, 0.05));
    // Real per-frame displacement, not a fixed constant — so the run cycle
    // actually matches how fast scrolling is moving him, and settles back
    // to idle the instant the scroll (and so his position) stops, instead
    // of playing a walk cycle in place while he's not really advancing.
    const distance = Math.hypot(x - previous.current.x, z - previous.current.z);
    previous.current = { x, z };
    const instantSpeed = Math.min(MAX_SPEED, distance / dt);
    const target = walking ? instantSpeed : 0;
    smoothedSpeed.current +=
      (target - smoothedSpeed.current) * Math.min(1, dt * SPEED_RESPONSE);

    node.position.set(x, GROUND_OFFSET, z);
    const angle =
      MathUtils.euclideanModulo(yaw - node.rotation.y + Math.PI, Math.PI * 2) -
      Math.PI;
    node.rotation.y += angle * (1 - Math.exp(-TURN_RESPONSE * dt));
    locomotion.current.speed = smoothedSpeed.current;
    locomotion.current.grounded = true;
  });
  return (
    <group ref={group}>
      <Monkey id={id} power={power} locomotion={locomotion} />
    </group>
  );
}
