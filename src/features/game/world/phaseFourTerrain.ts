import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  MathUtils,
  Vector3,
} from "three";
import type { Vec3 } from "../types";
import { PHASE_FOUR_FEET_OFFSET, PHASE_FOUR_RIVER, PHASE_FOUR_UPPER_RIVER } from "./phaseFourLayout";

const river = new CatmullRomCurve3(
  PHASE_FOUR_RIVER.map((p) => new Vector3(...p)),
);
const riverSamples = river.getSpacedPoints(240);
const upperRiverSamples = new CatmullRomCurve3(
  PHASE_FOUR_UPPER_RIVER.map((p) => new Vector3(...p)),
).getSpacedPoints(180);

function riverDistance(x: number, z: number, samples = riverSamples) {
  let squared = Infinity;
  for (const p of samples)
    squared = Math.min(squared, (x - p.x) ** 2 + (z - p.z) ** 2);
  return Math.sqrt(squared);
}

// The map's single cliff (the "penhasco") is this transition band: ground
// height jumps from the valley up to the plateau over a narrow strip of z,
// which is also where the waterfall sits. Shared by height and ground color
// so the visible rock face lines up with where the slope actually is steep.
export function phaseFourCliffBlend(z: number) {
  return MathUtils.smoothstep(-z, 38.4, 41.5);
}

export function phaseFourGroundHeight(x: number, z: number) {
  const distance = riverDistance(x, z);
  const bank = MathUtils.smoothstep(distance, 3.5, 7.1);
  const hills =
    Math.sin(x * 0.11) * Math.cos(z * 0.085) * 0.6 +
    Math.sin(x * 0.25 + z * 0.17) * 0.22;
  const valley = -7.5 + bank * (3.7 + hills);
  const plateauBlend = phaseFourCliffBlend(z);
  const upperBank = MathUtils.smoothstep(
    riverDistance(x, z, upperRiverSamples),
    3.2,
    6.2,
  );
  const plateau = 11.4 + upperBank * (2.6 + hills * 0.4);
  return valley + (plateau - valley) * plateauBlend;
}

export function createPhaseFourGroundGeometry() {
  const segments = 144,
    size = 210;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const earth = new Color("#365b2b"),
    grass = new Color("#4f7033"),
    sunGrass = new Color("#628b39"),
    cliff = new Color("#6b5847"),
    color = new Color();
  for (let row = 0; row <= segments; row++) {
    const z = -112 + (row * size) / segments;
    for (let col = 0; col <= segments; col++) {
      const x = -size / 2 + (col * size) / segments,
        distance = riverDistance(x, z);
      const patches =
        (Math.sin(x * 0.31 + Math.cos(z * 0.19)) +
          Math.cos(z * 0.25 - x * 0.15)) *
          0.25 +
        0.5;
      color
        .copy(earth)
        .lerp(
          grass,
          MathUtils.smoothstep(distance, 5, 12) * (0.48 + patches * 0.52),
        );
      color.lerp(sunGrass, MathUtils.smoothstep(patches, 0.62, 0.95) * 0.36);
      // The cliff face itself is the steep middle of the valley->plateau
      // transition, not its flat top or bottom - a bare rock-and-earth band
      // instead of grass green, peaking exactly where the slope is steepest.
      const cliffBlend = phaseFourCliffBlend(z);
      color.lerp(cliff, 4 * cliffBlend * (1 - cliffBlend));
      positions.push(x, phaseFourGroundHeight(x, z), z);
      colors.push(color.r, color.g, color.b);
      if (row < segments && col < segments) {
        const a = row * (segments + 1) + col,
          b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Ground is lethal, including the upper river bank above the old fall cutoff. */
export function phaseFourTouchesGround(position: Vec3) {
  return position.y - PHASE_FOUR_FEET_OFFSET <= phaseFourGroundHeight(position.x, position.z) + 0.18;
}
