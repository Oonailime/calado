import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LOCK_HINTS,
  lockHintsForLocale,
  nextLockHintCount,
} from "../src/features/game/ui/lockHints";

test("o cadeado revela cinco dicas em ordem nos dois idiomas", () => {
  assert.equal(LOCK_HINTS.length, 5);
  const pt = lockHintsForLocale("pt", 5);
  const en = lockHintsForLocale("en", 5);
  // First: where the waves come from (both powers, seen by Mizaru).
  assert.match(pt[0], /^Selecione Mizaru \(2\).*triângulo prateado.*Kikazaru \(1\).*círculo dourado/);
  assert.match(en[0], /^Select Mizaru \(2\).*silver triangle.*Kikazaru's \(1\).*golden circle/);
  assert.deepEqual(pt.slice(1, 4), [
    "A vida é feita de altos e baixos.",
    "Algumas vezes, a vida é preto e branco.",
    "Você deveria estudar binário, com isso você pode contar até 1023 com as mãos",
  ]);
  assert.deepEqual(en.slice(1, 4), [
    "Life is made of ups and downs.",
    "Sometimes, life is black and white.",
    "You should study binary; with it, you can count to 1023 using your hands.",
  ]);
  // Last: the full method, four bits per decimal digit.
  assert.match(pt[4], /4 bits.*algarismo decimal.*“Programador”/);
  assert.match(en[4], /4-bit.*decimal digit.*“Programmer”/);
  assert.equal(nextLockHintCount(0), 1);
  assert.equal(nextLockHintCount(4), 5);
  assert.equal(nextLockHintCount(5), 5);
});
