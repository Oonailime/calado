import type { CharacterId, Vec3 } from "../types";
import { CatmullRomCurve3, Vector3 } from "three";
import { VINE_GRIP_OFFSET, type ArborealSite } from "./forestLayout";
import {
  CHARACTER_CAPSULE_HALF_HEIGHT,
  CHARACTER_CAPSULE_RADIUS,
} from "./layout";

export type Point3 = [number, number, number];
export const PHASE_FOUR_FEET_OFFSET =
  CHARACTER_CAPSULE_HALF_HEIGHT + CHARACTER_CAPSULE_RADIUS;
export const PHASE_FOUR_FALL_Y = -5.5;
export const PHASE_FOUR_SPAWN = {
  x: -13,
  y: 8 + PHASE_FOUR_FEET_OFFSET + 0.1,
  z: 14,
};

export function phaseFourCharacterSpawn(id: CharacterId): Vec3 {
  return { ...PHASE_FOUR_SPAWN, x: PHASE_FOUR_SPAWN.x + (id - 1) * 1.1 };
}

// Coordinates describe the WALKING surface, so art and physics share a datum.
export const PHASE_FOUR_PLATFORMS = [
  {
    id: "arrival",
    name: "Clareira das copas",
    center: [-13, 8, 14] as Point3,
    width: 8,
    depth: 7,
  },
  {
    id: "heart",
    name: "Árvore coração",
    center: [-1, 11, -5] as Point3,
    width: 8,
    depth: 8,
  },
  {
    id: "west",
    name: "Refúgio dos galhos",
    center: [-19, 13, -4] as Point3,
    width: 7,
    depth: 7,
  },
  {
    id: "east",
    name: "Varanda do rio",
    center: [15, 10, -2] as Point3,
    width: 7,
    depth: 7,
  },
  {
    id: "crown",
    name: "Copa alta",
    center: [-3, 16, -17] as Point3,
    // Three paths dock here (the ladder from heart, the bridge from west, the
    // bridge onward to falls). The old 7x6 footprint gave them barely more
    // room than a single connection, and both bridges' endpoints sit right
    // at/near this center - a bigger deck gives the ladder's corner real
    // separation from that cluster instead of landing right on top of it.
    width: 10,
    depth: 9,
  },
  {
    id: "falls",
    name: "Mirante da cachoeira",
    center: [14, 14, -23] as Point3,
    width: 7,
    depth: 7,
  },
  {
    id: "vine-plateau",
    name: "Platô dos cipós",
    center: [-3, 22.5, -7] as Point3,
    width: 8,
    depth: 7,
  },
  {
    id: "waterfall-summit",
    name: "Cume atrás da cachoeira",
    center: [13, 31, -49] as Point3,
    width: 9,
    depth: 8,
  },
] as const;

export type CanopyPath = {
  id: string;
  from: string;
  to: string;
  kind: "branch" | "bridge" | "ladder";
  width: number;
  points: Point3[];
};

export const PHASE_FOUR_PATHS: CanopyPath[] = [
  {
    id: "root-road",
    from: "arrival",
    to: "heart",
    kind: "branch",
    width: 3.7,
    points: [
      [-13, 8, 13],
      [-10, 8.5, 8],
      [-6, 10, 1],
      [-1, 11, -4],
    ],
  },
  {
    id: "west-bough",
    from: "heart",
    to: "west",
    kind: "branch",
    width: 3,
    points: [
      [-3, 11, -4],
      [-10, 12, -3],
      [-18, 13, -4],
    ],
  },
  {
    id: "river-bough",
    from: "heart",
    to: "east",
    kind: "branch",
    width: 3.4,
    points: [
      [1, 11, -3],
      [7, 10.2, -1],
      [15, 10, -2],
    ],
  },
  {
    id: "crown-bridge",
    from: "west",
    to: "crown",
    kind: "bridge",
    width: 2.2,
    points: [
      [-19, 13, -5],
      [-12, 13.1, -11],
      [-3, 16, -17],
    ],
  },
  {
    id: "waterfall-bridge",
    from: "crown",
    to: "falls",
    kind: "bridge",
    width: 2.2,
    points: [
      [-1, 16, -18],
      [6, 13.8, -22],
      [14, 14, -23],
    ],
  },
  {
    id: "east-ascent",
    from: "east",
    to: "falls",
    kind: "branch",
    width: 3.1,
    points: [
      [15, 10, -3],
      [18, 11, -10],
      [16, 13, -17],
      [14, 14, -23],
    ],
  },
  {
    id: "heart-ladder",
    from: "heart",
    to: "crown",
    kind: "ladder",
    width: 1.4,
    // A straight line whose base sits just inside heart's own south edge
    // (z=-9) instead of floating past it with a gap underneath. The run is
    // long enough to keep this walkable alongside every other path (see
    // "upward-facing continuous collision surfaces" - tangent.y stays under
    // the shared 0.72 slope limit here).
    points: [
      [-2, 11, -8.85],
      [-2, 16, -14.35],
    ],
  },
];

