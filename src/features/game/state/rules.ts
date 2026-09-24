import type { CharacterId, Vec3 } from "../types";
import { ISLAND_SURFACE_Y } from "../world/layout";
import { PHASE_FOUR_CUBE_PIECE_SPAWNS, PHASE_FOUR_PLATFORMS } from "../world/phaseFourLayout";
import { solvedLayerCount, type CubieState } from "../world/rubiksCubeState";
import { CANOPY_FOCUS_DECK, CANOPY_HARVESTS, CANOPY_STUMPS } from "../world/canopyCooperationLayout";
export type PuzzleState = {
  selected: CharacterId;
  powers: [boolean, boolean, boolean];
  sustained: [boolean, boolean, boolean];
  logs: [boolean, boolean, boolean];
  bananas: [boolean, boolean, boolean, boolean];
  bridge: boolean;
  codeProgress: number;
  unlocked: boolean;
  built: boolean;
  revision: number;
  // Counts wrong padlock guesses so the UI can flash feedback once per miss
  // (see Lock.tsx) — never decremented, only ever compared for a change.
  wrongAttempts: number;
  // Phase 3's shrine puzzle. Indexed like CHARACTERS: 0 white (Mizaru), 1
  // yellow (Kikazaru), 2 brown (Iwazaru) — see PHASE_FOUR_CUBE_PIECE_SPAWNS.
  cubePieces: [boolean, boolean, boolean];
  cubeDelivered: [boolean, boolean, boolean];
  canopyFocused: boolean;
  canopyVines: [boolean, boolean, boolean];
  canopyGoldTied: boolean;
  canopyBridgeBuilt: boolean;
  cubeTurning: boolean;
  cubeLayersSolved: number;
  cubeSolved: boolean;
  // Permanent, one-way payoffs for crossing the vine bridge they cooperated
  // to build (see runtime.mizaruVineSight/kikazaruVineHearing in store.ts for
  // the live in-progress animation) — once true, stays true for the rest of
  // the session, regardless of later resets or which vine they're on.
  mizaruSightRestored: boolean;
  kikazaruHearingRestored: boolean;
};
export const initialPuzzle = (): PuzzleState => ({
  selected: 2,
  powers: [false, false, false],
  sustained: [false, false, false],
  logs: [false, false, false],
  bananas: [false, false, false, false],
  bridge: false,
  codeProgress: 0,
  unlocked: false,
  built: false,
  revision: 0,
  wrongAttempts: 0,
  cubePieces: [false, false, false],
  cubeDelivered: [false, false, false],
  canopyFocused: false,
  canopyVines: [false, false, false],
  canopyGoldTied: false,
  canopyBridgeBuilt: false,
  cubeTurning: false,
  cubeLayersSolved: 0,
  cubeSolved: false,
  mizaruSightRestored: false,
  kikazaruHearingRestored: false,
});
export function restoreMizaruSight(state: PuzzleState): PuzzleState {
  return state.mizaruSightRestored ? state : { ...state, mizaruSightRestored: true };
}
export function restoreKikazaruHearing(state: PuzzleState): PuzzleState {
  return state.kikazaruHearingRestored ? state : { ...state, kikazaruHearingRestored: true };
}
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export const anchors = {
  bridge: { x: 0, y: ISLAND_SURFACE_Y, z: -2 },
  reveal: { x: 3, y: ISLAND_SURFACE_Y, z: -23 },
  silence: { x: -3, y: ISLAND_SURFACE_Y, z: -23 },
  // First totem: on the first island, to the right of the bridge approach.
  bridgeBuild: { x: 3.4, y: ISLAND_SURFACE_Y, z: -1.7 },
  padlock: { x: 0, y: ISLAND_SURFACE_Y, z: -23.8 },
  finalBuild: { x: 0, y: ISLAND_SURFACE_Y, z: -28 },
  logs: [
    { x: -2.4, y: ISLAND_SURFACE_Y, z: -0.2 },
    { x: 2.4, y: ISLAND_SURFACE_Y, z: -0.2 },
    { x: 0, y: ISLAND_SURFACE_Y, z: -3.6 },
  ],
  bananas: [
    { x: -5.4, y: ISLAND_SURFACE_Y, z: 7.8 },
    { x: 5.8, y: ISLAND_SURFACE_Y, z: 10.2 },
    { x: -5.8, y: ISLAND_SURFACE_Y, z: -27.2 },
    { x: 6.1, y: ISLAND_SURFACE_Y, z: -30.2 },
  ],
};
const LOG_RANGE = 2.4;
const BANANA_RANGE = 2;
// Iwazaru reads this on the totem's padlock as four sound pulses per digit;
// only Mizaru can perceive them (see World.tsx's SoundWaves).
export const LOCK_CODE = [1, 9, 9, 8] as const;
export const LOCK_RANGE = 2.3;
export function selectCharacter(
  state: PuzzleState,
  id: CharacterId,
): PuzzleState {
  if (id === state.selected) return state;
  const sustained = [...state.sustained] as PuzzleState["sustained"];
  if (state.powers[state.selected]) sustained[state.selected] = true;
  return { ...state, selected: id, sustained };
}
export function startPower(
  state: PuzzleState,
  id: CharacterId,
  position: Vec3,
): PuzzleState {
  if (id === 2 || state.built) return state;
  if (state.powers[id]) {
    const powers = [...state.powers] as PuzzleState["powers"];
    const sustained = [...state.sustained] as PuzzleState["sustained"];
    powers[id] = false;
    sustained[id] = false;
    return { ...state, powers, sustained };
  }
  const target = !state.bridge
    ? anchors.bridge
    : id === 0
      ? anchors.reveal
      : anchors.silence;
  // Kikazaru reveals the bridge timber on the first island. Mizaru's power
  // only becomes available at his silver symbol after the bridge is built.
  if (distance(position, target) > 2.4 || (!state.bridge && id !== 1))
    return state;
  const powers = [...state.powers] as PuzzleState["powers"];
  powers[id] = true;
  return { ...state, powers };
}
// Iwazaru only gathers wood while Kikazaru keeps the palms marked,
// and before the bridge exists — collecting is the precondition to build it.
export function collectLog(state: PuzzleState, position: Vec3): PuzzleState {
  if (state.selected !== 2 || state.bridge || !state.powers[1]) return state;
  const index = anchors.logs.findIndex(
    (anchor, i) => !state.logs[i] && distance(position, anchor) < LOG_RANGE,
  );
  if (index === -1) return state;
  const logs = [...state.logs] as PuzzleState["logs"];
  logs[index] = true;
  return { ...state, logs };
}

