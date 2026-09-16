// View-relative face notation. The puzzle overlay lets the player look at
// the cube from any of 24 orientations (via RubiksCubePuzzle.tsx's D-pad);
// wherever they're currently looking from, "U"/"D"/"L"/"R"/"F"/"B" always
// mean what they mean on a real cube — whichever layer is presently on top,
// on the bottom, facing them, and so on. That's this module's only job:
// no rendering, no puzzle-solving logic, just "which raw (axis, layer) is
// currently the named face, and which `direction` turns it clockwise."
import {
  rotateOrientation,
  type Axis,
  type Direction,
  type GridPos,
  type Layer,
  type Orientation,
} from "./rubiksCubeState";

// [Right, Up, Front] as raw-space unit vectors: faceBasis[k] is "which raw
// direction currently maps to that named world direction". The resting
// value already accounts for the fixed Z-up -> Y-up tilt applied in
// RubiksCube.tsx (raw white/z=+1 sits at the base, yellow/z=-1 on top).
export type FaceBasis = Orientation;
export const RESTING_FACE_BASIS: FaceBasis = [
  [1, 0, 0],
  [0, 0, -1],
  [0, 1, 0],
];

export type ViewStep = "up" | "down" | "left" | "right";
export type FaceName = "U" | "D" | "L" | "R" | "F" | "B";
export type FaceMove = { axis: Axis; layer: Layer; direction: Direction };

function negate(v: GridPos): GridPos {
  return [-v[0], -v[1], -v[2]];
}

// Every faceBasis vector is always exactly one signed unit axis (steps are
// always 90 degrees), so this is a safe, exact lookup rather than a
// nearest-axis approximation.
function axisAndSign(v: GridPos): { axis: Axis; sign: 1 | -1 } {
  const axis = (v[0] !== 0 ? 0 : v[1] !== 0 ? 1 : 2) as Axis;
  return { axis, sign: v[axis] > 0 ? 1 : -1 };
}

// Left/right turn the view about whichever raw axis is currently "Up"
// (spinning around the vertical, like turning your head); up/down turn it
// about whichever raw axis is currently "Right" (tipping the view, like
// nodding). Either way, "Up" and "Right" name a raw axis, not a fixed world
// one, which is what makes repeated presses keep composing consistently.
export function stepFaceBasis(basis: FaceBasis, step: ViewStep): FaceBasis {
  if (step === "left" || step === "right") {
    const { axis, sign } = axisAndSign(basis[1]);
    return rotateOrientation(basis, axis, (sign * (step === "right" ? 1 : -1)) as Direction);
  }
  const { axis, sign } = axisAndSign(basis[0]);
  return rotateOrientation(basis, axis, (sign * (step === "down" ? 1 : -1)) as Direction);
}

// The move that performs a standard, unprimed (clockwise, viewed from
// outside that face) turn of the named face as currently oriented.
// "Clockwise" flips the required turnFace `direction` between opposite
// faces sharing the same axis — a fixed property of the right-hand rule,
// independent of which raw axis a face currently happens to be.
export function faceMove(basis: FaceBasis, name: FaceName): FaceMove {
  const vector: GridPos =
    name === "R"
      ? basis[0]
      : name === "L"
        ? negate(basis[0])
        : name === "U"
          ? basis[1]
          : name === "D"
            ? negate(basis[1])
            : name === "F"
              ? basis[2]
              : negate(basis[2]);
  const { axis, sign } = axisAndSign(vector);
  return { axis, layer: sign, direction: -sign as Direction };
}
