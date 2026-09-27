// Pure spatial math for the 2.5D biographical intro: a zigzag switchback
// path (diagonal hop right, diagonal hop left, ...) with a house at each
// point, entered through its front door (each house faces back toward the
// point it was reached from). The final beats gather everyone in a clearing
// far past the last house, then the camera alone pulls back into the exact
// shot Game.tsx's own <Canvas camera> opens on.
export type Point = { x: number; z: number };
export type Pose = {
  position: [number, number, number];
  lookAt: [number, number, number];
};

const STEP_X = 8;
const STEP_Z = 10;
export const STORY_STEPS_PER_BUILDING = 4.5;
export const STORY_METERS_PER_STEP =
  Math.hypot(STEP_X, STEP_Z) / STORY_STEPS_PER_BUILDING;
export const STORY_METERS_PER_STRIDE = STORY_METERS_PER_STEP * 2;

// birth, school, science (UFBA), engineering (UFBA), work, mobility (UFMG)
export const PATH_POINTS: Point[] = [
  { x: 0, z: 0 },
  { x: STEP_X, z: -STEP_Z },
  { x: 0, z: -STEP_Z * 2 },
  { x: STEP_X, z: -STEP_Z * 3 },
  { x: 0, z: -STEP_Z * 4 },
  { x: STEP_X, z: -STEP_Z * 5 },
];
export const CONVERGENCE_POINT: Point = { x: STEP_X / 2, z: -STEP_Z * 6.4 };
export const CLEARING_RADIUS = 9;
// The green ground plane's own Y in StoryScene.tsx — shared so anything
// resting on it (Grass.tsx) uses the exact same coordinate instead of an
// independently-guessed one.
export const GROUND_Y = -0.02;
export const STAND_OFFSET = 1.7;
export const FAR_OFFSET = 9;

// Everything a page needs to lay the walk out: the six houses, the meeting
// point, and how large the houses, monkeys and path are drawn. The original
// page uses ORIGINAL_ROUTE (the default everywhere below); design2 has its
// own, longer one (volcanicStoryRoute.ts).
export type StoryRoute = {
  points: readonly Point[];
  convergence: Point;
  // Scale of the houses, the monkeys and the stone path.
  houseScale: number;
  standOffset: number;
  farOffset: number;
  // Where the path along the last hop stops, in metres short of the meeting point.
  pathEndsBeforeMeeting: number;
};

// Clears each house's own footprint instead of running under it — the path
// reads as segments between houses, not one continuous ribbon — and stops
// well short of the sand-colored clearing rather than touching it. Shared
// by RockPath.tsx (to place tiles) and Grass.tsx (to scatter alongside it).
const HOUSE_CLEARANCE = 1.8;
export const WORK_PATH_CLEARANCE = 3.1;
// Kept short enough that the segment's own endpoint lands outside
// CLEARING_RADIUS around CONVERGENCE_POINT — it was previously 0.55, which
// put the endpoint ~6.6 units from the clearing's center, well inside its
// 9-unit radius, so both the rock tiles and anything scattered along this
// segment (grass) ended up on the sand.
const FINAL_HOP_COVERAGE = 0.28;
const FINAL_HOP_LENGTH = Math.hypot(
  CONVERGENCE_POINT.x - PATH_POINTS[5].x,
  CONVERGENCE_POINT.z - PATH_POINTS[5].z,
);
export const ORIGINAL_ROUTE: StoryRoute = {
  points: PATH_POINTS,
  convergence: CONVERGENCE_POINT,
  houseScale: 1,
  standOffset: STAND_OFFSET,
  farOffset: FAR_OFFSET,
  pathEndsBeforeMeeting: FINAL_HOP_LENGTH * (1 - FINAL_HOP_COVERAGE),
};

export function pathSegments(route: StoryRoute = ORIGINAL_ROUTE): [Point, Point][] {
  const segments: [Point, Point][] = [];
  const { points, convergence } = route;
  const house = HOUSE_CLEARANCE * route.houseScale;
  const work = WORK_PATH_CLEARANCE * route.houseScale;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const startT = (i === 4 ? work : house) / length;
    const endT = 1 - (i + 1 === 4 ? work : house) / length;
    if (endT > startT)
      segments.push([lerpPoint(a, b, startT), lerpPoint(a, b, endT)]);
  }
  const last = points[points.length - 1];
  const toClearing = Math.hypot(
    convergence.x - last.x,
    convergence.z - last.z,
  );
  const startT = house / toClearing;
  segments.push([
    lerpPoint(last, convergence, startT),
    lerpPoint(last, convergence, 1 - route.pathEndsBeforeMeeting / toClearing),
  ]);
  return segments;
}

// Background hill silhouettes — shared with Grass.tsx so scattered tufts
// know to avoid them instead of poking out of a hill's rounded surface.
export const HILL_SEEDS = [
  { x: -9, z: 8, scale: 5.5 },
  { x: 20, z: 4, scale: 6 },
  { x: -10, z: -14, scale: 5 },
  { x: 22, z: -20, scale: 6.5 },
  { x: -11, z: -34, scale: 5.5 },
  { x: 23, z: -38, scale: 6 },
  { x: -10, z: -54, scale: 6 },
  { x: 22, z: -58, scale: 5.5 },
  { x: -8, z: -74, scale: 6.5 },
  { x: 18, z: -78, scale: 6 },
];

