export type BinaryDigit = 0 | 1;
export type BinaryBitIndex = 0 | 1 | 2 | 3;
export const PULSE_ZERO = "#ffffff";
export const PULSE_ONE = "#000000";
export const PULSE_DURATION_SECONDS = 3;
export const SEQUENCE_PAUSE_SECONDS = 6;
export const BINARY_SEQUENCE_DURATION_SECONDS =
  PULSE_DURATION_SECONDS * 4 + SEQUENCE_PAUSE_SECONDS;

// Each digit is broadcast independently as four BCD bits. There is no marker
// pulse: black communicates 1 and white communicates 0.
export function buildDigitBits(digit: number): BinaryDigit[] {
  return [8, 4, 2, 1].map((bit) => (digit & bit ? 1 : 0));
}

export function buildDigitSequence(digit: number) {
  return buildDigitBits(digit).map((bit) =>
    bit === 1 ? PULSE_ONE : PULSE_ZERO,
  );
}

export function binarySequenceFrame(elapsedSeconds: number): {
  cycle: number;
  bitIndex: BinaryBitIndex | null;
  phase: number;
} {
  const elapsed = Math.max(0, elapsedSeconds);
  const cycle = Math.floor(elapsed / BINARY_SEQUENCE_DURATION_SECONDS);
  const cycleElapsed = elapsed % BINARY_SEQUENCE_DURATION_SECONDS;
  const pulsesDuration = PULSE_DURATION_SECONDS * 4;
  if (cycleElapsed >= pulsesDuration) {
    return {
      cycle,
      bitIndex: null,
      phase: (cycleElapsed - pulsesDuration) / SEQUENCE_PAUSE_SECONDS,
    };
  }
  return {
    cycle,
    bitIndex: Math.floor(
      cycleElapsed / PULSE_DURATION_SECONDS,
    ) as BinaryBitIndex,
    phase: (cycleElapsed % PULSE_DURATION_SECONDS) / PULSE_DURATION_SECONDS,
  };
}
