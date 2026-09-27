import {
  BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute,
  IcosahedronGeometry, MathUtils, Matrix4, Quaternion, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  createPhaseTwoTerrain, createPhaseTwoRocks, createPhaseTwoLava,
  createPhaseTwoTrees, createPhaseTwoLantern,
} from "@/features/game/world/phaseTwoAssets";
import {
  PHASE_TWO_TREE, phaseTwoGroundHeight, phaseTwoNoise,
  phaseTwoRandom as random,
} from "@/features/game/world/phaseTwoLayout";
import { pathSegments } from "./cameraRig";
import { VOLCANIC_CHESS, VOLCANIC_ROUTE, VOLCANIC_STORY_SCALE, VOLCANIC_TREE } from "./volcanicStoryRoute";

// design2 walks its own, longer route (volcanicStoryRoute.ts).
const PATH_POINTS = VOLCANIC_ROUTE.points;
const CONVERGENCE_POINT = VOLCANIC_ROUTE.convergence;
const ROUTE_MAX_X = Math.max(...PATH_POINTS.map(point => point.x));

// The meeting point, as seen from the camera: the cherry at the centre, at
// phase 2's size relative to the monkeys; the chess table beside it on the
// right, where Mizaru and Kikazaru play and Calado comes to watch; the fire
// in the lower left.
export const STORY_CHERRY_SCALE = VOLCANIC_STORY_SCALE;
export const STORY_CHERRY = VOLCANIC_TREE;
export const STORY_CHESS = VOLCANIC_CHESS;
export const STORY_HEARTH = { x: STORY_CHERRY.x - 6, z: STORY_CHERRY.z + 10 };
// One flat plateau holds all of it: the tree's roots, the table and its
// stools, and the fire.
const PLATEAU = { x: STORY_CHERRY.x + 3, z: STORY_CHERRY.z + 3.5 };
const PLATEAU_FLAT = 17;
const PLATEAU_EDGE = 23;

// The volcanic valley keeps its authored relief. Only the narrative's
// walking corridor and building foundations are raised to the story floor.
// Phase 2's cherry lands on the story's cherry (so its clearing and ramp
// surround the meeting point again), and the valley is turned around it so
// the long walk of houses runs over open ground: no lava river or volcano
// lies along it (see tests/volcanic-story.test.ts).
export const VALLEY_OFFSET = { y: -6 };
export const VALLEY_ROTATION = MathUtils.degToRad(85);
const VALLEY_COS = Math.cos(VALLEY_ROTATION), VALLEY_SIN = Math.sin(VALLEY_ROTATION);
/** A point of the phase 2 map, in story coordinates. */
export function valleyToStory(x: number, z: number) {
  const dx = x - PHASE_TWO_TREE[0], dz = z - PHASE_TWO_TREE[1];
  return {
    x: STORY_CHERRY.x + dx * VALLEY_COS + dz * VALLEY_SIN,
    z: STORY_CHERRY.z - dx * VALLEY_SIN + dz * VALLEY_COS,
  };
}
/** A story point, in the phase 2 map's coordinates. */
export function storyToValley(x: number, z: number) {
  const dx = x - STORY_CHERRY.x, dz = z - STORY_CHERRY.z;
  return {
    x: PHASE_TWO_TREE[0] + dx * VALLEY_COS - dz * VALLEY_SIN,
    z: PHASE_TWO_TREE[1] + dx * VALLEY_SIN + dz * VALLEY_COS,
  };
}
function onPlateau(x: number, z: number, margin = 0) {
  return Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU_FLAT + margin;
}
const WALK = [...PATH_POINTS, CONVERGENCE_POINT];
// Flat ground under each (larger) house.
function houseRadius(index: number) {
  return (index === 4 ? 4.3 : 3.2) * VOLCANIC_STORY_SCALE;
}

