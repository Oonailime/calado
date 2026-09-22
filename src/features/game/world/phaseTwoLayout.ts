import { MathUtils } from "three";
import type { CharacterId, Vec3 } from "../types";

export const PHASE_TWO_TREE = [-6, 2] as const;
export const PHASE_TWO_TABLE = [0, 5] as const;
export const PHASE_TWO_CHESS_SCALE = 0.48;
export const PHASE_TWO_PORTAL = { x: -8.5, y: 6, z: 6, halfWidth: 2.55, halfDepth: 1.36, groundInset: 0.04 } as const;
export const PHASE_TWO_START = { x: 123, y: -3, z: -28 } as const;
export const PHASE_TWO_START_YAW = Math.atan2(123 + 4, -28 - 5);
export const PHASE_TWO_ARRIVAL_PORTAL = {
  x: 127.2, y: -3.65, z: -29.1, rotationY: PHASE_TWO_START_YAW,
  halfWidth: 2.55, halfDepth: 1.36, groundInset: 0,
} as const;
// A flat sea the whole map's low ground floods into, turning the volcanoes,
// the ramp and the arrival shelf into islands/routes rising above it. Kept
// safely below the arrival shelf (-3.65) and the walkable route so neither
// is ever submerged.
export const PHASE_TWO_LAVA_SEA_LEVEL = -4.5;

// The approach is the sightline from the arrival to the clearing. Once past
// the dry grove it climbs counter-clockwise (seen from above), at the same pace.
const rampStartAngle = Math.atan2(PHASE_TWO_START.z - 5, PHASE_TWO_START.x + 4);
const approachZ = (x: number) => 5 + (x + 4) * (PHASE_TWO_START.z - 5) / (PHASE_TWO_START.x + 4);
export const PHASE_TWO_RAMP = Array.from({ length: 81 }, (_, i) => {
  const t = i / 80, angle = rampStartAngle - t * Math.PI * 1.5, radius = 30 - 20 * t;
  return { x: -4 + Math.cos(angle) * radius, z: 5 + Math.sin(angle) * radius, y: -3.65 + 9.65 * t };
});
export const PHASE_TWO_APPROACH = [
  ...[130, 123, 104, 84, 62, 40].map(x => [x, approachZ(x)] as const),
  [PHASE_TWO_RAMP[0].x, PHASE_TWO_RAMP[0].z] as const,
];
export const PHASE_TWO_ROUTE = [
  ...PHASE_TWO_APPROACH.map(([x, z]) => ({ x, z, y: -3.65 })),
  ...PHASE_TWO_RAMP.slice(1), { x: -4, z: 5, y: 6 }, { x: 0, z: 5, y: 6 },
];
export const PHASE_TWO_PICKUPS = [
  // Right at the first waypoint past the arrival portal — the first thing
  // in view on leaving it, not lost somewhere along a long open stretch.
  { id: 0, kind: "pawn", x: 130, z: approachZ(130), label: "Peão" },
  // x=62 sat almost on top of one of the volcanoes (see PHASE_TWO_VOLCANOES'
  // x67,z-6 entry) — phaseTwoGroundHeight deliberately doesn't carve the
  // walkable path through a volcano's own slope (that would cut the volcano
  // in half), so the piece ended up stranded on real, steep volcanic
  // terrain. x=40 is another existing approach waypoint, safely clear of
  // every volcano's radius.
  { id: 1, kind: "knight", x: 40, z: approachZ(40), label: "Cavalo" },
  { id: 2, kind: "rook", x: PHASE_TWO_RAMP[24].x, z: PHASE_TWO_RAMP[24].z, label: "Torre" },
] as const;

export function phaseTwoRouteProjection(x: number, z: number) {
  let distance = Infinity, height = -3.65, index = 0, progress = 0;
  for (let i = 0; i < PHASE_TWO_ROUTE.length - 1; i++) {
    const a = PHASE_TWO_ROUTE[i], b = PHASE_TWO_ROUTE[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (d < distance) { distance = d; height = MathUtils.lerp(a.y, b.y, t); index = i; progress = t; }
  }
  return { distance, height, index, progress };
}

export function phaseTwoFollowTarget(position: Vec3, leader: Vec3) {
  const from = phaseTwoRouteProjection(position.x, position.z);
  const to = phaseTwoRouteProjection(leader.x, leader.z);
  if (from.distance < 6 && to.distance < 6 && Math.abs(to.index - from.index) > 1) {
    return PHASE_TWO_ROUTE[to.index > from.index ? Math.min(PHASE_TWO_ROUTE.length-1, from.index + (from.progress > 0.8 ? 2 : 1)) : Math.max(0, from.index - (from.progress < 0.2 ? 1 : 0))];
  }
  return leader;
}
// The armies face one another along Z; the seats belong behind their back ranks.
export const PHASE_TWO_STOOLS = [-1, 1].map((side) => ({
  x: PHASE_TWO_TABLE[0],
  z: PHASE_TWO_TABLE[1] + side * 2.35 * PHASE_TWO_CHESS_SCALE,
  radius: 0.67 * PHASE_TWO_CHESS_SCALE,
  halfHeight: 0.44 * PHASE_TWO_CHESS_SCALE,
  rotationY: side < 0 ? 0 : Math.PI,
  // The idle model's feet are 0.44 below its rigid-body origin.
  seatedHeight: 0.88 * PHASE_TWO_CHESS_SCALE + 0.44,
}));
// Viewed from the light army (negative Z), files run from +X to -X.
// The queen occupies her own color: light at (column 4, row 0), dark at (4, 7).
export const PHASE_TWO_CHESS_BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "king",
  "queen",
  "bishop",
  "knight",
  "rook",
] as const;
export const PHASE_TWO_VOLCANOES = [
  { x: 8, z: -102, radius: 37, height: 62, seed: 3 },
  { x: -23, z: -53, radius: 25, height: 34, seed: 7 },
  { x: -67, z: -93, radius: 29, height: 40, seed: 11 },
  { x: 68, z: -91, radius: 28, height: 36, seed: 19 },
  { x: 34, z: -48, radius: 17, height: 23, seed: 23 },
  { x: -88, z: -39, radius: 22, height: 25, seed: 31 },
  { x: 67, z: -6, radius: 23, height: 30, seed: 41 },
  { x: 105, z: -127, radius: 32, height: 42, seed: 47 },
  // A separate, deliberately sparser group behind the clearing, hand-spaced
  // so no pair (and no pair with the front cluster above) ends up close
  // enough to merge into one blob — fewer peaks, kept well clear of the
  // others and of the clearing/spawn, reaching about as far back as the
  // front cluster reaches forward so the range encircles the sanctuary.
  { x: 0, z: 190, radius: 40, height: 66, seed: 101 },
  { x: -90, z: 150, radius: 26, height: 34, seed: 103 },
  { x: 90, z: 150, radius: 27, height: 36, seed: 107 },
  { x: -150, z: 95, radius: 24, height: 30, seed: 109 },
  { x: 150, z: 95, radius: 25, height: 32, seed: 113 },
  { x: -55, z: 60, radius: 20, height: 26, seed: 127 },
  { x: 60, z: 55, radius: 21, height: 27, seed: 131 },
  { x: 0, z: 110, radius: 22, height: 28, seed: 137 },
] as const;