export function eatBanana(
  state: PuzzleState,
  id: CharacterId,
  position: Vec3,
): PuzzleState {
  if (state.selected !== id) return state;
  const index = anchors.bananas.findIndex(
    (anchor, banana) =>
      !state.bananas[banana] && distance(position, anchor) < BANANA_RANGE,
  );
  if (index === -1) return state;
  const bananas = [...state.bananas] as PuzzleState["bananas"];
  bananas[index] = true;
  return { ...state, bananas };
}
// Iwazaru enters one digit at a time. A correct digit advances the broadcast;
// a wrong digit leaves the current step unchanged so it can be tried again.
export function submitCodeDigit(
  state: PuzzleState,
  position: Vec3,
  digit: number,
): PuzzleState {
  if (state.selected !== 2 || state.unlocked) return state;
  if (distance(position, anchors.padlock) > LOCK_RANGE) return state;
  if (digit !== LOCK_CODE[state.codeProgress])
    return { ...state, wrongAttempts: state.wrongAttempts + 1 };

  const codeProgress = state.codeProgress + 1;
  return {
    ...state,
    codeProgress,
    unlocked: codeProgress === LOCK_CODE.length,
  };
}
export function construct(state: PuzzleState, position: Vec3): PuzzleState {
  if (state.selected !== 2) return state;
  if (
    !state.bridge &&
    state.powers[1] &&
    state.logs.every(Boolean) &&
    distance(position, anchors.bridgeBuild) < 2.3
  ) {
    return {
      ...state,
      bridge: true,
      powers: [false, false, false],
      sustained: [false, false, false],
    };
  }
  if (
    state.bridge &&
    state.powers[0] &&
    state.powers[1] &&
    state.unlocked &&
    distance(position, anchors.finalBuild) < 2.3
  ) {
    return {
      ...state,
      built: true,
      powers: [false, false, false],
      sustained: [false, false, false],
    };
  }
  return state;
}
export function recover(state: PuzzleState): PuzzleState {
  return {
    ...state,
    powers: [false, false, false],
    sustained: [false, false, false],
    revision: state.revision + 1,
  };
}
const CUBE_PIECE_RANGE = 2;
// Mirrors collectLog/eatBanana: only the matching character, within range of
// their own plateau, can pick up their cube piece.
export function collectCubePiece(
  state: PuzzleState,
  id: CharacterId,
  position: Vec3,
): PuzzleState {
  if (state.selected !== id || state.cubePieces[id]) return state;
  const [x, y, z] = PHASE_FOUR_CUBE_PIECE_SPAWNS[id];
  if (Math.hypot(position.x - x, position.y - y, position.z - z) > CUBE_PIECE_RANGE) return state;
  const cubePieces = [...state.cubePieces] as PuzzleState["cubePieces"];
  cubePieces[id] = true;
  return { ...state, cubePieces };
}
export function beginCubeTurn(state: PuzzleState): PuzzleState {
  if (state.cubeTurning || state.cubeSolved) return state;
  return { ...state, cubeTurning: true };
}
export function finishCubeTurn(
  state: PuzzleState,
  cubies: readonly CubieState[],
): PuzzleState {
  const cubeLayersSolved = solvedLayerCount(cubies);
  return {
    ...state,
    cubeTurning: false,
    cubeLayersSolved,
    cubeSolved: cubeLayersSolved === 3,
  };
}
const CUBE_SHRINE_RANGE = 2.6;
const cubeShrineCenter = PHASE_FOUR_PLATFORMS.find(
  (deck) => deck.id === "summit-shrine",
)!.center;
export function nearCubeShrine(position: Vec3): boolean {
  const [x, y, z] = cubeShrineCenter;
  return distance(position, { x, y, z }) < CUBE_SHRINE_RANGE && Math.abs(position.y - y) < 2;
}

