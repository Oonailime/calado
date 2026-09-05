import type { CharacterId, Vec3 } from "../types";
import { ISLAND_SURFACE_Y } from "../world/layout";
export type PuzzleState = {
  selected: CharacterId;
  powers: [boolean, boolean, boolean];
  sustained: [boolean, boolean, boolean];
  bridge: boolean;
  built: boolean;
  revision: number;
};
export const initialPuzzle = (): PuzzleState => ({
  selected: 2,
  powers: [false, false, false],
  sustained: [false, false, false],
  bridge: false,
  built: false,
  revision: 0,
});
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export const anchors = {
  bridge: { x: 0, y: ISLAND_SURFACE_Y, z: -4 },
  reveal: { x: 3, y: ISLAND_SURFACE_Y, z: -21 },
  silence: { x: -3, y: ISLAND_SURFACE_Y, z: -21 },
  bridgeBuild: { x: 0, y: ISLAND_SURFACE_Y, z: -15.5 },
  finalBuild: { x: 0, y: ISLAND_SURFACE_Y, z: -26 },
};
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
  const target =
    id === 1 ? anchors.silence : state.bridge ? anchors.reveal : anchors.bridge;
  if (distance(position, target) > 2.4 || (id === 1 && !state.bridge))
    return state;
  const powers = [...state.powers] as PuzzleState["powers"];
  powers[id] = true;
  return { ...state, powers };
}
export function construct(state: PuzzleState, position: Vec3): PuzzleState {
  if (state.selected !== 2) return state;
  if (
    !state.bridge &&
    state.powers[0] &&
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
