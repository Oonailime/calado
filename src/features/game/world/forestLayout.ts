import type { Vec3 } from "../types";
import { CHARACTER_SPAWN_Y, ISLAND_SURFACE_Y } from "./layout";

export const TREE_MODEL_URL = "/assets/models/forest/tree.glb";
export const VINE_MODEL_URL = "/assets/models/forest/vine.glb";

export type ArborealSite = {
  id: string;
  tree: { x: number; z: number; scale: number; rotationY: number };
  climb: {
    x: number;
    z: number;
    topY: number;
    topX?: number;
    topZ?: number;
    baseY?: number;
    dismount?: boolean;
    bidirectional?: boolean;
    enabled?: boolean;
  };
  vine: {
    x: number;
    z: number;
    attachY: number;
    scale: number;
    length?: number;
    rotationY: number;
    grabbable?: boolean;
    /** Extra forgiving radius used when locating a handhold on a moving vine. */
    grabRadius?: number;
    interactionRequiresHeight?: boolean;
    directGrip?: boolean;
    twoPoint?: {
      rear: Vec3;
      grip: Vec3;
      rearTreeIndex: number;
      frontTreeIndex: number;
      // Some authored spans have a known travel direction. When present,
      // this support remains fixed on the first grab and the opposite tie is
      // the one that comes loose.
      fixedAttachment?: "rear" | "front";
    };
    // Upper pendulum spans are visual/hand supports while the monkey hangs;
    // their body must not collide with the surrounding high-level scenery.
    disableCharacterCollision?: boolean;
    brachiation?: {
      nextSiteId: string;
      previousSiteId: string;
      duration: number;
      gripHand: "left" | "right";
      radius: number;
      start: Vec3;
      end: Vec3;
    };
  };
};

// Each site keeps the trunk and the reachable end of its vine clear of puzzle
// props. The same coordinates drive rendering and character interaction, so
// the player never reaches for an invisible/offset anchor.
const ISLAND_TREE_SITES: readonly ArborealSite[] = [
  {
    id: "north-west",
    tree: { x: -6.8, z: 5.3, scale: 0.67, rotationY: 0.45 },
    climb: { x: -5.95, z: 5.3, topY: 4.9 },
    vine: {
      x: -4.65,
      z: 5.25,
      attachY: 6.05,
      scale: 0.22,
      rotationY: 0.2,
    },
  },
  {
    id: "north-east",
    tree: { x: 6.9, z: 5.1, scale: 0.64, rotationY: -0.7 },
    climb: { x: 6.05, z: 5.1, topY: 4.75 },
    vine: {
      x: 4.75,
      z: 5.05,
      attachY: 5.85,
      scale: 0.215,
      rotationY: -0.25,
    },
  },
  {
    id: "south-west",
    tree: { x: -7.25, z: -30.7, scale: 0.7, rotationY: 1.15 },
    climb: { x: -6.38, z: -30.7, topY: 5.05 },
    vine: {
      x: -5.05,
      z: -30.75,
      attachY: 6.25,
      scale: 0.225,
      rotationY: 0.4,
    },
  },
  {
    id: "south-east",
    tree: { x: 7.4, z: -26.1, scale: 0.66, rotationY: -1.2 },
    climb: { x: 6.55, z: -26.1, topY: 4.85 },
    vine: {
      x: 5.15,
      z: -26.15,
      attachY: 6,
      scale: 0.218,
      rotationY: -0.35,
    },
  },
] as const;

// Move each trunk and its handholds together into the wider side clearings.
const expandedSites = ISLAND_TREE_SITES.map((site) => {
  const offset = Math.sign(site.tree.x) * 3.8;
  return {
    ...site,
    tree: { ...site.tree, x: site.tree.x + offset },
    climb: { ...site.climb, x: site.climb.x + offset, topY: site.climb.topY + 3 },
    vine: {
      ...site.vine,
      x: site.vine.x + offset,
      attachY: site.vine.attachY + 3,
      interactionRequiresHeight: true,
    },
  };
});

// Distance from the character's centre to its gripping hands.
export const VINE_GRIP_OFFSET = 0.42;

export const ARBOREAL_SITES: readonly ArborealSite[] = expandedSites.map(
  (site, index) => {
    // Consecutive pairs belong to one island; never span the channel.
    if (index % 2 !== 0)
      return { ...site, vine: { ...site.vine, grabbable: false } };
    const other = expandedSites[index + 1];
    const grip = {
      x: (site.vine.x + other.vine.x) / 2,
      y: Math.min(site.vine.attachY, other.vine.attachY) - 1.8,
      z: (site.vine.z + other.vine.z) / 2,
    };
    return {
      ...site,
      vine: {
        ...site.vine,
        length: Math.hypot(
          site.vine.x - grip.x,
          site.vine.attachY - grip.y,
          site.vine.z - grip.z,
        ) + VINE_GRIP_OFFSET,
        twoPoint: {
          rear: { x: other.vine.x, y: other.vine.attachY, z: other.vine.z },
          grip,
          frontTreeIndex: index,
          rearTreeIndex: index + 1,
        },
      },
    };
  },
);

