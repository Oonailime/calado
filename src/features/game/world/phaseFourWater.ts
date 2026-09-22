import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, MathUtils, Vector3 } from "three";
import { PHASE_FOUR_RIVER, PHASE_FOUR_UPPER_RIVER } from "./phaseFourLayout";

/** One surface and one flow clock from the off-map source through the falls to the outlet. */
export const CANOPY_WATER_CURVE = new CatmullRomCurve3([
  ...PHASE_FOUR_UPPER_RIVER,
  [14, 12.7, -42], [14, 12.1, -40.6], [14, 9, -39.6],
  [14, 2, -38.7], [14, -3.9, -37.4],
  ...PHASE_FOUR_RIVER,
].map(p => new Vector3(...p)), false, "centripetal");
CANOPY_WATER_CURVE.arcLengthDivisions = 2400;

export function createCanopyWaterGeometry() {
  const rows = 1200, cols = 12;
  const positions: number[] = [], uvs: number[] = [], falling: number[] = [], indices: number[] = [];
  const length = CANOPY_WATER_CURVE.getLength();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const p = CANOPY_WATER_CURVE.getPointAt(t);
    const tangent = CANOPY_WATER_CURVE.getTangentAt(t);
    const horizontal = Math.max(0.001, Math.hypot(tangent.x, tangent.z));
    const fall = MathUtils.smoothstep(-tangent.y, 0.06, 0.8);
    const downstream = MathUtils.smoothstep(p.z, -38, -29);
    const width = MathUtils.lerp(6.5, 8.8 + Math.sin(p.z * 0.12) * 0.8, downstream);
    for (let col = 0; col <= cols; col++) {
      const u = col / cols;
      positions.push(p.x + tangent.z / horizontal * (u - 0.5) * width, p.y,
        p.z - tangent.x / horizontal * (u - 0.5) * width);
      uvs.push(u, t * length * 0.12);
      falling.push(fall);
      if (row < rows && col < cols) {
        const a = row * (cols + 1) + col, b = a + cols + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aFalling", new Float32BufferAttribute(falling, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
