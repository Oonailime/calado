import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhaseTwoLava } from "../src/features/game/world/phaseTwoAssets";
import { PHASE_TWO_TREE, PHASE_TWO_VOLCANOES } from "../src/features/game/world/phaseTwoLayout";
import { CONVERGENCE_POINT, PATH_POINTS, walkPoint } from "../src/features/story/scene3d/cameraRig";
import { volcanicCameraForProgress } from "../src/features/story/scene3d/volcanicStoryCamera";
import {
  createVolcanicStoryAssets,
  STORY_CHERRY,
  STORY_CHERRY_SCALE,
  STORY_CHESS,
  STORY_HEARTH,
  storyRouteDistance,
  storyToValley,
  valleyToStory,
  volcanicStoryGround,
} from "../src/features/story/scene3d/volcanicStoryAssets";
import {
  VOLCANIC_CHESS_SCALE,
  VOLCANIC_FINAL_HOP_TO_TREE,
  VOLCANIC_PLAYERS,
  VOLCANIC_ROUTE,
  VOLCANIC_ROUTE_SPREAD,
  VOLCANIC_STORY_SCALE,
  VOLCANIC_WATCH_YAW,
} from "../src/features/story/scene3d/volcanicStoryRoute";
import { angleTo } from "../src/features/story/scene3d/cameraRig";

const ROUTE_POINTS = [...VOLCANIC_ROUTE.points, VOLCANIC_ROUTE.convergence];

test("the alternative volcanic terrain supports the existing route and every building", () => {
  for (let step = 0; step <= 100; step++) {
    const point = walkPoint(step / 100 * 0.75, false, VOLCANIC_ROUTE);
    assert.ok(Math.abs(volcanicStoryGround(point.x, point.z) + 0.045) < 0.001);
  }
  // Flat under every (larger) house footprint and around the meeting point.
  const reach = 1.5 * VOLCANIC_STORY_SCALE;
  for (const point of ROUTE_POINTS) {
    for (const x of [-reach, 0, reach]) for (const z of [-reach, 0, reach]) {
      assert.ok(Math.abs(volcanicStoryGround(point.x + x, point.z + z) + 0.045) < 0.001);
    }
  }
});

test("design2 spreads the houses out and draws houses, monkeys and path larger", () => {
  VOLCANIC_ROUTE.points.forEach((point, index) => {
    assert.equal(point.x, PATH_POINTS[index].x * VOLCANIC_ROUTE_SPREAD);
    assert.equal(point.z, PATH_POINTS[index].z * VOLCANIC_ROUTE_SPREAD);
  });
  assert.ok(VOLCANIC_ROUTE_SPREAD > VOLCANIC_STORY_SCALE, "houses end up further apart, not just larger");
  assert.equal(VOLCANIC_ROUTE.houseScale, VOLCANIC_STORY_SCALE);
  // A much longer last stretch from the final house to the meeting point.
  const last = VOLCANIC_ROUTE.points[5], meeting = VOLCANIC_ROUTE.convergence;
  const original = Math.hypot(CONVERGENCE_POINT.x - PATH_POINTS[5].x, CONVERGENCE_POINT.z - PATH_POINTS[5].z);
  assert.ok(Math.hypot(meeting.x - last.x, meeting.z - last.z) > original * VOLCANIC_ROUTE_SPREAD * 1.5);
  assert.ok(Math.abs(Math.hypot(STORY_CHERRY.x - last.x, STORY_CHERRY.z - last.z) - VOLCANIC_FINAL_HOP_TO_TREE) < 1e-9);
});

test("phase 2's cherry lands on the story's cherry, and the mapping round-trips", () => {
  const cherry = storyToValley(STORY_CHERRY.x, STORY_CHERRY.z);
  assert.ok(Math.hypot(cherry.x - PHASE_TWO_TREE[0], cherry.z - PHASE_TWO_TREE[1]) < 1e-9);
  for (const [x, z] of [[3, -7], [-40, 12], [110, -60]]) {
    const story = valleyToStory(x, z);
    const back = storyToValley(story.x, story.z);
    assert.ok(Math.hypot(back.x - x, back.z - z) < 1e-9);
  }
});

