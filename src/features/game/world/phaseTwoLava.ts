import { CatmullRomCurve3, Vector3 } from "three";
import type { Vec3 } from "../types";
import {
  PHASE_TWO_LAVA_SEA_LEVEL,
  PHASE_TWO_VOLCANOES,
  phaseTwoGroundHeight,
  phaseTwoRouteProjection,
} from "./phaseTwoLayout";
type Point = [number, number, number];
type Edge = { x: number; z: number; y: number };
export const PHASE_TWO_LAVA_STRIPS: Edge[][] = [];
// The hand-authored rivers below were just floating paths with no volcanic
// source — extend whichever end sits closest to a volcano back to that
// volcano's own slope, so every river visibly originates from one instead of
// starting nowhere in the open terrain.
function nearestVolcanoEdge(x: number, z: number) {
  let best: { x: number; z: number; d: number } | null = null;
  for (const v of PHASE_TWO_VOLCANOES) {
    const d = Math.hypot(x - v.x, z - v.z);
    if (!best || d < best.d) {
      const angle = Math.atan2(z - v.z, x - v.x);
      best = {
        x: v.x + Math.cos(angle) * v.radius * 0.16,
        z: v.z + Math.sin(angle) * v.radius * 0.16,
        d,
      };
    }
  }
  return best!;
}
function withVolcanicOrigin(points: Point[]): Point[] {
  const [fx, , fz] = points[0],
    [lx, , lz] = points[points.length - 1];
  const nearFirst = nearestVolcanoEdge(fx, fz),
    nearLast = nearestVolcanoEdge(lx, lz);
  return nearFirst.d <= nearLast.d
    ? [[nearFirst.x, 0, nearFirst.z], ...points]
    : [...points, [nearLast.x, 0, nearLast.z]];
}
// Raw terrain height carries the volcano craters' ridge noise (up to ±2.4
// units) directly — sampling it at every point along an otherwise-smooth
// ribbon curve made stretches of lava visibly climb back uphill. Averaging
// each edge's height with its neighbors along the curve keeps the ribbon
// following the terrain's overall slope without the local noise.
const SMOOTH_RADIUS = 3;
function smoothed(raw: number[]) {
  return raw.map((_, s) => {
    let sum = 0, count = 0;
    for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
      const idx = s + k;
      if (idx < 0 || idx >= raw.length) continue;
      sum += raw[idx];
      count++;
    }
    return sum / count;
  });
}
function ribbon(points: Point[], width: number) {
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)));
  const xz: { x: number; z: number }[][] = [[], []];
  for (let i = 0; i <= 180; i++) {
    const t = i / 180, p = curve.getPoint(t), tangent = curve.getTangent(t);
    // Width used to stay constant right up to the very ends, cutting off
    // straight rather than narrowing to a point the way a real flow thins
    // out — taper it over the first/last 8% of the curve.
    const taper = Math.min(1, t / 0.08, (1 - t) / 0.08);
    const w = width * (0.8 + Math.sin(t * 47) * 0.18) * taper;
    for (let side = 0; side < 2; side++)
      xz[side].push({
        x: p.x + tangent.z * (side - 0.5) * w,
        z: p.z - tangent.x * (side - 0.5) * w,
      });
  }
  // The same smoothed height feeds both the visual mesh (createPhaseTwoLava)
  // and the collision lookup below, so a character can never die to lava
  // that isn't actually visible at their feet (or survive standing in lava
  // that is) — the two used to be computed independently and could drift
  // apart wherever the terrain wasn't already flat.
  const heights = xz.map((side) =>
    smoothed(side.map((point) => phaseTwoGroundHeight(point.x, point.z))),
  );
  const strip: Edge[] = [];
  for (let s = 0; s < xz[0].length; s++)
    for (let side = 0; side < 2; side++)
      strip.push({ x: xz[side][s].x, z: xz[side][s].z, y: heights[side][s] });
  PHASE_TWO_LAVA_STRIPS.push(strip);
}
  ribbon(
    withVolcanicOrigin([
      [45, 0, -117],
      [39, 0, -89],
      [50, 0, -64],
      [22, 0, -36],
      // These two used to belly in toward (31,-18) and (36,5), passing
      // within ~8.5 units of the ramp's own starting point — pushed further
      // east/south to clear it while keeping the same overall river shape.
      [24, 0, -30],
      [30, 0, -12],
      [40, 0, 14],
      [45, 0, 37],
      [57, 0, 63],
    ]),
    1.8,
  );
  // Used to curve straight toward the clearing (ending at 19,-3, right where
  // both the approach line and the ramp's start pass) — redirected further
  // southwest instead. The ramp spirals 1.5 turns out to a 30-unit radius
  // around the clearing (-4,5), so a modest redirect still swept back through
  // part of that circle; these points all sit outside it by a clear margin.
  ribbon(
    withVolcanicOrigin([
      [18, 0, -34],
      [0, 0, -30],
      [-12, 0, -34],
      [-24, 0, -40],
    ]),
    0.8,
  );
  for (const v of PHASE_TWO_VOLCANOES) {
    for (let j = 0; j < 4; j++) {
      const a = j * 1.8 + v.seed;
      const points: Point[] = [];
      for (let k = 0; k < 8; k++) {
        // Starts inside the crater-glow decal's own radius (0.075 — see the
        // circleGeometry in PhaseTwo.tsx) instead of just outside it, so the
        // ribbon visibly emerges from the glowing crater instead of picking
        // up partway down the outer slope.
        const r = v.radius * (0.055 + k * 0.11),
          angle = a + Math.sin(k * 1.6 + v.seed) * 0.07;
        points.push([v.x + Math.cos(angle) * r, 0, v.z + Math.sin(angle) * r]);
      }
      ribbon(points, j === 0 ? 0.85 : 0.24);
    }
  }
  ribbon(withVolcanicOrigin([[94, 0, -46], [94, 0, -34], [98, 0, -21]]), 1.1);
  ribbon(withVolcanicOrigin([[72, 0, -45], [73, 0, -33], [78, 0, -20]]), 1.2);

