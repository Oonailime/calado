import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { collectCubePiece, initialPuzzle, interactCanopy, nearCubeShrine } from "../src/features/game/state/rules";
import { CANOPY_BRIDGE_CURVE, CANOPY_BRIDGE_SITE, CANOPY_HARVESTS, CANOPY_STUMPS } from "../src/features/game/world/canopyCooperationLayout";
import { PHASE_FOUR_CUBE_PIECE_SPAWNS, PHASE_FOUR_PLATFORMS, PHASE_FOUR_FEET_OFFSET, phaseFourCharacterSpawn } from "../src/features/game/world/phaseFourLayout";
import { createVineWalk, stepVineWalk, vineWalkInput } from "../src/features/game/characters/vineWalking";
import { phaseFourGroundHeight, phaseFourTouchesGround } from "../src/features/game/world/phaseFourTerrain";
import { CANOPY_WATER_CURVE, createCanopyWaterGeometry } from "../src/features/game/world/phaseFourWater";
import { treePortalPresence } from "../src/features/game/world/treePortalAnimation";
const position = (p: readonly number[]) => ({ x: p[0], y: p[1] + 0.6, z: p[2] });

test("cooperation requires white focus, gold harvest, gold tie (lower stump), then brown construction (upper stump)", () => {
  let state = initialPuzzle();
  const harvest = position(CANOPY_HARVESTS[0].position);
  assert.equal(interactCanopy(state, harvest), state);
  state = { ...state, selected: 1 };
  assert.equal(interactCanopy(state, position(PHASE_FOUR_CUBE_PIECE_SPAWNS[0])), state);
  state = { ...state, selected: 0 };
  assert.equal(interactCanopy(state, { ...position(PHASE_FOUR_CUBE_PIECE_SPAWNS[0]), y: -3 }), state);
  state = interactCanopy(state, position(PHASE_FOUR_CUBE_PIECE_SPAWNS[0]));
  assert.equal(state.canopyFocused, true);
  assert.equal(interactCanopy(state, harvest), state);
  // Brown no longer harvests — only gold does.
  state = { ...state, selected: 2 };
  assert.equal(interactCanopy(state, harvest), state);
  assert.equal(interactCanopy(state, position(CANOPY_STUMPS.upper)), state);
  state = { ...state, selected: 1 };
  for (const site of CANOPY_HARVESTS) state = interactCanopy(state, position(site.position));
  assert.deepEqual(state.canopyVines, [true, true, true]);
  assert.equal(interactCanopy(state, harvest), state);
  // Brown no longer ties — only gold does, now at the lower stump.
  state = { ...state, selected: 2 };
  assert.equal(interactCanopy(state, position(CANOPY_STUMPS.lower)), state);
  state = { ...state, selected: 1 };
  state = interactCanopy(state, position(CANOPY_STUMPS.lower));
  assert.equal(state.canopyGoldTied, true);
  // Gold no longer builds — only brown does, now at the upper stump.
  assert.equal(interactCanopy(state, position(CANOPY_STUMPS.upper)), state);
  state = { ...state, selected: 2 };
  state = interactCanopy(state, position(CANOPY_STUMPS.upper));
  assert.equal(state.canopyBridgeBuilt, true);
});

test("each monkey must deliver their own prism at the shrine's height", () => {
  let state = initialPuzzle();
  const shrine = position(PHASE_FOUR_PLATFORMS.find(p => p.id === "summit-shrine")!.center);
  assert.equal(nearCubeShrine({ ...shrine, y: 0 }), false);
  for (const id of [0, 1, 2] as const) {
    state = { ...state, selected: id };
    const pickup = position(PHASE_FOUR_CUBE_PIECE_SPAWNS[id]);
    assert.equal(collectCubePiece(state, id, { ...pickup, y: 0 }), state);
    state = collectCubePiece(state, id, pickup);
  }
  assert.deepEqual(state.cubeDelivered, [false, false, false]);
  state = interactCanopy(state, shrine);
  assert.deepEqual(state.cubeDelivered, [false, false, true]);
  assert.equal(interactCanopy(state, shrine), state);
  for (const id of [0, 1] as const) state = interactCanopy({ ...state, selected: id }, shrine);
  assert.deepEqual(state.cubeDelivered, [true, true, true]);
});

