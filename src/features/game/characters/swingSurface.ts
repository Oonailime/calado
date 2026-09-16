import type { Vec3 } from "../types";

export type SwingSurface = {
  point: Vec3;
  normal: Vec3;
  tangent: Vec3;
  speed: number;
  driveSpeed: number;
  phase: number;
};

export const SURFACE_STRIDE = 0.42;
export const SURFACE_STANCE = 0.62;

/** Keep the incoming swing direction when an impact has already stopped the body. */
export function surfaceTravelDirection(
  out: Vec3,
  normal: Vec3,
  incoming: Vec3,
  towardSupport: Vec3,
  fallback: Vec3,
) {
  for (const candidate of [
    incoming,
    towardSupport,
    fallback,
    { x: 0, y: 1, z: 0 },
  ]) {
    const dot =
      candidate.x * normal.x + candidate.y * normal.y + candidate.z * normal.z;
    out.x = candidate.x - dot * normal.x;
    out.y = candidate.y - dot * normal.y;
    out.z = candidate.z - dot * normal.z;
    const length = Math.hypot(out.x, out.y, out.z);
    if (length > 0.05) {
      out.x /= length;
      out.y /= length;
      out.z /= length;
      return out;
    }
  }
  return out;
}

/** Leg traction is applied before the rope constraint and Rapier collisions. */
export function driveSwingSurface(
  out: Vec3,
  velocity: Vec3,
  surface: SwingSurface,
  dt: number,
) {
  const { tangent, normal } = surface;
  const speed =
    velocity.x * tangent.x + velocity.y * tangent.y + velocity.z * tangent.z;
  const change = Math.max(
    -12 * dt,
    Math.min(12 * dt, surface.driveSpeed - speed),
  );
  const inward =
    velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
  for (const axis of ["x", "y", "z"] as const)
    out[axis] =
      velocity[axis] + tangent[axis] * change - normal[axis] * (inward + 0.18);
  return out;
}

/** Alternating foot plants on a floor, branch or wall, along actual swing motion. */
export function sampleSwingSurfaceFoot(
  out: Vec3,
  hip: Vec3,
  surface: SwingSurface,
  side: "left" | "right",
  reach: number,
) {
  const { point, normal, tangent } = surface;
  const height =
    (hip.x - point.x) * normal.x +
    (hip.y - point.y) * normal.y +
    (hip.z - point.z) * normal.z;
  if (Math.abs(height) > reach + 0.12) return false;
  const phase = (((surface.phase + (side === "left" ? 0 : 0.5)) % 1) + 1) % 1;
  const recovering = phase >= SURFACE_STANCE;
  const t = recovering
    ? (phase - SURFACE_STANCE) / (1 - SURFACE_STANCE)
    : phase / SURFACE_STANCE;
  const stride = Math.max(
    0.18,
    Math.min(
      SURFACE_STRIDE,
      Math.sqrt(Math.max(0, reach ** 2 - height ** 2)) * 1.4,
    ),
  );
  const offset =
    surface.speed < 0.05
      ? 0
      : recovering
        ? (t - 0.5) * stride
        : (0.5 - t) * stride;
  const lift =
    recovering && surface.speed > 0.05 ? Math.sin(t * Math.PI) * 0.1 : 0;
  for (const axis of ["x", "y", "z"] as const)
    out[axis] =
      hip[axis] -
      normal[axis] * height +
      tangent[axis] * offset +
      normal[axis] * (0.015 + lift);
  return true;
}
