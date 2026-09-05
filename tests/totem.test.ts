import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "../src/features/game/types";
import {
  TOTEM_BOOK_COLORS,
  WISE_MONKEY_GESTURES,
} from "../src/features/game/world/Totem";

test("totem representa os três macacos sábios e seus livros coloridos", () => {
  assert.deepEqual(WISE_MONKEY_GESTURES, ["eyes", "ears", "mouth"]);
  assert.deepEqual(
    TOTEM_BOOK_COLORS,
    CHARACTERS.map((character) => character.color),
  );
});