function nearCanopyPoint(position: Vec3, point: readonly number[], range = 2.4) {
  return Math.hypot(position.x - point[0], position.z - point[2]) < range &&
    Math.abs(position.y - point[1]) < 2;
}

export function onCanopyFocusDeck(position: Vec3) {
  const deck = CANOPY_FOCUS_DECK;
  return Math.abs(position.x - deck.center[0]) <= deck.width / 2 &&
    Math.abs(position.z - deck.center[2]) <= deck.depth / 2 &&
    Math.abs(position.y - (deck.center[1] + 0.55)) < 1.5;
}

export type CanopyInteractionHint = { id: string; ready: boolean; pt: string; en: string };

/** The same ranges as the gameplay actions, with a reason when an action is locked. */
export function canopyInteractionHint(state: PuzzleState, position: Vec3): CanopyInteractionHint | null {
  const count = state.canopyVines.filter(Boolean).length;
  const hint = (id: string, ready: boolean, pt: string, en: string) => ({ id, ready, pt, en });
  const prerequisite = (id: string) => !state.canopyFocused
    ? hint(id, false, "Primeiro, concentre Mizaru (2) na Copa alta.", "First, focus Mizaru (2) on the High Canopy deck.")
    : count < 3 ? hint(id, false, `Faltam ${3 - count} cipós: colha os cipós iluminados com Kikazaru (1).`, `${3 - count} vines needed: harvest the glowing vines with Kikazaru (1).`) : null;
  if (nearCanopyPoint(position, CANOPY_STUMPS.lower)) {
    if (state.canopyBridgeBuilt) return hint("bridge-lower", true, "E · Caminhar pelo cipó até o platô superior", "E · Walk the vine to the upper plateau");
    const required = prerequisite("stump-lower");
    if (required) return required;
    return state.selected === 1
      ? hint("stump-lower", true, "E · Amarrar o cipó neste toco", "E · Tie the vine to this stump")
      : hint("stump-lower", false, "Troque para Kikazaru (1) para amarrar o cipó.", "Switch to Kikazaru (1) to tie the vine.");
  }
  if (nearCanopyPoint(position, CANOPY_STUMPS.upper)) {
    if (state.canopyBridgeBuilt) return hint("bridge-upper", true, "E · Caminhar pelo cipó até o platô inferior", "E · Walk the vine to the lower plateau");
    const required = prerequisite("stump-upper");
    if (required) return required;
    if (!state.canopyGoldTied) return hint("stump-upper", false, "Kikazaru (1) precisa amarrar a ponta no toco de baixo primeiro.", "Kikazaru (1) must tie the end at the lower stump first.");
    return state.selected === 2
      ? hint("stump-upper", true, "E · Construir a ponte de cipó", "E · Build the vine bridge")
      : hint("stump-upper", false, "Troque para Iwazaru (3) para construir a ponte.", "Switch to Iwazaru (3) to build the bridge.");
  }
  if (onCanopyFocusDeck(position) && !state.canopyFocused) return state.selected === 0
    ? hint("focus", true, "E · Concentrar e revelar os cipós das árvores", "E · Focus to reveal the tree vines")
    : hint("focus", false, "Troque para Mizaru (2) e pressione E neste platô.", "Switch to Mizaru (2) and press E on this deck.");
  const harvest = CANOPY_HARVESTS.findIndex((site, i) => !state.canopyVines[i] && nearCanopyPoint(position, site.position));
  if (harvest >= 0) {
    if (!state.canopyFocused) return hint(`harvest-${harvest}`, false, "Cipó oculto: concentre Mizaru (2) na Copa alta.", "Hidden vine: focus Mizaru (2) on the High Canopy deck.");
    return state.selected === 1
      ? hint(`harvest-${harvest}`, true, `E · Colher cipó (${count}/3)`, `E · Harvest vine (${count}/3)`)
      : hint(`harvest-${harvest}`, false, "Troque para Kikazaru (1) para colher este cipó.", "Switch to Kikazaru (1) to harvest this vine.");
  }
  if (onCanopyFocusDeck(position) && state.selected === 0 && count < 3) return hint("focused", false,
    `Troque para Kikazaru (1) e colha os cipós restantes (${count}/3).`,
    `Switch to Kikazaru (1) and harvest the remaining vines (${count}/3).`);
  return null;
}

