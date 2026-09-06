import { Color } from "three";

// Deliberately duplicated rather than imported from src/features/game/world —
// that module pulls in @react-three/rapier and heavy FBX/GLTF chains meant
// for gameplay, and this scene must stay light enough to mount at progress≈0.
// A full night-to-late-afternoon pass: the story opens in the dark and ends
// under a strongly orange sky right as the game becomes playable.
const KEYFRAMES = [
  { at: 0, sky: "#0d1330", fog: "#131a3a", sun: "#3a4a8f", sunIntensity: 0.25, hemi: 0.55 },
  { at: 0.32, sky: "#f0d9ad", fog: "#d9c398", sun: "#ffd9a0", sunIntensity: 2.2, hemi: 1.7 },
  { at: 0.68, sky: "#a9d9e8", fog: "#243e32", sun: "#ffe9c2", sunIntensity: 2.8, hemi: 2.1 },
  { at: 1, sky: "#e2712f", fog: "#7a3a24", sun: "#ff9552", sunIntensity: 2.2, hemi: 1.3 },
] as const;

function segment(t: number) {
  for (let i = 1; i < KEYFRAMES.length; i++) {
    if (t <= KEYFRAMES[i].at) {
      const a = KEYFRAMES[i - 1];
      const b = KEYFRAMES[i];
      const span = b.at - a.at || 1;
      return { a, b, local: (t - a.at) / span };
    }
  }
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  return { a: last, b: last, local: 0 };
}

const skyA = new Color();
const skyB = new Color();
const fogA = new Color();
const fogB = new Color();
const sunA = new Color();
const sunB = new Color();

export function atmosphereColors(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const { a, b, local } = segment(t);
  skyA.set(a.sky);
  skyB.set(b.sky);
  fogA.set(a.fog);
  fogB.set(b.fog);
  return {
    sky: skyA.clone().lerp(skyB, local),
    fog: fogA.clone().lerp(fogB, local),
  };
}

export function atmosphereLighting(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const { a, b, local } = segment(t);
  sunA.set(a.sun);
  sunB.set(b.sun);
  return {
    sunColor: sunA.clone().lerp(sunB, local),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * local,
    hemiIntensity: a.hemi + (b.hemi - a.hemi) * local,
  };
}
