import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchors,
  construct,
  initialPuzzle,
  recover,
  selectCharacter,
  startPower,
} from "../src/features/game/state/rules";

test("trocar de personagem com o poder ativo mantém a sustentação automaticamente", () => {
  let s = selectCharacter(initialPuzzle(), 0);
  s = startPower(s, 0, anchors.bridge);
  s = selectCharacter(s, 2);
  assert.equal(s.powers[0], true);
  assert.equal(s.sustained[0], true);
});
test("pressionar novamente enquanto selecionado desativa a habilidade imediatamente, sem precisar trocar", () => {
  let s = startPower(selectCharacter(initialPuzzle(), 0), 0, anchors.bridge);
  s = startPower(s, 0, anchors.bridge);
  assert.equal(s.powers[0], false);
  assert.equal(s.sustained[0], false);
});
test("troca livre preserva sustentação ao reselecionar e exige ação para liberar", () => {
  let s = startPower(selectCharacter(initialPuzzle(), 0), 0, anchors.bridge);
  s = selectCharacter(s, 2);
  s = selectCharacter(s, 0);
  assert.equal(s.powers[0], true);
  assert.equal(s.sustained[0], true);
  s = startPower(s, 0, anchors.bridge);
  assert.equal(s.powers[0], false);
});
test("poderes dependem do ponto válido e da progressão", () => {
  assert.equal(
    startPower(initialPuzzle(), 0, { x: 20, y: 0, z: 20 }).powers[0],
    false,
  );
  assert.equal(
    startPower(initialPuzzle(), 1, anchors.silence).powers[1],
    false,
  );
});
test("Calado constrói somente perto do mecanismo com ponte revelada", () => {
  let s = initialPuzzle();
  assert.equal(construct(s, anchors.bridgeBuild).bridge, false);
  s = startPower(selectCharacter(s, 0), 0, anchors.bridge);
  assert.equal(construct(s, anchors.bridgeBuild).bridge, false);
  s = selectCharacter(s, 2);
  assert.equal(construct(s, { x: 50, y: 0, z: 0 }).bridge, false);
  s = construct(s, anchors.bridgeBuild);
  assert.equal(s.bridge, true);
  assert.deepEqual(s.sustained, [false, false, false]);
});
test("construção final exige dois companheiros sustentando", () => {
  let s = { ...initialPuzzle(), bridge: true };
  s = startPower(selectCharacter(s, 0), 0, anchors.reveal);
  s = selectCharacter(s, 2);
  assert.equal(construct(s, anchors.finalBuild).built, false);
  s = startPower(selectCharacter(s, 1), 1, anchors.silence);
  s = selectCharacter(s, 2);
  assert.deepEqual(s.sustained, [true, true, false]);
  s = construct(s, anchors.finalBuild);
  assert.equal(s.built, true);
  assert.deepEqual(s.powers, [false, false, false]);
});
test("recuperação preserva construções e libera companheiros em ponto seguro", () => {
  let s = { ...initialPuzzle(), bridge: true, built: true };
  s = recover(s);
  assert.equal(s.bridge, true);
  assert.equal(s.built, true);
  assert.equal(s.revision, 1);
  assert.deepEqual(s.powers, [false, false, false]);
});
