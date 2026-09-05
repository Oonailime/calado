export const PULSE_ZERO = "#d9483a";
export const PULSE_ONE = "#3d7fd9";
export const PULSE_MARK = "#f5f2e2";

// Each digit is broadcast independently as a restart pulse followed by its
// four BCD bits. The current digit repeats until Calado enters it correctly.
export function buildDigitSequence(digit: number) {
  return [
    PULSE_MARK,
    ...[8, 4, 2, 1].map((bit) => (digit & bit ? PULSE_ONE : PULSE_ZERO)),
  ];
}