export const TREE_INTERACTION_RANGE = 1.35;
export const VINE_INTERACTION_RANGE = 1.5;
export const TREE_CLIMB_SECONDS = 2.35;
export const TREE_DESCEND_SECONDS = 2.1;
export const VINE_GRAB_SECONDS = 0.9;
export const VINE_JUMP_SECONDS = 0.72;
export const VINE_SWING_RATE = 1.75;
export const VINE_SWING_AMPLITUDE = 0.56;

export function nearestArborealInteraction(
  position: Vec3,
  sites: readonly ArborealSite[] = ARBOREAL_SITES,
) {
  let nearest:
    { kind: "tree" | "vine"; site: ArborealSite; distance: number } | undefined;
  for (const site of sites) {
    if (site.climb.enabled !== false) {
      let treeDistance = Math.hypot(
        position.x - site.climb.x,
        position.z - site.climb.z,
      );
      let atHeight = site.climb.baseY === undefined ||
        Math.abs(position.y - site.climb.baseY) < 1.5;
      if (site.climb.bidirectional && Math.abs(position.y - site.climb.topY) < 1.5) {
        const topDistance = Math.hypot(
          position.x - (site.climb.topX ?? site.climb.x),
          position.z - (site.climb.topZ ?? site.climb.z),
        );
        treeDistance = atHeight ? Math.min(treeDistance, topDistance) : topDistance;
        atHeight = true;
      }
      if (
        treeDistance <= TREE_INTERACTION_RANGE &&
        atHeight &&
        (!nearest || treeDistance < nearest.distance)
      )
        nearest = { kind: "tree", site, distance: treeDistance };
    }

    // The physical monkey starts at CHARACTER_SPAWN_Y. The hanging end is
    // deliberately projected onto the ground for a forgiving interaction.
    if (site.vine.grabbable !== false) {
      const target = site.vine.interactionRequiresHeight
        ? site.vine.twoPoint
          ? { x: site.vine.x, y: site.vine.attachY - VINE_GRIP_OFFSET, z: site.vine.z }
          : vineSwingPosition(site, 0)
        : { x: site.vine.x, y: position.y, z: site.vine.z };
      const vineDistance = Math.hypot(
        position.x - target.x,
        position.z - target.z,
        position.y - target.y,
      );
      if (
        vineDistance <= VINE_INTERACTION_RANGE &&
        (!nearest || vineDistance < nearest.distance)
      )
        nearest = { kind: "vine", site, distance: vineDistance };
    }
  }
  return nearest;
}

export function climbingPosition(site: ArborealSite, progress: number): Vec3 {
  const t = Math.max(0, Math.min(1, progress));
  const baseY = site.climb.baseY ?? CHARACTER_SPAWN_Y;
  return {
    x: site.climb.x + ((site.climb.topX ?? site.climb.x) - site.climb.x) * t,
    y: baseY + (site.climb.topY - baseY) * t,
    z: site.climb.z + ((site.climb.topZ ?? site.climb.z) - site.climb.z) * t,
  };
}

export function vineLength(site: ArborealSite) {
  if (site.vine.length !== undefined) return site.vine.length;
  if (site.vine.brachiation) return site.vine.brachiation.radius;
  return Math.max(2.2, site.vine.attachY - ISLAND_SURFACE_Y - 0.75);
}

export function vineSwingAngle(elapsed: number, site?: ArborealSite) {
  const brachiation = site?.vine.brachiation;
  if (brachiation) {
    const progress = Math.max(0, Math.min(1, elapsed / brachiation.duration));
    return -Math.PI / 2 + progress * Math.PI;
  }
  return Math.sin(elapsed * VINE_SWING_RATE) * VINE_SWING_AMPLITUDE;
}

export function vineSwingAngularVelocity(elapsed: number, site?: ArborealSite) {
  const brachiation = site?.vine.brachiation;
  if (brachiation)
    return elapsed >= brachiation.duration ? 0 : Math.PI / brachiation.duration;
  return (
    Math.cos(elapsed * VINE_SWING_RATE) * VINE_SWING_AMPLITUDE * VINE_SWING_RATE
  );
}

// Local-space articulated rope curve. Point zero is the fixed tree anchor and
// the final point is exactly the monkey/rope endpoint from vineSwingPosition.
// Intermediate fragments carry a travelling sine wave whose strength follows
// angular velocity, allowing the vine to flex without detaching either end.
export function vineCurvePoints(
  site: ArborealSite,
  elapsed: number,
  active: boolean,
  segmentCount = 14,
): Vec3[] {
  const length = Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET);
  const angle = active
    ? vineSwingAngle(elapsed, site)
    : Math.sin(elapsed * 0.72 + site.tree.rotationY) * 0.025;
  const angularVelocity = active
    ? vineSwingAngularVelocity(elapsed, site)
    : Math.cos(elapsed * 0.72 + site.tree.rotationY) * 0.018;
  const horizontal = Math.sin(angle) * length;
  const vertical = -Math.cos(angle) * length;
  const waveStrength = Math.min(0.24, 0.035 + Math.abs(angularVelocity) * 0.12);
  const points: Vec3[] = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const endpointLock = Math.sin(Math.PI * t);
    points.push({
      x:
        Math.sin(elapsed * 3.1 - t * Math.PI * 2 + site.tree.rotationY) *
        waveStrength *
        endpointLock,
      y: index === 0 ? 0 : vertical * t,
      z:
        horizontal * t -
        angularVelocity * 0.08 * endpointLock * (0.35 + t * 0.65),
    });
  }
  return points;
}

