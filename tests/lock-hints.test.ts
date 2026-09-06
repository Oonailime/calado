import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LOCK_HINTS,
  lockHintsForLocale,
  nextLockHintCount,
} from "../src/features/game/ui/lockHints";

test("o cadeado revela três dicas em ordem nos dois idiomas", () => {
  assert.equal(LOCK_HINTS.length, 3);
  assert.deepEqual(lockHintsForLocale("pt", 3), [
    "A vida é feita de altos e baixos.",
    "Algumas vezes, a vida é preto e branco.",
    "Você deveria estudar binário, com isso você pode contar até 1023 com as mãos",
  ]);
  assert.deepEqual(lockHintsForLocale("en", 3), [
    "Life is made of ups and downs.",
    "Sometimes, life is black and white.",
    "You should study binary; with it, you can count to 1023 using your hands.",
  ]);
  assert.equal(nextLockHintCount(0), 1);
  assert.equal(nextLockHintCount(2), 3);
  assert.equal(nextLockHintCount(3), 3);
});
