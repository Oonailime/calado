import assert from "node:assert/strict";
import { test } from "node:test";
import { ATMOSPHERE } from "../src/features/game/world/World";

test("céu e névoa são claros e o evento envolve toda a cena", () => {
  assert.match(ATMOSPHERE.sky, /^#[89a-f]/i);
  assert.ok(ATMOSPHERE.defaultNear > 20);
  assert.ok(ATMOSPHERE.denseNear <= 2);
  assert.ok(ATMOSPHERE.denseFar < ATMOSPHERE.defaultFar / 2);
});