/**
 * World-space physical hand contact converted into the vine group's local
 * frame. Both endpoints are exact; only intermediate fragments receive a
 * small gravity sag, so the rendered rope cannot drift from the constraint.
 */
export function vineCurvePointsToGrip(
  site: ArborealSite,
  grip: Vec3,
  segmentCount = 14,
): Vec3[] {
  const dx = grip.x - site.vine.x;
  const dy = grip.y - site.vine.attachY;
  const dz = grip.z - site.vine.z;
  const cosine = Math.cos(site.vine.rotationY);
  const sine = Math.sin(site.vine.rotationY);
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const points: Vec3[] = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const endpointLock = Math.sin(Math.PI * t);
    points.push({
      x: localX * t,
      y: dy * t - endpointLock * 0.035,
      z: localZ * t,
    });
  }
  return points;
}

export function vineLeafWind(
  elapsed: number,
  leafIndex: number,
  active: boolean,
) {
  const gust = Math.sin(elapsed * 2.4 + leafIndex * 1.73);
  const flutter = Math.sin(elapsed * 6.2 + leafIndex * 0.91);
  const response = active ? 1.75 : 1;
  return {
    x: gust * 0.18 * response,
    y: flutter * 0.12 * response,
    z: (gust * 0.12 + flutter * 0.05) * response,
  };
}

// The vine swings in the vertical plane through its own placed orientation
// (site.vine.rotationY), not always along world X — otherwise every vine
// looks like it swings the same fixed way regardless of how it actually
// hangs in the scene.
export function vineSwingPosition(site: ArborealSite, elapsed: number): Vec3 {
  const brachiation = site.vine.brachiation;
  if (brachiation) {
    const progress = Math.max(0, Math.min(1, elapsed / brachiation.duration));
    const theta = progress * Math.PI;
    const centerX = (brachiation.start.x + brachiation.end.x) / 2;
    const centerZ = (brachiation.start.z + brachiation.end.z) / 2;
    return {
      x: centerX + (brachiation.start.x - centerX) * Math.cos(theta),
      y:
        brachiation.start.y +
        (brachiation.end.y - brachiation.start.y) * progress -
        Math.sin(theta) * brachiation.radius,
      z: centerZ + (brachiation.start.z - centerZ) * Math.cos(theta),
    };
  }
  const ropeLength = vineLength(site);
  const angle = vineSwingAngle(elapsed, site);
  const horizontal = Math.sin(angle) * ropeLength;
  return {
    x: site.vine.x + horizontal * Math.sin(site.vine.rotationY),
    y: site.vine.attachY - Math.cos(angle) * ropeLength,
    z: site.vine.z + horizontal * Math.cos(site.vine.rotationY),
  };
}

export function vineGripPosition(site: ArborealSite, elapsed: number): Vec3 {
  if (site.vine.directGrip)
    return { x: site.vine.x, y: site.vine.attachY, z: site.vine.z };
  const ropeLength = Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET);
  const angle = vineSwingAngle(elapsed, site);
  const horizontal = Math.sin(angle) * ropeLength;
  return {
    x: site.vine.x + horizontal * Math.sin(site.vine.rotationY),
    y: site.vine.attachY - Math.cos(angle) * ropeLength,
    z: site.vine.z + horizontal * Math.cos(site.vine.rotationY),
  };
}

export function vineSwingVelocity(site: ArborealSite, elapsed: number): Vec3 {
  const brachiation = site.vine.brachiation;
  if (brachiation) {
    const progress = Math.max(0, Math.min(1, elapsed / brachiation.duration));
    const theta = progress * Math.PI;
    const angularVelocity = Math.PI / brachiation.duration;
    const centerX = (brachiation.start.x + brachiation.end.x) / 2;
    const centerZ = (brachiation.start.z + brachiation.end.z) / 2;
    return {
      x: -(brachiation.start.x - centerX) * Math.sin(theta) * angularVelocity,
      y:
        (brachiation.end.y - brachiation.start.y) / brachiation.duration -
        Math.cos(theta) * brachiation.radius * angularVelocity,
      z: -(brachiation.start.z - centerZ) * Math.sin(theta) * angularVelocity,
    };
  }
  const ropeLength = vineLength(site);
  const angle = vineSwingAngle(elapsed, site);
  const angularVelocity = vineSwingAngularVelocity(elapsed, site);
  const horizontalSpeed = Math.cos(angle) * ropeLength * angularVelocity;
  return {
    x: horizontalSpeed * Math.sin(site.vine.rotationY),
    y: Math.sin(angle) * ropeLength * angularVelocity,
    z: horizontalSpeed * Math.cos(site.vine.rotationY),
  };
}
