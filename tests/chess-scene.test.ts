import assert from "node:assert/strict";
import { test } from "node:test";
import { Chess } from "chess.js";
import { BoxGeometry } from "three";
import { ChessScene } from "../src/features/game/world/chessScene";

test("existing mesh pool handles captures, castling, en passant, promotions and reset", async () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const scene = new ChessScene({
    pawn: geometry,
    rook: geometry,
    knight: geometry,
    bishop: geometry,
    queen: geometry,
    king: geometry,
  });
  for (const [fen, san, count] of [
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O", 6],
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O-O", 6],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6", 3],
    ["4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=N", 3],
    ["4k3/8/8/8/8/8/r7/R3K3 w Q - 0 1", "Rxa2", 3],
  ] as const) {
    const chess = new Chess(fen);
    scene.syncFromFen(fen);
    const move = chess.move(san);
    await scene.animate(move);
    scene.syncFromFen(chess.fen());
    assert.equal(scene.group.children.filter((m) => m.visible).length, count);
    for (const piece of chess.board().flat().filter(Boolean))
      assert.ok(
        scene.group.children.some(
          (m) => m.visible && m.userData.square === piece!.square,
        ),
      );
  }
  scene.syncFromFen(new Chess().fen());
  assert.equal(scene.group.children.filter((m) => m.visible).length, 32);
  assert.equal(scene.group.children.length, 32);
  const chess = new Chess();
  const pending = scene.animate(chess.move("e4"));
  scene.cancel();
  scene.syncFromFen(new Chess().fen());
  await pending;
  assert.ok(
    scene.group.children.some((m) => m.visible && m.userData.square === "e2"),
  );
  assert.ok(
    !scene.group.children.some((m) => m.visible && m.userData.square === "e4"),
  );
  scene.dispose();
  geometry.dispose();
});
