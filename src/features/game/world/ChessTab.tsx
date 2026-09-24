"use client";
import { useMemo, useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import { phase2Chess } from "./phase2Chess";
import { useGame } from "../state/store";
import { CHARACTERS } from "../types";
import { PHASE_TWO_PICKUPS } from "./phaseTwoLayout";
import styles from "../ui/Game.module.css";

const PIECE_GLYPH: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

function squareIsLight(square: string) {
  const file = square.charCodeAt(0) - 97,
    rank = Number(square[1]) - 1;
  return (file + rank) % 2 !== 0;
}

/**
 * The right-side "representative" board: a flat 2D read-out of the exact
 * same phase2Chess state the 3D board (ChessBoard3D) already renders and
 * writes to. Clicking a square here calls the same phase2Chess.choose(...)
 * the 3D board's own click handling calls, so the two can never drift apart
 * — there's only ever one source of truth (phase2Chess/chess.js), this is
 * just a second, easier-to-read view onto it. Kept mounted (not a toggle)
 * for as long as a session is active, matching pointer lock staying released
 * the whole time (see runtime.chessActive in useControls.ts).
 */
const FILES = "abcdefgh";

export default function ChessTab() {
  const state = useSyncExternalStore(
    phase2Chess.subscribe,
    phase2Chess.getSnapshot,
    phase2Chess.getSnapshot,
  );
  const rows = useMemo(() => {
    const board = new Chess(state.fen).board();
    // board() only carries a `square` name on occupied cells (empty ones are
    // just `null`) — pair every cell with its square name up front, from the
    // array position itself, so empty squares stay clickable/labeled too.
    // board() rows are rank8→rank1, each row a-file→h-file (White's own
    // view); flip both axes for a Black-seated player so their own back rank
    // reads at the bottom, matching how a physical board looks from their side.
    const named = board.map((row, r) =>
      row.map((cell, c) => ({ square: `${FILES[c]}${8 - r}`, cell })),
    );
    return state.playerColor === "w"
      ? named
      : [...named].reverse().map((row) => [...row].reverse());
  }, [state.fen, state.playerColor]);
  if (!state.tabOpen) return null;
  const opponent = state.seats.find((s) => s && s.color !== state.playerColor);
  return (
    <div
      className={styles.chessTab}
      role="region"
      aria-label="Xadrez — tabuleiro representativo"
      data-chess-tab
    >
      <div className={styles.chessTabHeader}>
        <span>
          {state.requestedMode === "historical"
            ? "Desafio histórico · Tal × Gulko, 1969"
            : "Partida livre"}
        </span>
        <button onClick={() => phase2Chess.stop()} aria-label="Sair do xadrez">
          ×
        </button>
      </div>
      <div className={styles.chessTabBody}>
        {state.mode === "idle" && (
          <div className={styles.chessTabSide}>
            <p role="status">{state.message}</p>
            <p>{state.requestedMode === "historical"
              ? "E na cepa branca inicia o desafio; as pretas respondem automaticamente."
              : "Ocupe a outra cepa com um segundo macaco para começar."}</p>
            {state.seats.map((seat, i) => (
              <p key={i}>
                Cepa {i + 1} · {i === 0 ? "Brancas" : "Pretas"}:{" "}
                {seat ? CHARACTERS[seat.monkeyId].name : "vazia"}
              </p>
            ))}
          </div>
        )}
        <div className={styles.chessBoardFrame}>
          <div className={styles.chessFiles} aria-hidden="true" data-chess-files>
            {rows[0].map(({ square }) => <span key={square[0]}>{square[0].toUpperCase()}</span>)}
          </div>
          <div className={styles.chessRanks} aria-hidden="true" data-chess-ranks>
            {rows.map((row) => <span key={row[0].square[1]}>{row[0].square[1]}</span>)}
          </div>
          <div className={styles.chessUiBoard}>
          {rows.flatMap((row) =>
            row.map(({ square, cell }) => {
              const selected = state.selected === square;
              const legal = state.legalTargets.includes(square as never);
              const capture = state.captureTargets.includes(square as never);
              const classNames = [
                styles.chessSquare,
                squareIsLight(square) ? styles.chessLight : styles.chessDark,
                cell?.color === "w"
                  ? styles.chessWhitePiece
                  : styles.chessBlackPiece,
                selected ? styles.chessSelected : "",
                capture ? styles.chessCapture : legal ? styles.chessLegal : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={square}
                  type="button"
                  className={classNames}
                  disabled={
                    state.mode === "idle" ||
                    state.thinking ||
                    state.gameOver ||
                    Boolean(state.promotion)
                  }
                  onClick={() => void phase2Chess.choose(square)}
                  aria-label={square}
                  aria-pressed={selected}
                  data-square={square}
                  data-piece={cell ? `${cell.color}${cell.type}` : ""}
                  data-legal={legal}
                  data-capture={capture}
                >
                  {cell ? PIECE_GLYPH[`${cell.color}${cell.type}`] : ""}
                </button>
              );
            }),
          )}
          </div>
        </div>
        <div className={styles.chessTabSide}>
          {state.promotion ? (
            <>
              <p>Promover peão para:</p>
              {(
                [
                  ["q", "Dama"],
                  ["r", "Torre"],
                  ["b", "Bispo"],
                  ["n", "Cavalo"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() =>
                    void phase2Chess.choose(state.promotion!.to, type)
                  }
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            <>
              {state.mode !== "idle" && (
                <>
                  <p role="status" aria-live="polite">
                    {state.message}
                  </p>
                  <p>
                    Você: {state.playerColor === "w" ? "brancas" : "pretas"} ·
                    Adversário:{" "}
                    {opponent
                      ? CHARACTERS[opponent.monkeyId].name
                      : state.requestedMode === "historical" ? "Gulko · lances históricos" : "aguardando"}
                  </p>
                  {!state.gameOver && <p>Clique em sua peça e depois em uma casa destacada.</p>}
                  <button
                    disabled={state.thinking}
                    onClick={() => phase2Chess.restart()}
                  >
                    Reiniciar
                  </button>
                </>
              )}
              <button onClick={() => phase2Chess.stop()}>Sair da mesa</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


export function ChessPanel() {
  const state = useSyncExternalStore(phase2Chess.subscribe, phase2Chess.getSnapshot, phase2Chess.getSnapshot);
  const pieces = useGame(s => s.phase2Pieces);
  const count = pieces.filter(Boolean).length;
  const nextPiece = PHASE_TWO_PICKUPS.find((_, index) => !pieces[index]);
  const nextLocation = nextPiece?.id === 0 ? "no início da trilha"
    : nextPiece?.id === 1 ? "adiante no caminho"
      : "na rampa circular";
  return <>
    {!state.tabOpen && (
      <div className={styles.chessPanel} role="region" aria-label="Instruções de xadrez">
        <div className={styles.chessTitle}>Fase 2 · Xadrez</div>
        {count < 3 ? <p>Próxima peça: {nextPiece?.label} {nextLocation}. {count}/3 coletadas.</p>
          : !state.historicalSolved ? <p>Pressione E na cepa branca e resolva a combinação no tabuleiro. O portal abre após o desafio.</p>
          : <p>Você pode jogar xadrez com os outros macacos: E em uma cepa, troque com 1/2/3 e pressione E na outra.</p>}
      </div>
    )}
    <ChessTab />
  </>;
}
