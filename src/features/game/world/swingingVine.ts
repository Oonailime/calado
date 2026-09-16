import type { Vec3 } from "../types";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  constrainedPreStepVelocity,
  projectTangential,
} from "../characters/brachiationPhysics";
import {
  PHYSICS_FIXED_DT,
  WORLD_GRAVITY,
} from "../characters/locomotionConfig";
import {
  VINE_GRIP_OFFSET,
  vineLength,
  type ArborealSite,
} from "./forestLayout";

export function createSwingingVine(site: ArborealSite) {
  const length = Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET);
  const anchor = { x: site.vine.x, y: site.vine.attachY, z: site.vine.z };
  const grip = site.vine.twoPoint
    ? { ...site.vine.twoPoint.grip }
    : { ...anchor, y: anchor.y - length };
  const tailEnd = site.vine.twoPoint?.rear ?? grip;
  const tail = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const position = {
      x: grip.x + (tailEnd.x - grip.x) * t,
      y: grip.y + (tailEnd.y - grip.y) * t,
      z: grip.z + (tailEnd.z - grip.z) * t,
    };
    return { position, previous: { ...position } };
  });
  const initialPoints = new CatmullRomCurve3(
    [anchor, grip, tailEnd].map((p) => new Vector3(p.x, p.y, p.z)),
  ).getPoints(32);
  initialPoints[0].copy(anchor);
  initialPoints[16].copy(grip);
  initialPoints[32].copy(tailEnd);
  const totalLength = initialPoints
    .slice(1)
    .reduce((sum, p, i) => sum + p.distanceTo(initialPoints[i]), 0);
  return {
    grip,
    velocity: { x: 0, y: 0, z: 0 },
    held: false,
    releasedAttachment: null as "rear" | "front" | null,
    paired: !!site.vine.twoPoint,
    tail,
    tailSegmentLength:
      Math.hypot(tailEnd.x - grip.x, tailEnd.y - grip.y, tailEnd.z - grip.z) /
      12,
    initialPoints,
    totalLength,
    constraints: [{ active: true, anchor, length, maxDistanceOnly: false }],
    predictedPosition: { x: 0, y: 0, z: 0 },
    solvedVelocity: { x: 0, y: 0, z: 0 },
    radial: { x: 0, y: -1, z: 0 },
  };
}

export type SwingingVineState = ReturnType<typeof createSwingingVine>;

/** Release whichever tie lies behind the incoming motion; the other stays fixed. */
export function releaseRearVineTie(
  state: SwingingVineState,
  site: ArborealSite,
  travel: Vec3,
  contact?: Vec3,
) {
  const span = site.vine.twoPoint;
  if (!span) return;
  if (state.releasedAttachment && !contact) return;
  const points = swingingVinePoints(state).map((p) => ({ ...p }));
  const front = { x: site.vine.x, y: site.vine.attachY, z: site.vine.z };
  if (!state.releasedAttachment) {
    const fixedAttachment = span.fixedAttachment;
    const reverse = fixedAttachment
      ? fixedAttachment === "rear"
      : (front.x - span.rear.x) * travel.x +
          (front.z - span.rear.z) * travel.z <
        0;
    state.releasedAttachment = reverse ? "front" : "rear";
    if (reverse) points.reverse();
    Object.assign(state.constraints[0].anchor, reverse ? span.rear : front);
  }
  const location = closestPolylinePoint(
    points,
    contact ?? state.grip,
    state.grip,
  );
  const materialFraction = location.along / Math.max(0.001, location.total);
  state.constraints[0].length = Math.max(
    0.2,
    materialFraction * state.totalLength,
  );
  state.constraints[0].maxDistanceOnly = true;
  state.tailSegmentLength =
    Math.max(0, state.totalLength - state.constraints[0].length) / 12;
  state.tail.forEach((p, i) => {
    samplePolyline(
      points,
      location.along + ((location.total - location.along) * i) / 12,
      p.position,
    );
    Object.assign(p.previous, p.position);
  });
}

function samplePolyline(points: readonly Vec3[], distance: number, out: Vec3) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (distance <= length || i === points.length - 1) {
      const t = Math.max(0, Math.min(1, distance / Math.max(1e-8, length)));
      out.x = a.x + (b.x - a.x) * t;
      out.y = a.y + (b.y - a.y) * t;
      out.z = a.z + (b.z - a.z) * t;
      return;
    }
    distance -= length;
  }
}

