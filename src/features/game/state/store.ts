import { create } from "zustand";
import { CHESS_TROPHIES, CHESS_TROPHIES_STORAGE_KEY, readChessTrophies, type ChessTrophyId } from "./chessTrophies";
import { BANANA_TROPHY_STORAGE_KEY, readBananaTrophy } from "./trophies";
import type { CharacterId, Vec3 } from "../types";
import type { LocomotionState } from "../characters/monkeyMotion";
import { LOCOMOTION_TUNING } from "../characters/locomotionConfig";
import { characterSpawn } from "../world/layout";
import {
  type Axis,
  type Direction,
  type Layer,
  type RubiksCubeRuntimeState,
  DEFAULT_SCRAMBLE_SEED,
  scrambleCube,
  turnFace,
} from "../world/rubiksCubeState";
import { RESTING_FACE_BASIS, type FaceBasis } from "../world/rubiksCubeView";
import {
  beginCubeTurn,
  collectCubePiece,
  construct,
  collectLog,
  eatBanana,
  finishCubeTurn,
  initialPuzzle,
  interactCanopy,
  recover,
  restoreKikazaruHearing,
  restoreMizaruSight,
  selectCharacter,
  startPower,
  submitCodeDigit,
  type PuzzleState,
} from "./rules";
export type Quality = "low" | "medium" | "high" | "ultra";
export type GameMap = "islands" | "phase2" | "phase3";

export function gameMapFromQuery(value: string | null): GameMap | undefined {
  if (value === "phase4") return "phase3";
  if (value === "islands" || value === "phase2" || value === "phase3") return value;
  return undefined;
}

function initialGameMap(): GameMap {
  if (typeof window === "undefined") return "islands";
  return (
    gameMapFromQuery(new URLSearchParams(window.location.search).get("map")) ??
    "islands"
  );
}

