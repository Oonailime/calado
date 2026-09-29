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

/** Segments of the free rope; 33 points, the same count the renderer draws. */
const FREE_SEGMENTS = 32;
/** Per-step velocity retention of an unheld rope (about 26% lost per second). */
const FREE_DAMPING = 0.995;
const FREE_ITERATIONS = 24;
/**
 * A loose rope hangs straight along the body, so the reach aims this far
 * above the body's center: over the shoulders (a grab from the ground needs
 * that) and about where the hand sits when the monkey hangs, so closing the
 * hand does not yank the body up the rope. Raised ropes keep the older
 * chest-height aim.
 */
export const FREE_ROPE_REACH_LIFT = 0.9;
const HELD_ROPE_REACH_LIFT = 0.65;

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
    // Once no hand holds a released rope, the whole length becomes this free
    // chain hanging from the remaining tie: no point keeps the mass of the
    // monkey who let go, and any point of it can be grabbed again.
    free: false,
    chain: Array.from({ length: FREE_SEGMENTS + 1 }, () => ({
      position: { x: 0, y: 0, z: 0 },
      previous: { x: 0, y: 0, z: 0 },
    })),
    freeGripIndex: FREE_SEGMENTS / 2,
    // Support length at the authored grip once the first tie lets go: the
    // pendulum the route was designed around. A lower regrab climbs back to it.
    hangLength: length,
    // A hand closed on the rope this tick; its contact arrives next tick.
    captured: false,
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
    const authored = closestPolylinePoint(points, span.grip, { x: 0, y: 0, z: 0 });
    state.hangLength = Math.max(
      0.2,
      (authored.along / Math.max(0.001, authored.total)) * state.totalLength,
    );
  }
  splitRopeAt(state, points, contact ?? state.grip);
  state.captured = !!contact;
}

/**
 * The hand closes on `contact`: the rope from the tie to that point becomes
 * the pendulum support and the rest hangs below the hand as the tail.
 */
function splitRopeAt(state: SwingingVineState, points: readonly Vec3[], contact: Vec3) {
  // A free chain keeps its motion in its previous positions; the tail below
  // the hand inherits it instead of starting at rest.
  const previous = state.free ? state.chain.map((p) => p.previous) : null;
  const location = closestPolylinePoint(points, contact, state.grip);
  const materialFraction = location.along / Math.max(0.001, location.total);
  state.constraints[0].length = Math.max(
    0.2,
    materialFraction * state.totalLength,
  );
  state.constraints[0].maxDistanceOnly = true;
  state.tailSegmentLength =
    Math.max(0, state.totalLength - state.constraints[0].length) / 12;
  state.tail.forEach((p, i) => {
    const along = location.along + ((location.total - location.along) * i) / 12;
    samplePolyline(points, along, p.position);
    if (previous) samplePolyline(previous, along, p.previous);
    else Object.assign(p.previous, p.position);
  });
  state.free = false;
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
  const lift = state.free ? FREE_ROPE_REACH_LIFT : HELD_ROPE_REACH_LIFT;
  const origin = { x: position.x, y: position.y + lift, z: position.z };
  Object.assign(out, state.grip);
  return closestPolylinePoint(
    swingingVinePoints(state),
    origin,
    out,
    position.y + 0.1,
  ).distance;
}

/**
 * Turns the held shape (support segment + tail) into a free chain of the
 * rope's full length, keeping each point's current motion.
 */
function freeRope(state: SwingingVineState) {
  const dt = PHYSICS_FIXED_DT;
  const points = swingingVinePoints(state);
  // The support segment moves like a rod: speed grows with distance from the
  // tie. Tail points carry their own Verlet displacement.
  const rodCount = points.length - (state.tail.length - 1);
  const deltas = points.map((_, i) => {
    if (i < rodCount) {
      const f = i / (rodCount - 1);
      return {
        x: state.velocity.x * dt * f,
        y: state.velocity.y * dt * f,
        z: state.velocity.z * dt * f,
      };
    }
    const t = state.tail[i - rodCount + 1];
    return {
      x: t.position.x - t.previous.x,
      y: t.position.y - t.previous.y,
      z: t.position.z - t.previous.z,
    };
  });
  const cumulative = [0];
  for (let i = 1; i < points.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          points[i].z - points[i - 1].z,
        ),
    );
  const total = cumulative.at(-1)!;
  let segment = 1;
  state.chain.forEach((node, k) => {
    const distance = (total * k) / FREE_SEGMENTS;
    while (segment < points.length - 1 && cumulative[segment] < distance)
      segment++;
    const span = Math.max(1e-8, cumulative[segment] - cumulative[segment - 1]);
    const t = Math.max(0, Math.min(1, (distance - cumulative[segment - 1]) / span));
    const a = points[segment - 1],
      b = points[segment],
      da = deltas[segment - 1],
      db = deltas[segment];
    for (const axis of ["x", "y", "z"] as const) {
      node.position[axis] = a[axis] + (b[axis] - a[axis]) * t;
      node.previous[axis] =
        node.position[axis] - (da[axis] + (db[axis] - da[axis]) * t);
    }
  });
  Object.assign(state.chain[0].position, state.constraints[0].anchor);
  Object.assign(state.chain[0].previous, state.constraints[0].anchor);
  state.freeGripIndex = Math.round(
    (state.constraints[0].length / state.totalLength) * FREE_SEGMENTS,
  );
  state.free = true;
}

