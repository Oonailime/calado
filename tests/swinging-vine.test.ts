import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closestSwingingVineGrip,
  createSwingingVine,
  FREE_ROPE_REACH_LIFT,
  hoistSwingingVine,
  PENDULUM_PUMP_ACCELERATION,
  PENDULUM_PUMP_MAX_ANGLE,
  pendulumPumpAllowed,
  releaseRearVineTie,
  rerigUnheldSwingingVines,
  stepSwingingVine,
  swingingVinePoints,
} from "../src/features/game/world/swingingVine";
import { PHASE_FOUR_SWING_SITES } from "../src/features/game/world/phaseFourLayout";
import {
  PHYSICS_FIXED_DT,
  WORLD_GRAVITY,
} from "../src/features/game/characters/locomotionConfig";

function arcLength(points: readonly { x: number; y: number; z: number }[]) {
  return points
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum + Math.hypot(p.x - points[i].x, p.y - points[i].y, p.z - points[i].z),
      0,
    );
}

/** Captures the authored grip, swings it along an arc, then lets go. */
function releasedAfterSwing(site: (typeof PHASE_FOUR_SWING_SITES)[number]) {
  const state = createSwingingVine(site);
  releaseRearVineTie(
    state,
    site,
    { x: Math.sin(site.vine.rotationY), y: 0, z: Math.cos(site.vine.rotationY) },
    { ...site.vine.twoPoint!.grip },
  );
  const { anchor, length } = state.constraints[0];
  for (let i = 0; i < 60; i++) {
    const angle = 0.4 - i * 0.012;
    stepSwingingVine(state, {
      x: anchor.x + Math.sin(angle) * length,
      y: anchor.y - Math.cos(angle) * length,
      z: anchor.z,
    });
  }
  return state;
}

test("a rope nobody holds becomes a free chain: full length, no leftover monkey mass, settles under its tie", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const state = releasedAfterSwing(site);
    const anchor = { ...state.constraints[0].anchor };
    stepSwingingVine(state);
    assert.equal(state.free, true);
    const energy = () =>
      state.chain.reduce((sum, node) => {
        const vx = (node.position.x - node.previous.x) / PHYSICS_FIXED_DT,
          vy = (node.position.y - node.previous.y) / PHYSICS_FIXED_DT,
          vz = (node.position.z - node.previous.z) / PHYSICS_FIXED_DT;
        return sum + 0.5 * (vx * vx + vy * vy + vz * vz) - WORLD_GRAVITY.y * (node.position.y - anchor.y);
      }, 0);
    const initialEnergy = energy();
    assert.ok(
      Math.max(...state.chain.map(n => Math.hypot(n.position.x - n.previous.x, n.position.z - n.previous.z))) > 0.01,
      "letting go must keep the rope's motion",
    );
    for (let tick = 0; tick < 40 / PHYSICS_FIXED_DT; tick++) {
      stepSwingingVine(state);
      const points = swingingVinePoints(state);
      assert.equal(points.length, 33);
      assert.deepEqual({ ...points[0] }, anchor, "the remaining tie stays put");
      const length = arcLength(points);
      assert.ok(length > state.totalLength * 0.98 && length < state.totalLength * 1.02, `${site.id} stretched to ${length}`);
      if (tick % 60 === 0) assert.ok(energy() <= initialEnergy + 1e-3 * Math.abs(initialEnergy), "an unforced rope must not gain energy");
    }
    // With nobody on it, the whole rope ends up hanging straight below the tie.
    for (const point of swingingVinePoints(state)) {
      assert.ok(Math.hypot(point.x - anchor.x, point.z - anchor.z) < 0.1);
      assert.ok(point.y <= anchor.y + 1e-6);
    }
    assert.ok(swingingVinePoints(state).at(-1)!.y < anchor.y - state.totalLength * 0.97);
  }
});

