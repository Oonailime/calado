import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MONKEY_ANIMATION_PREVIEWS,
  isMonkeyMotion,
  motionPhase,
} from "../src/features/game/characters/monkeyMotion";
import { QUALITY_PROFILES } from "../src/features/game/quality";
import {
  ARBOREAL_SITES,
  climbingPosition,
  nearestArborealInteraction,
  vineCurvePoints,
  vineGripPosition,
  vineLeafWind,
  vineLength,
  vineSwingPosition,
  vineSwingVelocity,
} from "../src/features/game/world/forestLayout";
import { CHARACTER_SPAWN_Y } from "../src/features/game/world/layout";

test("catálogo cobre as seis animações solicitadas e tem um preview por pose", () => {
  assert.deepEqual(
    new Set(MONKEY_ANIMATION_PREVIEWS.map(({ motion }) => motion)),
    new Set([
      "biped-walk",
      "tree-climb",
      "tree-descend",
      "vine-grab",
      "vine-swing",
      "vine-jump",
    ]),
  );
  assert.equal(
    MONKEY_ANIMATION_PREVIEWS.every(({ file }) => file.endsWith(".webm")),
    true,
  );
  assert.equal(isMonkeyMotion("vine-swing"), true);
  assert.equal(isMonkeyMotion("idle"), false);
  assert.equal(motionPhase("tree-descend", 1), -motionPhase("tree-climb", 1));
});

test("árvore e cipó usam os mesmos pontos para render e interação", () => {
  const site = ARBOREAL_SITES[0];
  assert.equal(
    nearestArborealInteraction({ ...site.climb, y: CHARACTER_SPAWN_Y })?.kind,
    "tree",
  );
  assert.notEqual(
    nearestArborealInteraction({
      x: site.vine.x,
      y: CHARACTER_SPAWN_Y,
      z: site.vine.z,
    })?.kind,
    "vine",
  );
  assert.equal(
    nearestArborealInteraction({
      x: site.vine.x,
      y: site.vine.attachY - 0.42,
      z: site.vine.z,
    })?.kind,
    "vine",
  );
  assert.equal(nearestArborealInteraction({ x: 30, y: 0, z: 30 }), undefined);
  assert.equal(climbingPosition(site, 0).y, CHARACTER_SPAWN_Y);
  assert.equal(climbingPosition(site, 1).y, site.climb.topY);
});

test("somente a qualidade Ultra habilita a camada densa de vegetação", () => {
  assert.equal(QUALITY_PROFILES.low.denseVegetation, false);
  assert.equal(QUALITY_PROFILES.medium.denseVegetation, false);
  assert.equal(QUALITY_PROFILES.high.denseVegetation, false);
  assert.equal(QUALITY_PROFILES.ultra.denseVegetation, true);
  assert.ok(
    QUALITY_PROFILES.ultra.shadowMapSize >=
      QUALITY_PROFILES.medium.shadowMapSize,
  );
});

test("o salto herda a velocidade tangencial real do balanço", () => {
  // Site 0 has a non-zero vine.rotationY, so this also confirms the swing
  // plane follows the vine's own orientation instead of always being
  // world-X — a z of exactly 0 here would mean that regressed.
  const site = ARBOREAL_SITES[0];
  assert.notEqual(site.vine.rotationY, 0);
  const time = 0.63;
  const epsilon = 0.0001;
  const before = vineSwingPosition(site, time - epsilon);
  const after = vineSwingPosition(site, time + epsilon);
  const velocity = vineSwingVelocity(site, time);
  assert.ok(Math.abs(velocity.x - (after.x - before.x) / (2 * epsilon)) < 1e-5);
  assert.ok(Math.abs(velocity.y - (after.y - before.y) / (2 * epsilon)) < 1e-5);
  assert.ok(Math.abs(velocity.z - (after.z - before.z) / (2 * epsilon)) < 1e-5);
  assert.notEqual(velocity.z, 0);
});

test("cipó articulado preserva as duas pontas e curva os fragmentos internos", () => {
  const site = ARBOREAL_SITES[0];
  const elapsed = 0.63;
  const points = vineCurvePoints(site, elapsed, true, 14);
  const body = vineSwingPosition(site, elapsed);
  const end = vineGripPosition(site, elapsed);
  assert.equal(points.length, 15);
  assert.deepEqual(points[0], { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(points.at(-1)!.x) < 1e-10);
  assert.ok(
    Math.abs(points.at(-1)!.y - (end.y - site.vine.attachY)) < 1e-10,
  );
  const localEndZ =
    (end.x - site.vine.x) * Math.sin(site.vine.rotationY) +
    (end.z - site.vine.z) * Math.cos(site.vine.rotationY);
  assert.ok(Math.abs(points.at(-1)!.z - localEndZ) < 1e-10);
  assert.ok(points.slice(1, -1).some((point) => Math.abs(point.x) > 0.001));
  assert.ok(Math.abs(points.at(-1)!.y) <= vineLength(site));
  assert.ok(Math.abs(body.y - end.y) > 0.3);
});

test("folhas respondem ao vento e amplificam o movimento durante o balanço", () => {
  const idle = vineLeafWind(0.72, 2, false);
  const active = vineLeafWind(0.72, 2, true);
  assert.ok(Math.abs(active.x) > Math.abs(idle.x));
  assert.ok(Math.abs(active.y) > Math.abs(idle.y));
});
