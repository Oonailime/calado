import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils, Vector3, type Bone } from "three";
import Monkey from "@/features/game/characters/Monkey";
import { monkeyRigBone, resolveMonkeyRig } from "@/features/game/characters/monkeyRig";
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
  scale = 1,
  y = 0,
  centered = false,
}: {
  id: CharacterId;
  x: number;
  z: number;
  distance: number;
  yaw: number;
  walking: boolean;
  power: boolean;
  // Model size (design2 draws the monkeys larger); strides grow with it.
  scale?: number;
  // Height of the surface under the feet, e.g. a chess stool (design2).
  y?: number;
  // Keep the body itself over (x, z), e.g. seated on a stool (design2): the
  // idle pose carries the pelvis away from the model's origin, which would
  // otherwise leave the monkey perched on the stool's edge.
  centered?: boolean;
}) {
  const group = useRef<Group>(null);
  const pelvis = useRef<Bone | null>(null);
  const pelvisWorld = useMemo(() => new Vector3(), []);
  const locomotion = useRef({
    speed: 0,
    grounded: true,
    distance,
    metersPerStride: STORY_METERS_PER_STRIDE * scale,
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
    // Measured in the model's own size, so a larger monkey blends into its
    // walk at the same pace as the original one.
    const instantSpeed = Math.min(MAX_SPEED, stepDistance / dt / scale);
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
    node.position.set(x, y + GROUND_OFFSET * scale, z);
    node.scale.setScalar(scale);
    const targetYaw = travelYaw(yaw, direction.current, walking);
    const angle =
      MathUtils.euclideanModulo(
        targetYaw - node.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    node.rotation.y += angle * (1 - Math.exp(-TURN_RESPONSE * dt));
    if (centered) {
      // The model loads asynchronously; look the pelvis up once it exists.
      pelvis.current ??= monkeyRigBone(resolveMonkeyRig(node), "Hips") ?? null;
      if (pelvis.current) {
        node.updateMatrixWorld(true);
        pelvis.current.getWorldPosition(pelvisWorld);
        node.position.x -= pelvisWorld.x - x;
        node.position.z -= pelvisWorld.z - z;
      }
    }
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