test("new walking vine reaches both platforms, pauses and reverses", () => {
  const site = CANOPY_BRIDGE_SITE;
  const walk = createVineWalk({ x: site.climb.x, y: site.climb.baseY!, z: site.climb.z }, false, CANOPY_BRIDGE_CURVE);
  for (const direction of [1, -1] as const) {
    let arrived = false;
    for (let i = 0; i < 2500 && !arrived; i++) arrived = stepVineWalk(walk, direction, 1 / 60);
    assert.equal(arrived, true);
    const end = CANOPY_BRIDGE_CURVE.getPoint(direction > 0 ? 1 : 0);
    assert.ok(Math.hypot(walk.position.x - end.x, walk.position.z - end.z) < 0.5);
    assert.ok(walk.position.y > end.y);
  }
  for (let i = 0; i < 300; i++) stepVineWalk(walk, 1, 1 / 60);
  for (let i = 0; i < 60; i++) stepVineWalk(walk, 0, 1 / 60);
  const p = walk.position.clone();
  for (let i = 0; i < 60; i++) stepVineWalk(walk, 0, 1 / 60);
  assert.ok(walk.position.distanceTo(p) < 1e-8);
  const input = vineWalkInput(walk.distance, 0, 1, 0, walk);
  assert.ok(input > 0);
});

test("touching valley ground or the upper bank is lethal; decks are safe", () => {
  for (const [x, z] of [[-13, 14], [25, -65], [14, -35]]) {
    const y = phaseFourGroundHeight(x, z) + PHASE_FOUR_FEET_OFFSET;
    assert.equal(phaseFourTouchesGround({ x, y, z }), true);
    assert.equal(phaseFourTouchesGround({ x, y: y + 2, z }), false);
  }
  assert.equal(phaseFourTouchesGround(phaseFourCharacterSpawn(2)), false);
  for (const deck of PHASE_FOUR_PLATFORMS) assert.equal(phaseFourTouchesGround(position(deck.center)), false);
});

test("arrival portal fades smoothly and is entirely gone at three seconds", () => {
  assert.equal(treePortalPresence(0), 1);
  assert.equal(treePortalPresence(1.6), 1);
  assert.ok(treePortalPresence(2.3) > 0.45 && treePortalPresence(2.3) < 0.55);
  assert.equal(treePortalPresence(3), 0);
  assert.equal(treePortalPresence(30), 0);
});

test("river spans beyond both map borders and blends continuously into the falls", () => {
  assert.ok(CANOPY_WATER_CURVE.getPoint(0).z < -112);
  assert.ok(CANOPY_WATER_CURVE.getPoint(1).z > 98);
  const geometry = createCanopyWaterGeometry();
  const points = geometry.getAttribute("position");
  const falling = geometry.getAttribute("aFalling");
  let previous = new Vector3().fromBufferAttribute(points, 6), maxFall = 0, blended = 0;
  for (let row = 1; row <= 1200; row++) {
    const p = new Vector3().fromBufferAttribute(points, row * 13 + 6);
    assert.ok(p.distanceTo(previous) < 0.5, "water surface must not jump at the lip or pool");
    assert.ok(p.y > phaseFourGroundHeight(p.x, p.z), `water buried at ${p.toArray()}`);
    maxFall = Math.max(maxFall, falling.getX(row * 13 + 6));
    if (falling.getX(row * 13 + 6) > 0.05 && falling.getX(row * 13 + 6) < 0.95) blended++;
    previous = p;
  }
  assert.ok(maxFall > 0.95 && blended > 5);
  geometry.dispose();
});
