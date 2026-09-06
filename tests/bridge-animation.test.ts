import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRIDGE_PIECE_COUNT,
  bridgePieceProgress,
  bridgePieceTransform,
} from "../src/features/game/world/bridgeAnimation";

test("as madeiras chegam em sequência e terminam exatamente na ponte", () => {
  assert.equal(bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0), 0);
  assert.equal(bridgePieceProgress(6, BRIDGE_PIECE_COUNT, 0.03), 0);
  assert.ok(
    bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.3) >
      bridgePieceProgress(6, BRIDGE_PIECE_COUNT, 0.3),
  );
  assert.ok(
    bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.25) >
      1 - bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.75),
    "a maior parte do percurso deve acontecer antes da aproximação final",
  );
  assert.ok(
    bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.12) -
      bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.02) >
      bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.4) -
        bridgePieceProgress(0, BRIDGE_PIECE_COUNT, 0.3),
  );

  for (let index = 0; index < BRIDGE_PIECE_COUNT; index += 1) {
    const start = bridgePieceTransform(index, BRIDGE_PIECE_COUNT, 0);
    const end = bridgePieceTransform(index, BRIDGE_PIECE_COUNT, 1);
    assert.ok(Math.hypot(...start.position) > 7);
    assert.deepEqual(end.position, [0, 0, 0]);
    assert.deepEqual(end.rotation, [0, 0, 0]);
  }
});