export function phaseTwoRandom(seed: number) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function phaseTwoNoise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const fx = MathUtils.smoothstep(x - ix, 0, 1);
  const fz = MathUtils.smoothstep(z - iz, 0, 1);
  const at = (a: number, b: number) => phaseTwoRandom(a * 17.13 + b * 93.71);
  return MathUtils.lerp(
    MathUtils.lerp(at(ix, iz), at(ix + 1, iz), fx),
    MathUtils.lerp(at(ix, iz + 1), at(ix + 1, iz + 1), fx),
    fz,
  );
}

export function phaseTwoGroundHeight(x: number, z: number) {
  const rough =
    (phaseTwoNoise(x * 0.1, z * 0.1) - 0.5) * 5 +
    (phaseTwoNoise(x * 0.37, z * 0.37) - 0.5) * 1.1;
  let height = -4 + rough;
  for (const v of PHASE_TWO_VOLCANOES) {
    const dx = x - v.x,
      dz = z - v.z;
    const angle = Math.atan2(dz, dx);
    const distance = Math.hypot(dx, dz);
    const radius =
      v.radius *
      (1 + Math.sin(angle * 7 + v.seed) * 0.08 + Math.cos(angle * 13) * 0.045);
    const t = distance / radius;
    const slope = Math.pow(Math.max(0, 1 - t), 1.35);
    const crater = 1 - 0.32 * (1 - MathUtils.smoothstep(t, 0.035, 0.14));
    const ridges =
      Math.sin(angle * 19 + t * 8 + v.seed) *
      Math.sin(Math.min(1, t) * Math.PI) *
      2.4;
    height = Math.max(
      height,
      -4 + v.height * slope * crater + (t < 1 ? ridges + rough * t : 0),
    );
  }
  // How much a volcano (rather than plain rough ground) is responsible for
  // the current height — the approach line happens to graze one volcano's
  // slope, and blending the path in there flattened a groove straight
  // through it. Fading the path out wherever a volcano actually dominates
  // keeps every volcano's shape intact; the path only needs to carve plain
  // ground and the ramp's own spiral, not slopes that were already there.
  const volcanic = MathUtils.smoothstep(height - (-4 + rough), 1, 6);
  const clearing = 1 - MathUtils.smoothstep(Math.hypot((x + 4) / 1.25, z - 5), 9, 14);
  height = MathUtils.lerp(height, 6 + Math.sin(x * 0.4) * 0.035, clearing);
  // Small arrival shelf only; the surrounding volcanic relief remains intact.
  const arrival = 1 - MathUtils.smoothstep(
    Math.hypot(x - PHASE_TWO_START.x, z - PHASE_TWO_START.z),
    5,
    11,
  );
  height = MathUtils.lerp(height, -3.65, arrival);
  // PHASE_TWO_ROUTE (the approach + the spiral PHASE_TWO_RAMP up to the
  // clearing) previously only steered followers — nothing actually carved it
  // into the ground, so there was no real ramp to walk up, just a sheer drop
  // between the arrival shelf (-3.65) and the clearing (6). Blend the
  // terrain toward the route's own height near the path so it becomes an
  // actual walkable trail, fading out a few units to either side.
  const route = phaseTwoRouteProjection(x, z);
  const pathWidth = (1 - MathUtils.smoothstep(route.distance, 3.5, 7)) * (1 - volcanic);
  height = MathUtils.lerp(height, route.height, pathWidth);
  return height;
}

export function phaseTwoCharacterSpawn(id: CharacterId, fromCanopy = false): Vec3 {
  if (fromCanopy) return { x: -8.5 + (id - 1) * 1.1, y: 6.65, z: 9 };
  const offset = (id - 1) * 1.1;
  const x = PHASE_TWO_START.x + Math.cos(PHASE_TWO_START_YAW) * offset;
  const z = PHASE_TWO_START.z - Math.sin(PHASE_TWO_START_YAW) * offset;
  return { x, y: phaseTwoGroundHeight(x, z) + 0.65, z };
}

export function phaseTwoOutsideMap(position: Vec3) {
  return (
    position.y < -24 ||
    Math.abs(position.x) > 207 ||
    position.z < -242 ||
    position.z > 242
  );
}
