import { Vector3 } from "three";
import type { Vec3 } from "../types";
import type { LocalBasis, MutableVec3 } from "./brachiationPhysics";
import { LOCOMOTION_TUNING } from "./locomotionConfig";

const xAxis = new Vector3();
const up = new Vector3();
const forward = new Vector3();
const armAxis = new Vector3();
const poleReference = new Vector3();
const poleSide = new Vector3();
const polePreferred = new Vector3();

// Rig limits in radians. The elbow may sway, but never orbit a pinned arm.
export const SUSPENDED_SHOULDER_TWIST_LIMIT = Math.PI / 3;

/** Follow the rope through a full revolution, without rotating inside the shoulder. */
export function pendulumBodyBasis(out: LocalBasis, radial: Readonly<Vec3>, heading: number) {
  up.copy(radial).negate();
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
  up.normalize();
  xAxis.set(Math.cos(heading), 0, -Math.sin(heading));
  xAxis.addScaledVector(up, -xAxis.dot(up));
  if (xAxis.lengthSq() < 1e-6) {
    xAxis.copy(out.right).negate();
    xAxis.addScaledVector(up, -xAxis.dot(up));
    if (xAxis.lengthSq() < 1e-6) xAxis.set(0, 1, 0).addScaledVector(up, -up.y);
  }
  xAxis.normalize();
  forward.crossVectors(xAxis, up).normalize();
  Object.assign(out.right, { x: -xAxis.x, y: -xAxis.y, z: -xAxis.z });
  Object.assign(out.up, { x: up.x, y: up.y, z: up.z });
  Object.assign(out.forward, { x: forward.x, y: forward.y, z: forward.z });
  return out;
}

export function limitSuspendedElbowPole(
  out: MutableVec3,
  axis: Readonly<Vec3>,
  preferred: Readonly<Vec3>,
  basis: LocalBasis,
  side: "left" | "right",
) {
  armAxis.copy(axis);
  if (armAxis.lengthSq() < 1e-8) armAxis.copy(basis.up);
  armAxis.normalize();
  poleReference.copy(basis.forward).negate()
    .addScaledVector(basis.right, side === "left" ? -0.35 : 0.35);
  poleReference.addScaledVector(armAxis, -poleReference.dot(armAxis));
  if (poleReference.lengthSq() < 1e-6) {
    poleReference.copy(basis.up).addScaledVector(armAxis, -armAxis.dot(basis.up as Vector3));
    if (poleReference.lengthSq() < 1e-6)
      poleReference.copy(basis.right).addScaledVector(armAxis, -armAxis.dot(basis.right as Vector3));
  }
  poleReference.normalize();
  poleSide.crossVectors(armAxis, poleReference).normalize();
  polePreferred.copy(preferred).addScaledVector(armAxis, -armAxis.dot(preferred as Vector3));
  const angle = polePreferred.lengthSq() < 1e-8 ? 0 : Math.atan2(
    polePreferred.dot(poleSide), polePreferred.dot(poleReference),
  );
  const limited = Math.max(-SUSPENDED_SHOULDER_TWIST_LIMIT, Math.min(SUSPENDED_SHOULDER_TWIST_LIMIT, angle));
  poleReference.multiplyScalar(Math.cos(limited)).addScaledVector(poleSide, Math.sin(limited));
  out.x = poleReference.x;
  out.y = poleReference.y;
  out.z = poleReference.z;
  return out;
}

// Real brachiation reaches one hand ahead and trails the other behind along
// the course, not spread out sideways - so the shoulder-to-shoulder axis
// (`right`) stays parallel (or nearly so) to the vine/travel line, not
// perpendicular to it. The character's actual gaze direction is handled
// separately by poseHeadTowardMotion, which aims independently at the next
// anchor regardless of this torso orientation.
export function suspensionBasis(
  out: LocalBasis,
  travel: Readonly<Vec3>,
  lean = 0,
  turn = 0,
) {
  xAxis.set(travel.x, travel.y, travel.z);
  if (xAxis.lengthSq() < 1e-8) xAxis.set(0, 0, 1);
  xAxis.normalize();
  up.set(0, 1, 0).addScaledVector(xAxis, -xAxis.y);
  if (up.lengthSq() < 1e-8) up.set(0, 0, 1);
  up.normalize();
  xAxis.applyAxisAngle(up, turn);
  up.applyAxisAngle(xAxis, lean);
  forward.crossVectors(xAxis, up).normalize();
  Object.assign(out.right, { x: -xAxis.x, y: -xAxis.y, z: -xAxis.z });
  Object.assign(out.up, { x: up.x, y: up.y, z: up.z });
  Object.assign(out.forward, { x: forward.x, y: forward.y, z: forward.z });
  return out;
}

/**
 * Swap which shoulder leads: the shoulder bar stays parallel to the vine at
 * rest (turn 0 or PI - just which end faces the direction of travel differs),
 * and a handoff swings it through roughly half a turn so the hand that was
 * trailing ends up leading. Called continuously through the reach so the
 * bone is already rotating toward the next grip's side before the hand
 * lands, not snapped into place afterward.
 */
export function handoffShoulderTurn(from: "left" | "right", progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const blend = t * t * (3 - 2 * t);
  return from === "left" ? Math.PI * blend : Math.PI * (1 - blend);
}

/**
 * Maximum two-hand stride along the vine. With the shoulder bar parallel to
 * the direction of travel, each shoulder already sits on the same axis as
 * its own grip - one leads toward the front hold, the other trails toward
 * the back one - so the shoulder width adds directly to the reach budget
 * instead of being spent sideways as wasted lateral offset (the old
 * perpendicular-shoulder model this used to assume). Two right-triangle
 * arms (reach, drop) each cover half the leftover span past that width.
 */
export function suspensionStride(
  armLength: number,
  shoulderWidth: number,
  rise = 0,
) {
  const reach = armLength * LOCOMOTION_TUNING.armReachRatio;
  const drop = LOCOMOTION_TUNING.minShoulderDrop + Math.abs(rise) * 0.5;
  return Math.max(
    0.1,
    2 * Math.sqrt(Math.max(0, reach * reach - drop * drop)) + shoulderWidth,
  );
}

/** Smooth recovery from the previous wrist position to the next grip. */
export function sampleHandReach(
  out: MutableVec3,
  from: Readonly<Vec3>,
  to: Readonly<Vec3>,
  progress: number,
  outward: Readonly<Vec3>,
  clearance = 0.12,
) {
  const t = Math.max(0, Math.min(1, progress));
  const blend = t * t * (3 - 2 * t);
  const arc = Math.sin(Math.PI * t) ** 2 * clearance;
  out.x = from.x + (to.x - from.x) * blend + outward.x * arc;
  out.y = from.y + (to.y - from.y) * blend + outward.y * arc - arc;
  out.z = from.z + (to.z - from.z) * blend + outward.z * arc;
  return out;
}
