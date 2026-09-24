import assert from "node:assert/strict";
import { test } from "node:test";
import { canopyInteractionHint, initialPuzzle } from "../src/features/game/state/rules";
import { brownPrismGuidance, canopyRouteGuidance, onBrownPrismDeck, onShrineDeck, shrineGuidance } from "../src/features/game/ui/canopyGuidance";

test("the summit shrine reports remaining prisms even before the High Canopy task", () => {
  const puzzle = initialPuzzle();
  assert.equal(onShrineDeck({ x: 0, y: 41.55, z: -68 }), true);
  assert.equal(onShrineDeck({ x: 0, y: 22.5, z: -68 }), false);
  const hint = shrineGuidance(puzzle, true);
  assert.match(hint.body, /Faltam 3 prismas/);
  assert.match(hint.body, /Iwazaru \(3\)/);
  assert.match(hint.body, /cume atrás da cachoeira/);
  assert.doesNotMatch(hint.body, /suba pela escada/);
});

test("the shrine directs the player to deliver carried prisms and open the cube", () => {
  const puzzle = initialPuzzle();
  puzzle.cubePieces[0] = true;
  assert.match(shrineGuidance(puzzle, true).body, /Mizaru \(2\).*pressione E no totem/);
  puzzle.selected = 0;
  assert.match(shrineGuidance(puzzle, true).body, /Pressione E no totem para entregar o seu/);
  puzzle.cubeDelivered = [true, true, true];
  assert.match(shrineGuidance(puzzle, false).body, /Press E at the shrine to open the cube/);
});

test("the High Canopy asks for Mizaru after Iwazaru reaches it", () => {
  const puzzle = initialPuzzle();
  const hint = canopyInteractionHint(puzzle, { x: -3, y: 16.55, z: -17 });
  assert.match(hint?.pt ?? "", /Mizaru \(2\).*pressione E/);
  assert.match(hint?.en ?? "", /Mizaru \(2\).*press E/);
  assert.doesNotMatch(hint?.pt ?? "", /branco|dourado/i);
});

test("the brown prism plateau directs pickup and then delivery", () => {
  const puzzle = initialPuzzle();
  const position = { x: 12.53, y: 31.55, z: -48.22 };
  assert.equal(onBrownPrismDeck(position), true);
  assert.equal(onBrownPrismDeck({ ...position, y: 22.5 }), false);
  assert.match(brownPrismGuidance(puzzle, true).body, /prisma marrom.*pressione E/);
  assert.match(brownPrismGuidance(puzzle, false).body, /brown prism.*press E/);
  puzzle.cubePieces[2] = true;
  assert.match(brownPrismGuidance(puzzle, true).body, /Leve o prisma marrom ao totem/);
  puzzle.selected = 0;
  assert.match(brownPrismGuidance(puzzle, true).body, /Troque para Iwazaru \(3\)/);
});

test("Mizaru carrying his prism still receives the next crossing task", () => {
  const puzzle = initialPuzzle();
  puzzle.cubePieces[0] = true;
  puzzle.selected = 0;
  assert.match(canopyRouteGuidance(puzzle, true)?.body ?? "", /Mizaru \(2\).*pressione E/);
  puzzle.canopyFocused = true;
  assert.match(canopyInteractionHint(puzzle, { x: -3, y: 16.55, z: -17 })?.pt ?? "", /Kikazaru \(1\).*\(0\/3\)/);
  assert.match(canopyRouteGuidance(puzzle, true)?.body ?? "", /Kikazaru \(1\).*cipós iluminados/);
  assert.match(canopyRouteGuidance(puzzle, false)?.body ?? "", /Kikazaru \(1\).*glowing vines/);
  puzzle.canopyVines = [true, true, true];
  assert.equal(canopyInteractionHint(puzzle, { x: -3, y: 16.55, z: -17 }), null);
  assert.match(canopyRouteGuidance(puzzle, true)?.body ?? "", /Kikazaru \(1\).*toco/);
  puzzle.canopyGoldTied = true;
  assert.match(canopyRouteGuidance(puzzle, true)?.body ?? "", /Iwazaru \(3\).*toco/);
  puzzle.canopyBridgeBuilt = true;
  assert.equal(canopyRouteGuidance(puzzle, true), null);
});
