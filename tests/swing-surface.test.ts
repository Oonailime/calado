import assert from "node:assert/strict";
import { test } from "node:test";
import {
  driveSwingSurface,
  sampleSwingSurfaceFoot,
  surfaceTravelDirection,
  SURFACE_STANCE,
  SURFACE_STRIDE,
  type SwingSurface,
} from "../src/features/game/characters/swingSurface";
import { PHYSICS_FIXED_DT } from "../src/features/game/characters/locomotionConfig";

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

test("a stopped collision recovers walking motion from the incoming swing direction", () => {
  for (const sign of [-1, 1]) {
    const surface: SwingSurface = {
      point: v(),
      normal: v(0, 1, 0),
      tangent: v(),
      speed: 0,
      driveSpeed: 2,
      phase: 0,
    };
    surfaceTravelDirection(
      surface.tangent,
      surface.normal,
      v(sign * 3, -2, 0),
      v(0, 5, 0),
      v(sign, 0, 0),
    );
    const velocity = v(),
      position = v();
    for (let tick = 0; tick < 60; tick++) {
      driveSwingSurface(velocity, velocity, surface, PHYSICS_FIXED_DT);
      // The solid cancels the inward component, as Rapier does at contact.
      velocity.y = 0;
      position.x += velocity.x * PHYSICS_FIXED_DT;
    }
    assert.ok(
      position.x * sign > 1.5,
      "the collision must not leave the monkey frozen",
    );
    assert.equal(velocity.x, sign * 2);
  }
});

test("a head-on trunk impact walks up along the support instead of driving into the trunk", () => {
  const out = v();
  surfaceTravelDirection(out, v(-1, 0, 0), v(4, 0, 0), v(2, 5, 0), v(1, 0, 0));
  assert.deepEqual(out, v(0, 1, 0));
});

test("feet alternate planted and lifted steps on both floors and walls in either direction", () => {
  for (const normal of [v(0, 1, 0), v(-1, 0, 0)]) {
    for (const sign of [-1, 1]) {
      const tangent = normal.y ? v(sign, 0, 0) : v(0, sign, 0);
      const surface: SwingSurface = {
        point: v(),
        normal,
        tangent,
        speed: 1.5,
        driveSpeed: 1.5,
        phase: 0,
      };
      const hip = v(normal.x * 0.3, normal.y * 0.3, 0),
        left = v(),
        right = v();
      let leftLifted = false,
        rightLifted = false,
        alternated = false;
      for (let tick = 0; tick < 90; tick++) {
        surface.phase +=
          (surface.speed * PHYSICS_FIXED_DT * SURFACE_STANCE) / SURFACE_STRIDE;
        assert.ok(sampleSwingSurfaceFoot(left, hip, surface, "left", 0.6));
        assert.ok(sampleSwingSurfaceFoot(right, hip, surface, "right", 0.6));
        const lh = left.x * normal.x + left.y * normal.y,
          rh = right.x * normal.x + right.y * normal.y;
        leftLifted ||= lh > 0.05;
        rightLifted ||= rh > 0.05;
        alternated ||= Math.abs(lh - rh) > 0.04;
        assert.ok(lh >= 0 && rh >= 0, "feet never penetrate the solid");
      }
      assert.ok(leftLifted && rightLifted && alternated);
    }
  }
});
