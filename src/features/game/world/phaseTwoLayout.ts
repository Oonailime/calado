import { MathUtils } from "three";
import type { CharacterId, Vec3 } from "../types";

export const PHASE_TWO_TREE = [-6, 2] as const;
export const PHASE_TWO_TABLE = [0, 5] as const;
export const PHASE_TWO_CHESS_SCALE = 0.48;
// The armies face one another along Z; the seats belong behind their back ranks.
export const PHASE_TWO_STOOLS = [-1, 1].map((side) => ({
  x: PHASE_TWO_TABLE[0],
  z: PHASE_TWO_TABLE[1] + side * 2.35 * PHASE_TWO_CHESS_SCALE,
  radius: 0.67 * PHASE_TWO_CHESS_SCALE,
  halfHeight: 0.44 * PHASE_TWO_CHESS_SCALE,
}));
// Viewed from the light army (negative Z), files run from +X to -X.
// The queen occupies her own color: light at (column 4, row 0), dark at (4, 7).
export const PHASE_TWO_CHESS_BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "king",
  "queen",
  "bishop",
  "knight",
  "rook",
] as const;
export const PHASE_TWO_VOLCANOES = [
  { x: 8, z: -102, radius: 37, height: 62, seed: 3 },
  { x: -23, z: -53, radius: 25, height: 34, seed: 7 },
  { x: -67, z: -93, radius: 29, height: 40, seed: 11 },
  { x: 68, z: -91, radius: 28, height: 36, seed: 19 },
  { x: 34, z: -48, radius: 17, height: 23, seed: 23 },
  { x: -88, z: -39, radius: 22, height: 25, seed: 31 },
  { x: 67, z: -6, radius: 23, height: 30, seed: 41 },
  { x: 105, z: -127, radius: 32, height: 42, seed: 47 },
] as const;

export function phaseTwoRandom(seed: number) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function phaseTwoNoise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const fx = MathUtils.smoothstep(x - ix, 0, 1);
  const fz = MathUtils.smoothstep(z - iz, 0, 1);
  const at = (a: number, b: number) => phaseTwoRandom(a * 17.13 + b * 93.71);
  return MathUtils.lerp(
    MathUtils.lerp(at(ix, iz), at(ix + 1, iz), fx),
    MathUtils.lerp(at(ix, iz + 1), at(ix + 1, iz + 1), fx),
    fz,
  );
}

export function phaseTwoGroundHeight(x: number, z: number) {
  const rough =
    (phaseTwoNoise(x * 0.1, z * 0.1) - 0.5) * 5 +
    (phaseTwoNoise(x * 0.37, z * 0.37) - 0.5) * 1.1;
  let height = -4 + rough;
  for (const v of PHASE_TWO_VOLCANOES) {
    const dx = x - v.x,
      dz = z - v.z;
    const angle = Math.atan2(dz, dx);
    const distance = Math.hypot(dx, dz);
    const radius =
      v.radius *
      (1 + Math.sin(angle * 7 + v.seed) * 0.08 + Math.cos(angle * 13) * 0.045);
    const t = distance / radius;
    const slope = Math.pow(Math.max(0, 1 - t), 1.35);
    const crater = 1 - 0.32 * (1 - MathUtils.smoothstep(t, 0.035, 0.14));
    const ridges =
      Math.sin(angle * 19 + t * 8 + v.seed) *
      Math.sin(Math.min(1, t) * Math.PI) *
      2.4;
    height = Math.max(
      height,
      -4 + v.height * slope * crater + (t < 1 ? ridges + rough * t : 0),
    );
  }
  // A flat sanctuary blends into a steep rocky escarpment, with a walkable rear approach.
  const clearing =
    1 - MathUtils.smoothstep(Math.hypot((x + 4) / 1.25, z - 5), 9, 14);
  return MathUtils.lerp(height, 6 + Math.sin(x * 0.4) * 0.035, clearing);
}

export function phaseTwoCharacterSpawn(id: CharacterId): Vec3 {
  const x = (id - 1) * 2;
  const z = 11 + (id === 0 ? 0.5 : 0);
  return { x, y: phaseTwoGroundHeight(x, z) + 0.65, z };
}

export function phaseTwoOutsideMap(position: Vec3) {
  return (
    position.y < -24 ||
    Math.abs(position.x) > 132 ||
    position.z < -158 ||
    position.z > 62
  );
}