test("no lava river or volcano lies along the longer walk", () => {
  const lava = createPhaseTwoLava().getAttribute("position");
  let nearestLava = Infinity;
  for (let i = 0; i < lava.count; i++) {
    const p = valleyToStory(lava.getX(i), lava.getZ(i));
    nearestLava = Math.min(nearestLava, storyRouteDistance(p.x, p.z));
  }
  assert.ok(nearestLava > 10, `lava ${nearestLava.toFixed(1)} m from the walk`);
  for (const volcano of PHASE_TWO_VOLCANOES) {
    const p = valleyToStory(volcano.x, volcano.z);
    assert.ok(storyRouteDistance(p.x, p.z) - volcano.radius > 10, `volcano ${volcano.seed} too close to the walk`);
  }
});

test("from the meeting point on, the last house is behind the camera", () => {
  const house = VOLCANIC_ROUTE.points[5];
  // Generous bound around the (enlarged) house.
  const radius = 4.5 * VOLCANIC_STORY_SCALE;
  for (let step = 0; step <= 40; step++) {
    const progress = 0.75 + (step / 40) * 0.25;
    const { position, lookAt } = volcanicCameraForProgress(progress);
    const view = lookAt.map((value, index) => value - position[index]);
    const length = Math.hypot(...view);
    const toHouse = [house.x - position[0], 2 - position[1], house.z - position[2]];
    const ahead = toHouse.reduce((sum, value, index) => sum + value * view[index], 0) / length;
    assert.ok(ahead < -radius, `house visible at progress ${progress.toFixed(3)}`);
  }
});

test("the meeting point: cherry at the centre, chess beside it with two players, Calado watching", () => {
  const watch = VOLCANIC_ROUTE.convergence;
  const roots = 4.1 * STORY_CHERRY_SCALE;
  // Same cherry-, chess- and monkey-sizes relative to each other as phase 2.
  assert.equal(STORY_CHERRY_SCALE, VOLCANIC_STORY_SCALE);
  assert.equal(VOLCANIC_CHESS_SCALE, VOLCANIC_STORY_SCALE);
  // The whole tree base (roots included) rests on the flat plateau.
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8)
    for (const r of [0, 2, roots])
      assert.ok(Math.abs(volcanicStoryGround(STORY_CHERRY.x + Math.cos(angle) * r, STORY_CHERRY.z + Math.sin(angle) * r) + 0.045) < 0.001);
  // The camera looks along -z, so the viewer's right is +x and the lower
  // part of the frame is toward +z. The table stands beside the tree, on the
  // right and level with it, clear of the roots (it spans about 4.6 x 7.3 m
  // with its stools at this scale); the fire sits in the lower left.
  assert.ok(STORY_CHESS.x - STORY_CHERRY.x > roots + 3);
  assert.ok(Math.abs(STORY_CHESS.z - STORY_CHERRY.z) < 3);
  assert.ok(STORY_HEARTH.x < STORY_CHERRY.x && STORY_HEARTH.z > STORY_CHERRY.z + 5);
  // Mizaru and Kikazaru sit on the two stools, raised off the ground and
  // facing each other across the board.
  const [white, black] = VOLCANIC_PLAYERS;
  assert.deepEqual([white.id, black.id], [0, 1]);
  for (const player of VOLCANIC_PLAYERS) {
    assert.ok(player.y > 0.3);
    const facing = angleTo(player.seat, STORY_CHESS);
    assert.ok(Math.abs(Math.atan2(Math.sin(player.yaw - facing), Math.cos(player.yaw - facing))) < 1e-9);
    assert.ok(Math.hypot(player.seat.x - STORY_CHERRY.x, player.seat.z - STORY_CHERRY.z) > roots + 1);
  }
  // Calado ends at the side of the board, looking at it, off the roots and
  // clear of both players.
  assert.ok(Math.abs(Math.hypot(watch.x - STORY_CHESS.x, watch.z - STORY_CHESS.z) - 1.75 * VOLCANIC_CHESS_SCALE) < 1e-9);
  assert.ok(Math.abs(VOLCANIC_WATCH_YAW - angleTo(watch, STORY_CHESS)) < 1e-9);
  assert.ok(Math.hypot(watch.x - STORY_CHERRY.x, watch.z - STORY_CHERRY.z) > roots + 0.5);
  for (const player of VOLCANIC_PLAYERS)
    assert.ok(Math.hypot(watch.x - player.seat.x, watch.z - player.seat.z) > 2);
  // The friends are there, seated, before Calado arrives.
  assert.equal(walkPoint(0.7, false, VOLCANIC_ROUTE).x === watch.x, false);
});