export function storyRouteDistance(x: number, z: number) {
  let distance = Infinity;
  for (let i = 0; i < WALK.length - 1; i++) {
    const a = WALK[i], b = WALK[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return distance;
}

function shelfWeight(x: number, z: number) {
  let weight = 1 - MathUtils.smoothstep(storyRouteDistance(x, z), 2.2, 6.3);
  for (const [index, point] of PATH_POINTS.entries()) {
    const radius = houseRadius(index);
    weight = Math.max(weight, 1 - MathUtils.smoothstep(Math.hypot(x - point.x, z - point.z), radius, radius + 3.5));
  }
  weight = Math.max(weight, 1 - MathUtils.smoothstep(Math.hypot(x - PLATEAU.x, z - PLATEAU.z), PLATEAU_FLAT, PLATEAU_EDGE));
  return weight;
}

export function volcanicStoryGround(x: number, z: number) {
  const valley = storyToValley(x, z);
  const source = phaseTwoGroundHeight(valley.x, valley.z);
  const crags = (phaseTwoNoise(x * 0.75, z * 0.75) - 0.5) * 2.5
    + (phaseTwoNoise(x * 0.24, z * 0.24) - 0.5) * 3;
  const base = source + VALLEY_OFFSET.y + crags * MathUtils.smoothstep(source, 3, 15);
  return MathUtils.lerp(base, -0.045, shelfWeight(x, z));
}

// Same placement as valleyToStory: phase 2's cherry onto the story's,
// turned by VALLEY_ROTATION, and lowered to the story floor.
function translateValley(geometry: BufferGeometry) {
  geometry.translate(-PHASE_TWO_TREE[0], 0, -PHASE_TWO_TREE[1]);
  geometry.rotateY(VALLEY_ROTATION);
  geometry.translate(STORY_CHERRY.x, VALLEY_OFFSET.y, STORY_CHERRY.z);
  return geometry;
}

// Cut background decoration out of the route rather than lifting it into
// the monkey or a doorway. This operates on fresh generated geometry only.
function clearRoute(geometry: BufferGeometry, clearance: number, clearSlopes = false) {
  const p = geometry.getAttribute("position");
  const indices: number[] = [];
  const source = geometry.index;
  const count = source?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const a = source ? source.getX(i) : i;
    const b = source ? source.getX(i + 1) : i + 1;
    const c = source ? source.getX(i + 2) : i + 2;
    const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
    const z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    if (storyRouteDistance(x, z) > clearance && (!clearSlopes || volcanicStoryGround(x, z) < 2)
      && !onPlateau(x, z, 1)) indices.push(a, b, c);
  }
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function colorGeometry(g: BufferGeometry, hex: string) {
  const color = new Color(hex);
  const values = new Float32Array(g.getAttribute("position").count * 3);
  for (let i = 0; i < values.length; i += 3) {
    values[i] = color.r; values[i + 1] = color.g; values[i + 2] = color.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(values, 3));
  g.deleteAttribute("uv");
  return g;
}

function merge(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

function rock(seed: number, size: number) {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const rough = 0.82 + phaseTwoNoise(p.getX(i) * 4 + seed, p.getZ(i) * 4) * 0.34;
    p.setXYZ(i, p.getX(i) * rough, p.getY(i) * rough, p.getZ(i) * rough);
  }
  g.scale(size, size * (0.45 + random(seed + 31) * 0.4), size * 0.75);
  g.rotateY(seed);
  g.computeVertexNormals();
  return colorGeometry(g, ["#454548", "#555458", "#36373b", "#605b59"][seed % 4]);
}

function foregroundRocks() {
  const parts: BufferGeometry[] = [];
  // Same density as before over the longer, wider walk.
  const width = ROUTE_MAX_X + 44;
  const depth = 37 - STORY_CHERRY.z;
  const count = Math.round(580 * (width * depth) / (52 * 101));
  for (let i = 0; i < count; i++) {
    const x = -21 + random(i * 3 + 2) * width;
    const z = 13 - random(i * 3 + 3) * depth;
    if (storyRouteDistance(x, z) < 2.6 * VOLCANIC_STORY_SCALE) continue;
    if (PATH_POINTS.some((p, index) => Math.hypot(x - p.x, z - p.z) < houseRadius(index) + 0.6)) continue;
    if (onPlateau(x, z, 1)) continue;
    const size = 0.13 + Math.pow(random(i * 3 + 4), 3) * 1.4;
    const g = rock(i, size);
    g.translate(x, volcanicStoryGround(x, z) + size * 0.1, z);
    parts.push(g);
  }
  return merge(parts);
}

function stonePath() {
  const parts: BufferGeometry[] = [];
  // Larger stones, spaced to match, clear of the larger houses.
  pathSegments(VOLCANIC_ROUTE).forEach(([a, b], segment) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const count = Math.ceil(length / (1.12 * VOLCANIC_STORY_SCALE));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const g = rock(segment * 37 + i, 0.65 * VOLCANIC_STORY_SCALE);
      g.scale(1, 0.12, 1.3);
      g.rotateY(Math.atan2(b.x - a.x, b.z - a.z));
      g.translate(a.x + (b.x - a.x) * t, -0.025, a.z + (b.z - a.z) * t);
      parts.push(g);
    }
  });
  return merge(parts);
}

function hearth() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 15; i++) {
    const a = i / 15 * Math.PI * 2;
    const g = rock(i, 0.23 + random(i) * 0.06);
    g.translate(Math.cos(a) * 0.78, 0.09, Math.sin(a) * 0.78);
    parts.push(g);
  }
  for (let i = 0; i < 4; i++) {
    const g = colorGeometry(new CylinderGeometry(0.09, 0.14, 1.1, 9).toNonIndexed(), "#32231e");
    g.applyMatrix4(new Matrix4().compose(new Vector3(0, 0.16 + i * 0.025, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2), new Vector3(1, 1, 1)));
    g.rotateY(i * 1.8);
    parts.push(g);
  }
  return merge(parts);
}

