import { Chess, type Move, type Square } from "chess.js";
import { CHARACTERS, type CharacterId, type Vec3 } from "../types";
import { phase2SkipWalk, runtime, useGame } from "../state/store";
import { PHASE_TWO_STOOLS } from "./phaseTwoLayout";
import {
  createHistoricalChallenge,
  TAL_GULKO_SEQUENCE,
} from "./historicalChessChallenge";
import { StockfishEngine } from "./stockfishEngine";

export type Phase2Mode = "idle" | "historical" | "free";
export type Phase2Seat = { monkeyId: CharacterId; color: "w" | "b" };
export const PHASE_TWO_ELOS = { 0: 2000, 1: 800, 2: 1600 } as const;
const listeners = new Set<() => void>();
let engine: StockfishEngine | null = null;
let chess = createHistoricalChallenge();
let displayFen = chess.fen();
let mode: Phase2Mode = "idle",
  requestedMode: Exclude<Phase2Mode, "idle"> = "historical";
let selected: Square | null = null;
let targets: Move[] = [];
let seats: [Phase2Seat | null, Phase2Seat | null] = [null, null];
let message = "Aproxime-se da cepa das brancas e pressione E para jogar o desafio.";
let historicalSolved = false,
  thinking = false,
  gameOver = false;
let playerColor: "w" | "b" = "w";
let tabOpen = false;
let session = 0,
  revision = 0;
