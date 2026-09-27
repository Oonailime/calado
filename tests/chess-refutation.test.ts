import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeWrongMove,
  formatUciLine,
} from "../src/features/game/world/chessRefutation";
import { parseStockfishInfo } from "../src/features/game/world/stockfishEngine";
import { createHistoricalChallenge } from "../src/features/game/world/historicalChessChallenge";

test("parses score and principal variation from Stockfish info lines", () => {
  assert.deepEqual(
    parseStockfishInfo("info depth 18 seldepth 24 multipv 1 score cp -312 nodes 1 pv g8g7 e5c7 d8c7"),
    { pv: ["g8g7", "e5c7", "d8c7"], cp: -312 },
  );
  assert.deepEqual(
    parseStockfishInfo("info depth 9 score mate 3 pv a1a2"),
    { pv: ["a1a2"], mate: 3 },
  );
  assert.equal(parseStockfishInfo("info depth 9 multipv 2 score cp 5 pv a1a2"), null);
  assert.equal(parseStockfishInfo("bestmove g8g7"), null);
});

test("numbers a Black-first line in SAN", () => {
  const chess = createHistoricalChallenge();
  const move = chess.move("Qxe7+");
  assert.equal(formatUciLine(move.after, ["d8e7", "d5e7", "f8e7"]).text, "22…Qxe7 23.Nxe7 Kxe7");
});

test("explains a wrong move with the refutation, capture and evaluation", () => {
  const chess = createHistoricalChallenge();
  const move = chess.move("Qxe7+");
  const text = describeWrongMove(move, { pv: ["d8e7", "d5e7", "f8e7"], cp: 450 });
  assert.match(text, /^22\.Qxe7\+ deixa a vantagem escapar\./);
  assert.match(text, /A resposta 22…Qxe7 captura a dama\./);
  assert.match(text, /Melhor defesa das pretas: 22…Qxe7 23\.Nxe7 Kxe7\./);
  assert.match(text, /Avaliação do Stockfish: −4,5, vantagem das pretas\./);
  assert.match(describeWrongMove(move, { pv: ["d8e7"], mate: 2 }), /as pretas dão xeque-mate em 2/);
  assert.match(describeWrongMove(move, { pv: ["d8e7"], cp: -500 }), /mantém vantagem \(\+5,0\)/);
  assert.match(describeWrongMove(move, { pv: [] }), /não continua a combinação de Tal/);
});
