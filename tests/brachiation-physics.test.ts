import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ballisticPosition,
  buildLocalBasis,
  clampUnit,
  constrainedPreStepVelocity,
  projectTangential,
  releaseVelocity,
  scoreAnchor,
  solveDistanceConstraint,
  solveTwoBoneJoint,
} from "../src/features/game/characters/brachiationPhysics";
import {
  PHYSICS_FIXED_DT,
  WORLD_GRAVITY,
} from "../src/features/game/characters/locomotionConfig";

const epsilon = 1e-6;
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
const distance = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("projeção tangencial remove toda componente radial", () => {
  const inverseRootTwo = 1 / Math.sqrt(2);
  const radial = vector(inverseRootTwo, inverseRootTwo, 0);
  const tangential = vector();
  projectTangential(tangential, vector(1, -1, 0), radial);
  const dot =
    tangential.x * radial.x + tangential.y * radial.y + tangential.z * radial.z;
  assert.ok(Math.abs(dot) < epsilon);
});

test("constraint de distância termina exatamente no comprimento configurado", () => {
  const anchor = vector(1, 2, 3);
  const position = vector(4, -1, 6);
  solveDistanceConstraint(position, anchor, 2.4);
  assert.ok(Math.abs(distance(position, anchor) - 2.4) < epsilon);
});

test("solver pré-step deixa Rapier integrar gravidade uma vez e mantém o raio", () => {
  const position = vector(0.7, -0.4, 0.3);
  const anchor = vector();
  const length = distance(position, anchor);
  const velocity = vector(2.1, -0.7, 1.2);
  const beforeGravity = vector();
  constrainedPreStepVelocity(
    beforeGravity,
    position,
    velocity,
    WORLD_GRAVITY,
    [{ active: true, anchor, length }],
    PHYSICS_FIXED_DT,
    8,
    0,
    { predictedPosition: vector(), solvedVelocity: vector() },
  );
  const integratedVelocity = vector(
    beforeGravity.x + WORLD_GRAVITY.x * PHYSICS_FIXED_DT,
    beforeGravity.y + WORLD_GRAVITY.y * PHYSICS_FIXED_DT,
    beforeGravity.z + WORLD_GRAVITY.z * PHYSICS_FIXED_DT,
  );
  const integratedPosition = vector(
    position.x + integratedVelocity.x * PHYSICS_FIXED_DT,
    position.y + integratedVelocity.y * PHYSICS_FIXED_DT,
    position.z + integratedVelocity.z * PHYSICS_FIXED_DT,
  );
  assert.ok(Math.abs(distance(integratedPosition, anchor) - length) < epsilon);
});

test("duas mãos convergem iterativamente sem explosão de energia", () => {
  const left = vector(-0.8, 2, 0);
  const right = vector(0.8, 2, 0);
  const position = vector(0, 0, 0);
  const length = distance(position, left);
  const velocity = vector(0, 0, 2);
  const beforeGravity = vector();
  const scratch = { predictedPosition: vector(), solvedVelocity: vector() };
  let maximumSpeed = 0;

  for (let step = 0; step < 600; step += 1) {
    constrainedPreStepVelocity(
      beforeGravity,
      position,
      velocity,
      WORLD_GRAVITY,
      [
        { active: true, anchor: left, length },
        { active: true, anchor: right, length },
      ],
      PHYSICS_FIXED_DT,
      8,
      0.035,
      scratch,
    );
    velocity.x = beforeGravity.x + WORLD_GRAVITY.x * PHYSICS_FIXED_DT;
    velocity.y = beforeGravity.y + WORLD_GRAVITY.y * PHYSICS_FIXED_DT;
    velocity.z = beforeGravity.z + WORLD_GRAVITY.z * PHYSICS_FIXED_DT;
    position.x += velocity.x * PHYSICS_FIXED_DT;
    position.y += velocity.y * PHYSICS_FIXED_DT;
    position.z += velocity.z * PHYSICS_FIXED_DT;
    maximumSpeed = Math.max(
      maximumSpeed,
      Math.hypot(velocity.x, velocity.y, velocity.z),
    );
  }

  assert.ok(Math.abs(distance(position, left) - length) < 2e-5);
  assert.ok(Math.abs(distance(position, right) - length) < 2e-5);
  assert.ok(maximumSpeed < 12, `velocidade instável: ${maximumSpeed}`);
});

