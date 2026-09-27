import { Chess, type Move, type PieceSymbol } from "chess.js";

/** What Stockfish reported for the position after the player's move. */
export type StockfishAnalysis = {
  /** Principal variation in UCI notation, starting with the side to move. */
  pv: string[];
  /** Centipawns from the side to move's perspective. */
  cp?: number;
  /** Mate in N from the side to move's perspective (negative: being mated). */
  mate?: number;
};

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "o peão",
  n: "o cavalo",
  b: "o bispo",
  r: "a torre",
  q: "a dama",
  k: "o rei",
};

/** Reads score and PV from one UCI `info` line; returns null for other lines. */
export function parseStockfishInfo(line: string): StockfishAnalysis | null {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;
  const multipv = line.match(/ multipv (\d+)/);
  if (multipv && multipv[1] !== "1") return null;
  const score = line.match(/ score (cp|mate) (-?\d+)/);
  const pv = line.slice(line.indexOf(" pv ") + 4).trim().split(/\s+/);
  return {
    pv,
    ...(score?.[1] === "cp" ? { cp: Number(score[2]) } : {}),
    ...(score?.[1] === "mate" ? { mate: Number(score[2]) } : {}),
  };
}

function moveLabel(fen: string, san: string, first: boolean) {
  const [, turn, , , , number] = fen.split(" ");
  if (turn === "w") return `${number}.${san}`;
  return first ? `${number}…${san}` : san;
}

/** Plays a UCI line from `fen` and returns it in numbered SAN (e.g. "22…Kxg8 23.Qxc7"). */
export function formatUciLine(fen: string, uci: string[], maxPlies = 6) {
  const chess = new Chess(fen);
  const moves: Move[] = [];
  const labels: string[] = [];
  for (const step of uci.slice(0, maxPlies)) {
    const before = chess.fen();
    let move: Move;
    try {
      move = chess.move({
        from: step.slice(0, 2),
        to: step.slice(2, 4),
        promotion: step[4],
      });
    } catch {
      break;
    }
    moves.push(move);
    labels.push(moveLabel(before, move.san, labels.length === 0));
  }
  return { text: labels.join(" "), moves };
}

function formatPawns(whiteCp: number) {
  const value = (Math.abs(whiteCp) / 100).toFixed(1).replace(".", ",");
  return `${whiteCp < 0 ? "−" : "+"}${value}`;
}

/**
 * Explains, in Portuguese, why a move outside the historical sequence fails,
 * using Stockfish's evaluation and best defence after that move. The engine
 * searches with Black to move, so its scores are flipped to White's side.
 */
export function describeWrongMove(move: Move, analysis: StockfishAnalysis) {
  const label = moveLabel(move.before, move.san, true);
  const line = formatUciLine(move.after, analysis.pv);
  if (!line.text)
    return `${label} não continua a combinação de Tal. Tente outra jogada.`;
  const reply = line.moves[0];
  const capture = reply.captured
    ? ` A resposta ${line.text.split(" ")[0]} captura ${PIECE_NAMES[reply.captured]}.`
    : "";
  if (analysis.mate !== undefined && analysis.mate > 0)
    return `${label} falha: as pretas dão xeque-mate em ${analysis.mate}.${capture} Linha do Stockfish: ${line.text}. Tente outra jogada.`;
  if (analysis.mate !== undefined && analysis.mate < 0)
    return `${label} também vence (mate em ${-analysis.mate}), mas não é a continuação de Tal. Linha do Stockfish: ${line.text}. Encontre o lance da partida.`;
  const whiteCp = -(analysis.cp ?? 0);
  if (whiteCp >= 300)
    return `${label} mantém vantagem (${formatPawns(whiteCp)}), mas não é a continuação de Tal. Linha do Stockfish: ${line.text}. Encontre o lance da partida.`;
  const verdict =
    whiteCp <= -100
      ? "vantagem das pretas"
      : whiteCp < 100
        ? "posição equilibrada"
        : "vantagem pequena das brancas";
  return `${label} deixa a vantagem escapar.${capture} Melhor defesa das pretas: ${line.text}. Avaliação do Stockfish: ${formatPawns(whiteCp)}, ${verdict}. Tente outra jogada.`;
}
