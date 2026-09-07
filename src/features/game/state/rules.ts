import type { CharacterId, Vec3 } from "../types";
import { ISLAND_SURFACE_Y } from "../world/layout";
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
});
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
