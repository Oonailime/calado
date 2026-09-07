import assert from "node:assert/strict";
import { test } from "node:test";
import {
  followerDelaySeconds,
  FOLLOWER_DELAY_MAX,
  FOLLOWER_DELAY_MIN,
  shouldFollowerJump,
} from "../src/features/game/characters/followerNavigation";
import { PORTAL } from "../src/features/game/world/layout";
import { isInsideOpenPortal } from "../src/features/game/world/portalEntry";
import { powerAnchorVisibility } from "../src/features/game/world/powerAnchorVisibility";

test("cada seguidor recebe um atraso próprio entre um e três segundos", () => {
  const delays = ([0, 1, 2] as const).map((id) =>
    followerDelaySeconds(id, 0.25),
  );
  assert.equal(new Set(delays).size, 3);
  for (const delay of delays) {
    assert.ok(delay >= FOLLOWER_DELAY_MIN);
    assert.ok(delay <= FOLLOWER_DELAY_MAX);
  }
});

test("seguidor pula somente um obstáculo baixo com pouso seguro", () => {
  const base = {
    grounded: true,
    moving: true,
    lowerBlocked: true,
    upperBlocked: false,
    landingSafe: true,
    cooldown: 0,
  };
  assert.equal(shouldFollowerJump(base), true);
  assert.equal(shouldFollowerJump({ ...base, grounded: false }), false);
  assert.equal(shouldFollowerJump({ ...base, upperBlocked: true }), false);
  assert.equal(shouldFollowerJump({ ...base, landingSafe: false }), false);
  assert.equal(shouldFollowerJump({ ...base, cooldown: 0.2 }), false);
});

test("sinais de poder somem quando suas tarefas terminam", () => {
  assert.deepEqual(powerAnchorVisibility({ bridge: false, built: false }), {
    bridge: true,
    final: false,
  });
  assert.deepEqual(powerAnchorVisibility({ bridge: true, built: false }), {
    bridge: false,
    final: true,
  });
  assert.deepEqual(powerAnchorVisibility({ bridge: true, built: true }), {
    bridge: false,
    final: false,
  });
});

test("aviso do portal exige núcleo aberto e entrada no vão", () => {
  const center = { x: PORTAL.x, y: 2, z: PORTAL.z };
  assert.equal(isInsideOpenPortal(center, false), false);
  assert.equal(isInsideOpenPortal(center, true), true);
  assert.equal(
    isInsideOpenPortal({ ...center, x: PORTAL.x + 1.2 }, true),
    false,
  );
  assert.equal(isInsideOpenPortal({ ...center, z: PORTAL.z + 1 }, true), false);
});