// Index the same triangles used by the renderer, so even narrow veins hurt.
type Triangle = [Edge, Edge, Edge];
const cells = new Map<string, Triangle[]>();
for (const strip of PHASE_TWO_LAVA_STRIPS) {
  for (let i = 0; i < strip.length - 2; i += 2) {
    const triangles: Triangle[] = [[strip[i], strip[i+2], strip[i+1]], [strip[i+1], strip[i+2], strip[i+3]]];
    for (const triangle of triangles) {
      const minX = Math.floor(Math.min(...triangle.map(p => p.x)) / 4), maxX = Math.floor(Math.max(...triangle.map(p => p.x)) / 4);
      const minZ = Math.floor(Math.min(...triangle.map(p => p.z)) / 4), maxZ = Math.floor(Math.max(...triangle.map(p => p.z)) / 4);
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${z}`;
        const bucket = cells.get(key) ?? [];
        bucket.push(triangle); cells.set(key, bucket);
      }
    }
  }
}
function triangleAt(x: number, z: number): Triangle | null {
  const bucket = cells.get(`${Math.floor(x/4)},${Math.floor(z/4)}`);
  if (!bucket) return null;
  for (const triangle of bucket) {
    const [a, b, c] = triangle;
    const cross = (p: Edge, q: Edge) => (x-q.x)*(p.z-q.z)-(p.x-q.x)*(z-q.z);
    const u = cross(a,b), v = cross(b,c), w = cross(c,a);
    if (!((u<0 || v<0 || w<0) && (u>0 || v>0 || w>0))) return triangle;
  }
  return null;
}
export function phaseTwoLavaAt(x: number, z: number) {
  return triangleAt(x, z) !== null;
}
export function phaseTwoTouchesLava(p: Vec3) {
  // The walkable route (see phaseTwoGroundHeight's own path-carving) was
  // deliberately raised above the terrain to make a safe trail, but a lava
  // ribbon's horizontal footprint doesn't know that — it's a flat 2D lookup,
  // so a river crossing under the carved path still registered as lava at
  // that exact spot even once the ground there was lifted clear of it.
  // Nothing this close to the route's centerline should ever count as lava.
  if (phaseTwoRouteProjection(p.x, p.z).distance < 5) return false;
  const triangle = triangleAt(p.x, p.z);
  if (triangle) {
    // Compare against the lava's own baked height at this exact triangle,
    // not the player's — their own ground height is (by definition, while
    // grounded) always close to their own feet, so that comparison was
    // trivially satisfied almost everywhere a ribbon's flat footprint fell,
    // including terrain risen well above where the lava actually sits.
    const y = (triangle[0].y + triangle[1].y + triangle[2].y) / 3;
    if (p.y - 0.56 <= y + 0.21) return true;
  }
  // The sea (see createPhaseTwoLavaSea) is a flat plane covering the whole
  // map at PHASE_TWO_LAVA_SEA_LEVEL — no per-triangle lookup needed, since
  // anywhere the terrain itself is above that level already keeps a
  // standing character's feet above it too.
  return p.y - 0.56 <= PHASE_TWO_LAVA_SEA_LEVEL + 0.21;
}
export function phaseTwoFollowerJump(p: Vec3, dx: number, dz: number) {
  const length = Math.hypot(dx, dz);
  if (length < 0.1) return false;
  const x = dx/length, z = dz/length;
  const ahead = [0.45, 0.7, 0.95].some(d => phaseTwoLavaAt(p.x+x*d,p.z+z*d));
  return ahead && !phaseTwoLavaAt(p.x+x*2.9,p.z+z*2.9) &&
    phaseTwoGroundHeight(p.x+x*2.9,p.z+z*2.9) < phaseTwoGroundHeight(p.x,p.z) + 0.8;
}