test("release sem assist conserva integralmente o momentum", () => {
  const before = vector(3.25, 1.4, -2.1);
  const after = vector();
  releaseVelocity(after, before, vector(0, 0, -1), 0);
  assert.deepEqual(after, before);
});

test("two-bone IK conserva os dois comprimentos para alvo alcançável", () => {
  const shoulder = vector();
  const target = vector(0.9, 0.15, 0.25);
  const elbow = vector();
  const upper = 0.62;
  const forearm = 0.54;
  solveTwoBoneJoint(elbow, shoulder, target, vector(0, -1, 1), upper, forearm);
  assert.ok(Math.abs(distance(shoulder, elbow) - upper) < epsilon);
  assert.ok(Math.abs(distance(elbow, target) - forearm) < epsilon);
});

test("clamp protege acos de erro numérico", () => {
  for (const value of [-1.000001, -1, 0, 1, 1.000001]) {
    const clamped = clampUnit(value);
    assert.ok(clamped >= -1 && clamped <= 1);
    assert.ok(Number.isFinite(Math.acos(clamped)));
  }
});

test("base local é ortogonal e acompanha direção 3D projetada contra gravity", () => {
  const basis = {
    forward: vector(),
    right: vector(),
    up: vector(),
  };
  buildLocalBasis(vector(2, 4, -3), WORLD_GRAVITY, vector(0, 0, -1), basis);
  const dotForwardUp =
    basis.forward.x * basis.up.x +
    basis.forward.y * basis.up.y +
    basis.forward.z * basis.up.z;
  const dotRightUp =
    basis.right.x * basis.up.x +
    basis.right.y * basis.up.y +
    basis.right.z * basis.up.z;
  assert.ok(Math.abs(dotForwardUp) < epsilon);
  assert.ok(Math.abs(dotRightUp) < epsilon);
  assert.ok(
    Math.abs(
      Math.hypot(basis.forward.x, basis.forward.y, basis.forward.z) - 1,
    ) < epsilon,
  );
  assert.ok(
    Math.abs(Math.hypot(basis.right.x, basis.right.y, basis.right.z) - 1) <
      epsilon,
  );
  // The imported monkey's local +X is anatomical left. Mapping local axes as
  // (-right, up, forward) must be a proper rotation, never a reflection.
  const mappedForward = vector(
    -basis.right.y * basis.up.z + basis.right.z * basis.up.y,
    -basis.right.z * basis.up.x + basis.right.x * basis.up.z,
    -basis.right.x * basis.up.y + basis.right.y * basis.up.x,
  );
  assert.ok(distance(mappedForward, basis.forward) < epsilon);
});

test("seleção preditiva prefere progresso na direção do momentum", () => {
  const common = {
    position: vector(),
    velocity: vector(4, 0, 0),
    gravity: WORLD_GRAVITY,
    desiredDirection: vector(),
    right: vector(0, 0, 1),
    predictionTime: 0.25,
    maxReach: 2.5,
    hand: "right" as const,
  };
  const ahead = scoreAnchor({ ...common, anchor: vector(2, 0.4, 0.2) });
  const behind = scoreAnchor({ ...common, anchor: vector(-2, 0.4, 0.2) });
  assert.ok(ahead > behind);
});

test("trajetória balística independe da taxa de renderização", () => {
  const start = vector(1, 2, 3);
  const launch = vector(4, 6, -2);
  const expected = ballisticPosition(
    vector(),
    start,
    launch,
    WORLD_GRAVITY,
    1.2,
  );
  for (const renderRate of [30, 60, 120]) {
    let accumulator = 0;
    let physicsSteps = 0;
    for (let frame = 0; frame < renderRate * 1.2; frame += 1) {
      accumulator += 1 / renderRate;
      while (accumulator + 1e-10 >= PHYSICS_FIXED_DT) {
        accumulator -= PHYSICS_FIXED_DT;
        physicsSteps += 1;
      }
    }
    assert.equal(physicsSteps, 72);
    const sampled = ballisticPosition(
      vector(),
      start,
      launch,
      WORLD_GRAVITY,
      physicsSteps * PHYSICS_FIXED_DT,
    );
    assert.ok(distance(sampled, expected) < epsilon);
  }
});
