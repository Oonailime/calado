import type { PuzzleState } from "../state/rules";
import { CHARACTERS, CHARACTER_KEY_BINDINGS, type CharacterId, type Vec3 } from "../types";
import { PHASE_FOUR_PLATFORMS } from "../world/phaseFourLayout";

const SHRINE_DECK = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "summit-shrine")!;
const BROWN_PRISM_DECK = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "waterfall-summit")!;
const MONKEY_IDS = [0, 1, 2] as const;
const PRISMS = {
  0: { pt: "branco na Copa alta", en: "white prism on the High Canopy deck" },
  1: { pt: "dourado no mirante da cachoeira", en: "gold prism at the waterfall lookout" },
  2: { pt: "marrom no cume atrás da cachoeira", en: "brown prism on the summit behind the waterfall" },
} as const;

function onDeck(position: Vec3, deck: typeof SHRINE_DECK | typeof BROWN_PRISM_DECK) {
  return Math.abs(position.x - deck.center[0]) <= deck.width / 2 + 0.5 &&
    Math.abs(position.z - deck.center[2]) <= deck.depth / 2 + 0.5 &&
    Math.abs(position.y - (deck.center[1] + 0.55)) < 2.5;
}

export function onShrineDeck(position: Vec3) {
  return onDeck(position, SHRINE_DECK);
}

export function onBrownPrismDeck(position: Vec3) {
  return onDeck(position, BROWN_PRISM_DECK);
}

export function brownPrismGuidance(puzzle: PuzzleState, pt: boolean) {
  if (puzzle.cubePieces[2]) return pt
    ? { title: "Prisma marrom", body: puzzle.selected === 2
      ? "Leve o prisma marrom ao totem e pressione E para entregá-lo."
      : "Troque para Iwazaru (3) e leve o prisma marrom ao totem." }
    : { title: "Brown prism", body: puzzle.selected === 2
      ? "Take the brown prism to the shrine and press E to deliver it."
      : "Switch to Iwazaru (3) and take the brown prism to the shrine." };
  return pt
    ? { title: "Prisma marrom", body: puzzle.selected === 2
      ? "Aproxime-se do prisma marrom e pressione E para pegá-lo."
      : "Troque para Iwazaru (3), aproxime-se do prisma marrom e pressione E." }
    : { title: "Brown prism", body: puzzle.selected === 2
      ? "Approach the brown prism and press E to collect it."
      : "Switch to Iwazaru (3), approach the brown prism, and press E." };
}

export function canopyRouteGuidance(puzzle: PuzzleState, pt: boolean) {
  if (!puzzle.canopyFocused) {
    const reachedCanopy = puzzle.cubePieces[0] || puzzle.cubePieces[2];
    return reachedCanopy
      ? pt
        ? { title: "Revele os cipós", body: "Troque para Mizaru (2), vá à Copa alta e pressione E para se concentrar." }
        : { title: "Reveal the vines", body: "Switch to Mizaru (2), go to the High Canopy deck, and press E to focus." }
      : pt
        ? { title: "Primeiro cipó", body: "Com Iwazaru (3), suba pelo cipó da clareira até o platô alto e balance até a Copa alta." }
        : { title: "First vine", body: "With Iwazaru (3), climb the vine from the clearing to the high plateau, then swing to the High Canopy." };
  }
  const collected = puzzle.canopyVines.filter(Boolean).length;
  if (collected < 3) return pt
    ? { title: "Cipós revelados", body: `Com Kikazaru (1), pressione E nos cipós iluminados (${collected}/3).` }
    : { title: "Vines revealed", body: `With Kikazaru (1), press E at the glowing vines (${collected}/3).` };
  if (!puzzle.canopyGoldTied) return pt
    ? { title: "Amarrar o cipó", body: "Com Kikazaru (1), pressione E no toco junto à cachoeira." }
    : { title: "Tie the vine", body: "With Kikazaru (1), press E at the stump by the waterfall." };
  if (!puzzle.canopyBridgeBuilt) return pt
    ? { title: "Construir a ponte", body: "Com Iwazaru (3), pressione E no toco acima da cachoeira." }
    : { title: "Build the bridge", body: "With Iwazaru (3), press E at the stump above the waterfall." };
  return null;
}

export function shrineGuidance(puzzle: PuzzleState, pt: boolean) {
  const missing = MONKEY_IDS.filter(id => !puzzle.cubeDelivered[id]);
  if (missing.length === 0) return pt
    ? { title: "Cubo mágico", body: "Os três prismas foram entregues. Pressione E no totem para abrir o cubo." }
    : { title: "Magic cube", body: "All three prisms are delivered. Press E at the shrine to open the cube." };

  const carrying = missing.find(id => puzzle.cubePieces[id]);
  const next: CharacterId = puzzle.cubePieces[puzzle.selected] && !puzzle.cubeDelivered[puzzle.selected]
    ? puzzle.selected
    : carrying ?? (missing.includes(puzzle.selected) ? puzzle.selected : missing[0]);
  const monkey = CHARACTERS[next].name;
  const key = CHARACTER_KEY_BINDINGS.find(binding => binding.id === next)!.digit;
  const count = pt ? `Faltam ${missing.length} ${missing.length === 1 ? "prisma" : "prismas"}. `
    : `${missing.length} ${missing.length === 1 ? "prism" : "prisms"} left. `;
  if (puzzle.cubePieces[next]) {
    const action = next === puzzle.selected
      ? pt ? "Pressione E no totem para entregar o seu." : "Press E at the shrine to deliver yours."
      : pt ? `Troque para ${monkey} (${key}) e pressione E no totem.`
        : `Switch to ${monkey} (${key}) and press E at the shrine.`;
    return { title: pt ? "Entregue os prismas" : "Deliver the prisms", body: count + action };
  }
  return {
    title: pt ? "Busque os prismas" : "Collect the prisms",
    body: count + (pt
      ? `Com ${monkey} (${key}), busque o prisma ${PRISMS[next].pt}.`
      : `With ${monkey} (${key}), collect the ${PRISMS[next].en}.`),
  };
}