// Phase 2's blossom geometry also carries its fallen petals: a carpet on the
// ground round the tree and a trail down the spiral ramp, both at phase 2's
// ground heights. Moved and scaled onto the story's cherry, those would float
// or sink, so the carpet is laid back onto the story ground and the ramp
// trail (which belongs to phase 2's ramp, not this tree) is left out.
// `blossoms` is already centred on the tree's base (see the caller).
const FALLEN_PETAL_RADIUS = 12.5;
function settleFallenPetals(blossoms: BufferGeometry, tx: number, ty: number, tz: number) {
  const source = blossoms.index ? blossoms.toNonIndexed() : blossoms;
  const names = Object.keys(source.attributes);
  const kept: Record<string, number[]> = Object.fromEntries(names.map(name => [name, []]));
  const p = source.getAttribute("position");
  const groundUnder = (x: number, z: number) => phaseTwoGroundHeight(tx + x, tz + z) - ty;
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const fallen = cy - groundUnder(cx, cz) < 0.3;
    if (fallen && Math.hypot(cx, cz) > FALLEN_PETAL_RADIUS) continue;
    for (let v = i; v < i + 3; v++) {
      for (const name of names) {
        const attribute = source.getAttribute(name);
        for (let c = 0; c < attribute.itemSize; c++) kept[name].push(attribute.getComponent(v, c));
      }
      if (!fallen) continue;
      // Same small lift over the ground as in phase 2, now over the story
      // ground below the (scaled, moved) tree group.
      const x = p.getX(v), z = p.getZ(v);
      // The cupped petal's underside never dips below the ground.
      const lift = Math.max(0.01, p.getY(v) - groundUnder(x, z));
      const story = volcanicStoryGround(
        STORY_CHERRY.x + x * STORY_CHERRY_SCALE,
        STORY_CHERRY.z + z * STORY_CHERRY_SCALE,
      );
      const positions = kept.position;
      positions[positions.length - 2] = (story + 0.035) / STORY_CHERRY_SCALE + lift;
    }
  }
  const result = new BufferGeometry();
  for (const name of names) {
    const attribute = source.getAttribute(name);
    result.setAttribute(name, new Float32BufferAttribute(kept[name], attribute.itemSize));
  }
  result.computeBoundingSphere();
  if (source !== blossoms) source.dispose();
  blossoms.dispose();
  return result;
}

export function createVolcanicStoryAssets() {
  const terrain = translateValley(createPhaseTwoTerrain());
  const p = terrain.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setY(i, volcanicStoryGround(p.getX(i), p.getZ(i)));
  terrain.computeVertexNormals();
  terrain.computeBoundingSphere();

  // Match the actual terrain triangles, including the additional crags, so
  // lava follows the surface instead of floating over the slopes.
  const surface = (x: number, z: number) => {
    const valley = storyToValley(x, z);
    const u = MathUtils.clamp((valley.x + 220) / 440 * 300, 0, 299.999);
    const v = MathUtils.clamp((valley.z + 260) / 520 * 300, 0, 299.999);
    const col = Math.floor(u), row = Math.floor(v), fx = u - col, fz = v - row;
    const a = row * 301 + col, b = a + 301;
    return fx + fz <= 1
      ? p.getY(a) + (p.getY(a + 1) - p.getY(a)) * fx + (p.getY(b) - p.getY(a)) * fz
      : p.getY(b + 1) + (p.getY(b) - p.getY(b + 1)) * (1 - fx) + (p.getY(a + 1) - p.getY(b + 1)) * (1 - fz);
  };
  const lava = translateValley(createPhaseTwoLava());
  const lp = lava.getAttribute("position");
  for (let i = 0; i < lp.count; i += 2) {
    const cx = (lp.getX(i) + lp.getX(i + 1)) / 2, cz = (lp.getZ(i) + lp.getZ(i + 1)) / 2;
    for (let side = 0; side < 2; side++) {
      const index = i + side;
      const x = MathUtils.lerp(cx, lp.getX(index), 0.7), z = MathUtils.lerp(cz, lp.getZ(index), 0.7);
      lp.setXYZ(index, x, surface(x, z) + 0.065, z);
    }
  }
  lava.computeVertexNormals();
  lava.computeBoundingSphere();

  const trees = createPhaseTwoTrees();
  // Normalize the actual phase-two cherry, including its individual blossoms.
  const tx = PHASE_TWO_TREE[0], tz = PHASE_TWO_TREE[1];
  const ty = phaseTwoGroundHeight(tx, tz);
  for (const g of [trees.bark, trees.blossoms, trees.petalSources]) g.translate(-tx, -ty, -tz);
  const lantern = createPhaseTwoLantern();
  lantern.translate(-2.3, -phaseTwoGroundHeight(2.3, 3), -3);
  return {
    terrain,
    rocks: clearRoute(translateValley(createPhaseTwoRocks()), 6, true),
    dead: clearRoute(translateValley(trees.dead), 7),
    lava,
    bark: trees.bark,
    blossoms: settleFallenPetals(trees.blossoms, tx, ty, tz),
    petalSources: trees.petalSources,
    lantern,
    foreground: foregroundRocks(),
    path: stonePath(),
    hearth: hearth(),
  };
}
