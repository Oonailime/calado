import assert from "node:assert/strict";
import { test } from "node:test";
import { solveProceduralBodyPose } from "../src/features/game/characters/proceduralBodyRig";

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
const distance = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function pose() {
  return {
    leftShoulder: vector(),
    rightShoulder: vector(),
    base: vector(),
    leftHip: vector(),
    rightHip: vector(),
  };
}

test("rig procedural forma clavícula e triângulo rígidos", () => {
  const result = solveProceduralBodyPose(
    pose(),
    vector(3, 4, 5),
    {
      forward: vector(0, 0, -1),
      right: vector(1, 0, 0),
      up: vector(0, 1, 0),
    },
    {
      baseOffset: vector(0, -0.1, 0),
      baseToShoulderCenter: vector(0, 0.42, 0.08),
      shoulderWidth: 0.34,
      baseToHipCenter: vector(0, -0.025, 0.015),
      hipWidth: 0.18,
    },
  );
  assert.ok(Math.abs(distance(result.leftShoulder, result.rightShoulder) - 0.34) < 1e-9);
  assert.ok(
    Math.abs(
      distance(result.leftShoulder, result.base) -
        distance(result.rightShoulder, result.base),
    ) < 1e-9,
  );
  assert.ok(Math.abs(distance(result.leftHip, result.rightHip) - 0.18) < 1e-9);
});

test("triângulo e pivôs acompanham uma base 3D arbitrária", () => {
  const result = solveProceduralBodyPose(
    pose(),
    vector(),
    {
      forward: vector(1, 0, 0),
      right: vector(0, 0, 1),
      up: vector(0, 1, 0),
    },
    {
      baseOffset: vector(),
      baseToShoulderCenter: vector(0, 1, 0.2),
      shoulderWidth: 0.4,
      baseToHipCenter: vector(0, 0, 0),
      hipWidth: 0.2,
    },
  );
  assert.deepEqual(result.leftShoulder, { x: 0.2, y: 1, z: -0.2 });
  assert.deepEqual(result.rightShoulder, { x: 0.2, y: 1, z: 0.2 });
});