let lastMove: Move | null = null;
let promotion: { from: Square; to: Square } | null = null;
const savedPositions = new Map<CharacterId, Vec3>();
let camera: { yaw: number; pitch: number; zoom: number } | null = null;
let animate: ((move: Move) => Promise<void>) | null = null;
function snapshot() {
  return {
    mode,
    tabOpen,
    requestedMode,
    fen: displayFen,
    selected,
    legalTargets: targets.map((m) => m.to),
    captureTargets: targets.filter((m) => m.captured).map((m) => m.to),
    seats: [...seats],
    message,
    historicalSolved,
    thinking,
    gameOver,
    playerColor,
    promotion,
    revision,
    lastMove,
  };
}
let cachedSnapshot = snapshot();
function emit() {
  cachedSnapshot = snapshot();
  listeners.forEach((fn) => fn());
}
function status() {
  gameOver = chess.isGameOver();
  if (mode === "free" && chess.isCheckmate()) {
    const won = chess.turn() !== playerColor;
    const rival = seats.find(seat => seat && seat.color !== playerColor);
    message = won ? "Xeque-mate! Você venceu." : "Xeque-mate. O adversário venceu.";
    if (won && rival && useGame.getState().awardChessTrophy(rival.monkeyId)) {
      message += ` Troféu ${CHARACTERS[rival.monkeyId].name} adicionado ao inventário!`;
    }
    return;
  }
  message = chess.isCheckmate()
    ? "Xeque-mate."
    : chess.isStalemate()
      ? "Empate por afogamento (stalemate)."
      : gameOver
        ? "Empate: repetição, material insuficiente ou regra dos 50 lances."
        : chess.isCheck()
          ? "Xeque! Sua vez."
          : "Sua vez.";
}
async function play(move: Move, token: number) {
  lastMove = move;
  // Acknowledge the click immediately; the 3D scene slides into this position.
  displayFen = move.after;
  emit();
  if (animate) await animate(move);
  if (session !== token) return false;
  return true;
}
async function opponent(token: number) {
  if (chess.isGameOver()) {
    status();
    thinking = false;
    emit();
    return;
  }
  thinking = true;
  emit();
  try {
    const best = await engine!.getBestMove(chess.fen());
    if (session !== token) return;
    const move = chess.move({
      from: best.slice(0, 2),
      to: best.slice(2, 4),
      promotion: best[4],
    });
    if (!(await play(move, token))) return;
    status();
  } catch (error) {
    if (session !== token) return;
    message = `Falha na IA: ${error instanceof Error ? error.message : "erro"} Saia e inicie novamente.`;
  }
  thinking = false;
  emit();
}
function begin() {
  if (!seats[0] || (requestedMode === "free" && !seats[1])) return;
  mode = requestedMode;
  tabOpen = true;
  playerColor = mode === "historical" ? "w" : seats.find(
    (s) => s?.monkeyId === useGame.getState().puzzle.selected,
  )!.color;
  session++;
  revision++;
  lastMove = null;
  chess = mode === "historical" ? createHistoricalChallenge() : new Chess();
  displayFen = chess.fen();
  selected = null;
  targets = [];
  gameOver = false;
  promotion = null;
  thinking = false;
  camera ??= { yaw: runtime.yaw, pitch: runtime.pitch, zoom: runtime.zoom };
  runtime.keys.clear();
  runtime.jump = false;
  runtime.chessActive = true;
  if (typeof document !== "undefined") document.exitPointerLock?.();
  message =
    mode === "historical"
      ? "Tal × Gulko, após 21…Kf8. Encontre a combinação das brancas."
      : "Partida livre. Sua vez.";
  emit();
  if (mode === "free") {
    engine?.dispose();
    engine = new StockfishEngine();
    engine.setElo(
      PHASE_TWO_ELOS[seats.find((s) => s?.color !== playerColor)!.monkeyId],
    );
    const token = session;
    thinking = true;
    emit();
    void engine
      .initialize()
      .then(() => {
        if (session !== token) return;
        message = `Adversário: Elo aproximado ${engine!.effectiveElo}.`;
        thinking = false;
        emit();
        if (playerColor === "b") void opponent(token);
      })
      .catch(() => {
        if (session === token) {
          thinking = false;
          message =
            "Não foi possível carregar Stockfish. Saia e tente novamente.";
          emit();
        }
      });
  }
}
export const phase2Chess = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot: () => cachedSnapshot,
  hydrate() {
    useGame.getState().hydrateChessTrophies();
    try {
      historicalSolved =
        localStorage.getItem("historicalChessPuzzleSolved") === "true";
    } catch {}
    // ?skip already seeded phase2Pieces at store creation — don't let a
    // real (possibly incomplete) save from an earlier, non-skip session
    // overwrite that.
    if (!phase2SkipWalk()) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem("phase2ChessPieces") ?? "[]");
        if (Array.isArray(saved) && saved.length === 3) {
          useGame.setState({ phase2Pieces: saved.map(value => value === true) as [boolean, boolean, boolean] });
        }
      } catch {}
    }
    if (historicalSolved) useGame.setState({ phase2Pieces: [true, true, true] });
    requestedMode = historicalSolved ? "free" : "historical";
    emit();
  },
  registerAnimator(fn: (move: Move) => Promise<void>) {
    animate = fn;
    return () => {
      if (animate === fn) animate = null;
    };
  },
  startHistorical() {
    if (mode !== "idle" || requestedMode !== "historical") this.stop();
    requestedMode = "historical";
    chess = createHistoricalChallenge();
    displayFen = chess.fen();
    revision++;
    message =
      "Sente na cepa das brancas para começar. As pretas respondem automaticamente.";
    this.openTab();
    if (seats[0]) begin();
  },
  startFree() {
    if (!historicalSolved) return;
    if (mode !== "idle") this.stop();
    requestedMode = "free";
    chess = new Chess();
    displayFen = chess.fen();
    revision++;
    message =
      "Sente o adversário em uma cepa. Troque de macaco e ocupe a outra para começar.";
    this.openTab();
    if (seats.every(Boolean)) begin();
  },
  openTab() {
    tabOpen = true;
    if (typeof document !== "undefined") document.exitPointerLock?.();
    emit();
  },
  restart() {
    if (thinking || mode === "idle") return;
    engine?.dispose();
    begin();
  },
  stop() {
    session++;
    engine?.dispose();
    engine = null;
    for (const [id, position] of savedPositions)
      runtime.phase2Restore[id] = position;
    savedPositions.clear();
    seats = [null, null];
    runtime.phase2Seats = [null, null];
    runtime.chessActive = false;
    if (camera) Object.assign(runtime, camera);
    camera = null;
    mode = "idle";
    requestedMode = historicalSolved ? "free" : "historical";
    tabOpen = false;
    selected = null;
    targets = [];
    thinking = false;
    gameOver = false;
    promotion = null;
    lastMove = null;
    chess = createHistoricalChallenge();
    revision++;
    displayFen = chess.fen();
    message = "Aproxime-se de uma cepa e pressione E para jogar.";
    emit();
  },
  seat(monkeyId: CharacterId, color: "w" | "b") {
    if (mode !== "idle" || seats.some((s) => s?.monkeyId === monkeyId)) return;
    if (!useGame.getState().phase2Pieces.every(Boolean)) {
      message = "Recolha as três peças de xadrez no caminho antes de sentar.";
      emit();
      return;
    }
    if (requestedMode === "historical" && color === "b") {
      message = "No desafio, sente nas brancas. A cepa das pretas permanece vazia.";
      emit();
      return;
    }
    const index = color === "w" ? 0 : 1,
      anchor = PHASE_TWO_STOOLS[index],
      p = runtime.positions[monkeyId];
    if (seats[index] || Math.hypot(p.x - anchor.x, p.z - anchor.z) > 1.25) {
      message = "Chegue perto de uma cepa vazia.";
      emit();
      return;
    }
    savedPositions.set(monkeyId, { ...p });
    seats[index] = { monkeyId, color };
    runtime.phase2Seats[index] = monkeyId;
    message =
      "Adversário sentado. Troque de macaco (1/2/3) e ocupe a outra cepa.";
    emit();
    if (requestedMode === "historical" || seats.every(Boolean)) begin();
  },
  canSeat(monkeyId: CharacterId, index: number) {
    if (!useGame.getState().phase2Pieces.every(Boolean)) return false;
    if (mode !== "idle" || seats[index] || seats.some((s) => s?.monkeyId === monkeyId)) return false;
    if (requestedMode === "historical" && index !== 0) return false;
    const anchor = PHASE_TWO_STOOLS[index], p = runtime.positions[monkeyId];
    return Math.hypot(p.x - anchor.x, p.z - anchor.z) <= 1.25;
  },
  interact() {
    const id = useGame.getState().puzzle.selected,
      p = runtime.positions[id];
    const index = PHASE_TWO_STOOLS.map((s, i) => ({
      i,
      d: Math.hypot(s.x - p.x, s.z - p.z),
    })).sort((a, b) => a.d - b.d)[0].i;
    this.seat(id, index === 0 ? "w" : "b");
  },
  async choose(square: string, promote?: "q" | "r" | "b" | "n") {
    if (
      thinking ||
      mode === "idle" ||
      gameOver ||
      chess.turn() !== playerColor ||
      useGame.getState().paused
    )
      return;
    if (promotion && (!promote || square !== promotion.to)) return;
    if (!/^[a-h][1-8]$/.test(square)) return;
    const destination = square as Square;
    const target = targets.find((m) => m.to === destination);
    if (!selected || !target) {
      const piece = chess.get(destination);
      selected = piece?.color === playerColor ? destination : null;
      targets = selected
        ? chess.moves({ square: selected, verbose: true })
        : [];
      if (!piece || piece.color !== playerColor)
        message =
          "Escolha uma peça sua e uma casa destacada: esse movimento não é legal.";
      emit();
      return;
    }
    if (target.promotion && !promote) {
      promotion = { from: selected, to: destination };
      emit();
      return;
    }
    const ply = chess.history().length;
    const move = chess.move({
      from: selected,
      to: destination,
      promotion: promote,
    });
    selected = null;
    targets = [];
    promotion = null;
    if (mode === "historical" && move.san !== TAL_GULKO_SEQUENCE[ply]) {
      chess.undo();
      message = "Esse lance não continua a combinação. Tente outra jogada.";
      emit();
      return;
    }
    const token = session;
    thinking = true;
    emit();
    if (!(await play(move, token))) return;
    if (mode === "historical") {
      if (chess.history().length === TAL_GULKO_SEQUENCE.length) {
        historicalSolved = true;
        gameOver = true;
        thinking = false;
        message =
          "Combinação concluída! Portal para a Fase 3 e Partida Livre liberados. Saia da mesa para explorar.";
        try {
          localStorage.setItem("historicalChessPuzzleSolved", "true");
        } catch {
          message += " O navegador não permitiu salvar a conclusão.";
        }
        emit();
        return;
      }
      const reply = chess.move(TAL_GULKO_SEQUENCE[chess.history().length]);
      if (!(await play(reply, token))) return;
      thinking = false;
      message = "Boa! Encontre a próxima continuação das brancas.";
      emit();
    } else await opponent(token);
  },
};
