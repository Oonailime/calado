import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUBE_TURN_DURATION_SECONDS,
  initialCubeState,
  isSolved,
  scrambleCube,
  solvedLayerCount,
  turnEase,
  turnFace,
  turnProgress,
  type CubieState,
} from "../src/features/game/world/rubiksCubeState";

function occupiedSlots(state: readonly CubieState[]) {
  return state
    .map((cubie) => cubie.position.join(","))
    .sort()
    .join("|");
}

test("a freshly initialised cube is solved with all three layers complete", () => {
  const state = initialCubeState();
  assert.equal(isSolved(state), true);
  assert.equal(solvedLayerCount(state), 3);
});

test("turning any face four times in the same direction returns to the start", () => {
  for (const axis of [0, 1, 2] as const) {
    for (const layer of [-1, 0, 1] as const) {
      let state = initialCubeState();
      for (let i = 0; i < 4; i++) state = turnFace(state, axis, layer, 1);
      assert.deepEqual(state, initialCubeState());
    }
  }
});

test("a quarter turn followed by its inverse returns to the start", () => {
  const start = initialCubeState();
  const roundTrip = turnFace(turnFace(start, 1, -1, 1), 1, -1, -1);
  assert.deepEqual(roundTrip, start);
});

test("same-axis turns on different layers commute", () => {
  const start = initialCubeState();
  const ab = turnFace(turnFace(start, 0, 1, 1), 0, -1, -1);
  const ba = turnFace(turnFace(start, 0, -1, -1), 0, 1, 1);
  assert.deepEqual(ab, ba);
});

test("a single quarter turn leaves the cube unsolved but keeps every slot occupied", () => {
  const start = initialCubeState();
  const turned = turnFace(start, 1, 1, 1);
  assert.equal(isSolved(turned), false);
  assert.equal(occupiedSlots(turned), occupiedSlots(start));
});

test("scrambling is deterministic per seed and always produces a legal, unsolved cube", () => {
  const a = scrambleCube(7);
  const b = scrambleCube(7);
  assert.deepEqual(a, b);
  assert.equal(isSolved(a), false);
  assert.equal(occupiedSlots(a), occupiedSlots(initialCubeState()));

  const c = scrambleCube(8);
  assert.notDeepEqual(a, c);
});

test("turn progress clamps to [0,1] and eases smoothly between them", () => {
  const startedAt = 1_000;
  assert.equal(turnProgress(startedAt, startedAt), 0);
  assert.equal(
    turnProgress(startedAt, startedAt + CUBE_TURN_DURATION_SECONDS * 1000),
    1,
  );
  assert.equal(
    turnProgress(startedAt, startedAt + CUBE_TURN_DURATION_SECONDS * 5000),
    1,
  );
  assert.equal(turnEase(0), 0);
  assert.equal(turnEase(1), 1);
  assert.equal(turnEase(-1), 0);
  assert.equal(turnEase(2), 1);
  assert.ok(turnEase(0.5) > 0.4 && turnEase(0.5) < 0.6);
});
