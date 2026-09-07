import type { CharacterId } from "../types";

export const FOLLOWER_DELAY_MIN = 1;
export const FOLLOWER_DELAY_MAX = 3;

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
