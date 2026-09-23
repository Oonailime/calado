import { Vector3 } from "three";
import {
  PHASE_TWO_CHESS_SCALE,
  PHASE_TWO_TABLE,
  phaseTwoGroundHeight,
} from "./phaseTwoLayout";

export type ChessSquare =
  `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export const CHESS_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function squareToBoardIndex(square: string) {
  const file = CHESS_FILES.indexOf(square[0] as (typeof CHESS_FILES)[number]);
  const rank = Number(square[1]);
  if (!/^[a-h][1-8]$/.test(square))
    throw new Error(`Invalid chess square: ${square}`);
  return { file, rank: rank - 1 };
}

export function squareToWorldPosition(
  square: string,
  y = phaseTwoGroundHeight(...PHASE_TWO_TABLE) + 1.415 * PHASE_TWO_CHESS_SCALE,
) {
  const { file, rank } = squareToBoardIndex(square);
  return new Vector3(
    // The imported Phase 2 board is viewed from the light army and its
    // physical files run h..a across X. Keep chess notation logical while
    // projecting it onto that existing orientation.
    PHASE_TWO_TABLE[0] + (7 - file - 3.5) * 0.3 * PHASE_TWO_CHESS_SCALE,
    y,
    PHASE_TWO_TABLE[1] + (rank - 3.5) * 0.3 * PHASE_TWO_CHESS_SCALE,
  );
}

export function worldToSquare(x: number, z: number): ChessSquare | null {
  const visualFile = Math.round(
    (x - PHASE_TWO_TABLE[0]) / (0.3 * PHASE_TWO_CHESS_SCALE) + 3.5,
  );
  const rank = Math.round(
    (z - PHASE_TWO_TABLE[1]) / (0.3 * PHASE_TWO_CHESS_SCALE) + 3.5,
  );
  if (visualFile < 0 || visualFile > 7 || rank < 0 || rank > 7) return null;
  return `${CHESS_FILES[7 - visualFile]}${rank + 1}` as ChessSquare;
}