test("a loose rope can be grabbed at any point of its length, which becomes the new support", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const lengths = new Set<number>();
    for (const index of [4, 12, 20, 28, 32]) {
      const state = releasedAfterSwing(site);
      for (let tick = 0; tick < 3 / PHYSICS_FIXED_DT; tick++) stepSwingingVine(state);
      const target = { ...swingingVinePoints(state)[index] };
      const grip = { x: 0, y: 0, z: 0 };
      const distance = closestSwingingVineGrip(
        state,
        { x: target.x, y: target.y - FREE_ROPE_REACH_LIFT, z: target.z },
        grip,
      );
      assert.ok(distance < 1e-6, `${site.id} point ${index} is out of reach`);
      releaseRearVineTie(state, site, { x: 0, y: 0, z: 1 }, grip);
      stepSwingingVine(state, grip);
      assert.equal(state.free, false);
      const expected = (index / 32) * state.totalLength;
      assert.ok(Math.abs(state.constraints[0].length - Math.max(0.2, expected)) < state.totalLength * 0.03);
      assert.ok(
        Math.abs(state.constraints[0].length + state.tailSegmentLength * 12 - state.totalLength) < 1e-6,
      );
      lengths.add(Math.round(state.constraints[0].length * 10));
    }
    assert.equal(lengths.size, 5);
  }
});

test("a rope that loses its hand for a tick is split again where the hand returns", () => {
  const site = PHASE_FOUR_SWING_SITES[0];
  const state = releasedAfterSwing(site);
  const length = state.constraints[0].length;
  const contact = { ...state.grip };
  stepSwingingVine(state);
  assert.equal(state.free, true);
  stepSwingingVine(state, contact);
  assert.equal(state.free, false);
  assert.ok(Math.abs(state.constraints[0].length - length) < 0.3);
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

test("after a fall, loose ropes nobody holds are tied at both ends again", () => {
  const [first, second, third] = PHASE_FOUR_SWING_SITES;
  const vines = new Map([
    [first.id, releasedAfterSwing(first)],
    [second.id, releasedAfterSwing(second)],
    [third.id, createSwingingVine(third)],
  ]);
  const held = vines.get(second.id)!;
  const untouched = vines.get(third.id)!;
  rerigUnheldSwingingVines(
    vines,
    [{ left: { siteId: second.id }, right: null }, { left: null, right: null }],
    PHASE_FOUR_SWING_SITES,
  );
  const rerigged = vines.get(first.id)!;
  assert.equal(rerigged.releasedAttachment, null);
  assert.deepEqual(rerigged.grip, first.vine.twoPoint!.grip);
  assert.equal(vines.get(second.id), held, "a rope in a monkey's hand is left alone");
  assert.equal(vines.get(third.id), untouched);
});

/** A rope released after a swing, left to hang still under its tie. */
function settledLooseRope(site: (typeof PHASE_FOUR_SWING_SITES)[number]) {
  const state = releasedAfterSwing(site);
  for (let tick = 0; tick < 40 / PHYSICS_FIXED_DT; tick++) stepSwingingVine(state);
  return state;
}

test("the first release records the authored pendulum length at the grip", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const state = createSwingingVine(site);
    releaseRearVineTie(
      state,
      site,
      { x: Math.sin(site.vine.rotationY), y: 0, z: Math.cos(site.vine.rotationY) },
      { ...site.vine.twoPoint!.grip },
    );
    // Grabbing at the authored grip leaves nothing to climb back.
    assert.ok(Math.abs(state.constraints[0].length - state.hangLength) < 0.05);
    assert.ok(state.hangLength > 0.2 && state.hangLength < state.totalLength);
  }
});