// A URL-only dev shortcut: ?map=phase2&skip spawns at the clearing (the
// same spot arriving back from phase3 already uses) with all three chess
// pieces already in hand, instead of the long walk in from the arrival
// portal — for quickly testing the chess table/tree portal without
// replaying the route each time. Doesn't touch historicalSolved; the puzzle
// itself still has to be solved normally.
export function phase2SkipWalk(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("skip");
}
type Store = {
  phase2FromCanopy: boolean;
  phase2Pieces: [boolean, boolean, boolean];
  collectChessPiece: (index: number) => void;
  chessTrophies: ChessTrophyId[];
  bananaTrophy: boolean;
  hydrateBananaTrophy: () => void;
  hydrateChessTrophies: () => void;
  awardChessTrophy: (opponent: CharacterId) => boolean;
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
  // Mirrors lockOpen for the shrine's cube-twisting overlay — see Lock.tsx's
  // precedent and useControls.ts's pointer-lock-release effect.
  cubePuzzleOpen: boolean;
  // Which world is currently mounted. The islands map is the puzzle from
  // the start of the game; phase4 is the canopy valley reached through its
  // portal. Only one world is mounted at a time.
  map: GameMap;
  select: (id: CharacterId) => void;
  power: (id: CharacterId, position: Vec3) => void;
  build: (position: Vec3) => void;
  eat: (id: CharacterId, position: Vec3) => boolean;
  canopyInteract: (position: Vec3) => boolean;
  restoreMizaruSight: () => void;
  restoreKikazaruHearing: () => void;
  collectCube: (id: CharacterId, position: Vec3) => boolean;
  turnCubeFace: (axis: Axis, layer: Layer, direction: Direction) => void;
  completeCubeTurn: () => void;
  submitLockDigit: (position: Vec3, digit: number) => void;
  reset: () => void;
  learn: (key: string) => void;
  configure: (
    patch: Partial<
      Pick<
        Store,
        | "phase2FromCanopy"
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
        | "cubePuzzleOpen"
        | "map"
      >
    >,
  ) => void;
};
export const useGame = create<Store>((set) => ({
  phase2FromCanopy: phase2SkipWalk(),
  phase2Pieces: phase2SkipWalk() ? [true, true, true] : [false, false, false],
  collectChessPiece: (index) => set(s => {
    if (index < 0 || index > 2 || s.phase2Pieces[index]) return s;
    const pieces = [...s.phase2Pieces] as [boolean, boolean, boolean];
    pieces[index] = true;
    try { localStorage.setItem("phase2ChessPieces", JSON.stringify(pieces)); } catch {}
    return { phase2Pieces: pieces };
  }),
  chessTrophies: [],
  bananaTrophy: false,
  hydrateBananaTrophy: () => set(s =>
    readBananaTrophy() && !s.bananaTrophy ? { bananaTrophy: true } : s,
  ),
  hydrateChessTrophies: () => set(s => {
    const saved = readChessTrophies();
    const merged = [...new Set([...s.chessTrophies, ...saved])];
    return merged.length === s.chessTrophies.length ? s : { chessTrophies: merged };
  }),
  awardChessTrophy: (opponent) => {
    let awarded = false;
    set(s => {
      const id = CHESS_TROPHIES[opponent].id;
      if (s.chessTrophies.includes(id)) return s;
      const saved = readChessTrophies();
      awarded = !saved.includes(id);
      const chessTrophies = [...new Set([...s.chessTrophies, ...saved, id])];
      try { localStorage.setItem(CHESS_TROPHIES_STORAGE_KEY, JSON.stringify(chessTrophies)); } catch {}
      return { chessTrophies };
    });
    return awarded;
  },
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
  cubePuzzleOpen: false,
  map: initialGameMap(),
  select: (id) =>
    set((s) => {
      if (!runtime.chessActive && s.map === "phase3" && id !== s.puzzle.selected) runtime.canopySelectionEpoch++;
      return {
      puzzle: runtime.chessActive ? s.puzzle : selectCharacter(s.puzzle, id),
      learned: {
        ...s.learned,
        switch: true,
        hold: s.learned.hold || s.puzzle.powers[s.puzzle.selected],
      },
    }; }),
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
      if (!ate) return state;
      const bananaTrophy = state.bananaTrophy || puzzle.bananas.every(Boolean);
      if (bananaTrophy && !state.bananaTrophy) {
        try { localStorage.setItem(BANANA_TROPHY_STORAGE_KEY, "true"); } catch {}
      }
      return { puzzle, bananaTrophy };
    });
    return ate;
  },
  canopyInteract: (position) => {
    let changed = false;
    set(state => {
      if (state.map !== "phase3") return state;
      const puzzle = interactCanopy(state.puzzle, position);
      changed = puzzle !== state.puzzle;
      return changed ? { puzzle } : state;
    });
    return changed;
  },
  restoreMizaruSight: () => set((s) => ({ puzzle: restoreMizaruSight(s.puzzle) })),
  restoreKikazaruHearing: () => set((s) => ({ puzzle: restoreKikazaruHearing(s.puzzle) })),
  collectCube: (id, position) => {
    let collected = false;
    set((state) => {
      if (state.map !== "phase3") return state;
      const puzzle = collectCubePiece(state.puzzle, id, position);
      collected = puzzle !== state.puzzle;
      return collected ? { puzzle } : state;
    });
    return collected;
  },
  turnCubeFace: (axis, layer, direction) =>
    set((s) => {
      if (!runtime.rubiksCube || runtime.rubiksCube.activeTurn) return s;
      const puzzle = beginCubeTurn(s.puzzle);
      if (puzzle === s.puzzle) return s;
      runtime.rubiksCube.activeTurn = { axis, layer, direction, startedAt: performance.now() };
      return { puzzle };
    }),
  completeCubeTurn: () =>
    set((s) => {
      const cube = runtime.rubiksCube;
      const active = cube?.activeTurn;
      if (!cube || !active) return s;
      cube.cubies = turnFace(cube.cubies, active.axis, active.layer, active.direction);
      cube.activeTurn = null;
      const puzzle = finishCubeTurn(s.puzzle, cube.cubies);
      // The overlay unmounts once solved (Game.tsx switches to the ending
      // screen) — close it explicitly so it isn't left "open" underneath,
      // which previously left the pointer-lock-release effect and the
      // canvas click-to-relock handler fighting each other.
      return puzzle.cubeSolved ? { puzzle, cubePuzzleOpen: false } : { puzzle };
    }),
  submitLockDigit: (position, digit) =>
    set((s) => ({ puzzle: submitCodeDigit(s.puzzle, position, digit) })),
  reset: () =>
    set((s) => ({
      puzzle: recover(s.puzzle),
      phase2FromCanopy: false,
      lockOpen: false,
      cubePuzzleOpen: false,
    })),
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
  canopySelectionEpoch: 0,
  // Live 0..1 progress crossing the cooperative vine bridge, ratcheting up
  // only — read by Game.tsx (sight) and useSound.ts (hearing) to ease the
  // blind/muffled filters off. Once either reaches 1, the corresponding
  // puzzle.*Restored flag makes the payoff permanent regardless of this
  // value, which itself resets to 0 like any other per-frame runtime data.
  mizaruVineSight: 0,
  kikazaruVineHearing: 0,
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
  // Mouse-wheel camera zoom — a multiplier applied to each map's own base
  // follow distance (see FollowCamera.tsx), clamped in useControls.ts's
  // wheel handler so it can't be scrolled past a comfortable in/out range.
  zoom: 1,
  // Which raw direction is currently "Right/Up/Front" for the cube puzzle's
  // view-relative U/D/L/R/F/B notation (see world/rubiksCubeView.ts) —
  // updated instantly and persistently by RubiksCubePuzzle.tsx's D-pad
  // (never springs back); RubiksCube.tsx's useFrame animates the visible
  // transition toward whatever this currently is.
  cubeInspect: {
    faceBasis: RESTING_FACE_BASIS as FaceBasis,
  },
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
  // Created lazily once all three pieces are collected — see useControls.ts.
  rubiksCube: null as RubiksCubeRuntimeState | null,
  ensureRubiksCube(): RubiksCubeRuntimeState {
    if (!this.rubiksCube)
      this.rubiksCube = {
        cubies: scrambleCube(DEFAULT_SCRAMBLE_SEED),
        activeTurn: null,
      };
    return this.rubiksCube;
  },
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
    if (this.rubiksCube) this.rubiksCube.activeTurn = null;
    for (const contacts of this.vineContacts) {
      contacts.left = null;
      contacts.right = null;
    }
    this.mizaruVineSight = 0;
    this.kikazaruVineHearing = 0;
    this.stopBinarySequence();
  },
  chessActive: false,
  phase2Restore: [null, null, null] as (Vec3 | null)[],
  phase2Seats: [null, null] as [number | null, number | null],
};

// TEMP-VERIFY: live inspection hook for Playwright, removed before finishing.
if (typeof window !== "undefined") (window as unknown as { __game: unknown }).__game = {
  useGame,
  get runtime() {
    return runtime;
  },
};
