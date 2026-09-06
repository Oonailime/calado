import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchors,
  collectLog,
  construct,
  eatBanana,
  initialPuzzle,
  LOCK_CODE,
  recover,
  selectCharacter,
  startPower,
  submitCodeDigit,
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
test("Calado só coleta madeira perto das palmeiras marcadas enquanto Mizaru revela", () => {
  let s = initialPuzzle();
  s = collectLog(s, anchors.logs[0]);
  assert.deepEqual(s.logs, [false, false, false]);
  s = startPower(selectCharacter(s, 0), 0, anchors.bridge);
  s = collectLog(s, anchors.logs[0]);
  assert.deepEqual(s.logs, [false, false, false]);
  s = selectCharacter(s, 2);
  s = collectLog(s, anchors.logs[0]);
  assert.deepEqual(s.logs, [true, false, false]);
  s = collectLog(s, { x: 50, y: 0, z: 0 });
  assert.deepEqual(s.logs, [true, false, false]);
  s = collectLog(s, anchors.logs[1]);
  s = collectLog(s, anchors.logs[2]);
  assert.deepEqual(s.logs, [true, true, true]);
});
test("qualquer macaco pode pegar uma banana próxima uma única vez", () => {
  let state = initialPuzzle();
  assert.equal(
    eatBanana(state, 2, { x: 50, y: 0, z: 50 }),
    state,
  );
  state = selectCharacter(state, 0);
  state = eatBanana(state, 0, anchors.bananas[0]);
  assert.deepEqual(state.bananas, [true, false, false, false]);
  const repeated = eatBanana(state, 0, anchors.bananas[0]);
  assert.equal(repeated, state);
  state = selectCharacter(state, 1);
  state = eatBanana(state, 1, anchors.bananas[1]);
  assert.deepEqual(state.bananas, [true, true, false, false]);
});
test("Calado constrói somente perto do mecanismo com ponte revelada e madeira coletada", () => {
  assert.ok(anchors.bridgeBuild.x > 0);
  assert.ok(anchors.bridgeBuild.z > -6);
  let s = initialPuzzle();
  assert.equal(construct(s, anchors.bridgeBuild).bridge, false);
  s = startPower(selectCharacter(s, 0), 0, anchors.bridge);
  assert.equal(construct(s, anchors.bridgeBuild).bridge, false);
  s = selectCharacter(s, 2);
  assert.equal(construct(s, { x: 50, y: 0, z: 0 }).bridge, false);
  assert.equal(construct(s, anchors.bridgeBuild).bridge, false);
  for (const log of anchors.logs) s = collectLog(s, log);
  assert.deepEqual(s.logs, [true, true, true]);
  s = construct(s, anchors.bridgeBuild);
  assert.equal(s.bridge, true);
  assert.deepEqual(s.sustained, [false, false, false]);
});
test("Calado destrava um algarismo por vez, perto do cadeado e na ordem exata", () => {
  let s = selectCharacter({ ...initialPuzzle(), bridge: true }, 0);
  assert.equal(submitCodeDigit(s, anchors.padlock, LOCK_CODE[0]), s);
  s = selectCharacter(s, 2);
  assert.equal(submitCodeDigit(s, { x: 50, y: 0, z: 0 }, LOCK_CODE[0]), s);
  assert.equal(submitCodeDigit(s, anchors.padlock, 0), s);

  for (let index = 0; index < LOCK_CODE.length; index += 1) {
    s = submitCodeDigit(s, anchors.padlock, LOCK_CODE[index]);
    assert.equal(s.codeProgress, index + 1);
    assert.equal(s.unlocked, index === LOCK_CODE.length - 1);
  }
  assert.equal(s.unlocked, true);
  // Re-submitting after unlocking is a harmless no-op, not a re-validation.
  const again = submitCodeDigit(s, anchors.padlock, 0);
  assert.equal(again, s);
});
test("construção final exige dois companheiros sustentando e o cadeado destravado", () => {
  let s = { ...initialPuzzle(), bridge: true };
  s = startPower(selectCharacter(s, 0), 0, anchors.reveal);
  s = selectCharacter(s, 2);
  assert.equal(construct(s, anchors.finalBuild).built, false);
  s = startPower(selectCharacter(s, 1), 1, anchors.silence);
  s = selectCharacter(s, 2);
  assert.deepEqual(s.sustained, [true, true, false]);
  assert.equal(construct(s, anchors.finalBuild).built, false);
  for (const digit of LOCK_CODE)
    s = submitCodeDigit(s, anchors.padlock, digit);
  assert.equal(s.unlocked, true);
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
