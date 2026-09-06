import { create } from "zustand";
import type { CharacterId, Vec3 } from "../types";
import { characterSpawn } from "../world/layout";
import {
  collectLog,
  construct,
  eatBanana,
  initialPuzzle,
  recover,
  selectCharacter,
  startPower,
  submitCodeDigit,
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
  lockOpen: boolean;
  select: (id: CharacterId) => void;
  power: (id: CharacterId, position: Vec3) => void;
  build: (position: Vec3) => void;
  eat: (id: CharacterId, position: Vec3) => boolean;
  submitLockDigit: (position: Vec3, digit: number) => void;
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
        | "lockOpen"
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
  lockOpen: false,
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
  build: (p) =>
    set((s) => {
      const collected = collectLog(s.puzzle, p);
      if (collected !== s.puzzle) return { puzzle: collected };
      return { puzzle: construct(s.puzzle, p) };
    }),
  eat: (id, position) => {
    let ate = false;
    set((state) => {
      const puzzle = eatBanana(state.puzzle, id, position);
      ate = puzzle !== state.puzzle;
      return ate ? { puzzle } : state;
    });
    return ate;
  },
  submitLockDigit: (position, digit) =>
    set((s) => ({ puzzle: submitCodeDigit(s.puzzle, position, digit) })),
  reset: () => set((s) => ({ puzzle: recover(s.puzzle), lockOpen: false })),
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
  speeds: [0, 0, 0] as [number, number, number],
  poseUntil: [0, 0, 0] as [number, number, number],
  eatingStarted: [0, 0, 0] as [number, number, number],
  eatingUntil: [0, 0, 0] as [number, number, number],
  keys: new Set<string>(),
  yaw: 0,
  pitch: 0.38,
  jump: false,
  splashes: [] as Vec3[],
  triggerPose(id: CharacterId, duration = 1_050) {
    this.poseUntil[id] = performance.now() + duration;
  },
  triggerEating(id: CharacterId, duration = 1_600) {
    const now = performance.now();
    this.eatingStarted[id] = now;
    this.eatingUntil[id] = now + duration;
  },
  clear() {
    this.keys.clear();
    this.jump = false;
    this.poseUntil.fill(0);
    this.eatingStarted.fill(0);
    this.eatingUntil.fill(0);
  },
};
