import type { CharacterId } from "../types";

export type MonkeySurface =
  "fur" | "face" | "eye" | "eyeWhite" | "paw" | "innerEar" | "mouth";

export type BoneInfluence = { name: string; weight: number };

export const MONKEY_FACE_COLORS = ["#e9c98d", "#9da39d", "#d5a06e"] as const;
export const MONKEY_DETAIL_COLOR = "#303435";
export const MONKEY_EYE_COLOR = "#111514";
export const MONKEY_EYE_WHITE = "#f3efdc";

export type PowerPoseHand = "left" | "right";
export type PowerPoseGesture = "eyes" | "ears" | "mouth";
export const MONKEY_POWER_POSES: readonly {
  gesture: PowerPoseGesture;
  hands: readonly PowerPoseHand[];
}[] = [
  { gesture: "eyes", hands: ["left", "right"] },
  { gesture: "ears", hands: ["left", "right"] },
  { gesture: "mouth", hands: ["right"] },
];

const POWER_POSE_RESPONSE = 7;
export function nextPowerPoseBlend(
  current: number,
  active: boolean,
  delta: number,
) {
  const target = active ? 1 : 0;
  return target + (current - target) * Math.exp(-POWER_POSE_RESPONSE * delta);
}

function weightOf(
  influences: BoneInfluence[],
  match: (name: string) => boolean,
) {
  return influences.reduce(
    (total, influence) =>
      total + (match(influence.name) ? influence.weight : 0),
    0,
  );
}

export function classifyMonkeySurface({
  influences,
  sourceBrightness,
  x,
  y,
  z,
}: {
  influences: BoneInfluence[];
  sourceBrightness: number;
  x: number;
  y: number;
  z: number;
}): MonkeySurface {
  const paw = weightOf(influences, (name) =>
    /^(Hand|Foot_(?:thum|[LR]00[1-3]))/.test(name),
  );
  if (paw > 0.35) return "paw";

  const eye = weightOf(influences, (name) => name.startsWith("eye_"));
  if (eye > 0.25) return sourceBrightness > 0.2 ? "eyeWhite" : "eye";

  const mouth = weightOf(influences, (name) => name === "mouth");
  if (mouth > 0.3) return "mouth";

  const ear = weightOf(influences, (name) => name.startsWith("ear_"));
  if (ear > 0.35 && sourceBrightness < 0.25) return "innerEar";

  const head = weightOf(influences, (name) => name === "Head");
  if (
    head > 0.25 &&
    sourceBrightness > 0.25 &&
    y > 1.29 &&
    z > 0.015 &&
    Math.abs(x) < 0.13
  )
    return "face";

  return "fur";
}

export function monkeySurfaceColor(surface: MonkeySurface, id: CharacterId) {
  if (surface === "face") return MONKEY_FACE_COLORS[id];
  if (surface === "eyeWhite") return MONKEY_EYE_WHITE;
  if (surface === "eye") return MONKEY_EYE_COLOR;
  if (surface === "paw" || surface === "innerEar" || surface === "mouth")
    return MONKEY_DETAIL_COLOR;
  return null;
}

export function monkeyAnimation(
  grounded: boolean,
  speed: number,
  currentlyRunning: boolean,
) {
  const threshold = currentlyRunning ? 0.12 : 0.55;
  return !grounded || speed > threshold ? "run" : "idle";
}
