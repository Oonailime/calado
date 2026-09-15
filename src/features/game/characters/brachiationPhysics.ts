import type { Vec3 } from "../types";

export type MutableVec3 = { x: number; y: number; z: number };

export type LocalBasis = {
  forward: MutableVec3;
  right: MutableVec3;
  up: MutableVec3;
};

export type DistanceConstraint = {
  active: boolean;
  anchor: Readonly<Vec3>;
  length: number;
  /** Keep a held body in the lower part of its swing, relative to gravity. */
  minDrop?: number;
  /** Contact with a solid can shorten a hanging rope's span without stretching it. */
  maxDistanceOnly?: boolean;
};

export type ConstraintScratch = {
  predictedPosition: MutableVec3;
  solvedVelocity: MutableVec3;
};

export type AnchorScoreInput = {
  position: Readonly<Vec3>;
  velocity: Readonly<Vec3>;
  gravity: Readonly<Vec3>;
  desiredDirection: Readonly<Vec3>;
  right: Readonly<Vec3>;
  anchor: Readonly<Vec3>;
  predictionTime: number;
  maxReach: number;
  hand: "left" | "right";
};

const EPSILON = 1e-8;

export function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function copyVector(out: MutableVec3, value: Readonly<Vec3>) {
  out.x = value.x;
  out.y = value.y;
  out.z = value.z;
  return out;
}

export function vectorLength(value: Readonly<Vec3>) {
  return Math.hypot(value.x, value.y, value.z);
}

export function normalizeVector(
  out: MutableVec3,
  value: Readonly<Vec3>,
  fallback: Readonly<Vec3> = { x: 0, y: 0, z: -1 },
) {
  const length = vectorLength(value);
  if (length <= EPSILON || !Number.isFinite(length))
    return copyVector(out, fallback);
  out.x = value.x / length;
  out.y = value.y / length;
  out.z = value.z / length;
  return out;
}

export function gravityUp(out: MutableVec3, gravity: Readonly<Vec3>) {
  const length = vectorLength(gravity);
  if (length <= EPSILON || !Number.isFinite(length)) {
    out.x = 0;
    out.y = 1;
    out.z = 0;
  } else {
    out.x = -gravity.x / length;
    out.y = -gravity.y / length;
    out.z = -gravity.z / length;
  }
  return out;
}

/**
 * Builds a right-handed, gravity-relative basis. A zero desired vector keeps
 * the prior forward direction instead of ever normalizing zero.
 */
export function buildLocalBasis(
  desiredDirection: Readonly<Vec3>,
  gravity: Readonly<Vec3>,
  fallbackForward: Readonly<Vec3>,
  out: LocalBasis,
) {
  // Callers may reuse out.forward as the fallback; preserve it before writes.
  const fallbackX = fallbackForward.x, fallbackY = fallbackForward.y, fallbackZ = fallbackForward.z;
  gravityUp(out.up, gravity);
  const desiredDotUp =
    desiredDirection.x * out.up.x +
    desiredDirection.y * out.up.y +
    desiredDirection.z * out.up.z;
  out.forward.x = desiredDirection.x - out.up.x * desiredDotUp;
  out.forward.y = desiredDirection.y - out.up.y * desiredDotUp;
  out.forward.z = desiredDirection.z - out.up.z * desiredDotUp;
  if (vectorLength(out.forward) <= EPSILON) {
    const fallbackDotUp =
      fallbackX * out.up.x + fallbackY * out.up.y + fallbackZ * out.up.z;
    out.forward.x = fallbackX - out.up.x * fallbackDotUp;
    out.forward.y = fallbackY - out.up.y * fallbackDotUp;
    out.forward.z = fallbackZ - out.up.z * fallbackDotUp;
  }
  if (vectorLength(out.forward) <= EPSILON) {
    // Pick the world axis least parallel to up as a deterministic last resort.
    const useX = Math.abs(out.up.x) < 0.8;
    out.forward.x = useX ? 1 : 0;
    out.forward.y = useX ? 0 : 0;
    out.forward.z = useX ? 0 : 1;
    const dot =
      out.forward.x * out.up.x +
      out.forward.y * out.up.y +
      out.forward.z * out.up.z;
    out.forward.x -= out.up.x * dot;
    out.forward.y -= out.up.y * dot;
    out.forward.z -= out.up.z * dot;
  }
  normalizeVector(out.forward, out.forward);
  // right = forward × up for Three.js's +Y-up, local +Z-forward convention.
  out.right.x = out.forward.y * out.up.z - out.forward.z * out.up.y;
  out.right.y = out.forward.z * out.up.x - out.forward.x * out.up.z;
  out.right.z = out.forward.x * out.up.y - out.forward.y * out.up.x;
  normalizeVector(out.right, out.right, { x: 1, y: 0, z: 0 });
  return out;
}

