import { BRIDGE } from "../world/layout";
import type { Vec3, CharacterId } from "../types";

export const FOLLOWER_DELAY_MIN = 1;
export const FOLLOWER_DELAY_MAX = 2;

export function followerDelaySeconds(id: CharacterId, randomValue: number) {
  const clamped = Math.max(0, Math.min(0.999_999, randomValue));
  // A fixed offset per character guarantees independent delays even when a
  // test, browser or seeded random source happens to return the same value.
  const distributed = (clamped + id * 0.271_828) % 1;
  return (
    FOLLOWER_DELAY_MIN + distributed * (FOLLOWER_DELAY_MAX - FOLLOWER_DELAY_MIN)
  );
}

export function shouldFollowerJump({
  grounded,
  moving,
  lowerBlocked,
  upperBlocked,
  landingSafe,
  cooldown,
}: {
  grounded: boolean;
  moving: boolean;
  lowerBlocked: boolean;
  upperBlocked: boolean;
  landingSafe: boolean;
  cooldown: number;
}) {
  return (
    grounded &&
    moving &&
    lowerBlocked &&
    !upperBlocked &&
    landingSafe &&
    cooldown <= 0
  );
}

/** Reach the bridge entrance before attempting the crossing from either bank. */
export function islandFollowerTarget(position: Vec3, leader: Vec3, id: CharacterId) {
  const north = BRIDGE.z + BRIDGE.length / 2;
  const south = BRIDGE.z - BRIDGE.length / 2;
  const toSouth = position.z > north && leader.z < north;
  const toNorth = position.z < south && leader.z > south;
  if (toSouth || toNorth) {
    if (Math.abs(position.x) > 0.45)
      return { x: 0, z: toSouth ? Math.max(position.z, north + 1) : Math.min(position.z, south - 1), stopDistance: 0.2 };
    return { x: 0, z: toSouth ? Math.max(leader.z, south - 1) : Math.min(leader.z, north + 1), stopDistance: 0.2 };
  }
  if (position.z <= north && position.z >= south)
    return { x: 0, z: leader.z > position.z ? Math.max(leader.z, north + 1) : Math.min(leader.z, south - 1), stopDistance: 0.2 };
  return { x: Math.max(-5, Math.min(5, leader.x + [-1.3, 1.3, 0][id])), z: leader.z + 1.3, stopDistance: 1.1 };
}