export function interactCanopy(state: PuzzleState, position: Vec3): PuzzleState {
  const id = state.selected;
  if (state.cubePieces[id] && !state.cubeDelivered[id] && nearCubeShrine(position)) {
    const cubeDelivered = [...state.cubeDelivered] as PuzzleState["cubeDelivered"];
    cubeDelivered[id] = true;
    return { ...state, cubeDelivered };
  }
  if (id === 0 && !state.canopyFocused && onCanopyFocusDeck(position))
    return { ...state, canopyFocused: true };
  if (!state.canopyFocused) return state;
  if (id === 1 && !state.canopyBridgeBuilt) {
    const index = CANOPY_HARVESTS.findIndex((site, i) => !state.canopyVines[i] && nearCanopyPoint(position, site.position));
    if (index >= 0) {
      const canopyVines = [...state.canopyVines] as PuzzleState["canopyVines"];
      canopyVines[index] = true;
      return { ...state, canopyVines };
    }
  }
  if (!state.canopyVines.every(Boolean)) return state;
  if (id === 1 && !state.canopyGoldTied && nearCanopyPoint(position, CANOPY_STUMPS.lower))
    return { ...state, canopyGoldTied: true };
  if (id === 2 && state.canopyGoldTied && !state.canopyBridgeBuilt && nearCanopyPoint(position, CANOPY_STUMPS.upper))
    return { ...state, canopyBridgeBuilt: true };
  return state;
}
