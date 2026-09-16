import type { Vec3 } from "../types";
import type { LocalBasis, MutableVec3 } from "./brachiationPhysics";

export type ProceduralBodyDimensions = {
  /** Physical-root local coordinate of the lower point of the torso triangle. */
  baseOffset: Readonly<Vec3>;
  /** Local vector from the triangle's lower point to the clavicle midpoint. */
  baseToShoulderCenter: Readonly<Vec3>;
  shoulderWidth: number;
  /** Local vector from the triangle base to the midpoint of the two hips. */
  baseToHipCenter: Readonly<Vec3>;
  hipWidth: number;
};

export type ProceduralBodyPose = {
  leftShoulder: MutableVec3;
  rightShoulder: MutableVec3;
  base: MutableVec3;
  leftHip: MutableVec3;
  rightHip: MutableVec3;
};

function localPoint(
  out: MutableVec3,
  root: Readonly<Vec3>,
  basis: LocalBasis,
  x: number,
  y: number,
  z: number,
) {
  // The measured FBX convention is +X anatomical-left, +Y up, +Z forward.
  out.x =
    root.x - basis.right.x * x + basis.up.x * y + basis.forward.x * z;
  out.y =
    root.y - basis.right.y * x + basis.up.y * y + basis.forward.y * z;
  out.z =
    root.z - basis.right.z * x + basis.up.z * y + basis.forward.z * z;
  return out;
}

/**
 * Builds the rigid control structure used to drive the deform skeleton.
 * The clavicle and both shoulder-to-base diagonals are exact by construction;
 * hip pivots stay beside the lower triangle point and originate the leg IK.
 */
export function solveProceduralBodyPose(
  out: ProceduralBodyPose,
  root: Readonly<Vec3>,
  basis: LocalBasis,
  dimensions: ProceduralBodyDimensions,
) {
  const base = dimensions.baseOffset;
  localPoint(out.base, root, basis, base.x, base.y, base.z);
  const shoulders = dimensions.baseToShoulderCenter;
  const shoulderY = base.y + shoulders.y;
  const shoulderZ = base.z + shoulders.z;
  const shoulderCenterX = base.x + shoulders.x;
  localPoint(
    out.leftShoulder,
    root,
    basis,
    shoulderCenterX + dimensions.shoulderWidth * 0.5,
    shoulderY,
    shoulderZ,
  );
  localPoint(
    out.rightShoulder,
    root,
    basis,
    shoulderCenterX - dimensions.shoulderWidth * 0.5,
    shoulderY,
    shoulderZ,
  );
  const hips = dimensions.baseToHipCenter;
  const hipY = base.y + hips.y;
  const hipZ = base.z + hips.z;
  const hipCenterX = base.x + hips.x;
  localPoint(
    out.leftHip,
    root,
    basis,
    hipCenterX + dimensions.hipWidth * 0.5,
    hipY,
    hipZ,
  );
  localPoint(
    out.rightHip,
    root,
    basis,
    hipCenterX - dimensions.hipWidth * 0.5,
    hipY,
    hipZ,
  );
  return out;
}