test("the cherry's fallen petals lie on the ground and cover the whole centre", () => {
  const meeting = VOLCANIC_ROUTE.convergence;
  const assets = createVolcanicStoryAssets();
  const p = assets.blossoms.getAttribute("position");
  let fallen = 0, nearestToCentre = Infinity;
  const fallenPoints: [number, number][] = [];
  for (let i = 0; i < p.count; i++) {
    const x = STORY_CHERRY.x + p.getX(i) * STORY_CHERRY_SCALE;
    const z = STORY_CHERRY.z + p.getZ(i) * STORY_CHERRY_SCALE;
    const y = -0.035 + p.getY(i) * STORY_CHERRY_SCALE;
    const above = y - volcanicStoryGround(x, z);
    if (above > 1) continue;
    fallen += 1;
    // Resting on the ground, never floating or sunk.
    assert.ok(above > -0.01 && above < 0.5, `petal ${above.toFixed(2)} m off the ground`);
    nearestToCentre = Math.min(nearestToCentre, Math.hypot(x - meeting.x, z - meeting.z));
    fallenPoints.push([x, z]);
  }
  assert.ok(fallen > 1000, "the petal carpet is kept");
  assert.ok(nearestToCentre < 1, "petals reach the middle of the meeting point");
  // Covered all over: from the tree out past the monkeys, petals everywhere.
  for (let x = -6; x <= 6; x += 3) for (let z = 0; z <= 12; z += 3) {
    const sx = STORY_CHERRY.x + x, sz = STORY_CHERRY.z + z;
    assert.ok(fallenPoints.some(([px, pz]) => Math.hypot(px - sx, pz - sz) < 1.5), `bare ground at ${x}, ${z}`);
  }
  Object.values(assets).forEach(geometry => geometry.dispose());
});

test("at the meeting point the camera frames the whole cherry, centred, with the game and the monkeys", () => {
  const tree = STORY_CHERRY, meeting = VOLCANIC_ROUTE.convergence;
  const players = VOLCANIC_PLAYERS.map(player => [player.seat.x, player.y + 1.2, player.seat.z]);
  const height = 16.2 * STORY_CHERRY_SCALE, crown = 10.2 * STORY_CHERRY_SCALE;
  const vertical = (25 * Math.PI) / 180;
  const horizontal = Math.atan(Math.tan(vertical) * 1.5);
  for (const progress of [0.875, 0.94, 1]) {
    const { position, lookAt } = volcanicCameraForProgress(progress);
    const f = lookAt.map((v, i) => v - position[i]);
    const fl = Math.hypot(...f); f.forEach((_, i) => { f[i] /= fl; });
    const r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r.forEach((_, i) => { r[i] /= rl; });
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const inView = (p: number[]) => {
      const v = p.map((value, i) => value - position[i]);
      const depth = v.reduce((sum, value, i) => sum + value * f[i], 0);
      const side = v.reduce((sum, value, i) => sum + value * r[i], 0);
      const up = v.reduce((sum, value, i) => sum + value * u[i], 0);
      return depth > 0 && Math.abs(Math.atan(side / depth)) < horizontal && Math.abs(Math.atan(up / depth)) < vertical;
    };
    for (const point of [
      [tree.x, height, tree.z], [tree.x, 0, tree.z],
      [tree.x - crown, height * 0.6, tree.z], [tree.x + crown, height * 0.6, tree.z],
      [meeting.x, 0, meeting.z], [meeting.x, 1.2, meeting.z],
      [STORY_CHESS.x, 0, STORY_CHESS.z], [STORY_HEARTH.x, 0, STORY_HEARTH.z],
      ...players,
    ]) assert.ok(inView(point), `out of frame at ${progress}: ${point.map(v => v.toFixed(1))}`);
    // Centred left to right.
    assert.ok(Math.abs(lookAt[0] - tree.x) < 0.01 && Math.abs(position[0] - tree.x) < 1.01);
  }
});

test("the alternative camera remains continuous at the meeting and final scene", () => {
  for (const boundary of [0.75, 0.875]) {
    const before = volcanicCameraForProgress(boundary - 1e-7);
    const after = volcanicCameraForProgress(boundary);
    for (const key of ["position", "lookAt"] as const) {
      assert.ok(Math.hypot(...before[key].map((value, index) => value - after[key][index])) < 0.001);
    }
  }
  assert.ok(volcanicCameraForProgress(1).position[2] < -40);
});
