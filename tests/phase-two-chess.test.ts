import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHistoricalChallenge,
  TAL_GULKO_FEN,
  TAL_GULKO_SEQUENCE,
  validateHistoricalSequence,
} from "../src/features/game/world/historicalChessChallenge";
import {
  squareToWorldPosition,
  worldToSquare,
} from "../src/features/game/world/chessCoordinates";
import { Chess } from "chess.js";
import { phase2Chess } from "../src/features/game/world/phase2Chess";
import { runtime, useGame } from "../src/features/game/state/store";
import { PHASE_TWO_STOOLS } from "../src/features/game/world/phaseTwoLayout";

test("Tal-Gulko challenge loads the supplied reference-image position", () => {
  const chess = createHistoricalChallenge();
  assert.equal(chess.fen(), TAL_GULKO_FEN);
  assert.equal(chess.get("e5")?.type, "q");
  assert.equal(chess.get("d5")?.type, "n");
  assert.equal(chess.get("f8")?.type, "k");
});

test("the supplied FEN is exactly the position after 21...Kf8", () => {
  const chess = new Chess();
  chess.loadPgn(
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6 6. f4 Nc6 7. Be3 Be7 8. Qf3 a6 9. O-O-O Qc7 10. g4 Nxd4 11. Bxd4 e5 12. fxe5 dxe5 13. Qg3 Nxg4 14. Be2 Qa5 15. Bxg4 exd4 16. Nd5 Qxa2 17. Qe5 Qa1+ 18. Kd2 Qa5+ 19. b4 Qd8 20. Rhg1 f6 21. Bh5 Kf8",
  );
  assert.equal(chess.fen(), TAL_GULKO_FEN);
  assert.ok(chess.moves().includes("Rxg7"));
});

test("every historical move is legal, ending in resignation rather than mate", () => {
  const chess = validateHistoricalSequence();
  assert.deepEqual(chess.history(), TAL_GULKO_SEQUENCE);
  assert.equal(chess.turn(), "b");
  assert.equal(chess.isCheckmate(), false);
});

function sit(id: 0 | 1 | 2, index: number) {
  const seat = PHASE_TWO_STOOLS[index];
  runtime.positions[id] = { x: seat.x + 0.7, y: 1, z: seat.z };
  useGame.getState().select(id);
  phase2Chess.seat(id, index === 0 ? "w" : "b");
}
test("puzzle retries preserve ply, restart, persistence, unlocks and character restoration", async () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k),
      setItem: (k: string, v: string) => memory.set(k, v),
    },
  });
  phase2Chess.stop();
  phase2Chess.hydrate();
  useGame.setState({ phase2Pieces: [true, true, true] });
  phase2Chess.startHistorical();
  assert.equal(phase2Chess.getSnapshot().tabOpen, true);
  assert.equal(phase2Chess.getSnapshot().mode, "idle");
  phase2Chess.startFree();
  assert.equal(phase2Chess.getSnapshot().requestedMode, "historical");
  sit(1, 1);
  assert.equal(phase2Chess.getSnapshot().seats[1], null);
  assert.equal(phase2Chess.getSnapshot().mode, "idle");
  sit(0, 0);
  assert.equal(runtime.chessActive, true);
  await phase2Chess.choose("g1");
  await phase2Chess.choose("g7");
  const afterFirst = phase2Chess.getSnapshot().fen;
  await phase2Chess.choose("g7");
  await phase2Chess.choose("g8");
  assert.equal(phase2Chess.getSnapshot().fen, afterFirst);
  await phase2Chess.choose("g7");
  await phase2Chess.choose("f7");
  assert.equal(new Chess(phase2Chess.getSnapshot().fen).get("e8")?.type, "k");
  phase2Chess.restart();
  assert.equal(phase2Chess.getSnapshot().fen, TAL_GULKO_FEN);
  for (const [from, to] of [
    ["g1", "g7"],
    ["g7", "f7"],
    ["f7", "e7"],
    ["d1", "f1"],
    ["f1", "f7"],
  ]) {
    await phase2Chess.choose(from);
    await phase2Chess.choose(to);
  }
  assert.equal(phase2Chess.getSnapshot().historicalSolved, true);
  assert.equal(phase2Chess.getSnapshot().gameOver, true);
  assert.equal(memory.get("historicalChessPuzzleSolved"), "true");
  assert.notEqual(useGame.getState().map, "phase3");
  phase2Chess.stop();
  phase2Chess.hydrate();
  assert.equal(phase2Chess.getSnapshot().historicalSolved, true);
  assert.equal(runtime.chessActive, false);
  assert.deepEqual(runtime.phase2Seats, [null, null]);
  assert.ok(runtime.phase2Restore[0]);
  assert.equal(runtime.phase2Restore[1], null);
  phase2Chess.startFree();
  assert.equal(phase2Chess.getSnapshot().requestedMode, "free");
  useGame.setState({ phase2Pieces: [true, true, true] });
  phase2Chess.startHistorical();
  sit(2, 1);
  sit(0, 0);
  assert.equal(phase2Chess.getSnapshot().fen, TAL_GULKO_FEN);
  phase2Chess.stop();
});

test("phase 2 chess coordinates round-trip every board square", () => {
  for (const file of "abcdefgh")
    for (let rank = 1; rank <= 8; rank++) {
      const square = `${file}${rank}`;
      const p = squareToWorldPosition(square);
      assert.equal(worldToSquare(p.x, p.z), square);
    }
});


test("seat hints only allow a nearby unseated player and an available side", () => {
  phase2Chess.stop();
  useGame.setState({ phase2Pieces: [true, true, true] });
  phase2Chess.startHistorical();
  runtime.positions[0] = { x: 20, y: 1, z: 20 };
  assert.equal(phase2Chess.canSeat(0, 0), false);
  const anchor = PHASE_TWO_STOOLS[0];
  runtime.positions[0] = { x: anchor.x + 0.7, y: 1, z: anchor.z };
  assert.equal(phase2Chess.canSeat(0, 0), true);
  assert.equal(phase2Chess.canSeat(0, 1), false);
  useGame.getState().select(0);
  phase2Chess.interact();
  assert.equal(phase2Chess.getSnapshot().mode, "historical");
  assert.deepEqual(runtime.phase2Seats, [0, null]);
  assert.equal(phase2Chess.canSeat(0, 0), false);
  assert.equal(phase2Chess.canSeat(1, 1), false);
  phase2Chess.stop();
});

test("the tab publishes the move before the 3D animation finishes; exit cancels the reply", async () => {
  phase2Chess.stop();
  useGame.setState({ phase2Pieces: [true, true, true] });
  phase2Chess.startHistorical();
  sit(0, 0);
  let finish!: () => void;
  const unregister = phase2Chess.registerAnimator(() => new Promise<void>((resolve) => { finish = resolve; }));
  await phase2Chess.choose("g1");
  const pending = phase2Chess.choose("g7");
  assert.equal(new Chess(phase2Chess.getSnapshot().fen).get("g7")?.type, "r");
  assert.equal(phase2Chess.getSnapshot().thinking, true);
  phase2Chess.stop();
  finish();
  await pending;
  assert.equal(phase2Chess.getSnapshot().fen, TAL_GULKO_FEN);
  assert.equal(phase2Chess.getSnapshot().mode, "idle");
  unregister();
});
