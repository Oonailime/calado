// Pure Rubik's cube state machine. Positions and orientations are tracked as
// exact integers (quarter turns only), never as accumulated floats, so a long
// play session cannot drift. The Y-up/Z-up conversion lives entirely at the
// render layer (see RubiksCube.tsx) — everything here stays in the model's
// own raw grid space, where a "layer" is just one coordinate.
export type Axis = 0 | 1 | 2;
export type Layer = -1 | 0 | 1;
export type Direction = 1 | -1;
export type GridPos = readonly [number, number, number];
export type CubeColor = "white" | "brown" | "yellow";
// World-space images of the cubie's local +X, +Y and +Z edges.
export type Orientation = readonly [GridPos, GridPos, GridPos];

export type CubieState = {
  readonly colorTarget: CubeColor;
  readonly position: GridPos;
  readonly orientation: Orientation;
};

export type TurnMove = { axis: Axis; layer: Layer; direction: Direction };
export type ActiveTurn = TurnMove & { startedAt: number };
// Lives in the mutable `runtime` object (see state/store.ts), not Zustand:
// it changes every animation frame during a turn and doesn't need React
// re-renders, exactly like runtime.activeVine/swingingVines.
export type RubiksCubeRuntimeState = {
  cubies: CubieState[];
  activeTurn: ActiveTurn | null;
};
export const DEFAULT_SCRAMBLE_SEED = 42;

const IDENTITY_ORIENTATION: Orientation = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export const CUBIE_POSITIONS: readonly GridPos[] = (() => {
  const positions: GridPos[] = [];
  for (const x of [-1, 0, 1] as const)
    for (const y of [-1, 0, 1] as const)
      for (const z of [-1, 0, 1] as const) {
        if (x === 0 && y === 0 && z === 0) continue;
        positions.push([x, y, z]);
      }
  return positions;
})();

export function colorForLayer(z: number): CubeColor {
  return z > 0 ? "white" : z < 0 ? "yellow" : "brown";
}

export function targetLayer(color: CubeColor): Layer {
  return color === "white" ? 1 : color === "yellow" ? -1 : 0;
}

function rotateVector(v: GridPos, axis: Axis, direction: Direction): GridPos {
  const [x, y, z] = v;
  if (axis === 0) return direction === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return direction === 1 ? [z, y, -x] : [-z, y, x];
  return direction === 1 ? [-y, x, z] : [y, -x, z];
}

// Exported for RubiksCubePuzzle.tsx's view-relative U/D/L/R/F/B tracking —
// rotating a full 3-vector basis by one quarter turn is the same primitive
// operation whether it's a cubie's orientation or "which raw direction is
// currently Right/Up/Front".
export function rotateOrientation(
  o: Orientation,
  axis: Axis,
  direction: Direction,
): Orientation {
  return [
    rotateVector(o[0], axis, direction),
    rotateVector(o[1], axis, direction),
    rotateVector(o[2], axis, direction),
  ];
}

export function initialCubeState(): CubieState[] {
  return CUBIE_POSITIONS.map((position) => ({
    colorTarget: colorForLayer(position[2]),
    position,
    orientation: IDENTITY_ORIENTATION,
  }));
}

export function turnFace(
  state: readonly CubieState[],
  axis: Axis,
  layer: Layer,
  direction: Direction,
): CubieState[] {
  return state.map((cubie) => {
    if (cubie.position[axis] !== layer) return cubie;
    return {
      colorTarget: cubie.colorTarget,
      position: rotateVector(cubie.position, axis, direction),
      orientation: rotateOrientation(cubie.orientation, axis, direction),
    };
  });
}

export function isSolved(state: readonly CubieState[]): boolean {
  return state.every(
    (cubie) => colorForLayer(cubie.position[2]) === cubie.colorTarget,
  );
}

// Used by the puzzle overlay's progress readout — a layer counts as solved
// only once every cubie assigned to it currently sits in that physical slice
// (piece order within the layer never matters, per the cube's own design:
// same-colour pieces are visually identical).
export function solvedLayerCount(state: readonly CubieState[]): number {
  const colors: CubeColor[] = ["white", "brown", "yellow"];
  return colors.filter((color) => {
    const layer = targetLayer(color);
    return state.every(
      (cubie) => cubie.colorTarget !== color || cubie.position[2] === layer,
    );
  }).length;
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Outer layers only (never the middle slice, layer 0): the puzzle overlay
// only exposes standard face notation (U/D/L/R/F/B, one per outer layer per
// axis), so every scramble must stay solvable using just those six moves.
const OUTER_LAYERS: readonly Layer[] = [-1, 1];

// Always reached by legal moves from solved, so it is always solvable. The
// seed keeps a given playthrough attempt reproducible.
export function scrambleCube(seed: number, moves = 20): CubieState[] {
  const rng = random(seed);
  let state = initialCubeState();
  for (let i = 0; i < moves; i++) {
    const axis = Math.floor(rng() * 3) as Axis;
    const layer = OUTER_LAYERS[Math.floor(rng() * 2)];
    const direction: Direction = rng() < 0.5 ? 1 : -1;
    state = turnFace(state, axis, layer, direction);
  }
  // Astronomically unlikely, but a scramble that cancels itself out entirely
  // would open the puzzle already solved.
  if (isSolved(state)) state = turnFace(state, 0, 1, 1);
  return state;
}

export const CUBE_TURN_DURATION_SECONDS = 0.32;

export function turnEase(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function turnProgress(startedAt: number, now: number): number {
  if (now <= startedAt) return 0;
  return Math.min(1, (now - startedAt) / (CUBE_TURN_DURATION_SECONDS * 1000));
}
