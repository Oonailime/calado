import { create } from "zustand";
import type { CharacterId, Vec3 } from "../types";
import { characterSpawn } from "../world/layout";
import {
  construct,
  initialPuzzle,
  recover,
  selectCharacter,
  startPower,
  type PuzzleState,
} from "./rules";
export type Quality = "low" | "medium" | "high";
type Store = {
  puzzle: PuzzleState;
  paused: boolean;
  muted: boolean;
  quality: Quality;
  contrast: boolean;
  reduced: boolean;
  ambientVolume: number;
  effectsVolume: number;
  abilityKey: string;
  learned: Record<string, boolean>;
  zone: number;
  select: (id: CharacterId) => void;
  power: (id: CharacterId, position: Vec3) => void;
  build: (position: Vec3) => void;
  reset: () => void;
  learn: (key: string) => void;
  configure: (
    patch: Partial<
      Pick<
        Store,
        | "paused"
        | "muted"
        | "quality"
        | "contrast"
        | "reduced"
        | "ambientVolume"
        | "effectsVolume"
        | "abilityKey"
        | "zone"
      >
    >,
  ) => void;
};
export const useGame = create<Store>((set) => ({
  puzzle: initialPuzzle(),
  paused: false,
  muted: true,
  quality: "medium",
  contrast: false,
  reduced: false,
  ambientVolume: 0.3,
  effectsVolume: 0.4,
  abilityKey: "KeyF",
  learned: {},
  zone: 0,
  select: (id) =>
    set((s) => ({
      puzzle: selectCharacter(s.puzzle, id),
      learned: {
        ...s.learned,
        switch: true,
        hold: s.learned.hold || s.puzzle.powers[s.puzzle.selected],
      },
    })),
  power: (id, p) => set((s) => ({ puzzle: startPower(s.puzzle, id, p) })),
  build: (p) => set((s) => ({ puzzle: construct(s.puzzle, p) })),
  reset: () => set((s) => ({ puzzle: recover(s.puzzle) })),
  learn: (key) =>
    set((s) =>
      s.learned[key] ? s : { learned: { ...s.learned, [key]: true } },
    ),
  configure: (patch) => set(patch),
}));

// Positions/frame data intentionally live outside React's render state.
export const runtime = {
  positions: [
    characterSpawn(0),
    characterSpawn(1),
    characterSpawn(2),
  ] as Vec3[],
  grounded: [true, true, true] as [boolean, boolean, boolean],
  keys: new Set<string>(),
  yaw: 0,
  pitch: 0.38,
  jump: false,
  splashes: [] as Vec3[],
  clear() {
    this.keys.clear();
    this.jump = false;
  },
};