test("beside a hanging loose rope, the reach aims over the shoulders", () => {
  const site = PHASE_FOUR_SWING_SITES[0];
  const state = settledLooseRope(site);
  const point = swingingVinePoints(state)[24];
  const body = { x: point.x + 0.4, y: point.y, z: point.z };
  const grip = { x: 0, y: 0, z: 0 };
  closestSwingingVineGrip(state, body, grip);
  // The capture from the ground needs the hand at least 0.22 m over a
  // shoulder about 0.49 m above the body's center.
  assert.ok(grip.y - body.y >= 0.49 + 0.22, `aimed ${grip.y - body.y} above the body`);
  assert.ok(Math.hypot(grip.x - point.x, grip.z - point.z) < 0.05);
});

test("a loose rope grabbed low keeps the grab, then climbs back to the designed pendulum", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    const state = settledLooseRope(site);
    assert.equal(state.free, true);
    const point = swingingVinePoints(state)[26];
    const grip = { x: 0, y: 0, z: 0 };
    closestSwingingVineGrip(
      state,
      { x: point.x, y: point.y - FREE_ROPE_REACH_LIFT, z: point.z },
      grip,
    );
    releaseRearVineTie(state, site, { x: 0, y: 0, z: 1 }, grip);
    const grabbed = state.constraints[0].length;
    assert.ok(grabbed > state.hangLength + 1, `${site.id} grab was not low`);
    // The hand's contact is published after the rope's own step: that tick
    // must not free the rope again or move the grab.
    stepSwingingVine(state);
    assert.equal(state.free, false);
    assert.equal(state.constraints[0].length, grabbed);
    stepSwingingVine(state, grip);
    let seconds = 0;
    while (hoistSwingingVine(state, PHYSICS_FIXED_DT, 2.4)) {
      stepSwingingVine(state, grip);
      seconds += PHYSICS_FIXED_DT;
      assert.ok(seconds < 10, "the climb must finish");
    }
    assert.ok(Math.abs(state.constraints[0].length - state.hangLength) < 1e-6);
    assert.ok(
      Math.abs(state.constraints[0].length + state.tailSegmentLength * 12 - state.totalLength) < 1e-6,
    );
    // Full speed most of the way, easing into the designed length.
    assert.ok(seconds >= (grabbed - state.hangLength) / 2.4);
    assert.ok(seconds < (grabbed - state.hangLength) / 2.4 + 1);
  }
});

test("holding a direction pumps a pendulum with its motion, up to its capped swing", () => {
  // Tuned by play-testing: a 100 degree ceiling reached with 3 m/s^2 pushes.
  assert.equal(Math.round((PENDULUM_PUMP_MAX_ANGLE * 180) / Math.PI), 100);
  assert.equal(PENDULUM_PUMP_ACCELERATION, 3);
  const support = { x: 0, y: 10, z: 0 };
  const length = 5;
  const bottom = { x: 0, y: 5, z: 0 };
  const forward = { x: 0, y: 0, z: -1 };
  // Hanging still, or already swinging the way the key asks: push.
  assert.equal(pendulumPumpAllowed(bottom, { x: 0, y: 0, z: 0 }, forward, support, length), true);
  assert.equal(pendulumPumpAllowed(bottom, { x: 0, y: 0, z: -3 }, forward, support, length), true);
  // Swinging back against it: no push, so the rest position never tilts.
  assert.equal(pendulumPumpAllowed(bottom, { x: 0, y: 0, z: 3 }, forward, support, length), false);
  // Energy at the cap is g * L * (1 - cos angle), all kinetic at the bottom.
  const g = Math.hypot(WORLD_GRAVITY.x, WORLD_GRAVITY.y, WORLD_GRAVITY.z);
  const atCap = Math.sqrt(2 * g * length * (1 - Math.cos(PENDULUM_PUMP_MAX_ANGLE)));
  assert.equal(pendulumPumpAllowed(bottom, { x: 0, y: 0, z: -atCap * 0.99 }, forward, support, length), true);
  assert.equal(pendulumPumpAllowed(bottom, { x: 0, y: 0, z: -atCap * 1.01 }, forward, support, length), false);
});
