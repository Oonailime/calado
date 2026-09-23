import assert from "node:assert/strict";
import { test } from "node:test";
import { colorForLayer, initialCubeState, isSolved, turnFace } from "../src/features/game/world/rubiksCubeState";
import {
  faceMove,
  RESTING_FACE_BASIS,
  stepFaceBasis,
  type FaceName,
  type ViewStep,
} from "../src/features/game/world/rubiksCubeView";

const FACE_NAMES: FaceName[] = ["U", "D", "L", "R", "F", "B"];
const VIEW_STEPS: ViewStep[] = ["up", "down", "left", "right"];

test("at rest, U/D sit on the colour-defining axis matching yellow-on-top, white-at-base", () => {
  const up = faceMove(RESTING_FACE_BASIS, "U");
  const down = faceMove(RESTING_FACE_BASIS, "D");
  assert.equal(up.axis, 2);
  assert.equal(down.axis, 2);
  assert.equal(colorForLayer(up.layer), "yellow");
  assert.equal(colorForLayer(down.layer), "white");
});

test("every named face maps to a distinct, valid (axis, layer) at rest", () => {
  const seen = new Set<string>();
  for (const name of FACE_NAMES) {
    const move = faceMove(RESTING_FACE_BASIS, name);
    assert.ok([0, 1, 2].includes(move.axis));
    assert.ok(move.layer === 1 || move.layer === -1);
    seen.add(`${move.axis},${move.layer}`);
  }
  assert.equal(seen.size, 6, "all six faces must be distinct outer layers");
});

test("a face's clockwise move applied four times returns the cube to solved", () => {
  for (const name of FACE_NAMES) {
    const move = faceMove(RESTING_FACE_BASIS, name);
    let state = initialCubeState();
    for (let i = 0; i < 4; i++) state = turnFace(state, move.axis, move.layer, move.direction);
    assert.equal(isSolved(state), true, `face ${name}`);
  }
});

test("four of the same view step return the view to its starting orientation", () => {
  for (const step of VIEW_STEPS) {
    let basis = RESTING_FACE_BASIS;
    for (let i = 0; i < 4; i++) basis = stepFaceBasis(basis, step);
    assert.deepEqual(basis, RESTING_FACE_BASIS, `step ${step}`);
  }
});

test("left followed by right (and up followed by down) cancel out", () => {
  assert.deepEqual(
    stepFaceBasis(stepFaceBasis(RESTING_FACE_BASIS, "left"), "right"),
    RESTING_FACE_BASIS,
  );
  assert.deepEqual(
    stepFaceBasis(stepFaceBasis(RESTING_FACE_BASIS, "up"), "down"),
    RESTING_FACE_BASIS,
  );
});

test("stepping the view relabels faces but a clockwise move still solves in four turns from any orientation", () => {
  let basis = RESTING_FACE_BASIS;
  for (const step of ["right", "right", "up", "left", "down", "down"] as ViewStep[]) {
    basis = stepFaceBasis(basis, step);
    for (const name of FACE_NAMES) {
      const move = faceMove(basis, name);
      let state = initialCubeState();
      for (let i = 0; i < 4; i++) state = turnFace(state, move.axis, move.layer, move.direction);
      assert.equal(isSolved(state), true, `after ${step}, face ${name}`);
    }
  }
});
