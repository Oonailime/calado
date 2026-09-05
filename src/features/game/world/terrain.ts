import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
} from "three";
import {
  BEACH_RAMP_SCALE,
  BEACH_BRIDGE_SCALE,
  BEACH_SHORE_Y,
  BRIDGE,
  ISLANDS,
  ISLAND_SURFACE_Y,
  ISLAND_THICKNESS,
} from "./layout";

export function organicIslandShape(
  halfWidth: number,
  halfDepth: number,
  seed: number,
  points = 26,
) {
  let state = seed;
  const shape = new Shape();
  for (let i = 0; i < points; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const random = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const angle = (i / points) * Math.PI * 2;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const radius = Math.min(halfWidth / Math.abs(c), halfDepth / Math.abs(s));
    const bulge = 1.12 + random * 0.28;
    const x = c * radius * bulge,
      y = s * radius * bulge;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// The very same mesh supplies the visible ground and Rapier's trimesh collider.
export function islandGeometry(shape: Shape) {
  return new ExtrudeGeometry(shape, {
    depth: ISLAND_THICKNESS,
    bevelEnabled: false,
    steps: 1,
  }).rotateX(-Math.PI / 2);
}

function outlinePoints(shape: Shape) {
  const points = shape.getPoints();
  const first = points[0];
  const last = points.at(-1);
  if (last && first.distanceToSquared(last) < 1e-8) points.pop();
  return points;
}

function beachScale(pointX: number, pointY: number, islandZ: number) {
  const length = Math.hypot(pointX, pointY) || 1;
  const bridgeDirection =
    islandZ > BRIDGE.z ? pointY / length : -pointY / length;
  // Keep the whole bridge-facing half narrow, otherwise the two beach rings
  // overlap laterally and make the islands read as one continuous landmass.
  const towardBridge = Math.max(
    0,
    Math.min(1, (bridgeDirection + 0.55) / 0.55),
  );
  const blend = towardBridge * towardBridge * (3 - 2 * towardBridge);
  return BEACH_RAMP_SCALE + (BEACH_BRIDGE_SCALE - BEACH_RAMP_SCALE) * blend;
}

export function beachRampGeometry(shape: Shape, islandZ: number) {
  const points = outlinePoints(shape);
  const positions: number[] = [];
  const indices: number[] = [];
  const outerScales: number[] = [];
  for (const point of points)
    positions.push(point.x, ISLAND_SURFACE_Y - 0.012, -point.y);
  for (const point of points) {
    const scale = beachScale(point.x, point.y, islandZ);
    const middleScale = 1 + (scale - 1) * 0.52;
    outerScales.push(scale);
    positions.push(point.x * middleScale, 0.48, -point.y * middleScale);
  }
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    positions.push(
      point.x * outerScales[i],
      BEACH_SHORE_Y,
      -point.y * outerScales[i],
    );
  }
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    indices.push(i, points.length + i, next);
    indices.push(next, points.length + i, points.length + next);
  }
  const dirtIndexCount = indices.length;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    indices.push(
      points.length + i,
      points.length * 2 + i,
      points.length + next,
    );
    indices.push(
      points.length + next,
      points.length * 2 + i,
      points.length * 2 + next,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.addGroup(0, dirtIndexCount, 0);
  geometry.addGroup(dirtIndexCount, indices.length - dirtIndexCount, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const outlines = ISLANDS.map((island) => ({
  ...island,
  // Rotating the shape -90 degrees around X turns its Y into world -Z.
  points: organicIslandShape(island.halfWidth, island.halfDepth, island.seed)
    .getPoints()
    .map((p) => ({ x: p.x + island.x, z: -p.y + island.z })),
}));

const beachOutlines = outlines.map((island) => ({
  ...island,
  points: island.points.map((point) => {
    const localX = point.x - island.x;
    const localShapeY = -(point.z - island.z);
    const scale = beachScale(localX, localShapeY, island.z);
    return {
      x: island.x + localX * scale,
      z: island.z - localShapeY * scale,
    };
  }),
}));

// Negative inside, positive outside; measured against the real organic outline.
function signedEdgeDistance(x: number, z: number, source: typeof outlines) {
  return Math.min(
    ...source.map(({ points }) => {
      let inside = false,
        distance = Infinity;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j],
          b = points[i];
        if (
          a.z > z !== b.z > z &&
          x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
        )
          inside = !inside;
        const dx = b.x - a.x,
          dz = b.z - a.z;
        const lengthSquared = dx * dx + dz * dz;
        const t = lengthSquared
          ? Math.max(
              0,
              Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared),
            )
          : 0;
        distance = Math.min(
          distance,
          Math.hypot(x - a.x - t * dx, z - a.z - t * dz),
        );
      }
      return inside ? -distance : distance;
    }),
  );
}

export function islandEdgeDistance(x: number, z: number) {
  return signedEdgeDistance(x, z, outlines);
}

export function beachEdgeDistance(x: number, z: number) {
  return signedEdgeDistance(x, z, beachOutlines);
}

export function safeGround(x: number, z: number, bridge: boolean) {
  return (
    beachEdgeDistance(x, z) <= -0.4 ||
    (bridge &&
      Math.abs(x) < BRIDGE.halfWidth - 0.3 &&
      Math.abs(z - BRIDGE.z) < BRIDGE.length / 2)
  );
}

export function waterDepth(x: number, z: number, bridge: boolean) {
  if (
    bridge &&
    Math.abs(x) <= BRIDGE.halfWidth &&
    Math.abs(z - BRIDGE.z) <= BRIDGE.length / 2
  )
    return 0;
  return Math.max(0, beachEdgeDistance(x, z));
}
