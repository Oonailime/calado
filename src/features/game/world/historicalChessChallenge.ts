import { Chess } from "chess.js";

// The supplied reference image is authoritative for the current setup. It is
// the line ending in 21...Kf8, not the earlier PGN line ending in 21...Nxd5.
export const TAL_GULKO_FEN =
  "r1bq1k1r/1p2b1pp/p4p2/3NQ2B/1P1pP3/8/2PK3P/3R2R1 w - - 2 22";
export const TAL_GULKO_SEQUENCE = [
  "Rxg7",
  "fxe5",
  "Rf7+",
  "Ke8",
  "Rxe7+",
  "Kf8",
  "Rf1+",
  "Kg8",
  "Rff7",
] as const;
export const HISTORICAL_HINTS = [
  "Esse lance não segue o ataque histórico. Procure uma captura de torre que abra a sétima fileira, mesmo deixando a dama atacada.",
  "A combinação exige manter o rei sob pressão. Procure um xeque de torre na sétima fileira.",
  "O bispo em e7 sustenta a defesa. Procure removê-lo com xeque.",
  "A segunda torre precisa entrar no ataque. Procure ativá-la com xeque pela coluna f.",
  "As duas torres precisam dominar a sétima fileira. Observe qual delas deve subir.",
];

export function createHistoricalChallenge() {
  const chess = new Chess(TAL_GULKO_FEN);
  if (chess.fen() !== TAL_GULKO_FEN)
    throw new Error("Tal-Gulko FEN could not be loaded");
  return chess;
}

export function validateHistoricalSequence() {
  const chess = createHistoricalChallenge();
  for (const san of TAL_GULKO_SEQUENCE) chess.move(san);
  return chess;
}
