import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BINARY_SEQUENCE_DURATION_SECONDS,
  binarySequenceFrame,
  buildDigitBits,
  buildDigitSequence,
  PULSE_DURATION_SECONDS,
  PULSE_ONE,
  PULSE_ZERO,
  SEQUENCE_PAUSE_SECONDS,
} from "../src/features/game/world/soundCode";

test("cada algarismo gera quatro pulsos binários sem onda marcadora", () => {
  assert.deepEqual(buildDigitSequence(1), [
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ONE,
  ]);
  assert.deepEqual(buildDigitSequence(9), [
    PULSE_ONE,
    PULSE_ZERO,
    PULSE_ZERO,
    PULSE_ONE,
  ]);
  assert.deepEqual(buildDigitBits(9), [1, 0, 0, 1]);
  assert.equal(buildDigitSequence(8).length, 4);
  assert.equal(PULSE_ONE, "#000000");
  assert.equal(PULSE_ZERO, "#ffffff");
  assert.equal(PULSE_DURATION_SECONDS, 3);
  assert.equal(SEQUENCE_PAUSE_SECONDS, 6);
  assert.equal(BINARY_SEQUENCE_DURATION_SECONDS, 18);
});

test("quatro ondas de três segundos são seguidas por seis segundos de pausa", () => {
  assert.deepEqual(binarySequenceFrame(0), {
    cycle: 0,
    bitIndex: 0,
    phase: 0,
  });
  assert.equal(binarySequenceFrame(2.99).bitIndex, 0);
  assert.equal(binarySequenceFrame(3).bitIndex, 1);
  assert.equal(binarySequenceFrame(6).bitIndex, 2);
  assert.equal(binarySequenceFrame(9).bitIndex, 3);
  assert.equal(binarySequenceFrame(11.99).bitIndex, 3);
  assert.equal(binarySequenceFrame(12).bitIndex, null);
  assert.equal(binarySequenceFrame(17.99).bitIndex, null);
  assert.deepEqual(binarySequenceFrame(18), {
    cycle: 1,
    bitIndex: 0,
    phase: 0,
  });
});
