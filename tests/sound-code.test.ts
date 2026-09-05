import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDigitSequence,
  PULSE_MARK,
  PULSE_ONE,
  PULSE_ZERO,
} from "../src/features/game/world/soundCode";

test("cada algarismo gera somente o seu próprio loop de cinco pulsos", () => {
  assert.deepEqual(buildDigitSequence(1), [
    PULSE_MARK,
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ONE,
  ]);
  assert.deepEqual(buildDigitSequence(9), [
    PULSE_MARK,
    PULSE_ONE,
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ONE,
  ]);
  assert.equal(buildDigitSequence(8).length, 5);
});
