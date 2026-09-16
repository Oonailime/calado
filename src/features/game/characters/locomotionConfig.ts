import type { Vec3 } from "../types";

/** One fixed clock drives Rapier and every procedural locomotion constraint. */
export const PHYSICS_FIXED_DT = 1 / 60;

/** World-space acceleration. Character code derives its up axis from this. */
export const WORLD_GRAVITY = Object.freeze({
  x: 0,
  y: -9.81,
  z: 0,
}) satisfies Readonly<Vec3>;

export const LOCOMOTION_TUNING = Object.freeze({
  groundSpeed: 4,
  jumpSpeed: 6,
  groundProbeDistance: 0.62,
  airAcceleration: 5.5,
  swingConstraintIterations: 8,
  swingDamping: 0.035,
  grabRadius: 0.16,
  maxArmStretch: 1.005,
  armReachRatio: 0.98,
  attachSmoothing: 0.15,
  minShoulderDrop: 0.22,
  reachPredictionTime: 0.34,
  reachTimeout: 0.62,
  handoffOverlap: 0.65,
  releaseThreshold: 0.08,
  landingDuration: 0.18,
  landingPredictionTime: 0.36,
  swingAssist: 1.6,
  handoffAssist: 10,
  releaseAssist: 0,
  torsoSmoothing: 8,
  headSmoothing: 7,
  headMaxLookAngle: 0.7,
  maxDebugCandidates: 12,
});