export function projectTangential(
  out: MutableVec3,
  velocity: Readonly<Vec3>,
  radialDirection: Readonly<Vec3>,
) {
  const radialSpeed =
    velocity.x * radialDirection.x +
    velocity.y * radialDirection.y +
    velocity.z * radialDirection.z;
  out.x = velocity.x - radialDirection.x * radialSpeed;
  out.y = velocity.y - radialDirection.y * radialSpeed;
  out.z = velocity.z - radialDirection.z * radialSpeed;
  return out;
}

export function decomposeVelocity(
  radial: MutableVec3,
  tangential: MutableVec3,
  velocity: Readonly<Vec3>,
  position: Readonly<Vec3>,
  anchor: Readonly<Vec3>,
) {
  const dx = position.x - anchor.x;
  const dy = position.y - anchor.y;
  const dz = position.z - anchor.z;
  const inverseLength = 1 / Math.max(EPSILON, Math.hypot(dx, dy, dz));
  const nx = dx * inverseLength;
  const ny = dy * inverseLength;
  const nz = dz * inverseLength;
  const radialSpeed = velocity.x * nx + velocity.y * ny + velocity.z * nz;
  radial.x = nx * radialSpeed;
  radial.y = ny * radialSpeed;
  radial.z = nz * radialSpeed;
  tangential.x = velocity.x - radial.x;
  tangential.y = velocity.y - radial.y;
  tangential.z = velocity.z - radial.z;
}

/** Exact positional projection used by tests and by the predicted-position solve. */
export function solveDistanceConstraint(
  position: MutableVec3,
  anchor: Readonly<Vec3>,
  length: number,
) {
  let dx = position.x - anchor.x;
  let dy = position.y - anchor.y;
  let dz = position.z - anchor.z;
  let distance = Math.hypot(dx, dy, dz);
  if (distance <= EPSILON) {
    dx = 0;
    dy = -1;
    dz = 0;
    distance = 1;
  }
  const scale = Math.max(EPSILON, length) / distance;
  position.x = anchor.x + dx * scale;
  position.y = anchor.y + dy * scale;
  position.z = anchor.z + dz * scale;
  return Math.abs(distance - length);
}

export function solveSuspensionLimit(
  position: MutableVec3,
  constraint: DistanceConstraint,
  gravity: Readonly<Vec3>,
) {
  if (!constraint.minDrop) return;
  const gravityLength = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
  const ux = -gravity.x / gravityLength,
    uy = -gravity.y / gravityLength,
    uz = -gravity.z / gravityLength;
  const dx = position.x - constraint.anchor.x,
    dy = position.y - constraint.anchor.y,
    dz = position.z - constraint.anchor.z;
  const height = dx * ux + dy * uy + dz * uz;
  const drop = Math.min(constraint.length * 0.98, constraint.minDrop);
  if (height <= -drop) return;
  let tx = dx - ux * height,
    ty = dy - uy * height,
    tz = dz - uz * height;
  let tangentLength = Math.hypot(tx, ty, tz);
  if (tangentLength < EPSILON) {
    tx = Math.abs(uy) > 0.5 ? 1 : 0;
    ty = Math.abs(uy) > 0.5 ? 0 : 1;
    tz = 0;
    const projection = tx * ux + ty * uy;
    tx -= ux * projection;
    ty -= uy * projection;
    tz -= uz * projection;
    tangentLength = Math.hypot(tx, ty, tz);
  }
  const scale =
    Math.sqrt(Math.max(0, constraint.length ** 2 - drop ** 2)) / tangentLength;
  position.x = constraint.anchor.x + tx * scale - ux * drop;
  position.y = constraint.anchor.y + ty * scale - uy * drop;
  position.z = constraint.anchor.z + tz * scale - uz * drop;
}