/** Verlet rope pinned only at its remaining tie. */
function stepFreeRope(state: SwingingVineState) {
  const dt = PHYSICS_FIXED_DT;
  const { chain } = state;
  const anchor = state.constraints[0].anchor;
  const segmentLength = state.totalLength / FREE_SEGMENTS;
  for (let i = 1; i < chain.length; i++) {
    const p = chain[i];
    for (const axis of ["x", "y", "z"] as const) {
      const next =
        p.position[axis] +
        (p.position[axis] - p.previous[axis]) * FREE_DAMPING +
        WORLD_GRAVITY[axis] * dt * dt;
      p.previous[axis] = p.position[axis];
      p.position[axis] = next;
    }
  }
  for (let iteration = 0; iteration < FREE_ITERATIONS; iteration++) {
    Object.assign(chain[0].position, anchor);
    // Alternate sweep directions so the correction reaches both ends evenly.
    const forward = iteration % 2 === 0;
    for (let n = 1; n < chain.length; n++) {
      const i = forward ? n : chain.length - n;
      const a = chain[i - 1].position,
        b = chain[i].position;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const distance = Math.max(1e-8, Math.hypot(dx, dy, dz));
      const correction = (distance - segmentLength) / distance;
      const weightA = i === 1 ? 0 : 0.5,
        weightB = i === 1 ? 1 : 0.5;
      a.x += dx * correction * weightA;
      a.y += dy * correction * weightA;
      a.z += dz * correction * weightA;
      b.x -= dx * correction * weightB;
      b.y -= dy * correction * weightB;
      b.z -= dz * correction * weightB;
    }
  }
  Object.assign(chain[0].position, anchor);
  const grip = chain[state.freeGripIndex];
  for (const axis of ["x", "y", "z"] as const) {
    state.velocity[axis] = (grip.position[axis] - grip.previous[axis]) / dt;
    state.grip[axis] = grip.position[axis];
  }
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
  if (state.free) return state.chain.map((p) => p.position);
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

/**
 * Held ropes follow the hand; a released paired rope nobody holds becomes a
 * free chain that keeps its last motion on the same fixed clock as Rapier.
 */
export function stepSwingingVine(
  state: ReturnType<typeof createSwingingVine>,
  contact?: Vec3,
) {
  const dt = PHYSICS_FIXED_DT;
  if (state.paired && !state.releasedAttachment) return;
  if (contact) {
    state.captured = false;
    if (state.free) splitRopeAt(state, swingingVinePoints(state), contact);
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
  if (state.paired) {
    // The hand that just closed on the rope publishes its contact after this
    // step; keep the fresh split instead of freeing the rope for one tick.
    if (state.captured) {
      state.captured = false;
      return;
    }
    if (!state.free) freeRope(state);
    stepFreeRope(state);
    return;
  }
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
}

/**
 * Ties every released rope that no hand holds back at both ends, in its
 * authored shape. Used when a fall restarts the canopy climb.
 */
export function rerigUnheldSwingingVines(
  vines: Map<string, SwingingVineState>,
  contacts: readonly {
    left: { siteId: string } | null;
    right: { siteId: string } | null;
  }[],
  sites: readonly ArborealSite[],
) {
  const held = new Set<string>();
  for (const hands of contacts)
    for (const hand of [hands.left, hands.right]) if (hand) held.add(hand.siteId);
  for (const site of sites) {
    const rope = vines.get(site.id);
    if (site.vine.twoPoint && rope?.releasedAttachment && !held.has(site.id))
      vines.set(site.id, createSwingingVine(site));
  }
}

/**
 * Climbs the held rope back toward its authored pendulum length at `rate`
 * (m/s), slowing over the last `ease` metres so the body arrives without
 * momentum up the rope, and pays the difference into the tail below the
 * hand. Returns true while the support is still longer than that length.
 */
export function hoistSwingingVine(
  state: SwingingVineState,
  dt: number,
  rate: number,
  ease = 0.6,
) {
  const constraint = state.constraints[0];
  const remaining = constraint.length - state.hangLength;
  const speed = rate * Math.max(0.2, Math.min(1, remaining / ease));
  constraint.length = Math.max(state.hangLength, constraint.length - speed * dt);
  state.tailSegmentLength =
    Math.max(0, state.totalLength - constraint.length) / 12;
  return constraint.length > state.hangLength + 1e-3;
}

/**
 * Holding a direction on a canopy pendulum pumps it: the push only acts while
 * the swing already moves that way (or hangs nearly still), so a monkey
 * hanging at rest - after regrabbing a loose rope - builds a real swing
 * instead of leaning to a tilted rest. Energy is capped at a 150 degree
 * swing so a held key never loops the pendulum over its support.
 */
export const PENDULUM_PUMP_ACCELERATION = 2.2;
export const PENDULUM_PUMP_MAX_ANGLE = (100 * Math.PI) / 180;
export function pendulumPumpAllowed(
  position: Readonly<Vec3>,
  velocity: Readonly<Vec3>,
  direction: Readonly<Vec3>,
  support: Readonly<Vec3>,
  length: number,
) {
  const along =
    velocity.x * direction.x + velocity.y * direction.y + velocity.z * direction.z;
  if (along < -0.2) return false;
  const gravity = Math.hypot(WORLD_GRAVITY.x, WORLD_GRAVITY.y, WORLD_GRAVITY.z);
  const height = position.y - (support.y - length);
  const energy =
    0.5 * (velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) +
    gravity * height;
  return energy < gravity * length * (1 - Math.cos(PENDULUM_PUMP_MAX_ANGLE));
}
