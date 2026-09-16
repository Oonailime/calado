import { create } from "zustand";
import type { CharacterId, Vec3 } from "../types";
import type { LocomotionState } from "../characters/monkeyMotion";
import { LOCOMOTION_TUNING } from "../characters/locomotionConfig";
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
export type Quality = "low" | "medium" | "high" | "ultra";
export type GameMap = "islands" | "phase4";

export function gameMapFromQuery(value: string | null): GameMap | undefined {
  if (value === "islands" || value === "phase4") return value;
  return undefined;
}
type Store = {
  puzzle: PuzzleState;
  paused: boolean;
  muted: boolean;
  quality: Quality;
  contrast: boolean;
  reduced: boolean;
  movementDebug: boolean;
  ambientVolume: number;
  effectsVolume: number;
  abilityKey: string;
  learned: Record<string, boolean>;
  zone: number;
  lockOpen: boolean;
  // Which world is currently mounted. The islands map is the puzzle from
  // the start of the game; phase4 is the canopy valley reached through its
  // portal. Only one world is mounted at a time.
  map: GameMap;
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
        | "movementDebug"
        | "ambientVolume"
        | "effectsVolume"
        | "abilityKey"
        | "zone"
        | "lockOpen"
        | "map"
      >
    >,
  ) => void;
};
export const useGame = create<Store>((set) => ({
  puzzle: initialPuzzle(),
  paused: false,
  muted: false,
  quality: "high",
  contrast: false,
  reduced: false,
  movementDebug: false,
  ambientVolume: 0.3,
  effectsVolume: 0.4,
  abilityKey: "KeyF",
  learned: {},
  zone: 0,
  lockOpen: false,
  map: "islands",
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

function debugVector(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

function movementDebugFrame() {
  return {
    state: "GROUND" as LocomotionState,
    physicsDt: 0,
    renderDelta: 0,
    position: debugVector(),
    velocity: debugVector(),
    gravity: debugVector(),
    radialVelocity: debugVector(),
    tangentialVelocity: debugVector(),
    swingPlaneNormal: debugVector(),
    forward: debugVector(),
    right: debugVector(),
    up: debugVector(),
    leftAnchor: debugVector(),
    rightAnchor: debugVector(),
    leftShoulder: debugVector(),
    rightShoulder: debugVector(),
    leftHand: debugVector(),
    rightHand: debugVector(),
    rigLeftShoulder: debugVector(),
    rigRightShoulder: debugVector(),
    rigBase: debugVector(),
    rigLeftHip: debugVector(),
    rigRightHip: debugVector(),
    leftKnee: debugVector(),
    rightKnee: debugVector(),
    leftFoot: debugVector(),
    rightFoot: debugVector(),
    chosenTarget: debugVector(),
    trajectory: Array.from({ length: 7 }, debugVector),
    candidates: Array.from(
      { length: LOCOMOTION_TUNING.maxDebugCandidates },
      debugVector,
    ),
    candidateCount: 0,
    handoffCount: 0,
    closestReachDistance: Number.POSITIVE_INFINITY,
    hasLeftAnchor: false,
    hasRightAnchor: false,
    hasChosenTarget: false,
    hasSwingSurface: false,
    leftConstraintError: 0,
    rightConstraintError: 0,
    leftArmLength: 0,
    rightArmLength: 0,
    leftArmMax: 0,
    rightArmMax: 0,
  };
}

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
  interact: false,
  motions: [null, null, null] as [string | null, string | null, string | null],
  movementDebug: [
    movementDebugFrame(),
    movementDebugFrame(),
    movementDebugFrame(),
  ],
  // One selected character can occupy a vine at a time. Rendering and
  // character animation both read this exact clock so their pendulums cannot
  // drift into opposite phases.
  activeVine: null as {
    siteId: string;
    monkeyId: CharacterId;
    elapsed: number;
    grip?: Vec3;
  } | null,
  vineContacts: Array.from({ length: 3 }, () => ({
    left: null as { siteId: string; grip: Vec3 } | null,
    right: null as { siteId: string; grip: Vec3 } | null,
  })),
  swingingVines: new Map<string, import("../world/swingingVine").SwingingVineState>(),
  // Set once the canvas mounts (see Game.tsx's Ready) so useControls can
  // request pointer lock on it without threading a ref through props.
  canvasElement: null as HTMLElement | null,
  splashes: [] as Vec3[],
  binarySequenceStep: null as number | null,
  binarySequenceStartedAt: 0,
  binarySequenceElapsed(step: number, now = performance.now()) {
    if (this.binarySequenceStep !== step) {
      this.binarySequenceStep = step;
      this.binarySequenceStartedAt = now;
    }
    return Math.max(0, (now - this.binarySequenceStartedAt) / 1_000);
  },
  stopBinarySequence() {
    this.binarySequenceStep = null;
    this.binarySequenceStartedAt = 0;
  },
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
    this.interact = false;
    this.poseUntil.fill(0);
    this.eatingStarted.fill(0);
    this.eatingUntil.fill(0);
    this.motions.fill(null);
    this.activeVine = null;
    this.swingingVines.clear();
    for (const contacts of this.vineContacts) {
      contacts.left = null;
      contacts.right = null;
    }
    this.stopBinarySequence();
  },
};

// TEMP-VERIFY: live inspection hook for Playwright, removed before finishing.
if (typeof window !== "undefined") (window as unknown as { __game: unknown }).__game = {
  useGame,
  get runtime() {
    return runtime;
  },
};