/**
 * Predicts the semi-implicit Rapier step, projects that future position onto
 * one or two arm/support constraints, and returns the pre-gravity velocity to
 * feed Rapier. Rapier still applies gravity exactly once; the subtraction at
 * the end merely avoids applying the same acceleration twice.
 */
export function constrainedPreStepVelocity(
  out: MutableVec3,
  position: Readonly<Vec3>,
  velocity: Readonly<Vec3>,
  gravity: Readonly<Vec3>,
  constraints: readonly DistanceConstraint[],
  dt: number,
  iterations: number,
  damping: number,
  scratch: ConstraintScratch,
) {
  const safeDt = Math.max(1e-5, dt);
  const gravityVelocityX = gravity.x * safeDt;
  const gravityVelocityY = gravity.y * safeDt;
  const gravityVelocityZ = gravity.z * safeDt;
  const dampingFactor = Math.exp(-Math.max(0, damping) * safeDt);
  const integratedX = velocity.x * dampingFactor + gravityVelocityX;
  const integratedY = velocity.y * dampingFactor + gravityVelocityY;
  const integratedZ = velocity.z * dampingFactor + gravityVelocityZ;
  const predicted = scratch.predictedPosition;
  predicted.x = position.x + integratedX * safeDt;
  predicted.y = position.y + integratedY * safeDt;
  predicted.z = position.z + integratedZ * safeDt;

  for (let iteration = 0; iteration < Math.max(1, iterations); iteration += 1)
    for (const constraint of constraints)
      if (constraint.active) {
        if (constraint.maxDistanceOnly && Math.hypot(
          predicted.x - constraint.anchor.x,
          predicted.y - constraint.anchor.y,
          predicted.z - constraint.anchor.z,
        ) <= constraint.length) continue;
        solveDistanceConstraint(
          predicted,
          constraint.anchor,
          constraint.length,
        );
        solveSuspensionLimit(predicted, constraint, gravity);
      }

  const solved = scratch.solvedVelocity;
  solved.x = (predicted.x - position.x) / safeDt;
  solved.y = (predicted.y - position.y) / safeDt;
  solved.z = (predicted.z - position.z) / safeDt;

  // Reconstructing velocity from the corrected position is the PBD velocity
  // correction. Its tiny inward chord component is the discrete centripetal
  // term needed to arrive on the sphere; blindly projecting it away here
  // would reintroduce stretch on the very next Rapier integration.
  out.x = solved.x - gravityVelocityX;
  out.y = solved.y - gravityVelocityY;
  out.z = solved.z - gravityVelocityZ;
  return out;
}

export function releaseVelocity(
  out: MutableVec3,
  currentVelocity: Readonly<Vec3>,
  assistDirection: Readonly<Vec3>,
  assist: number,
) {
  out.x = currentVelocity.x + assistDirection.x * assist;
  out.y = currentVelocity.y + assistDirection.y * assist;
  out.z = currentVelocity.z + assistDirection.z * assist;
  return out;
}

export function ballisticPosition(
  out: MutableVec3,
  position: Readonly<Vec3>,
  velocity: Readonly<Vec3>,
  gravity: Readonly<Vec3>,
  time: number,
) {
  const halfTimeSquared = 0.5 * time * time;
  out.x = position.x + velocity.x * time + gravity.x * halfTimeSquared;
  out.y = position.y + velocity.y * time + gravity.y * halfTimeSquared;
  out.z = position.z + velocity.z * time + gravity.z * halfTimeSquared;
  return out;
}

