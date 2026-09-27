import { sceneAndPhase, walkPoint, type Pose } from "./cameraRig";
import { VOLCANIC_ROUTE, VOLCANIC_TREE } from "./volcanicStoryRoute";

function approach(progress: number, reduced: boolean): Pose {
  const point = walkPoint(progress, reduced, VOLCANIC_ROUTE);
  const trail = walkPoint(Math.max(0, progress - 0.035), reduced, VOLCANIC_ROUTE);
  return {
    position: [trail.x + 4, 6.4 + Math.min(progress / 0.75, 1) * 0.4, trail.z + 13],
    lookAt: [point.x - 3, 1.8, point.z - 5],
  };
}

function blend(a: Pose, b: Pose, t: number): Pose {
  const mix = (from: number[], to: number[]) => from.map((n, i) => n + (to[i] - n) * t) as [number, number, number];
  return { position: mix(a.position, b.position), lookAt: mix(a.lookAt, b.lookAt) };
}

// At the meeting point the camera pulls back and rises until the whole
// cherry (about 26 m tall, its crown 16 m across either side) fits, centred,
// with the monkeys, the fire and the chess table in front of it.
const SANCTUARY: Pose = {
  position: [VOLCANIC_TREE.x, 13, VOLCANIC_TREE.z + 42],
  lookAt: [VOLCANIC_TREE.x, 10, VOLCANIC_TREE.z],
};

export function volcanicCameraForProgress(progress: number, reduced = false): Pose {
  const { scene, t } = sceneAndPhase(progress, reduced);
  if (scene < 6) return approach(progress, reduced);
  if (scene === 6) return blend(approach(0.75, reduced), SANCTUARY, t);
  return blend(SANCTUARY, {
    position: [VOLCANIC_TREE.x + 1, 13.5, VOLCANIC_TREE.z + 44],
    lookAt: [VOLCANIC_TREE.x, 10, VOLCANIC_TREE.z - 0.5],
  }, t);
}
