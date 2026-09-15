import { MathUtils, Vector3 } from "three";
import type { Vec3 } from "../types";

const STEP = 1 / 120;
export const LEG_LIMITS = { hip: 0.85, kneeMin: 0.12, kneeMax: 1.45 } as const;
type LegMotion = {
  forward?: Readonly<Vec3>;
  travel?: Readonly<Vec3>;
  pump?: number;
  grip?: number;
  flight?: number;
};

/** Rigid thigh → hinge knee → rigid shin; gravity acts on both links. */
export class SuspendedLeg {
  readonly knee = new Vector3();
  readonly foot = new Vector3();
  readonly thighLength: number;
  readonly shinLength: number;
  private elapsed = 0;
  private readonly hip = new Vector3();
  private readonly previousHip = new Vector3();
  private readonly nextHip = new Vector3();
  private readonly velocity = new Vector3();
  private readonly acceleration = new Vector3();
  private readonly thigh = new Vector3();
  private readonly thighRate = new Vector3();
  private readonly forward = new Vector3(0, 0, 1);
  private readonly travel = new Vector3(0, 0, 1);
  private readonly bend = new Vector3();
  private readonly target = new Vector3();
  private readonly scratch = new Vector3();
  private flex = 0.2;
  private flexRate = 0;

  constructor(hip: Vector3, knee: Vector3, foot: Vector3) {
    this.thighLength = hip.distanceTo(knee);
    this.shinLength = knee.distanceTo(foot);
    this.thigh.subVectors(knee, hip).normalize();
    this.flex = MathUtils.clamp(
      this.scratch.subVectors(foot, knee).normalize().angleTo(this.thigh),
      LEG_LIMITS.kneeMin,
      LEG_LIMITS.kneeMax,
    );
    this.hip.copy(hip);
    this.previousHip.copy(hip);
    this.knee.copy(knee);
    this.foot.copy(foot);
  }

  get kneeFlexion() {
    return this.flex;
  }

  update(hip: Readonly<Vec3>, delta: number, motion: LegMotion = {}) {
    this.nextHip.set(hip.x, hip.y, hip.z);
    if (motion.forward) this.forward.copy(motion.forward).normalize();
    this.travel.copy(motion.travel ?? this.forward).normalize();
    if (this.previousHip.distanceTo(this.nextHip) > 2) {
      this.previousHip.copy(this.nextHip);
      this.hip.copy(this.nextHip);
      this.velocity.set(0, 0, 0);
      this.acceleration.set(0, 0, 0);
      this.thighRate.set(0, 0, 0);
    }
    const frameTime = Math.max(0, Math.min(delta, 0.1));
    let time = STEP - this.elapsed;
    this.elapsed += frameTime;
    while (this.elapsed + 1e-10 >= STEP) {
      this.scratch.lerpVectors(
        this.previousHip,
        this.nextHip,
        Math.min(1, time / Math.max(frameTime, STEP)),
      );
      this.target.subVectors(this.scratch, this.hip).divideScalar(STEP);
      this.scratch
        .subVectors(this.target, this.velocity)
        .divideScalar(STEP)
        .clampLength(0, 18);
      this.acceleration.lerp(this.scratch, 1 - Math.exp(-8 * STEP));
      this.velocity.copy(this.target);
      this.hip.lerpVectors(
        this.previousHip,
        this.nextHip,
        Math.min(1, time / Math.max(frameTime, STEP)),
      );
      const pump = MathUtils.clamp(motion.pump ?? 0, 0, 1);
      const grip = MathUtils.clamp(motion.grip ?? 0, 0, 1);
      const flight = MathUtils.clamp(motion.flight ?? 0, 0, 1);
      // Extend in flight instead of increasing the crouch after release.
      const targetFlex = MathUtils.lerp(
        0.2 + pump * 0.48 + grip * 0.95,
        LEG_LIMITS.kneeMin,
        flight,
      );
      // Muscle stiffness and damping at a one-way hinge prevent rope motion.
      const gravityTorque =
        (-9.81 / Math.max(0.05, this.shinLength)) * Math.sin(this.flex) * 0.12;
      this.flexRate +=
        ((targetFlex - this.flex) * 70 - this.flexRate * 14 + gravityTorque) *
        STEP;
      this.flex = MathUtils.clamp(
        this.flex + this.flexRate * STEP,
        LEG_LIMITS.kneeMin,
        LEG_LIMITS.kneeMax,
      );
      this.target
        .set(0, -9.81 + grip * 3, 0)
        .addScaledVector(this.acceleration, -0.55)
        .addScaledVector(this.velocity, -0.5)
        .addScaledVector(
          this.forward,
          (1.0 + pump * 2.4 + grip * 7) * (1 - flight),
        )
        .addScaledVector(this.travel, -flight * 9)
        .normalize();
      this.scratch
        .copy(this.target)
        .sub(this.thigh)
        .multiplyScalar(42)
        .addScaledVector(this.thighRate, -9);
      this.thighRate.addScaledVector(this.scratch, STEP);
      this.thigh.addScaledVector(this.thighRate, STEP).normalize();
      if (-this.thigh.y < Math.cos(LEG_LIMITS.hip)) {
        this.thigh.y = 0;
        if (this.thigh.lengthSq() < 1e-8) this.thigh.copy(this.forward);
        this.thigh.normalize().multiplyScalar(Math.sin(LEG_LIMITS.hip));
        this.thigh.y = -Math.cos(LEG_LIMITS.hip);
      }
      this.thighRate.addScaledVector(
        this.thigh,
        -this.thighRate.dot(this.thigh),
      );
      this.elapsed -= STEP;
      time += STEP;
    }
    this.previousHip.copy(this.nextHip);
    this.knee.copy(this.nextHip).addScaledVector(this.thigh, this.thighLength);
    this.bend
      .copy(this.forward)
      .addScaledVector(this.thigh, -this.forward.dot(this.thigh))
      .normalize();
    this.foot
      .copy(this.knee)
      .addScaledVector(this.thigh, this.shinLength * Math.cos(this.flex))
      .addScaledVector(this.bend, -this.shinLength * Math.sin(this.flex));
  }
}