function closestPolylinePoint(
  points: readonly Vec3[],
  origin: Vec3,
  out: Vec3,
  minimumY = -Infinity,
) {
  const ox = origin.x,
    oy = origin.y,
    oz = origin.z;
  let best = Infinity,
    along = 0,
    total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const length = Math.sqrt(lengthSquared);
    let low = 0,
      high = 1;
    if (a.y < minimumY && b.y < minimumY) {
      total += length;
      continue;
    }
    if (a.y < minimumY) low = (minimumY - a.y) / dy;
    if (b.y < minimumY) high = (minimumY - a.y) / dy;
    const t = Math.max(
      low,
      Math.min(
        high,
        ((ox - a.x) * dx + (oy - a.y) * dy + (oz - a.z) * dz) /
          Math.max(1e-8, lengthSquared),
      ),
    );
    const x = a.x + dx * t,
      y = a.y + dy * t,
      z = a.z + dz * t;
    const distance = (x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2;
    if (distance < best) {
      best = distance;
      along = total + length * t;
      out.x = x;
      out.y = y;
      out.z = z;
    }
    total += length;
  }
  return { along, total, distance: Math.sqrt(best) };
}

/** Every visible segment is grabbable from below, including a released tail. */
export function closestSwingingVineGrip(
  state: SwingingVineState,
  position: Vec3,
  out: Vec3,
) {
  const origin = { x: position.x, y: position.y + 0.65, z: position.z };
  Object.assign(out, state.grip);
  return closestPolylinePoint(
    swingingVinePoints(state),
    origin,
    out,
    position.y + 0.1,
  ).distance;
}

function stepTail(state: SwingingVineState) {
  const dt = PHYSICS_FIXED_DT;
  const { tail } = state;
  for (let i = 1; i < tail.length; i++) {
    const p = tail[i];
    for (const axis of ["x", "y", "z"] as const) {
      const next =
        p.position[axis] +
        (p.position[axis] - p.previous[axis]) * 0.99 +
        WORLD_GRAVITY[axis] * dt * dt;
      p.previous[axis] = p.position[axis];
      p.position[axis] = next;
    }
  }
  for (let iteration = 0; iteration < 12; iteration++) {
    Object.assign(tail[0].position, state.grip);
    for (let i = 1; i < tail.length; i++) {
      const a = tail[i - 1].position,
        b = tail[i].position;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const distance = Math.max(1e-8, Math.hypot(dx, dy, dz));
      const correction = (distance - state.tailSegmentLength) / distance;
      const weight = i === 1 ? 1 : 0.5;
      b.x -= dx * correction * weight;
      b.y -= dy * correction * weight;
      b.z -= dz * correction * weight;
      if (i > 1) {
        a.x += dx * correction * weight;
        a.y += dy * correction * weight;
        a.z += dz * correction * weight;
      }
    }
  }
}

/** World-space centerline shared by the visible rope and both physical ends. */
export function swingingVinePoints(
  state: SwingingVineState,
  grip = state.grip,
): Vec3[] {
  if (state.paired && !state.releasedAttachment) return state.initialPoints;
  const anchor = state.constraints[0].anchor;
  const distance = Math.hypot(
    grip.x - anchor.x,
    grip.y - anchor.y,
    grip.z - anchor.z,
  );
  const slack =
    Math.sqrt(Math.max(0, state.constraints[0].length ** 2 - distance ** 2)) *
    0.4;
  const points = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    return {
      x: anchor.x + (grip.x - anchor.x) * t,
      y: anchor.y + (grip.y - anchor.y) * t - Math.sin(t * Math.PI) * slack,
      z: anchor.z + (grip.z - anchor.z) * t,
    };
  });
  if (state.paired) points.push(...state.tail.slice(1).map((p) => p.position));
  return points;
}

/** Free ropes retain their last contact velocity on the same fixed clock as Rapier. */
export function stepSwingingVine(
  state: ReturnType<typeof createSwingingVine>,
  contact?: Vec3,
) {
  const dt = PHYSICS_FIXED_DT;
  if (state.paired && !state.releasedAttachment) return;
  if (contact) {
    for (const axis of ["x", "y", "z"] as const) {
      state.velocity[axis] = state.held
        ? (contact[axis] - state.grip[axis]) / dt
        : 0;
      state.grip[axis] = contact[axis];
    }
    state.held = true;
    if (state.paired) stepTail(state);
    return;
  }
  state.held = false;
  constrainedPreStepVelocity(
    state.velocity,
    state.grip,
    state.velocity,
    WORLD_GRAVITY,
    state.constraints,
    dt,
    1,
    0.08,
    state,
  );
  for (const axis of ["x", "y", "z"] as const) {
    state.velocity[axis] += WORLD_GRAVITY[axis] * dt;
    state.grip[axis] += state.velocity[axis] * dt;
    state.radial[axis] =
      (state.grip[axis] - state.constraints[0].anchor[axis]) /
      state.constraints[0].length;
  }
  if (Math.hypot(state.radial.x, state.radial.y, state.radial.z) >= 1 - 1e-6)
    projectTangential(state.velocity, state.velocity, state.radial);
  if (state.paired) stepTail(state);
}