// Trunk base Y is phaseFourGroundHeight(x, z) minus ROOT_EMBED_DEPTH: sitting
// exactly on the ground surface left the buttress-root flare (see giantTree)
// fully exposed, with no earth covering any of it. Tree 6 (behind the falls)
// used to sit at x=19, only 2.8 units from the upper river's centerline -
// well inside its own 3.1 trunk radius, i.e. literally in the water; moved
// to x=26 for real clearance from the bank.
export const PHASE_FOUR_TREES = [
  { position: [-20, -4.54, 12] as Point3, radius: 3.4, height: 38, seed: 41 },
  { position: [-6, -4.42, -11] as Point3, radius: 3.8, height: 43, seed: 91 },
  { position: [22, -4.11, -5] as Point3, radius: 3.7, height: 39, seed: 62 },
  { position: [-24, -4.66, -7] as Point3, radius: 2.8, height: 36, seed: 18 },
  { position: [-8, -4.0, -22] as Point3, radius: 2.8, height: 39, seed: 73 },
  { position: [20, -4.55, -28] as Point3, radius: 2.7, height: 49, seed: 32 },
  { position: [26, 13.43, -49] as Point3, radius: 3.1, height: 38, seed: 84 },
];

export const PHASE_FOUR_LADDER_SITE: ArborealSite = {
  id: "phase4-pull-to-plateau",
  tree: { x: -6, z: -11, scale: 1, rotationY: 0 },
  climb: {
    // The first climb starts on the arrival deck, where the low part of the
    // original grab vine passes. Its end is deliberately inside the new high
    // plateau, so dismounting cannot leave the player below its collider.
    x: PHASE_FOUR_SPAWN.x,
    z: PHASE_FOUR_SPAWN.z,
    baseY:
      PHASE_FOUR_PLATFORMS.find((deck) => deck.id === "arrival")!.center[1] +
      PHASE_FOUR_FEET_OFFSET +
      0.08,
    topX: -3,
    topZ: -7,
    topY:
      PHASE_FOUR_PLATFORMS.find((deck) => deck.id === "vine-plateau")!
        .center[1] +
      PHASE_FOUR_FEET_OFFSET +
      0.08,
    dismount: true,
  },
  vine: {
    x: -3,
    z: -7,
    attachY: 24,
    scale: 1,
    rotationY: 0,
    grabbable: false,
  },
};

// Visible liana for the first ascent. Its low loop is on the arrival deck,
// while the upper segment reaches the new plateau at the same point used by
// the pull animation below.
export const PHASE_FOUR_PULL_VINE_POINTS: Point3[] = [
  [-16.2, 17.8, 14.5],
  [-14.8, 13.2, 14.1],
  [PHASE_FOUR_SPAWN.x, 9.45, PHASE_FOUR_SPAWN.z],
  [-9.5, 13.5, 9.2],
  [-6.2, 18.5, 3.4],
  [-3.9, 22.4, -2.2],
  [-3, 24, -7],
];
export const PHASE_FOUR_PULL_VINE_CURVE = new CatmullRomCurve3(
  PHASE_FOUR_PULL_VINE_POINTS.map((p) => new Vector3(...p)),
  false,
  "centripetal",
);

