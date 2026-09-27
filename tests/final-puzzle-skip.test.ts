import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchors,
  distance,
  finalPuzzleSkipState,
  initialPuzzle,
  nearCubeShrine,
} from "../src/features/game/state/rules";
import { CHARACTER_CAPSULE_RADIUS, ISLANDS, islandFinalPuzzleSpawn } from "../src/features/game/world/layout";
import { PHASE_FOUR_PLATFORMS, phaseFourShrineSpawn } from "../src/features/game/world/phaseFourLayout";

const MONKEYS = [0, 1, 2] as const;

test("?skip on the islands starts with the bridge built and the final puzzle untouched", () => {
  const state = finalPuzzleSkipState("islands");
  assert.equal(state.bridge, true);
  assert.deepEqual(state.logs, [true, true, true]);
  assert.deepEqual(state.powers, [false, false, false]);
  assert.equal(state.codeProgress, 0);
  assert.equal(state.unlocked, false);
  assert.equal(state.built, false);
  const island = ISLANDS[1];
  for (const id of MONKEYS) {
    const spawn = islandFinalPuzzleSpawn(id);
    // On island 2, in the final zone (z <= -21), just short of the symbols.
    assert.ok(Math.abs(spawn.z - island.z) < island.halfDepth - 1);
    assert.ok(spawn.z <= -21 && spawn.z > anchors.reveal.z);
    assert.ok(distance(spawn, anchors.reveal) < 5 && distance(spawn, anchors.silence) < 5);
  }
});

test("?skip on phase 3 starts at the shrine with every prism delivered and the cube unsolved", () => {
  const state = finalPuzzleSkipState("phase3");
  assert.deepEqual(state.cubeDelivered, [true, true, true]);
  assert.deepEqual(state.cubePieces, [true, true, true]);
  assert.equal(state.canopyBridgeBuilt, true);
  assert.equal(state.cubeSolved, false);
  assert.equal(state.cubeLayersSolved, 0);
  const shrine = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "summit-shrine")!;
  for (const id of MONKEYS) {
    const spawn = phaseFourShrineSpawn(id);
    // Within E range of the cube but clear of its pedestal collider (r 1.4).
    assert.equal(nearCubeShrine(spawn), true);
    assert.ok(Math.hypot(spawn.x - shrine.center[0], spawn.z - shrine.center[2]) > 1.4 + CHARACTER_CAPSULE_RADIUS);
    assert.ok(Math.abs(spawn.x - shrine.center[0]) < shrine.width / 2);
    assert.ok(Math.abs(spawn.z - shrine.center[2]) < shrine.depth / 2);
  }
});

test("without ?skip the puzzle starts from scratch", () => {
  assert.deepEqual(initialPuzzle().cubeDelivered, [false, false, false]);
  assert.equal(initialPuzzle().bridge, false);
});
