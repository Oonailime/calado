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
  // 0 - x rather than -x: a clean 0, never -0, for the zero components.
  return [0 - v[0], 0 - v[1], 0 - v[2]] as GridPos;
}

// Every faceBasis vector is always exactly one signed unit axis (steps are
// always 90 degrees), so this is a safe, exact lookup rather than a
// nearest-axis approximation.
function axisAndSign(v: GridPos): { axis: Axis; sign: 1 | -1 } {
  const axis = (v[0] !== 0 ? 0 : v[1] !== 0 ? 1 : 2) as Axis;
  return { axis, sign: v[axis] > 0 ? 1 : -1 };
}

const QUARTER_TURN = Math.PI / 2;

/** The camera yaw snapped to the nearest face-on view of the cube. */
export function snapCubeViewYaw(yaw: number) {
  return Math.round(yaw / QUARTER_TURN) * QUARTER_TURN;
}

// faceBasis names the raw directions at world +X/+Y/+Z, but the camera looks
// at the cube from the player's yaw (FollowCamera places it at
// (sin yaw, cos yaw) from the cube). This re-expresses the basis from the
// viewer's side: [raw at the viewer's right, raw at up, raw facing the
// viewer], with the yaw snapped to the nearest of the four sides.
export function viewerFaceBasis(basis: FaceBasis, yaw: number): FaceBasis {
  const quarter = ((Math.round(yaw / QUARTER_TURN) % 4) + 4) % 4;
  // Facing the viewer / to the viewer's right, as signed world X or Z.
  const [front, right] = (
    [
      [basis[2], basis[0]], // camera at +Z: front +Z, right +X
      [basis[0], negate(basis[2])], // camera at +X: front +X, right -Z
      [negate(basis[2]), negate(basis[0])], // camera at -Z: front -Z, right -X
      [negate(basis[0]), basis[2]], // camera at -X: front -X, right +Z
    ] as const
  )[quarter];
  return [right, basis[1], front];
}

// Left/right turn the view about whichever raw axis is currently "Up"
// (spinning around the vertical, like turning your head); up/down turn it
// about whichever raw axis is currently at the viewer's right (tipping the
// view, like nodding). Either way, "Up" and "Right" name a raw axis, not a
// fixed world one, which is what makes repeated presses keep composing
// consistently from whichever side the camera looks.
export function stepFaceBasis(basis: FaceBasis, step: ViewStep, yaw = 0): FaceBasis {
  if (step === "left" || step === "right") {
    const { axis, sign } = axisAndSign(basis[1]);
    return rotateOrientation(basis, axis, (sign * (step === "right" ? 1 : -1)) as Direction);
  }
  const { axis, sign } = axisAndSign(viewerFaceBasis(basis, yaw)[0]);
  return rotateOrientation(basis, axis, (sign * (step === "down" ? 1 : -1)) as Direction);
}

// The move that performs a standard, unprimed (clockwise, viewed from
// outside that face) turn of the named face as currently oriented and seen
// from the camera's yaw. "Clockwise" flips the required turnFace `direction`
// between opposite faces sharing the same axis — a fixed property of the
// right-hand rule, independent of which raw axis a face currently happens
// to be.
export function faceMove(basis: FaceBasis, name: FaceName, yaw = 0): FaceMove {
  const view = viewerFaceBasis(basis, yaw);
  const vector: GridPos =
    name === "R"
      ? view[0]
      : name === "L"
        ? negate(view[0])
        : name === "U"
          ? view[1]
          : name === "D"
            ? negate(view[1])
            : name === "F"
              ? view[2]
              : negate(view[2]);
  const { axis, sign } = axisAndSign(vector);
  return { axis, layer: sign, direction: -sign as Direction };
}