// Each span repeats the initial vine's wooden branch + wrapped liana at BOTH
// ends. The low point is the reachable grip; capture releases the end behind
// the monkey, leaving the forward end as the physical pendulum support.
const SWING_SPANS: {
  id: string;
  rear: Point3;
  front: Point3;
  grip: Point3;
  rearTreeIndex: number;
  frontTreeIndex: number;
  fixedAttachment?: "rear" | "front";
}[] = [
  {
    id: "plateau",
    rear: [-5, 29, -3],
    front: [-1, 32, -15],
    grip: [-2, 24.1, -9],
    rearTreeIndex: 1,
    frontTreeIndex: 4,
    // The waterfall is beyond the front tree. Keep this end fixed when the
    // player first grabs the span from the new plateau.
    fixedAttachment: "front",
  },
  {
    id: "upper-heart",
    rear: [-5, 31, -12],
    front: [5, 34, -22],
    grip: [0, 25.1, -17],
    rearTreeIndex: 4,
    frontTreeIndex: 5,
  },
  {
    id: "upper-crossing",
    rear: [1, 33, -19],
    front: [13, 36, -28],
    grip: [7, 26.3, -24],
    rearTreeIndex: 4,
    frontTreeIndex: 5,
  },
  {
    id: "waterfall-tree",
    rear: [8, 35, -24],
    front: [18, 38, -35],
    grip: [14, 27.5, -30],
    rearTreeIndex: 5,
    frontTreeIndex: 5,
  },
  {
    id: "over-falls",
    rear: [14, 37, -31],
    front: [17, 39, -41],
    grip: [17, 28.8, -37],
    rearTreeIndex: 5,
    frontTreeIndex: 6,
  },
  {
    id: "behind-falls",
    rear: [19, 39, -38],
    front: [13, 41, -49],
    grip: [16, 30.1, -43],
    rearTreeIndex: 6,
    frontTreeIndex: 6,
  },
  {
    id: "summit",
    rear: [17, 40, -43],
    front: [10, 42, -53],
    grip: [13, 32.5, -49],
    rearTreeIndex: 6,
    frontTreeIndex: 6,
  },
];
export const PHASE_FOUR_SWING_SITES: ArborealSite[] = SWING_SPANS.map(
  (span) => {
    const tree = PHASE_FOUR_TREES[span.frontTreeIndex];
    const [x, attachY, z] = span.front;
    const [gx, gy, gz] = span.grip;
    return {
      id: `phase4-swing-${span.id}`,
      tree: {
        x: tree.position[0],
        z: tree.position[2],
        scale: 1,
        rotationY: 0,
      },
      climb: { x: gx, z: gz, topY: gy, enabled: false },
      vine: {
        x,
        z,
        attachY,
        scale: 1,
        length: Math.hypot(x - gx, attachY - gy, z - gz) + VINE_GRIP_OFFSET,
        rotationY: Math.atan2(x - span.rear[0], z - span.rear[2]),
        interactionRequiresHeight: true,
        // The upper route is authored as a continuous handoff. A generous
        // capture radius keeps every span reachable when the two pendulums
        // pass at slightly different phases, without changing rope length or
        // the momentum-driven swing itself.
        grabRadius: 0.95,
        twoPoint: {
          rear: { x: span.rear[0], y: span.rear[1], z: span.rear[2] },
          grip: { x: gx, y: gy, z: gz },
          rearTreeIndex: span.rearTreeIndex,
          frontTreeIndex: span.frontTreeIndex,
          ...(span.fixedAttachment
            ? { fixedAttachment: span.fixedAttachment }
            : {}),
        },
        disableCharacterCollision: true,
      },
    };
  },
);
export const PHASE_FOUR_SITES: readonly ArborealSite[] = [
  PHASE_FOUR_LADDER_SITE,
  ...PHASE_FOUR_SWING_SITES,
];
const sitesById = new Map(PHASE_FOUR_SITES.map((site) => [site.id, site]));
export function phaseFourAdjacentSite(
  site: ArborealSite,
  direction: "next" | "previous",
) {
  // The raised pendulums form their own ordered route. They intentionally do
  // not carry the old phase-three brachiation metadata because their rope
  // motion is solved by the two-ended pendulum state instead.
  const swingIndex = PHASE_FOUR_SWING_SITES.findIndex(
    (candidate) => candidate.id === site.id,
  );
  if (swingIndex >= 0)
    return PHASE_FOUR_SWING_SITES[swingIndex + (direction === "next" ? 1 : -1)];
  const id =
    direction === "next"
      ? site.vine.brachiation?.nextSiteId
      : site.vine.brachiation?.previousSiteId;
  return id ? sitesById.get(id) : undefined;
}

export const PHASE_FOUR_RIVER: Point3[] = [
  [14, -4.8, -39],
  [11, -4.8, -30],
  [7, -4.8, -20],
  [10, -4.8, -9],
  [5, -4.8, 4],
  [3, -4.8, 19],
  [10, -4.8, 38],
  [6, -4.8, 64],
];
export const PHASE_FOUR_WATERFALL = {
  position: [14, -4.8, -39] as Point3,
  height: 17.5,
  width: 6.5,
};
export const PHASE_FOUR_UPPER_RIVER: Point3[] = [
  [18, 12.7, -104],
  [6, 12.7, -88],
  [4, 12.7, -75],
  [12, 12.7, -63],
  [18, 12.7, -54],
  [14, 12.7, -44],
  [14, 12.7, -39],
];
