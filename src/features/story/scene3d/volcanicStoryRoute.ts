// design2's walk (the volcanic landing page): the same zigzag of six houses
// as the original page, but twice as spread out, with the monkeys, the
// houses and the stone path drawn 1.6x larger. A long last stretch leads
// from the final house to the meeting point, so that house stays out of the
// camera's view there. At the meeting point Mizaru and Kikazaru are already
// playing chess beside the cherry; Calado (Iwazaru) walks up to watch.
// Dependency-free apart from cameraRig and phase 2's plain layout data, so
// Experience.tsx and the camera can import it without the scene geometry.
import { PHASE_TWO_STOOLS } from "@/features/game/world/phaseTwoLayout";
import {
  angleTo,
  CONVERGENCE_POINT,
  FAR_OFFSET,
  PATH_POINTS,
  STAND_OFFSET,
  type Point,
  type StoryRoute,
} from "./cameraRig";

/** How much further apart the houses are than on the original page. */
export const VOLCANIC_ROUTE_SPREAD = 2;
/** Size of the monkeys, houses and path relative to the original page. */
export const VOLCANIC_STORY_SCALE = 1.6;
/** From the last house to the cherry at the centre of the meeting point. */
export const VOLCANIC_FINAL_HOP_TO_TREE = 55;

const HOUSES: Point[] = PATH_POINTS.map(point => ({
  x: point.x * VOLCANIC_ROUTE_SPREAD,
  z: point.z * VOLCANIC_ROUTE_SPREAD,
}));
// Same heading as the original page's last hop, only much longer.
const LAST = HOUSES[5];
const HOP_LENGTH = Math.hypot(CONVERGENCE_POINT.x - PATH_POINTS[5].x, CONVERGENCE_POINT.z - PATH_POINTS[5].z);
const HOP = {
  x: (CONVERGENCE_POINT.x - PATH_POINTS[5].x) / HOP_LENGTH,
  z: (CONVERGENCE_POINT.z - PATH_POINTS[5].z) / HOP_LENGTH,
};

/** The cherry at the centre of the meeting point. */
export const VOLCANIC_TREE: Point = {
  x: LAST.x + HOP.x * VOLCANIC_FINAL_HOP_TO_TREE,
  z: LAST.z + HOP.z * VOLCANIC_FINAL_HOP_TO_TREE,
};

// Phase 2's own chess set, at the monkeys' scale as in phase 2, beside the
// cherry (clear of its roots) and turned three-quarters to the camera.
export const VOLCANIC_CHESS_SCALE = VOLCANIC_STORY_SCALE;
export const VOLCANIC_CHESS = { x: VOLCANIC_TREE.x + 10.5, z: VOLCANIC_TREE.z + 1.5 };
export const VOLCANIC_CHESS_ROTATION = -0.5;
// Phase 2's stool offsets and seat height (feet on the stool top), scaled.
const STOOL_OFFSET = (PHASE_TWO_STOOLS[1].z - PHASE_TWO_STOOLS[0].z) / 2;
const STOOL_TOP = PHASE_TWO_STOOLS[0].seatedHeight - 0.44;
function fromChess(localX: number, localZ: number): Point {
  const cos = Math.cos(VOLCANIC_CHESS_ROTATION), sin = Math.sin(VOLCANIC_CHESS_ROTATION);
  const x = localX * VOLCANIC_CHESS_SCALE, z = localZ * VOLCANIC_CHESS_SCALE;
  return { x: VOLCANIC_CHESS.x + x * cos + z * sin, z: VOLCANIC_CHESS.z - x * sin + z * cos };
}
/** The two players: Mizaru (white, id 0) and Kikazaru (black, id 1). */
export const VOLCANIC_PLAYERS = [
  { id: 0 as const, seat: fromChess(0, -STOOL_OFFSET), yaw: VOLCANIC_CHESS_ROTATION, y: STOOL_TOP * VOLCANIC_CHESS_SCALE },
  { id: 1 as const, seat: fromChess(0, STOOL_OFFSET), yaw: VOLCANIC_CHESS_ROTATION + Math.PI, y: STOOL_TOP * VOLCANIC_CHESS_SCALE },
];
/** Where Calado stops: at the side of the board, between the players. */
const WATCH = fromChess(-1.75, 0);
export const VOLCANIC_WATCH_YAW = angleTo(WATCH, VOLCANIC_CHESS);

export const VOLCANIC_ROUTE: StoryRoute = {
  points: HOUSES,
  convergence: WATCH,
  houseScale: VOLCANIC_STORY_SCALE,
  standOffset: STAND_OFFSET * VOLCANIC_STORY_SCALE,
  farOffset: FAR_OFFSET * VOLCANIC_STORY_SCALE,
  // The stone path runs on into the meeting point.
  pathEndsBeforeMeeting: 6,
};