const CAM_BACK = 9;
const CAM_UP = 3.6;
const LOOK_UP = 1.4;
export const GAME_HANDOFF: Pose = {
  position: [0, 6, 12],
  lookAt: [0, 1, 4],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) };
}
export function angleTo(from: Point, to: Point) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
export function sceneAndPhase(progress: number, reduced = false) {
  const clamped = Math.max(0, Math.min(1, progress));
  const scene = Math.min(7, Math.floor(clamped * 8));
  const rawPhase = Math.min(1, clamped * 8 - scene);
  const t = reduced ? (rawPhase > 0.5 ? 1 : 0) : smoothstep(rawPhase);
  return { scene, rawPhase, t };
}

// House rotation so its front door (the kit's local +Z face) points back
// toward the point the character arrives from — the first house faces
// forward, toward the second, since nothing precedes it.
export function houseYaw(index: number, route: StoryRoute = ORIGINAL_ROUTE) {
  const { points } = route;
  if (index <= 0) return angleTo(points[0], points[1]);
  const from = points[index];
  const to = points[index - 1];
  return angleTo(from, to);
}

// A single continuous function of progress across scenes 0-5 (each scene's
// end exactly equals the next scene's start), so anything built on top of it
// — the camera, the walk — never has to reset/jump at a scene boundary.
export function walkPoint(progress: number, reduced = false, route: StoryRoute = ORIGINAL_ROUTE): Point {
  const { scene, t } = sceneAndPhase(progress, reduced);
  const { points, convergence } = route;
  if (scene <= 4)
    return lerpPoint(points[scene], points[scene + 1], t);
  if (scene === 5) return lerpPoint(points[5], convergence, t);
  return convergence;
}

