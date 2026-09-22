import assert from "node:assert/strict";
import { test } from "node:test";
import { phase2Chess } from "../src/features/game/world/phase2Chess";
import { StockfishEngine } from "../src/features/game/world/stockfishEngine";
import { PHASE_TWO_STOOLS } from "../src/features/game/world/phaseTwoLayout";
import { runtime, useGame } from "../src/features/game/state/store";
import { CHESS_TROPHIES, CHESS_TROPHIES_STORAGE_KEY, readChessTrophies } from "../src/features/game/state/chessTrophies";
import type { CharacterId } from "../src/features/game/types";

test("each defeated monkey awards a distinct persistent item, from either side, without duplicates", async (t) => {
  const saved = new Map([["historicalChessPuzzleSolved", "true"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  } });
  t.after(() => phase2Chess.stop());
  t.mock.method(StockfishEngine.prototype, "initialize", async () => {});
  let replies: string[] = [];
  t.mock.method(StockfishEngine.prototype, "getBestMove", async () => {
    assert.ok(replies.length, "the engine must not search after checkmate");
    return replies.shift()!;
  });
  function sit(id: CharacterId, index: number) {
    const seat = PHASE_TWO_STOOLS[index];
    runtime.positions[id] = { x: seat.x + 0.7, y: 1, z: seat.z };
    useGame.getState().select(id);
    phase2Chess.seat(id, index === 0 ? "w" : "b");
  }
  async function begin(opponent: CharacterId, white: boolean) {
    phase2Chess.stop();
    phase2Chess.hydrate();
    phase2Chess.startFree();
    sit(opponent, white ? 1 : 0);
    sit(((opponent + 1) % 3) as CharacterId, white ? 0 : 1);
    await new Promise(resolve => setImmediate(resolve));
  }
  async function move(from: string, to: string) {
    await phase2Chess.choose(from);
    await phase2Chess.choose(to);
  }
  for (const trophy of CHESS_TROPHIES) {
    const white = trophy.opponent !== 1;
    replies = white ? ["e7e5", "b8c6", "g8f6"] : ["f2f3", "g2g4"];
    await begin(trophy.opponent, white);
    if (white) {
      await move("e2", "e4");
      await move("d1", "h5");
      await move("f1", "c4");
      await move("h5", "f7");
    } else {
      await move("e7", "e5");
      await move("d8", "h4");
    }
    assert.equal(phase2Chess.getSnapshot().gameOver, true);
    assert.match(phase2Chess.getSnapshot().message, /Troféu/);
    assert.ok(useGame.getState().chessTrophies.includes(trophy.id));
  }
  const expected = CHESS_TROPHIES.map(trophy => trophy.id);
  assert.deepEqual(useGame.getState().chessTrophies, expected);
  assert.deepEqual(JSON.parse(saved.get(CHESS_TROPHIES_STORAGE_KEY)!), expected);
  assert.equal(useGame.getState().awardChessTrophy(0), false);
  phase2Chess.stop();
  useGame.getState().reset();
  assert.deepEqual(useGame.getState().chessTrophies, expected);
  useGame.setState({ chessTrophies: [] });
  phase2Chess.hydrate();
  assert.deepEqual(useGame.getState().chessTrophies, expected);

  // A real loss must never produce a trophy, even when the collection is empty.
  saved.delete(CHESS_TROPHIES_STORAGE_KEY);
  useGame.setState({ chessTrophies: [] });
  replies = ["e7e5", "d8h4"];
  await begin(0, true);
  await move("f2", "f3");
  await move("g2", "g4");
  assert.match(phase2Chess.getSnapshot().message, /adversário venceu/);
  assert.deepEqual(useGame.getState().chessTrophies, []);
  replies = ["g8f6", "f6g8", "g8f6", "f6g8"];
  await begin(0, true);
  for (let i = 0; i < 2; i++) {
    await move("g1", "f3");
    await move("f3", "g1");
  }
  assert.match(phase2Chess.getSnapshot().message, /Empate/);
  assert.deepEqual(useGame.getState().chessTrophies, []);
  phase2Chess.stop();
  phase2Chess.startHistorical();
  sit(0, 0);
  for (const [from, to] of [["g1", "g7"], ["g7", "f7"], ["f7", "e7"], ["d1", "f1"], ["f1", "f7"]]) await move(from, to);
  assert.equal(phase2Chess.getSnapshot().gameOver, true);
  assert.deepEqual(useGame.getState().chessTrophies, []);
});

test("saved trophies reject malformed data and unknown items and tolerate blocked storage", () => {
  let value = "invalid";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => value,
    setItem: () => { throw new Error("Storage blocked"); },
  } });
  assert.deepEqual(readChessTrophies(), []);
  value = '{"chess-mizaru":true}';
  assert.deepEqual(readChessTrophies(), []);
  value = '["chess-mizaru","cheat","chess-mizaru"]';
  assert.deepEqual(readChessTrophies(), ["chess-mizaru"]);
  useGame.setState({ chessTrophies: [] });
  assert.equal(useGame.getState().awardChessTrophy(2), true);
  assert.ok(useGame.getState().chessTrophies.includes("chess-iwazaru"));
});
