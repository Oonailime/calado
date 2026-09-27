import assert from "node:assert/strict";
import { test } from "node:test";
import { colorForLayer, initialCubeState, isSolved, turnFace } from "../src/features/game/world/rubiksCubeState";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  faceMove,
  RESTING_FACE_BASIS,
  snapCubeViewYaw,
  stepFaceBasis,
  viewerFaceBasis,
  type FaceBasis,
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

// The same display rotation RubiksCube.tsx applies (basisQuaternion with
// invert): faceBasis[k] is shown along world axis k.
function displayed(basis: FaceBasis, raw: readonly number[]) {
  const matrix = new Matrix4().makeBasis(
    new Vector3(...basis[0]),
    new Vector3(...basis[1]),
    new Vector3(...basis[2]),
  ).transpose();
  return new Vector3(...raw).applyQuaternion(new Quaternion().setFromRotationMatrix(matrix));
}
function outward(move: { axis: number; layer: number }) {
  const n = [0, 0, 0];
  n[move.axis] = move.layer;
  return n;
}
function near(a: Vector3, b: Vector3) {
  return a.distanceTo(b) < 1e-9;
}
const YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2, (3 * Math.PI) / 2, 0.3, Math.PI / 2 + 0.4];

test("from any side the camera stands, F faces it, R is on its right and U on top", () => {
  let basis = RESTING_FACE_BASIS;
  for (const step of [null, "down", "left", "down", "right", "up", "up"] as (ViewStep | null)[]) {
    for (const yaw of YAWS) {
      if (step) basis = stepFaceBasis(basis, step, yaw);
      const snapped = snapCubeViewYaw(yaw);
      // FollowCamera sits at (sin yaw, cos yaw) from the cube.
      const toCamera = new Vector3(Math.round(Math.sin(snapped)), 0, Math.round(Math.cos(snapped)));
      const right = new Vector3().crossVectors(toCamera.clone().negate(), new Vector3(0, 1, 0));
      const expect: Record<FaceName, Vector3> = {
        F: toCamera, B: toCamera.clone().negate(),
        R: right, L: right.clone().negate(),
        U: new Vector3(0, 1, 0), D: new Vector3(0, -1, 0),
      };
      for (const name of FACE_NAMES)
        assert.ok(near(displayed(basis, outward(faceMove(basis, name, yaw))), expect[name]), `yaw ${yaw}, ${name}`);
    }
  }
});

test("the view arrows tip the cube about the viewer's own right axis from every side", () => {
  // x + 0 folds -0 into 0 so deep equality compares directions only.
  const clean = (basis: FaceBasis) => basis.map(v => v.map(x => x + 0));
  for (const yaw of YAWS) {
    for (const step of VIEW_STEPS) {
      const before = clean(viewerFaceBasis(RESTING_FACE_BASIS, yaw));
      const after = clean(viewerFaceBasis(stepFaceBasis(RESTING_FACE_BASIS, step, yaw), yaw));
      // Seen from the viewer, each arrow does exactly what it does from +Z.
      assert.deepEqual(after, clean(stepFaceBasis(viewerFaceBasis(RESTING_FACE_BASIS, yaw), step)), `yaw ${yaw}, ${step}`);
      // Up/down keep the viewer's right axis; left/right keep the vertical.
      if (step === "up" || step === "down") assert.deepEqual(after[0], before[0]);
      else assert.deepEqual(after[1], before[1]);
    }
  }
});

test("opening the cube squares the camera up to the nearest face", () => {
  assert.equal(snapCubeViewYaw(0.3), 0);
  assert.equal(snapCubeViewYaw(1.2), Math.PI / 2);
  assert.equal(snapCubeViewYaw(-2.9), -Math.PI);
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
