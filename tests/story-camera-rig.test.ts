import assert from "node:assert/strict";
import { test } from "node:test";
import {
  angleTo,
  calladoState,
  cameraForProgress,
  companionState,
  CONVERGENCE_POINT,
  GAME_HANDOFF,
  houseYaw,
  PATH_POINTS,
} from "../src/features/story/scene3d/cameraRig";

test("o caminho é um zigue-zague diagonal que sempre avança (z cada vez mais negativo)", () => {
  for (let i = 1; i < PATH_POINTS.length; i++) {
    assert.ok(
      PATH_POINTS[i].z < PATH_POINTS[i - 1].z,
      `ponto ${i} deveria estar mais à frente que o ponto ${i - 1}`,
    );
    assert.notEqual(
      PATH_POINTS[i].x,
      PATH_POINTS[i - 1].x,
      `ponto ${i} deveria alternar o lado (diagonal) em relação ao ponto ${i - 1}`,
    );
  }
});

test("cada casa vira a porta (frente) de volta para o ponto anterior do caminho", () => {
  // House 0 has no previous point, so it faces forward toward house 1 instead.
  assert.equal(houseYaw(0), angleTo(PATH_POINTS[0], PATH_POINTS[1]));
  for (let i = 1; i < PATH_POINTS.length; i++) {
    assert.equal(houseYaw(i), angleTo(PATH_POINTS[i], PATH_POINTS[i - 1]));
  }
});

test("Calado percorre o caminho e para na clareira, sem voltar a atravessar as casas", () => {
  const arrival = calladoState(6 / 8, false);
  assert.deepEqual(arrival.position, CONVERGENCE_POINT);
  // Once in the clearing (scenes 6 and 7), his position never leaves it again,
  // even as the camera itself pulls all the way back to the game handoff —
  // this is the exact regression the "walked through every house" bug was.
  for (const progress of [6 / 8, 6.5 / 8, 7 / 8, 7.5 / 8, 1]) {
    assert.deepEqual(calladoState(progress, false).position, CONVERGENCE_POINT);
  }
  assert.equal(calladoState(7.5 / 8).settled, true);
  assert.equal(calladoState(7.5 / 8).yaw, 0);
});

test("Mizaru e Kikazaru só aparecem na cena do encontro, entrando de fora da câmera", () => {
  assert.equal(companionState(-1, 5.9 / 8).visible, false);
  const entering = companionState(-1, 6.1 / 8);
  assert.equal(entering.visible, true);
  assert.ok(entering.walking);
  const start = companionState(-1, 6.01 / 8).position.x;
  const later = companionState(-1, 6.4 / 8).position.x;
  // Side -1 starts far to the left of the clearing and walks inward (toward
  // a larger x) to flank Calado.
  assert.ok(later > start);
  const settled = companionState(-1, 6.9 / 8);
  assert.equal(settled.walking, false);
  assert.equal(settled.yaw, 0);
  // Mirrored side enters from the opposite direction.
  const otherStart = companionState(1, 6.01 / 8).position.x;
  const otherLater = companionState(1, 6.4 / 8).position.x;
  assert.ok(otherLater < otherStart);
});

test("a câmera converge exatamente para a entrada do jogo ao final", () => {
  const end = cameraForProgress(1);
  assert.deepEqual(end.position, GAME_HANDOFF.position);
  assert.deepEqual(end.lookAt, GAME_HANDOFF.lookAt);
});

test("modo de movimento reduzido troca a suavização por um corte abrupto", () => {
  const early = cameraForProgress(0.1 / 8, true);
  const late = cameraForProgress(0.4 / 8, true);
  assert.deepEqual(early.position, late.position);

  const normalEarly = cameraForProgress(0.1 / 8, false);
  const normalLate = cameraForProgress(0.4 / 8, false);
  assert.notDeepEqual(
    normalEarly.position,
    normalLate.position,
    "sem reduced motion a câmera deveria se mover continuamente com a fase",
  );
});
