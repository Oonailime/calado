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

// Clears each house's own footprint instead of running under it — the path
// reads as segments between houses, not one continuous ribbon — and stops
// well short of the sand-colored clearing rather than touching it. Shared
// by RockPath.tsx (to place tiles) and Grass.tsx (to scatter alongside it).
const HOUSE_CLEARANCE = 1.8;
// Kept short enough that the segment's own endpoint lands outside
// CLEARING_RADIUS around CONVERGENCE_POINT — it was previously 0.55, which
// put the endpoint ~6.6 units from the clearing's center, well inside its
// 9-unit radius, so both the rock tiles and anything scattered along this
// segment (grass) ended up on the sand.
const FINAL_HOP_COVERAGE = 0.28;
export function pathSegments(): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const startT = HOUSE_CLEARANCE / length;
    const endT = 1 - HOUSE_CLEARANCE / length;
    if (endT > startT)
      segments.push([lerpPoint(a, b, startT), lerpPoint(a, b, endT)]);
  }
  const last = PATH_POINTS[PATH_POINTS.length - 1];
  const toClearing = Math.hypot(
    CONVERGENCE_POINT.x - last.x,
    CONVERGENCE_POINT.z - last.z,
  );
  const startT = HOUSE_CLEARANCE / toClearing;
  segments.push([
    lerpPoint(last, CONVERGENCE_POINT, startT),
    lerpPoint(last, CONVERGENCE_POINT, FINAL_HOP_COVERAGE),
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
export function houseYaw(index: number) {
  if (index <= 0) return angleTo(PATH_POINTS[0], PATH_POINTS[1]);
  const from = PATH_POINTS[index];
  const to = PATH_POINTS[index - 1];
  return angleTo(from, to);
}

// A single continuous function of progress across scenes 0-5 (each scene's
// end exactly equals the next scene's start), so anything built on top of it
// — the camera, the walk — never has to reset/jump at a scene boundary.
export function walkPoint(progress: number, reduced = false): Point {
  const { scene, t } = sceneAndPhase(progress, reduced);
  if (scene <= 4)
    return lerpPoint(PATH_POINTS[scene], PATH_POINTS[scene + 1], t);
  if (scene === 5) return lerpPoint(PATH_POINTS[5], CONVERGENCE_POINT, t);
  return CONVERGENCE_POINT;
}

const WALK_POINTS = [...PATH_POINTS, CONVERGENCE_POINT];
const WALK_SEGMENT_LENGTHS = WALK_POINTS.slice(0, -1).map((point, index) => {
  const next = WALK_POINTS[index + 1];
  return Math.hypot(next.x - point.x, next.z - point.z);
});
export const WALK_PATH_LENGTH = WALK_SEGMENT_LENGTHS.reduce(
  (total, length) => total + length,
  0,
);

// Absolute meters covered from the beginning of the route. Unlike a
// frame-by-frame accumulator, this always returns the same value for the
// same scroll position and decreases naturally when the visitor scrolls up.
export function walkDistance(progress: number, reduced = false): number {
  const { scene, t } = sceneAndPhase(progress, reduced);
  if (scene >= WALK_SEGMENT_LENGTHS.length) return WALK_PATH_LENGTH;
  let completed = 0;
  for (let index = 0; index < scene; index += 1)
    completed += WALK_SEGMENT_LENGTHS[index];
  return completed + WALK_SEGMENT_LENGTHS[scene] * t;
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

// How open house `index`'s door should be (0 closed, 1 open), peaking exactly
// when the character reaches it and easing shut again as he moves away —
// driven by progress rather than live 3D distance, since the two are
// deterministically the same thing in this scroll-only scene.
const DOOR_OPEN_WINDOW = 0.7;
export function houseDoorOpenness(
  index: number,
  progress: number,
  reduced = false,
) {
  const clamped = Math.max(0, Math.min(1, progress));
  const distance = Math.abs(clamped * 8 - index);
  if (reduced) return distance < 0.5 ? 1 : 0;
  return smoothstep(1 - Math.min(1, distance / DOOR_OPEN_WINDOW));
}

// Calado walks the whole path and stops in the clearing; he never doubles
// back through the houses once there (that was the "walked through every
// house" bug) — from scene 6 on his position is pinned to the clearing.
export function calladoState(progress: number, reduced = false) {
  const { scene, t } = sceneAndPhase(progress, reduced);
  const position = walkPoint(progress, reduced);
  const distance = walkDistance(progress, reduced);
  const settled = scene > 6 || (scene === 6 && t > 0.6);
  let yaw: number;
  if (scene <= 4) yaw = angleTo(PATH_POINTS[scene], PATH_POINTS[scene + 1]);
  else if (scene === 5) yaw = angleTo(PATH_POINTS[5], CONVERGENCE_POINT);
  else yaw = settled ? 0 : angleTo(PATH_POINTS[5], CONVERGENCE_POINT);
  const walking = scene <= 5;
  return { position, distance, yaw, walking, settled };
}

// Mizaru/Kikazaru are absent until the clearing, then walk in from well
// outside the camera frame to flank Calado, facing the camera once arrived.
export function companionState(
  side: -1 | 1,
  progress: number,
  reduced = false,
) {
  const { scene, rawPhase } = sceneAndPhase(progress, reduced);
  if (scene < 6)
    return {
      visible: false,
      position: CONVERGENCE_POINT,
      distance: 0,
      yaw: 0,
      walking: false,
      settled: false,
    };
  const far: Point = {
    x: CONVERGENCE_POINT.x + side * FAR_OFFSET,
    z: CONVERGENCE_POINT.z,
  };
  const stand: Point = {
    x: CONVERGENCE_POINT.x + side * STAND_OFFSET,
    z: CONVERGENCE_POINT.z,
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
