import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closestSwingingVineGrip,
  createSwingingVine,
  releaseRearVineTie,
  stepSwingingVine,
  swingingVinePoints,
} from "../src/features/game/world/swingingVine";
import { PHASE_FOUR_SWING_SITES } from "../src/features/game/world/phaseFourLayout";
import {
  PHYSICS_FIXED_DT,
  WORLD_GRAVITY,
} from "../src/features/game/characters/locomotionConfig";

test("released ropes retain momentum, reverse under gravity and keep their length for a minute", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const state = createSwingingVine(site);
    releaseRearVineTie(state, site, {
      x: Math.sin(site.vine.rotationY),
      y: 0,
      z: Math.cos(site.vine.rotationY),
    });
    const { anchor, length } = state.constraints[0];
    for (const angle of [0.4, 0.39])
      stepSwingingVine(state, {
        x: anchor.x + Math.sin(angle) * length,
        y: anchor.y - Math.cos(angle) * length,
        z: anchor.z,
      });
    const speed = state.velocity.x;
    assert.ok(speed < -1);
    const energy = () =>
      0.5 *
        (state.velocity.x ** 2 +
          state.velocity.y ** 2 +
          state.velocity.z ** 2) +
      -WORLD_GRAVITY.y * (state.grip.y - anchor.y + length);
    const initialEnergy = energy();
    let reversed = false;
    for (let tick = 0; tick < 60 / PHYSICS_FIXED_DT; tick++) {
      stepSwingingVine(state);
      if (tick === 0)
        assert.ok(
          state.velocity.x < speed * 0.9,
          "release must preserve motion",
        );
      if (state.velocity.x > 0.1) reversed = true;
      assert.ok(
        Math.abs(
          Math.hypot(
            state.grip.x - anchor.x,
            state.grip.y - anchor.y,
            state.grip.z - anchor.z,
          ) - length,
        ) < 1e-6,
      );
      assert.ok(
        energy() <= initialEnergy * 1.001,
        "unforced pendulum must not gain energy",
      );
    }
    assert.ok(reversed);
  }
});

test("both ends stay tied until capture; only the rear tie releases in either travel direction", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    for (const direction of [1, -1]) {
      const state = createSwingingVine(site);
      const span = site.vine.twoPoint!;
      const front = { x: site.vine.x, y: site.vine.attachY, z: site.vine.z };
      for (let tick = 0; tick < 120; tick++) stepSwingingVine(state);
      assert.equal(state.releasedAttachment, null);
      assert.deepEqual(state.grip, span.grip);
      const points = swingingVinePoints(state);
      assert.deepEqual({ ...points[0] }, front);
      assert.deepEqual({ ...points.at(-1)! }, span.rear);
      releaseRearVineTie(state, site, {
        x: Math.sin(site.vine.rotationY) * direction,
        y: 0,
        z: Math.cos(site.vine.rotationY) * direction,
      });
      const expectedReleased = span.fixedAttachment
        ? span.fixedAttachment === "front"
          ? "rear"
          : "front"
        : direction === 1
          ? "rear"
          : "front";
      assert.equal(state.releasedAttachment, expectedReleased);
      const support = { ...state.constraints[0].anchor };
      if (span.fixedAttachment) {
        assert.deepEqual(
          support,
          span.fixedAttachment === "front" ? front : span.rear,
          "the authored first support must stay on the waterfall side",
        );
      }
      const endpoint = { ...state.tail.at(-1)!.position };
      for (let tick = 0; tick < 60; tick++) stepSwingingVine(state, span.grip);
      assert.deepEqual(state.constraints[0].anchor, support);
      assert.ok(
        state.tail.at(-1)!.position.y < endpoint.y - 0.2,
        "released end must fall away from the wood",
      );
      assert.deepEqual(state.grip, span.grip);
      releaseRearVineTie(state, site, {
        x: -Math.sin(site.vine.rotationY) * direction,
        y: 0,
        z: -Math.cos(site.vine.rotationY) * direction,
      });
      assert.deepEqual(
        state.constraints[0].anchor,
        support,
        "regrabbing never swaps the remaining support",
      );
    }
  }
});

test("sufficient momentum carries a pendulum over the support through a full 360 degrees", () => {
  const site = PHASE_FOUR_SWING_SITES[0];
  const state = createSwingingVine(site);
  releaseRearVineTie(state, site, {
    x: Math.sin(site.vine.rotationY),
    y: 0,
    z: Math.cos(site.vine.rotationY),
  });
  const { anchor, length } = state.constraints[0];
  Object.assign(state.grip, { x: anchor.x, y: anchor.y - length, z: anchor.z });
  state.velocity.x = Math.sqrt(8 * -WORLD_GRAVITY.y * length);
  let angle = 0,
    previous = 0,
    aboveSupport = false;
  for (let tick = 0; tick < 600 && angle < Math.PI * 2; tick++) {
    stepSwingingVine(state);
    const next = Math.atan2(state.grip.x - anchor.x, anchor.y - state.grip.y);
    angle += Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
    previous = next;
    aboveSupport ||= state.grip.y > anchor.y;
  }
  assert.ok(aboveSupport);
  assert.ok(
    angle >= Math.PI * 2,
    `rotation was capped at ${(angle * 180) / Math.PI} degrees`,
  );
});

test("every section of a raised vine can be grabbed from below, with its own support length", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const lengths = new Set<number>();
    for (const index of [4, 9, 16, 22, 28]) {
      const state = createSwingingVine(site);
      const target = state.initialPoints[index];
      const grip = { x: 0, y: 0, z: 0 };
      const distance = closestSwingingVineGrip(
        state,
        { x: target.x, y: target.y - 0.65, z: target.z },
        grip,
      );
      assert.ok(distance < 1e-6);
      assert.ok(
        Math.hypot(grip.x - target.x, grip.y - target.y, grip.z - target.z) <
          1e-6,
      );
      releaseRearVineTie(
        state,
        site,
        {
          x: Math.sin(site.vine.rotationY),
          y: 0,
          z: Math.cos(site.vine.rotationY),
        },
        grip,
      );
      assert.ok(
        Math.hypot(
          state.grip.x - grip.x,
          state.grip.y - grip.y,
          state.grip.z - grip.z,
        ) < 1e-6,
      );
      assert.ok(
        Math.abs(
          state.constraints[0].length +
            state.tailSegmentLength * 12 -
            state.totalLength,
        ) < 1e-6,
      );
      lengths.add(Math.round(state.constraints[0].length * 100));
    }
    assert.equal(
      lengths.size,
      5,
      "grabs must not collapse to the authored midpoint",
    );
  }
});