function segmentLengths(route: StoryRoute) {
  const walk = [...route.points, route.convergence];
  return walk.slice(0, -1).map((point, index) => {
    const next = walk[index + 1];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
}
const WALK_SEGMENT_LENGTHS = segmentLengths(ORIGINAL_ROUTE);
export const WALK_PATH_LENGTH = WALK_SEGMENT_LENGTHS.reduce(
  (total, length) => total + length,
  0,
);
const ROUTE_SEGMENT_LENGTHS = new WeakMap<StoryRoute, number[]>();

// Absolute meters covered from the beginning of the route. Unlike a
// frame-by-frame accumulator, this always returns the same value for the
// same scroll position and decreases naturally when the visitor scrolls up.
export function walkDistance(progress: number, reduced = false, route: StoryRoute = ORIGINAL_ROUTE): number {
  const { scene, t } = sceneAndPhase(progress, reduced);
  let lengths = ROUTE_SEGMENT_LENGTHS.get(route);
  if (!lengths) {
    lengths = route === ORIGINAL_ROUTE ? WALK_SEGMENT_LENGTHS : segmentLengths(route);
    ROUTE_SEGMENT_LENGTHS.set(route, lengths);
  }
  if (scene >= lengths.length)
    return lengths.reduce((total, length) => total + length, 0);
  let completed = 0;
  for (let index = 0; index < scene; index += 1)
    completed += lengths[index];
  return completed + lengths[scene] * t;
}

export type TravelDirection = -1 | 1;
export function travelDirection(
  previousDistance: number,
  distance: number,
  fallback: TravelDirection,
): TravelDirection {
  const difference = distance - previousDistance;
  if (Math.abs(difference) < 1e-4) return fallback;
  return difference < 0 ? -1 : 1;
}

export function travelYaw(
  forwardYaw: number,
  direction: TravelDirection,
  walking: boolean,
): number {
  return walking && direction < 0 ? forwardYaw + Math.PI : forwardYaw;
}

// The camera trails the character by a fixed progress lag instead of resetting
// to a fresh 0-1 range each scene — since walkPoint has no jumps, neither does
// this, which is what fixes the "abrupt cut arriving at each house" complaint.
const CAMERA_LAG = 0.045;
const WALK_HEIGHT_SPAN = 5.5 / 8;
export function cameraForProgress(progress: number, reduced = false): Pose {
  const { scene, t } = sceneAndPhase(progress, reduced);
  if (scene <= 5) {
    const clamped = Math.max(0, Math.min(1, progress));
    const lookPoint = walkPoint(clamped, reduced);
    const camPoint = walkPoint(Math.max(0, clamped - CAMERA_LAG), reduced);
    const heightT = reduced
      ? Math.min(1, scene / (WALK_HEIGHT_SPAN * 8))
      : Math.max(0, Math.min(1, clamped / WALK_HEIGHT_SPAN));
    return {
      position: [
        camPoint.x,
        lerp(CAM_UP, CAM_UP + 1, heightT),
        camPoint.z + CAM_BACK,
      ],
      lookAt: [lookPoint.x, LOOK_UP, lookPoint.z],
    };
  }
  if (scene === 6) {
    const camStart = walkPoint(Math.max(0, 6 / 8 - CAMERA_LAG), reduced);
    const camX = lerp(camStart.x, CONVERGENCE_POINT.x, t);
    const camZBase = lerp(camStart.z, CONVERGENCE_POINT.z, t);
    const camY = lerp(CAM_UP + 1, CAM_UP + 2.4, t);
    const camBack = lerp(CAM_BACK, CAM_BACK + 3, t);
    return {
      position: [camX, camY, camZBase + camBack],
      lookAt: [CONVERGENCE_POINT.x, LOOK_UP, CONVERGENCE_POINT.z],
    };
  }
  const start: Pose = {
    position: [
      CONVERGENCE_POINT.x,
      CAM_UP + 2.4,
      CONVERGENCE_POINT.z + CAM_BACK + 3,
    ],
    lookAt: [CONVERGENCE_POINT.x, LOOK_UP, CONVERGENCE_POINT.z],
  };
  return {
    position: [
      lerp(start.position[0], GAME_HANDOFF.position[0], t),
      lerp(start.position[1], GAME_HANDOFF.position[1], t),
      lerp(start.position[2], GAME_HANDOFF.position[2], t),
    ],
    lookAt: [
      lerp(start.lookAt[0], GAME_HANDOFF.lookAt[0], t),
      lerp(start.lookAt[1], GAME_HANDOFF.lookAt[1], t),
      lerp(start.lookAt[2], GAME_HANDOFF.lookAt[2], t),
    ],
  };
}

// Distances in world units: increase OPEN_DISTANCE to start opening sooner.
// The door is fully open before the monkey reaches the facade, and stays
// open while he enters. The same spatial timing works when scrolling back.
export const STORY_DOOR_OPEN_DISTANCE = 6;
export const STORY_DOOR_FULL_OPEN_DISTANCE = 2.4;
// Distances stretch with the route's house scale, so larger houses still
// open before the monkey reaches their (further out) facade.
export function houseDoorOpenness(index: number, progress: number, reduced = false, route: StoryRoute = ORIGINAL_ROUTE) {
  const position = walkPoint(progress, reduced, route);
  const house = route.points[index];
  const distance = Math.hypot(position.x - house.x, position.z - house.z) / route.houseScale;
  if (reduced) return distance < STORY_DOOR_OPEN_DISTANCE ? 1 : 0;
  return smoothstep((STORY_DOOR_OPEN_DISTANCE - distance) /
    (STORY_DOOR_OPEN_DISTANCE - STORY_DOOR_FULL_OPEN_DISTANCE));
}

// Calado walks the whole path and stops in the clearing; he never doubles
// back through the houses once there (that was the "walked through every
// house" bug) — from scene 6 on his position is pinned to the clearing.
export function calladoState(progress: number, reduced = false, route: StoryRoute = ORIGINAL_ROUTE) {
  const { scene, t } = sceneAndPhase(progress, reduced);
  const { points, convergence } = route;
  const position = walkPoint(progress, reduced, route);
  const distance = walkDistance(progress, reduced, route);
  const settled = scene > 6 || (scene === 6 && t > 0.6);
  let yaw: number;
  if (scene <= 4) yaw = angleTo(points[scene], points[scene + 1]);
  else if (scene === 5) yaw = angleTo(points[5], convergence);
  else yaw = settled ? 0 : angleTo(points[5], convergence);
  const walking = scene <= 5;
  return { position, distance, yaw, walking, settled };
}

// Mizaru/Kikazaru are absent until the clearing, then walk in from well
// outside the camera frame to flank Calado, facing the camera once arrived.
export function companionState(
  side: -1 | 1,
  progress: number,
  reduced = false,
  route: StoryRoute = ORIGINAL_ROUTE,
) {
  const { scene, rawPhase } = sceneAndPhase(progress, reduced);
  const { convergence } = route;
  if (scene < 6)
    return {
      visible: false,
      position: convergence,
      distance: 0,
      yaw: 0,
      walking: false,
      settled: false,
    };
  const far: Point = {
    x: convergence.x + side * route.farOffset,
    z: convergence.z,
  };
  const stand: Point = {
    x: convergence.x + side * route.standOffset,
    z: convergence.z,
  };
  const distanceToStand = Math.abs(stand.x - far.x);
  if (scene === 6) {
    const enterT = reduced
      ? rawPhase > 0.3
        ? 1
        : 0
      : smoothstep(Math.min(1, rawPhase / 0.6));
    const settled = enterT >= 1;
    return {
      visible: true,
      position: lerpPoint(far, stand, enterT),
      distance: distanceToStand * enterT,
      yaw: settled ? 0 : angleTo(far, stand),
      walking: !settled,
      settled,
    };
  }
  return {
    visible: true,
    position: stand,
    distance: distanceToStand,
    yaw: 0,
    walking: false,
    settled: true,
  };
}
