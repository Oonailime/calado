import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import Monkey from "@/features/game/characters/Monkey";
import type { CharacterId } from "@/features/game/types";
import {
  STORY_METERS_PER_STRIDE,
  travelDirection,
  travelYaw,
  type TravelDirection,
} from "./cameraRig";

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
  distance,
  yaw,
  walking,
  power,
}: {
  id: CharacterId;
  x: number;
  z: number;
  distance: number;
  yaw: number;
  walking: boolean;
  power: boolean;
}) {
  const group = useRef<Group>(null);
  const locomotion = useRef({
    speed: 0,
    grounded: true,
    distance,
    metersPerStride: STORY_METERS_PER_STRIDE,
  });
  const previous = useRef({ x, z });
  const previousDistance = useRef(distance);
  const traveledDistance = useRef(distance);
  const direction = useRef<TravelDirection>(1);
  const smoothedSpeed = useRef(0);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const dt = Math.max(1e-4, Math.min(delta, 0.05));
    // Real per-frame displacement only controls the idle/walk blend. The
    // pose inside the walk itself is selected from route meters below, so
    // scroll velocity cannot add or remove steps.
    const stepDistance = Math.hypot(
      x - previous.current.x,
      z - previous.current.z,
    );
    previous.current = { x, z };
    const instantSpeed = Math.min(MAX_SPEED, stepDistance / dt);
    const target = walking ? instantSpeed : 0;
    smoothedSpeed.current +=
      (target - smoothedSpeed.current) * Math.min(1, dt * SPEED_RESPONSE);
    direction.current = travelDirection(
      previousDistance.current,
      distance,
      direction.current,
    );
    traveledDistance.current += Math.abs(distance - previousDistance.current);
    previousDistance.current = distance;
    node.position.set(x, GROUND_OFFSET, z);
    const targetYaw = travelYaw(yaw, direction.current, walking);
    const angle =
      MathUtils.euclideanModulo(
        targetYaw - node.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    node.rotation.y += angle * (1 - Math.exp(-TURN_RESPONSE * dt));
    locomotion.current.speed = smoothedSpeed.current;
    locomotion.current.grounded = true;
    // Count actual route meters in either direction. On the return the model
    // turns around while the walk clip keeps progressing forward, avoiding a
    // backward/moonwalk pose without tying cadence to scroll event count.
    locomotion.current.distance = traveledDistance.current;
  });
  return (
    <group ref={group}>
      <Monkey id={id} power={power} locomotion={locomotion} />
    </group>
  );
}
