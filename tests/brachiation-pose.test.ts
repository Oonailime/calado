import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import {
  sampleHandReach,
  suspensionBasis,
  handoffShoulderTurn,
  limitSuspendedElbowPole,
  SUSPENDED_SHOULDER_TWIST_LIMIT,
  pendulumBodyBasis,
} from "../src/features/game/characters/brachiationPose";

test("transferência gira o ombro cerca de 180° e troca qual lado lidera, ficando paralelo ao cipó em repouso", () => {
  const basis = {
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
  };
  for (const travel of [
    new Vector3(1, 0, 0),
    new Vector3(1, 0.2, -1).normalize(),
  ]) {
    for (const from of ["left", "right"] as const) {
      const restTurn = from === "left" ? 0 : Math.PI;
      for (const [progress, expectedTurn] of [
        [0, restTurn],
        [0.5, Math.PI / 2],
        [1, Math.PI - restTurn],
      ]) {
        const turn = handoffShoulderTurn(from, progress);
        assert.ok(Math.abs(turn - expectedTurn) < 1e-8);
        suspensionBasis(basis, travel, 0.15, turn);
        assert.ok(
          Math.abs(-basis.right.dot(travel) - Math.cos(expectedTurn)) < 1e-6,
        );
        assert.ok(Math.abs(basis.right.length() - 1) < 1e-8);
        assert.ok(Math.abs(basis.right.dot(basis.up)) < 1e-8);
      }
      // At rest (progress 0 or 1) the shoulder bar is fully parallel to the
      // vine - only which physical shoulder leads differs.
      suspensionBasis(basis, travel, 0.15, handoffShoulderTurn(from, 0));
      assert.ok(Math.abs(Math.abs(-basis.right.dot(travel)) - 1) < 1e-6);
    }
  }
  assert.equal(handoffShoulderTurn("left", 1), handoffShoulderTurn("right", 0));
  assert.equal(handoffShoulderTurn("right", 1), handoffShoulderTurn("left", 0));
});

test("barra dos ombros fica paralela ao caminho 3D mesmo com o tronco oscilando", () => {
  const frame = {
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
  };
  for (const travel of [
    new Vector3(1, 0, 0),
    new Vector3(1, 0.2, 1),
    new Vector3(0, -0.3, -1),
  ]) {
    for (const lean of [-0.3, 0, 0.3]) {
      suspensionBasis(frame, travel, lean, 0);
      assert.ok(
        Math.abs(frame.right.dot(travel.clone().normalize())) > 0.999999,
      );
      assert.ok(Math.abs(frame.up.dot(frame.right)) < 1e-8);
      const normal = frame.right.clone().negate().cross(frame.up);
      assert.ok(normal.distanceTo(frame.forward) < 1e-8);
    }
  }
});

test("shoulder twist stays bounded even when the simulated elbow tries multiple full turns", () => {
  const basis = { right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), forward: new Vector3(0, 0, 1) };
  for (const side of ["left", "right"] as const) {
    for (const axis of [basis.up, new Vector3(0.5, 0.8, -0.2).normalize()]) {
      const reference = new Vector3().copy(limitSuspendedElbowPole(new Vector3(), axis, new Vector3(), basis, side));
      for (let i = 0; i <= 720; i++) {
        const preferred = reference.clone().applyAxisAngle(axis, i / 60);
        const limited = new Vector3();
        limitSuspendedElbowPole(limited, axis, preferred, basis, side);
        assert.ok(limited.angleTo(reference) <= SUSPENDED_SHOULDER_TWIST_LIMIT + 1e-6);
        assert.ok(Math.abs(limited.dot(axis)) < 1e-6);
        assert.ok(Math.abs(limited.length() - 1) < 1e-6);
      }
    }
  }
});

test("the body follows the rope continuously through 360 degrees with bounded joint twist", () => {
  const basis = { right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), forward: new Vector3(0, 0, 1) };
  const previous = new Vector3(0, 1, 0);
  for (let step = 0; step <= 720; step++) {
    const angle = step * Math.PI / 180;
    const radial = new Vector3(0, -Math.cos(angle), Math.sin(angle));
    pendulumBodyBasis(basis, radial, 0);
    assert.ok(basis.up.dot(radial) < -0.999999);
    assert.ok(basis.up.dot(previous) > 0.999, "the body must not flip at the top or bottom");
    assert.ok(Math.abs(basis.right.dot(basis.up)) < 1e-6);
    previous.copy(basis.up);
  }
});

test("mão parte do apoio anterior e percorre um arco contínuo antes da pegada", () => {
  const a = new Vector3(0, 2, 0),
    b = new Vector3(0.46, 2, 0);
  const out = new Vector3(),
    normal = new Vector3(0, 0, 1);
  sampleHandReach(out, a, b, 0, normal);
  assert.ok(out.distanceTo(a) < 1e-8);
  const previous = out.clone();
  for (let frame = 1; frame <= 60; frame++) {
    sampleHandReach(out, a, b, frame / 60, normal);
    assert.ok(out.distanceTo(previous) < 0.02);
    previous.copy(out);
  }
  assert.ok(out.distanceTo(b) < 1e-8);
  sampleHandReach(out, a, b, 0.5, normal);
  assert.ok(out.y < a.y && out.z > a.z);
  sampleHandReach(out, a, b, 0.001, normal);
  assert.ok(out.distanceTo(a) < 0.00001);
});