export function scoreAnchor(input: AnchorScoreInput) {
  const futureX =
    input.position.x +
    input.velocity.x * input.predictionTime +
    0.5 * input.gravity.x * input.predictionTime ** 2;
  const futureY =
    input.position.y +
    input.velocity.y * input.predictionTime +
    0.5 * input.gravity.y * input.predictionTime ** 2;
  const futureZ =
    input.position.z +
    input.velocity.z * input.predictionTime +
    0.5 * input.gravity.z * input.predictionTime ** 2;
  const futureDx = input.anchor.x - futureX;
  const futureDy = input.anchor.y - futureY;
  const futureDz = input.anchor.z - futureZ;
  const futureDistance = Math.hypot(futureDx, futureDy, futureDz);
  const nowDx = input.anchor.x - input.position.x;
  const nowDy = input.anchor.y - input.position.y;
  const nowDz = input.anchor.z - input.position.z;
  const nowDistance = Math.max(EPSILON, Math.hypot(nowDx, nowDy, nowDz));
  let desiredX = input.desiredDirection.x;
  let desiredY = input.desiredDirection.y;
  let desiredZ = input.desiredDirection.z;
  let desiredLength = Math.hypot(desiredX, desiredY, desiredZ);
  if (desiredLength <= EPSILON) {
    desiredX = input.velocity.x;
    desiredY = input.velocity.y;
    desiredZ = input.velocity.z;
    desiredLength = Math.hypot(desiredX, desiredY, desiredZ);
  }
  desiredLength = Math.max(EPSILON, desiredLength);
  const direction =
    (nowDx * desiredX + nowDy * desiredY + nowDz * desiredZ) /
    (nowDistance * desiredLength);
  const side =
    (nowDx * input.right.x + nowDy * input.right.y + nowDz * input.right.z) /
    nowDistance;
  const wantedSide = input.hand === "left" ? -1 : 1;
  const reachableMargin = input.maxReach - futureDistance;
  if (reachableMargin < -input.maxReach * 0.5) return Number.NEGATIVE_INFINITY;
  return (
    direction * 2.1 +
    side * wantedSide * 0.28 +
    Math.min(0.5, reachableMargin) * 1.7 -
    futureDistance * 1.15 -
    Math.max(0, -direction) * 2.4
  );
}

/** Analytic two-bone joint solve with a pole vector and acos input clamping. */
export function solveTwoBoneJoint(
  out: MutableVec3,
  start: Readonly<Vec3>,
  target: Readonly<Vec3>,
  pole: Readonly<Vec3>,
  upperLength: number,
  lowerLength: number,
) {
  let dx = target.x - start.x;
  let dy = target.y - start.y;
  let dz = target.z - start.z;
  const rawDistance = Math.hypot(dx, dy, dz);
  if (
    rawDistance <= EPSILON ||
    upperLength <= EPSILON ||
    lowerLength <= EPSILON
  )
    return copyVector(out, start);
  dx /= rawDistance;
  dy /= rawDistance;
  dz /= rawDistance;
  const distance = Math.min(
    upperLength + lowerLength - 1e-6,
    Math.max(Math.abs(upperLength - lowerLength) + 1e-6, rawDistance),
  );
  const cosine = clampUnit(
    (upperLength * upperLength +
      distance * distance -
      lowerLength * lowerLength) /
      (2 * upperLength * distance),
  );
  const angle = Math.acos(cosine);
  const poleDot = pole.x * dx + pole.y * dy + pole.z * dz;
  let px = pole.x - dx * poleDot;
  let py = pole.y - dy * poleDot;
  let pz = pole.z - dz * poleDot;
  let poleLength = Math.hypot(px, py, pz);
  if (poleLength <= EPSILON) {
    px = Math.abs(dy) < 0.9 ? -dz : 0;
    py = Math.abs(dy) < 0.9 ? 0 : dz;
    pz = Math.abs(dy) < 0.9 ? dx : -dy;
    poleLength = Math.max(EPSILON, Math.hypot(px, py, pz));
  }
  px /= poleLength;
  py /= poleLength;
  pz /= poleLength;
  const along = Math.cos(angle) * upperLength;
  const bend = Math.sin(angle) * upperLength;
  out.x = start.x + dx * along + px * bend;
  out.y = start.y + dy * along + py * bend;
  out.z = start.z + dz * along + pz * bend;
  return out;
}
