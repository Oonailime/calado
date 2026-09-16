import { MathUtils, Vector3 } from "three";
import { PHASE_FOUR_FEET_OFFSET, PHASE_FOUR_PULL_VINE_CURVE as curve } from "../world/phaseFourLayout";
import type { Vec3 } from "../types";
import type { LocalBasis } from "./brachiationPhysics";

// The first two spans tie the rope to its branch. Walking starts at the low
// knot on the arrival deck; all distances below are actual rope arc lengths.
const lengths = curve.getLengths();
const startLength = lengths[curve.arcLengthDivisions / 3];
const totalLength = curve.getLength();
export const VINE_WALK_LENGTH = totalLength - startLength;
export const VINE_WALK_SPEED = 2.1;
export const VINE_WALK_STRIDE = 0.72;
const STRIDE = VINE_WALK_STRIDE;
const STANCE = 0.7;
const tangent = new Vector3();

export type VineWalk = {
  distance: number;
  speed: number;
  direction: 1 | -1;
  entryTime: number;
  entry: Vec3;
  position: Vector3;
  basis: LocalBasis;
  leftHand: Vector3;
  rightHand: Vector3;
  leftFoot: Vector3;
  rightFoot: Vector3;
  lookTarget: Vector3;
  /** Extension of the leading hand / trailing foot pair, from compact to long. */
  stretch: number;
};

export function sampleWalkingVine(distance: number, out = new Vector3()) {
  return curve.getPointAt((startLength + Math.max(0, Math.min(VINE_WALK_LENGTH, distance))) / totalLength, out);
}

export function vineWalkInput(distance: number, yaw: number, forward: number, right: number) {
  curve.getTangentAt((startLength + distance) / totalLength, tangent);
  const length = Math.hypot(tangent.x, tangent.z);
  const inputLength = Math.max(1, Math.hypot(forward, right));
  const x = (right * Math.cos(yaw) - forward * Math.sin(yaw)) / inputLength;
  const z = (-forward * Math.cos(yaw) - right * Math.sin(yaw)) / inputLength;
  // Use camera heading even when looking straight up/down, just like walking
  // on the decks. Pitch must never invert W/S or make the route impassable.
  const projection = (x * tangent.x + z * tangent.z) / Math.max(1e-6, length);
  return Math.abs(projection) < 0.12 ? 0 : projection;
}

export function createVineWalk(position: Vec3, fromTop: boolean): VineWalk {
  const walk: VineWalk = {
    distance: fromTop ? VINE_WALK_LENGTH : 0,
    speed: 0, direction: fromTop ? -1 : 1, entryTime: 0,
    entry: { ...position }, position: new Vector3(),
    basis: { forward: new Vector3(), right: new Vector3(), up: new Vector3() },
    leftHand: new Vector3(), rightHand: new Vector3(),
    leftFoot: new Vector3(), rightFoot: new Vector3(),
    lookTarget: new Vector3(), stretch: 0,
  };
  sampleVineWalkPose(walk);
  return walk;
}

export function stepVineWalk(walk: VineWalk, input: number, dt: number) {
  walk.entryTime += dt;
  const target = walk.entryTime < 0.35 ? 0 : input * VINE_WALK_SPEED;
  const change = 8 * dt;
  walk.speed += Math.max(-change, Math.min(change, target - walk.speed));
  if (Math.abs(walk.speed) > 0.03) walk.direction = walk.speed > 0 ? 1 : -1;
  walk.distance = Math.max(0, Math.min(VINE_WALK_LENGTH, walk.distance + walk.speed * dt));
  sampleVineWalkPose(walk);
  const blend = Math.min(1, walk.entryTime / 0.35);
  walk.position.lerp(new Vector3().copy(walk.entry), 1 - blend * blend * (3 - 2 * blend));
  return walk.entryTime >= 0.35 && (
    (walk.distance === 0 && input < 0) ||
    (walk.distance === VINE_WALK_LENGTH && input > 0)
  );
}

export function sampleVineWalkPose(walk: VineWalk) {
  curve.getTangentAt((startLength + walk.distance) / totalLength, tangent).multiplyScalar(walk.direction);
  Object.assign(walk.basis.forward, tangent);
  const right = new Vector3(-tangent.z, 0, tangent.x).normalize();
  const up = new Vector3().crossVectors(right, tangent).normalize();
  Object.assign(walk.basis.right, right);
  Object.assign(walk.basis.up, up);
  sampleWalkingVine(walk.distance, walk.position).addScaledVector(up, PHASE_FOUR_FEET_OFFSET);
  const exitDistance = walk.direction > 0 ? VINE_WALK_LENGTH : 0;
  sampleWalkingVine(exitDistance, walk.lookTarget);
  walk.lookTarget.y += 0.65;
  // Look through the exit as we approach it, so the head never turns back
  // toward a point beneath the body on the final step onto the deck.
  walk.lookTarget.addScaledVector(tangent, Math.max(0, 1 - Math.abs(exitDistance - walk.distance)));
  const contact = (out: Vector3, offset: number, phaseOffset: number, side: number, foot: boolean) => {
    const phase = ((walk.distance * walk.direction / STRIDE + phaseOffset) % 1 + 1) % 1;
    const recovery = Math.max(0, (phase - STANCE) / (1 - STANCE));
    const stride = phase < STANCE
      ? STRIDE * (STANCE / 2 - phase)
      : STRIDE * (-STANCE / 2 + recovery * recovery * (3 - 2 * recovery) * STANCE);
    sampleWalkingVine(walk.distance + walk.direction * (offset + stride), out);
    // These are wrist/ankle origins, not skin contact points. Leave room for
    // the palm/sole and inward-curled digits outside the 0.1-radius rope.
    // Each contact uses its own cross-section, including on curved spans.
    const contactDistance = Math.max(0, Math.min(VINE_WALK_LENGTH, walk.distance + walk.direction * (offset + stride)));
    const contactTangent = curve.getTangentAt((startLength + contactDistance) / totalLength).multiplyScalar(walk.direction);
    const contactRight = new Vector3(-contactTangent.z, 0, contactTangent.x).normalize();
    const contactUp = new Vector3().crossVectors(contactRight, contactTangent).normalize();
    out.addScaledVector(contactRight, side * (foot ? 0.18 : 0.17));
    out.addScaledVector(contactUp, 0.115 + Math.sin(recovery * Math.PI) * (foot ? 0.09 : 0.055));
    return offset + stride;
  };
  const leftHand = contact(walk.leftHand, 0.27, 0, -1, false);
  const rightHand = contact(walk.rightHand, 0.27, 0.5, 1, false);
  // The opposite hind leg finishes pushing as the leading hand reaches out.
  const leftFoot = contact(walk.leftFoot, -0.3, 0.15, -1, true);
  const rightFoot = contact(walk.rightFoot, -0.3, 0.65, 1, true);
  const span = Math.max(leftHand, rightHand) - Math.min(leftFoot, rightFoot);
  walk.stretch = MathUtils.smoothstep(span, 0.68, 1.04);
}
