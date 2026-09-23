import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Curve,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { accelerateStaticRaycast } from "../camera/staticRaycast";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  PHASE_FOUR_PATHS,
  PHASE_FOUR_PLATFORMS,
  PHASE_FOUR_RIVER,
  PHASE_FOUR_UPPER_RIVER,
  PHASE_FOUR_TREES,
  PHASE_FOUR_PULL_VINE_CURVE,
  PHASE_FOUR_SWING_SITES,
  PHASE_FOUR_WATERFALL,
  type CanopyPath,
  type Point3,
} from "./phaseFourLayout";
import {
  createPhaseFourGroundGeometry,
  phaseFourGroundHeight,
} from "./phaseFourTerrain";

const UP = new Vector3(0, 1, 0);
const palette = {
  bark: ["#674126", "#815431", "#94663a", "#553522"],
  wood: ["#bc9254", "#a97a40", "#c9a368", "#95652f"],
  leaf: ["#24553a", "#387141", "#4d863c", "#6e9a3c", "#8aaa42"],
  moss: ["#6a8c27", "#89a638", "#54762b"],
  // Stone-and-earth mix for the waterfall's cliff face - no moss green here,
  // it reads as a rockface backdrop rather than another mossy boulder.
  cliff: ["#7a6650", "#6b5847", "#8c765c"],
};

export const PHASE_FOUR_VINE_LEAF_COLORS = palette.leaf;
export function createPhaseFourVineLeafGeometry() {
  return leafGeometry(0.48, 0.14, 0.2);
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const point = (p: Point3) => new Vector3(...p);

// Sitting a trunk exactly on phaseFourGroundHeight left its buttress-root
// flare (see giantTree) fully exposed with no earth covering any of it.
export const ROOT_EMBED_DEPTH = 0.45;
// Includes the tapered tip and the thickness of the buttress near the ground.
export const GIANT_TREE_ROOT_REACH = 4;
const riverBankSamples = new Map<readonly Point3[], Point3[]>(
  [PHASE_FOUR_RIVER, PHASE_FOUR_UPPER_RIVER].map((points) => [
    points,
    new CatmullRomCurve3(points.map(point)).getSpacedPoints(360)
      .map((p) => p.toArray() as Point3),
  ]),
);

function nearestPolylinePoint(x: number, z: number, points: readonly Point3[]) {
  let best = Infinity,
    bestX = x,
    bestZ = z;
  for (let i = 1; i < points.length; i++) {
    const [ax, , az] = points[i - 1],
      [bx, , bz] = points[i];
    const dx = bx - ax,
      dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t =
      lengthSquared > 0
        ? Math.max(
            0,
            Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared),
          )
        : 0;
    const px = ax + dx * t,
      pz = az + dz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < best) {
      best = distance;
      bestX = px;
      bestZ = pz;
    }
  }
  return { distance: best, x: bestX, z: bestZ };
}

// The shrine sits high and its own platform is small; a nearby background
// tree's canopy can visually swallow it. Generous horizontal clearance around
// its (x, z) keeps any tall decorative tree's crown out of that airspace.
const SUMMIT_SHRINE_XZ: [number, number] = [
  PHASE_FOUR_PLATFORMS.find((deck) => deck.id === "summit-shrine")!.center[0],
  PHASE_FOUR_PLATFORMS.find((deck) => deck.id === "summit-shrine")!.center[2],
];
const SUMMIT_SHRINE_CLEARANCE = 25;
function clearsSummitShrine(x: number, z: number) {
  return Math.hypot(x - SUMMIT_SHRINE_XZ[0], z - SUMMIT_SHRINE_XZ[1]) >= SUMMIT_SHRINE_CLEARANCE;
}

/** Keep the entire root spread beyond the widest water edge, plus a dry margin. */
function clearRiverBank(
  x: number,
  z: number,
  radius: number,
  points: readonly Point3[],
  minClearance = 6,
) {
  const samples = riverBankSamples.get(points) ?? points;
  const needed = radius * GIANT_TREE_ROOT_REACH + minClearance;
  // A push away from one bend can approach the next bend of the same river.
  for (let pass = 0; pass < 12; pass++) {
    const nearest = nearestPolylinePoint(x, z, samples);
    if (nearest.distance >= needed - 1e-5) break;
    const dx = nearest.distance > 1e-6 ? (x - nearest.x) / nearest.distance : 1;
    const dz = nearest.distance > 1e-6 ? (z - nearest.z) / nearest.distance : 0;
    x = nearest.x + dx * needed;
    z = nearest.z + dz * needed;
  }
  return [x, z];
}

/** Bake vertex colour/transforms once and keep each playable tree in one draw. */
class AssetBuilder {
  private batches = new Map<string, BufferGeometry[]>();
  private namespace = "";

  scoped(name: string, build: () => void) {
    const previous = this.namespace;
    this.namespace = name;
    try {
      build();
    } finally {
      this.namespace = previous;
    }
  }

  private batchKey(layer: string) {
    return this.namespace ? `${this.namespace}/${layer}` : layer;
  }

  add(
    geometry: BufferGeometry,
    color: string | null,
    position: Point3 = [0, 0, 0],
    scale: Point3 = [1, 1, 1],
    rotation = new Quaternion(),
    layer = "solid",
  ) {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geo !== geometry) geometry.dispose();
    geo.applyMatrix4(
      new Matrix4().compose(point(position), rotation, point(scale)),
    );
    geo.deleteAttribute("uv");
    if (color !== null) {
      const rgb = new Color(color);
      const count = geo.getAttribute("position").count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
      geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
    }
    const batchKey = this.batchKey(layer);
    const batch = this.batches.get(batchKey) ?? [];
    batch.push(geo);
    this.batches.set(batchKey, batch);
  }
  tube(
    points: Point3[],
    radius: number,
    color: string,
    segments = 12,
    layer = "solid",
  ) {
    this.add(
      new TubeGeometry(
        new CatmullRomCurve3(points.map(point)),
        segments,
        radius,
        6,
        false,
      ),
      color,
      undefined,
      undefined,
      undefined,
      layer,
    );
  }
  beam(
    a: Point3,
    b: Point3,
    radius: number,
    color: string,
    endRadius = radius,
    layer = "solid",
  ) {
    const start = point(a),
      end = point(b),
      axis = end.clone().sub(start);
    this.add(
      new CylinderGeometry(endRadius, radius, axis.length(), 8, 1),
      color,
      start.add(end).multiplyScalar(0.5).toArray() as Point3,
      undefined,
      new Quaternion().setFromUnitVectors(UP, axis.normalize()),
      layer,
    );
  }
  rock(
    position: Point3,
    scale: Point3,
    seed: number,
    moss = true,
    colors: readonly string[] = ["#5b6c5d", "#738071", "#879084"],
  ) {
    const rng = random(seed);
    const rotation = new Quaternion().setFromAxisAngle(UP, rng() * Math.PI);
    this.add(
      new IcosahedronGeometry(1, 1),
      colors[seed % colors.length],
      position,
      scale,
      rotation,
    );
    if (moss)
      this.add(
        new IcosahedronGeometry(1, 1),
        palette.moss[seed % 3],
        [position[0], position[1] + scale[1] * 0.78, position[2]],
        [scale[0] * 0.78, scale[1] * 0.22, scale[2] * 0.8],
        rotation,
        "foliage",
      );
  }
  finish(name: string) {
    const group = new Group();
    group.name = name;
    const namespaces = new Map<string, Group>();
    const drawBatches = new Map<
      string,
      { geometries: BufferGeometry[]; layers: Set<string>; namespace: string }
    >();
    for (const [batchKey, geometries] of this.batches) {
      const separator = batchKey.indexOf("/");
      const namespace = separator >= 0 ? batchKey.slice(0, separator) : "";
      const layer = batchKey.slice(batchKey.lastIndexOf("/") + 1);
      const drawKey = namespace || batchKey;
      const batch = drawBatches.get(drawKey) ?? {
        geometries: [],
        layers: new Set<string>(),
        namespace,
      };
      batch.geometries.push(...geometries);
      batch.layers.add(layer);
      drawBatches.set(drawKey, batch);
    }
    for (const [drawKey, batch] of drawBatches) {
      const hasSolid = batch.layers.has("solid");
      const geometry = mergeGeometries(batch.geometries, false)!;
      batch.geometries.forEach((geo) => geo.dispose());
      geometry.computeBoundingSphere();
      const material = new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        ...(batch.layers.size === 1 && batch.layers.has("glow")
          ? { emissive: "#ff9a28", emissiveIntensity: 2.5 }
          : {}),
      });
      const safeKey = drawKey.replace(/[^a-zA-Z0-9]+/g, "_");
      material.name = `Phase4_${safeKey}`;
      const mesh = new Mesh(geometry, material);
      mesh.name = `${name}_${safeKey}`;
      mesh.matrixAutoUpdate = false;
      const parent = batch.namespace
        ? (namespaces.get(batch.namespace) ??
          (() => {
            const created = new Group();
            created.name = `${name}_${batch.namespace}`;
            created.matrixAutoUpdate = false;
            created.userData.cameraOccluder = batch.namespace !== "distant";
            namespaces.set(batch.namespace, created);
            group.add(created);
            return created;
          })())
        : group;
      // Unscoped batches contain many unrelated decorative pieces (all moss,
      // all rocks, or the ground). Keep them as one fast draw, but never use
      // that shared material as an occlusion fade target. Scoped assets such
      // as one tree, one platform, or one path can fade independently.
      mesh.userData.cameraOccluder =
        !!batch.namespace &&
        !batch.layers.has("glow") &&
        batch.namespace !== "distant";
      mesh.userData.canopySupport = /^(support-|swing-support-|bough-)/.test(batch.namespace);
      if (mesh.userData.cameraOccluder) accelerateStaticRaycast(mesh);
      mesh.castShadow = hasSolid;
      mesh.receiveShadow = true;
      if (batch.namespace) mesh.userData.cameraOcclusionGroup = parent.uuid;
      parent.add(mesh);
    }
    return group;
  }
}

function leafGeometry(length: number, width: number, bend: number) {
  const vertices: number[] = [];
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const spread = Math.sin(Math.PI * t) * width;
    vertices.push(
      -spread,
      Math.sin(t * Math.PI) * bend,
      t * length,
      0,
      Math.sin(t * Math.PI) * bend + spread * 0.28,
      t * length,
      spread,
      Math.sin(t * Math.PI) * bend,
      t * length,
    );
  }
  const indices: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    const a = i * 3,
      b = a + 3;
    indices.push(
      a,
      b,
      a + 1,
      a + 1,
      b,
      b + 1,
      a + 1,
      b + 1,
      a + 2,
      a + 2,
      b + 1,
      b + 2,
    );
    indices.push(
      a + 1,
      b,
      a,
      b + 1,
      b,
      a + 1,
      a + 2,
      b + 1,
      a + 1,
      b + 2,
      b + 1,
      a + 2,
    );
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function plant(builder: AssetBuilder, p: Point3, size: number, seed: number) {
  const rng = random(seed);
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9 + rng() * 0.3;
    const rotation = new Quaternion().setFromAxisAngle(UP, angle);
    builder.add(
      leafGeometry(size * (0.9 + rng() * 0.6), size * 0.22, size * 0.8),
      palette.leaf[(i + seed) % 5],
      p,
      undefined,
      rotation,
      "foliage",
    );
    builder.beam(
      p,
      [
        p[0] + Math.sin(angle) * size * 0.8,
        p[1] + size * 0.28,
        p[2] + Math.cos(angle) * size * 0.8,
      ],
      0.018 * size,
      "#98ac52",
      0.008,
      "foliage",
    );
  }
}

/** A closed buttress that continues beyond the old cut end into a solid tip. */
export function createGiantTreeRootGeometry(radius: number) {
  const curve = new CatmullRomCurve3([
    new Vector3(0, radius * 3.2, radius * 0.4),
    new Vector3(0, radius * 0.9, radius * 1.4),
    new Vector3(0, 0.2, radius * 3),
    new Vector3(0, 0.08, radius * 3.8),
  ]);
  const rings = 20, sides = 8;
  const geometry = new TubeGeometry(curve, rings, 1, sides, false);
  const positions = geometry.getAttribute("position");
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const center = curve.getPointAt(t);
    // Broad at the trunk; the exposed end narrows continuously to one point.
    const thickness = radius * 0.34 * Math.pow(1 - t, 0.8);
    for (let side = 0; side <= sides; side++) {
      const index = ring * (sides + 1) + side;
      positions.setXYZ(
        index,
        center.x + (positions.getX(index) - center.x) * thickness,
        center.y + (positions.getY(index) - center.y) * thickness,
        center.z + (positions.getZ(index) - center.z) * thickness,
      );
    }
  }
  // Replace the collapsed final ring with a triangle fan to a single tip.
  const indices = Array.from(geometry.index!.array).slice(0, (rings - 1) * sides * 6);
  const tip = rings * (sides + 1);
  const lastRing = (rings - 1) * (sides + 1);
  for (let side = 0; side < sides; side++)
    indices.push(lastRing + side, tip, lastRing + side + 1);
  // Only the trunk end needs a cap; the other end already meets at the tip.
  const vertices = Array.from(positions.array).slice(0, (tip + 1) * 3);
  const base = curve.getPointAt(0);
  vertices.push(base.x, base.y, base.z);
  for (let side = 0; side < sides; side++) indices.push(tip + 1, side, side + 1);
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// A detailed tree's i-th hanging vine (see the loop inside giantTree below) —
// pulled out so a handful of these can be rebuilt as their own toggleable
// objects (see HARVESTABLE_TREE_VINES) instead of only ever existing fused
// into the tree's own static decoration batch.
function treeVineCurvePoints(
  p: Point3,
  radius: number,
  height: number,
  seed: number,
  index: number,
): Point3[] {
  const angle = index * 1.8 + seed;
  const r = radius * 0.83;
  const start: Point3 = [
    p[0] + Math.sin(angle) * r,
    p[1] + height * 0.7,
    p[2] + Math.cos(angle) * r,
  ];
  return [
    start,
    [start[0] + 1.2, start[1] - 5, start[2] + 0.6],
    [start[0] - 0.6, start[1] - 11, start[2] + 1.1],
    [start[0] - 0.8, start[1] - 16, start[2] + 0.8],
  ];
}

// Three of each detailed tree's four hanging vines are pure scenery; these
// three (picked to match what a player can actually reach while walking the
// paths near trees seed 62 and seed 18) are instead harvestable — built as
// their own scoped, individually-hideable objects below rather than fused
// into the tree's static batch. See CANOPY_HARVESTS in
// canopyCooperationLayout.ts for the matching grab positions (kept in sync
// by hand: both were measured against this same curve).
const HARVESTABLE_TREE_VINES = [
  { seed: 62, vine: 3, id: "tree-vine-a" },
  { seed: 62, vine: 0, id: "tree-vine-b" },
  { seed: 18, vine: 1, id: "tree-vine-c" },
] as const;

export function canopyHarvestCurve(id: string) {
  const harvest = HARVESTABLE_TREE_VINES.find(vine => vine.id === id)!;
  const tree = PHASE_FOUR_TREES.find(tree => tree.seed === harvest.seed)!;
  return new CatmullRomCurve3(treeVineCurvePoints(
    tree.position, tree.radius, tree.height, tree.seed, harvest.vine,
  ).map(point));
}

export function createCanopyHarvestMarkerGeometry(id: string, position: Point3) {
  const curve = canopyHarvestCurve(id);
  // Use the same rings and frames as the harvested mesh. The cuff's surface
  // clears its bark by 0.015, with no scale/rotation animation to cut into it.
  const geometry = new TubeGeometry(curve, 20, 0.125, 6, false);
  const target = point(position);
  let nearest = 0, distance = Infinity;
  for (let segment = 0; segment < 20; segment++) {
    const d = curve.getPointAt((segment + 0.5) / 20).distanceToSquared(target);
    if (d < distance) { distance = d; nearest = segment; }
  }
  geometry.setDrawRange(nearest * 6 * 6, 6 * 6);
  return geometry;
}

function giantTree(
  builder: AssetBuilder,
  p: Point3,
  radius: number,
  height: number,
  seed: number,
  detailed = true,
) {
  const rng = random(seed);
  const trunk = new CylinderGeometry(radius * 0.57, radius, height, 14, 12);
  const vertices = trunk.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i),
      t = (y + height / 2) / height;
    const a = Math.atan2(vertices.getZ(i), vertices.getX(i));
    const ripple =
      1 + Math.sin(a * 7 + t * 4) * 0.085 + Math.pow(1 - t, 7) * 0.55;
    vertices.setXYZ(
      i,
      vertices.getX(i) * ripple + Math.sin(t * 3 + seed) * t * radius * 0.34,
      y,
      vertices.getZ(i) * ripple,
    );
  }
  trunk.computeVertexNormals();
  builder.add(trunk, palette.bark[seed % 4], [p[0], p[1] + height / 2, p[2]]);
  for (let i = 0; i < (detailed ? 14 : 6); i++) {
    const angle = (i * Math.PI * 2) / (detailed ? 14 : 6);
    const points: Point3[] = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8,
        r = radius * (1 - t * 0.43) * (1.005 + Math.pow(1 - t, 7) * 0.48);
      const a = angle + Math.sin(t * 6 + i) * 0.1;
      points.push([
        p[0] + Math.sin(a) * r,
        p[1] + height * t,
        p[2] + Math.cos(a) * r,
      ]);
    }
    builder.tube(
      points,
      radius * (i % 3 === 0 ? 0.085 : 0.025),
      i % 3 === 0 ? "#a67945" : "#402d20",
      18,
    );
    if (i % 2 === 0) {
      builder.add(
        createGiantTreeRootGeometry(radius),
        palette.bark[i % 4],
        p,
        undefined,
        new Quaternion().setFromAxisAngle(UP, angle),
      );
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + seed;
    const branchY = p[1] + height * (0.68 + rng() * 0.16);
    const end: Point3 = [
      p[0] + Math.sin(a) * radius * 3.6,
      branchY + height * 0.12,
      p[2] + Math.cos(a) * radius * 3.6,
    ];
    builder.beam(
      [p[0], branchY - 2, p[2]],
      end,
      radius * 0.35,
      palette.bark[i % 4],
      radius * 0.1,
    );
    for (let j = 0; j < (detailed ? 6 : 3); j++) {
      const crown: Point3 = [
        end[0] + (rng() - 0.5) * radius * 3.4,
        end[1] + rng() * radius * 1.3,
        end[2] + (rng() - 0.5) * radius * 3.4,
      ];
      builder.add(
        new IcosahedronGeometry(1, 1),
        palette.leaf[(i + j) % 5],
        crown,
        [
          radius * (0.9 + rng() * 0.5),
          radius * 0.65,
          radius * (0.9 + rng() * 0.5),
        ],
        undefined,
        "foliage",
      );
      if (detailed) {
        for (let k = 0; k < 4; k++)
          builder.add(
            leafGeometry(radius * 0.85, radius * 0.34, radius * 0.18),
            palette.leaf[(i + j + k + 2) % 5],
            [crown[0], crown[1] + radius * 0.6, crown[2]],
            undefined,
            new Quaternion().setFromAxisAngle(UP, k * 1.6 + a),
            "foliage",
          );
      }
    }
  }
  if (detailed) {
    for (let i = 0; i < 4; i++) {
      if (HARVESTABLE_TREE_VINES.some((hv) => hv.seed === seed && hv.vine === i))
        continue;
      builder.tube(
        treeVineCurvePoints(p, radius, height, seed, i),
        0.11,
        "#4c6b2b",
        20,
        "foliage",
      );
    }
    for (let i = 0; i < 4; i++)
      plant(
        builder,
        [
          p[0] + Math.sin(i * 1.7) * radius * 1.9,
          p[1] + 0.4,
          p[2] + Math.cos(i * 1.7) * radius * 1.9,
        ],
        2.2,
        seed + i,
      );
  }
}

// Standalone, origin-centred versions of phase four's tree/vine look, for
// reuse anywhere else in the game that just wants "the phase-four tree" or
// "the phase-four vine" as a static asset (see Forest.tsx, which feeds these
// into the same prepareAsset()/instancing pipeline used for loaded GLTFs) -
// giantTree() itself always draws at an absolute world position, so both
// wrappers build at the origin and let the caller place/scale the result.
export function createPhaseFourTreeGroup(
  radius: number,
  height: number,
  seed: number,
  detailed = true,
): Group {
  const builder = new AssetBuilder();
  giantTree(builder, [0, 0, 0], radius, height, seed, detailed);
  return builder.finish("phase4-style-tree");
}

export function createPhaseFourVineGroup(length: number, seed: number): Group {
  const builder = new AssetBuilder();
  const rng = random(seed);
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3((rng() - 0.5) * length * 0.18, length * 0.34, (rng() - 0.5) * length * 0.18),
    new Vector3((rng() - 0.5) * length * 0.22, length * 0.68, (rng() - 0.5) * length * 0.22),
    new Vector3(0, length, 0),
  ]);
  builder.add(new TubeGeometry(curve, 32, length * 0.014, 7, false), "#536d2e");
  const leafCount = Math.max(3, Math.round(length * 2.6));
  for (let i = 1; i < leafCount; i++) {
    const t = i / leafCount;
    const p = curve.getPointAt(t);
    builder.add(
      createPhaseFourVineLeafGeometry(),
      palette.leaf[(seed + i) % 5],
      p.toArray() as Point3,
      undefined,
      new Quaternion().setFromAxisAngle(UP, seed + i * 2.1),
      "foliage",
    );
  }
  return builder.finish("phase4-style-vine");
}

// The "tied off to a branch" anchor from a swing/pull vine (see
// vineAttachment above), as a standalone group in absolute world space -
// reusable anywhere a vine needs to visibly wrap around a wooden branch
// instead of hanging with no support (e.g. phase one's climbable trees).
export function createVineAnchorGroup(
  tree: AnchorTree,
  anchor: Point3,
  wrapped = true,
): Group {
  const builder = new AssetBuilder();
  vineAttachment(builder, tree, anchor, wrapped);
  return builder.finish("vine-anchor");
}

class WalkingCurve extends Curve<Vector3> {
  private readonly spline: CatmullRomCurve3;
  private transitionStart = 0;
  private transitionEnd = 1;
  private startHeight: number;
  private endHeight: number;
  constructor(private readonly path: CanopyPath) {
    super();
    this.spline = new CatmullRomCurve3(
      path.points.map(point),
      false,
      "centripetal",
    );
    const from = PHASE_FOUR_PLATFORMS.find((deck) => deck.id === path.from);
    const to = PHASE_FOUR_PLATFORMS.find((deck) => deck.id === path.to);
    this.startHeight = from?.center[1] ?? path.points[0][1];
    this.endHeight = to?.center[1] ?? path.points.at(-1)![1];
    const onDeck = (p: Vector3, deck: typeof from) =>
      deck &&
      Math.abs(p.x - deck.center[0]) <=
        deck.width / 2 + path.width / 2 + 0.12 &&
      Math.abs(p.z - deck.center[2]) <= deck.depth / 2 + path.width / 2 + 0.12;
    for (let i = 0; i <= 240; i++) {
      const t = i / 240,
        p = this.spline.getPoint(t);
      if (onDeck(p, from)) this.transitionStart = t;
      if (onDeck(p, to)) {
        this.transitionEnd = t;
        break;
      }
    }
  }
  getPoint(t: number, target = new Vector3()) {
    this.spline.getPoint(t, target);
    const blend = Math.max(
      0,
      Math.min(
        1,
        (t - this.transitionStart) /
          Math.max(0.01, this.transitionEnd - this.transitionStart),
      ),
    );
    const smooth = this.path.kind === "ladder"
      ? blend
      : blend * blend * (3 - 2 * blend);
    target.y = this.startHeight + (this.endHeight - this.startHeight) * smooth;
    if (this.path.kind === "bridge")
      target.y -= Math.sin(blend * Math.PI) ** 2 * 0.32;
    return target;
  }
}

export function phaseFourPathCurve(path: CanopyPath): Curve<Vector3> {
  return new WalkingCurve(path);
}

function closeTubeEnds(geometry: BufferGeometry, rings: number, sides: number) {
  const position = geometry.getAttribute("position");
  const vertices = Array.from(position.array);
  const indices = Array.from(geometry.index!.array);
  for (const ring of [0, rings]) {
    const start = ring * (sides + 1),
      centerIndex = vertices.length / 3;
    const center = new Vector3();
    for (let j = 0; j < sides; j++)
      center.add(new Vector3().fromBufferAttribute(position, start + j));
    center.multiplyScalar(1 / sides);
    vertices.push(center.x, center.y, center.z);
    for (let j = 0; j < sides; j++) {
      if (ring === 0) indices.push(centerIndex, start + j, start + j + 1);
      else indices.push(centerIndex, start + j + 1, start + j);
    }
  }
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const PHASE_FOUR_BRANCH_CLEARANCE = 0.38;

function barkBelowPlatforms(x: number, y: number, z: number) {
  for (const deck of PHASE_FOUR_PLATFORMS) {
    if (Math.abs(x - deck.center[0]) <= deck.width / 2 + 0.18 &&
        Math.abs(z - deck.center[2]) <= deck.depth / 2 + 0.18)
      y = Math.min(y, deck.center[1] - 0.38);
  }
  return y;
}

// Distinct, millimetric levels keep angled board corners from sharing a plane
// with either the platform or another path at a multi-way junction.
export function phaseFourPathFloorOffset(path: CanopyPath) {
  return 0.006 + Math.max(0, PHASE_FOUR_PATHS.indexOf(path)) * 0.003;
}

export function phaseFourRailingRange(path: CanopyPath, side: number) {
  const curve = phaseFourPathCurve(path);
  const from = PHASE_FOUR_PLATFORMS.find((deck) => deck.id === path.from)!;
  const to = PHASE_FOUR_PLATFORMS.find((deck) => deck.id === path.to)!;
  let start = 0, end = 1;
  for (let i = 0; i <= 600; i++) {
    const t = i / 600, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const length = Math.hypot(tangent.x, tangent.z);
    const x = p.x + tangent.z / length * path.width * 0.5 * side;
    const z = p.z - tangent.x / length * path.width * 0.5 * side;
    const inside = (deck: typeof from) =>
      Math.abs(x - deck.center[0]) < deck.width / 2 + 0.15 &&
      Math.abs(z - deck.center[2]) < deck.depth / 2 + 0.15;
    if (inside(from)) start = Math.min(1, t + 1 / 600);
    if (inside(to)) { end = Math.max(start, t - 1 / 600); break; }
  }
  return [start, end] as const;
}

function nearestDeckTree(deck: (typeof PHASE_FOUR_PLATFORMS)[number]) {
  return PHASE_FOUR_TREES.reduce((closest, candidate) =>
    Math.hypot(candidate.position[0] - deck.center[0], candidate.position[2] - deck.center[2]) <
    Math.hypot(closest.position[0] - deck.center[0], closest.position[2] - deck.center[2])
      ? candidate
      : closest,
  );
}

// Vertical rings keep the bark below the planks even on curved, sloping paths.
// Offsetting a second spline changed its parameterization and caused the old
// branch crest to cut through the deck at bends.
export function createPhaseFourBranchGeometry(path: CanopyPath) {
  const curve = phaseFourPathCurve(path),
    radius = path.width * 0.58;
  const samples: { center: Vector3; direction: Vector3; radius: number }[] = [];
  const walkingRings = Math.ceil(curve.getLength() * 5);
  // Each walking bough and its two trunk roots share a single mesh. There
  // are no separately capped limbs meeting at an angle beneath the decks.
  const addRoot = (atStart: boolean) => {
    const deck = PHASE_FOUR_PLATFORMS.find(
      (candidate) => candidate.id === (atStart ? path.from : path.to),
    );
    if (!deck) return;
    const tree = nearestDeckTree(deck);
    const end = curve.getPoint(atStart ? 0 : 1);
    end.y -= radius + PHASE_FOUR_BRANCH_CLEARANCE;
    const outward = curve.getTangent(atStart ? 0 : 1).multiplyScalar(atStart ? -1 : 1);
    const root = new Vector3(tree.position[0], end.y - 2.6, tree.position[2]);
    const approach = end.clone().addScaledVector(outward, 1.5);
    const support = new CatmullRomCurve3([
      end,
      approach,
      approach.clone().lerp(root, 0.6),
      root,
    ]);
    const steps = Math.ceil(support.getLength() * 5);
    for (let i = 0; i < steps; i++) {
      const t = atStart ? 1 - i / steps : (i + 1) / steps;
      samples.push({
        center: support.getPoint(t),
        direction: support.getTangent(t).multiplyScalar(atStart ? -1 : 1),
        radius: radius + (tree.radius * 0.9 - radius) * t * t * (3 - 2 * t),
      });
    }
  };
  addRoot(true);
  for (let ring = 0; ring <= walkingRings; ring++) {
    const center = curve.getPoint(ring / walkingRings);
    center.y -= radius + PHASE_FOUR_BRANCH_CLEARANCE;
    samples.push({ center, direction: curve.getTangent(ring / walkingRings), radius });
  }
  addRoot(false);
  const rings = samples.length - 1, sides = 54;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const bark = new Color("#77502f"),
    grainShadow = new Color("#5d3d26"),
    grainHighlight = new Color("#95683c"),
    color = new Color();
  let distance = 0;
  for (let ring = 0; ring <= rings; ring++) {
    const { center: p, direction, radius: ringRadius } = samples[ring];
    if (ring) distance += p.distanceTo(samples[ring - 1].center);
    const side = new Vector3(direction.z, 0, -direction.x).normalize();
    for (let j = 0; j <= sides; j++) {
      const angle = (j * Math.PI * 2) / sides;
      // Restore the nine raised bark veins of the old grown limbs directly
      // in the continuous skin. World-distance phase carries the grain across
      // both root/walkway junctions without a seam or a separate end cap.
      const grain = angle * 9 + Math.sin(distance * 0.24 + angle * 2) * 0.45;
      const ridge = ((Math.cos(grain) + 1) / 2) ** 5;
      const furrow = ((1 - Math.cos(grain)) / 2) ** 7;
      const irregularity =
        Math.sin(angle * 3 + distance * 0.31) * 0.018 +
        Math.sin(angle * 5 - distance * 0.17) * 0.009;
      // Limit relief near the upper crest so the bark stays below the planks.
      const relief = Math.min(0.095, ringRadius * 0.05);
      const r = ringRadius * (1 + irregularity) + relief * (ridge - furrow * 0.35);
      const x = p.x + side.x * Math.sin(angle) * r;
      const z = p.z + side.z * Math.sin(angle) * r;
      positions.push(x, barkBelowPlatforms(x, p.y + Math.cos(angle) * r, z), z);
      color.copy(bark)
        .lerp(grainShadow, 0.12 + furrow * 0.55)
        .lerp(grainHighlight, ridge * 0.72)
        .multiplyScalar(1 + Math.sin(distance * 0.63 + angle * 3) * 0.055);
      colors.push(color.r, color.g, color.b);
      if (ring < rings && j < sides) {
        const a = ring * (sides + 1) + j,
          b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  closeTubeEnds(geometry, rings, sides);
  colors.push(bark.r, bark.g, bark.b, bark.r, bark.g, bark.b);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  // The duplicated UV-seam vertices share a position and must also share a
  // normal, otherwise lighting draws an artificial line along the branch.
  const normals = geometry.getAttribute("normal");
  const normal = new Vector3();
  for (let ring = 0; ring <= rings; ring++) {
    const first = ring * (sides + 1), last = first + sides;
    normal.fromBufferAttribute(normals, first)
      .add(new Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

// A continuous closed ribbon avoids collider seams between individual planks.
export function createPhaseFourPathCollider(path: CanopyPath) {
  const curve = phaseFourPathCurve(path);
  const steps = Math.ceil(curve.getLength() * 3);
  const vertices: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      p = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const side = new Vector3(-tangent.z, 0, tangent.x)
      .normalize()
      .multiplyScalar(path.width / 2);
    vertices.push(
      p.x + side.x,
      p.y,
      p.z + side.z,
      p.x - side.x,
      p.y,
      p.z - side.z,
      p.x + side.x,
      p.y - 0.28,
      p.z + side.z,
      p.x - side.x,
      p.y - 0.28,
      p.z - side.z,
    );
    if (i < steps) {
      const a = i * 4,
        b = a + 4;
      indices.push(
        a,
        b,
        a + 1,
        a + 1,
        b,
        b + 1,
        a + 2,
        a + 3,
        b + 2,
        a + 3,
        b + 3,
        b + 2,
        a,
        a + 2,
        b,
        a + 2,
        b + 2,
        b,
        a + 1,
        b + 1,
        a + 3,
        a + 3,
        b + 1,
        b + 3,
      );
    }
  }
  indices.push(0, 2, 1, 1, 2, 3);
  const end = steps * 4;
  indices.push(end, end + 1, end + 2, end + 1, end + 3, end + 2);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function canopyPath(builder: AssetBuilder, path: CanopyPath, seed: number) {
  const curve = phaseFourPathCurve(path),
    length = curve.getLength(),
    rng = random(seed);
  const segments = Math.ceil(length / (path.kind === "ladder" ? 0.42 : 0.62));
  const radius = path.width * 0.58;
  if (path.kind === "branch") {
    builder.scoped(`bough-${path.id}`, () => builder.add(createPhaseFourBranchGeometry(path), null));
  }
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = curve.getPointAt(t),
      dir = curve.getTangentAt(t);
    const side = new Vector3(dir.z, 0, -dir.x).normalize();
    const normal = new Vector3().crossVectors(dir, side).normalize();
    const rotation = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(side, normal, dir),
    );
    const width = path.kind === "branch" ? path.width * 0.85 : path.width;
    // A plank's own footprint extends roughly plankDepth/2 back along the
    // curve from its center. A flat 0.1 margin was smaller than that for
    // branches/bridges, so the first plank drawn just past the "boundary"
    // still physically overlapped the platform's own deck boards - two
    // coplanar surfaces fighting for the same pixels at every junction.
    const plankDepth =
      path.kind === "ladder" ? 0.19 : (length / segments) * 0.95;
    const insideDeck = PHASE_FOUR_PLATFORMS.some(
      (deck) =>
        (deck.id === path.from || deck.id === path.to) &&
        Math.abs(p.x - deck.center[0]) < deck.width / 2 + plankDepth / 2 &&
        Math.abs(p.z - deck.center[2]) < deck.depth / 2 + plankDepth / 2 &&
        Math.abs(p.y - deck.center[1]) < 0.3,
    );
    if (!insideDeck) {
      builder.add(
        new BoxGeometry(
          width * (0.97 + rng() * 0.06),
          0.16,
          path.kind === "ladder" ? 0.19 : (length / segments) * 0.95,
        ),
        palette.wood[i % 4],
        [p.x - normal.x * 0.08, p.y - normal.y * 0.08 - phaseFourPathFloorOffset(path), p.z - normal.z * 0.08],
        undefined,
        rotation,
      );
      if (path.kind === "branch" && i % 2 === 0)
        builder.add(
          new BoxGeometry(width * 0.9, 0.24, 0.16),
          "#69472d",
          [p.x, p.y - 0.28, p.z],
          undefined,
          rotation,
        );
    }
    if (path.kind === "branch" && i % 3 === 0) {
      builder.add(
        new IcosahedronGeometry(1, 1),
        palette.moss[i % 3],
        [
          p.x + dir.z * path.width * 0.34,
          p.y + 0.015,
          p.z - dir.x * path.width * 0.34,
        ],
        [0.42, 0.05, 0.38],
        rotation,
        "foliage",
      );
    }
    if (path.kind === "branch" && i % 10 === 2) {
      const ropeRadius = 0.055;
      // Clear the full bark relief (both irregularity waves and raised grain),
      // including the rope's inner surface and the ring's polygonal edges.
      const wrapRadius =
        radius * 1.027 + Math.min(0.095, radius * 0.05) + ropeRadius + 0.025;
      for (let wrap = 0; wrap < 3; wrap++) {
        const wrapT = Math.min(1, t + (wrap * 0.14) / length);
        const wrapPoint = curve.getPointAt(wrapT);
        const wrapDirection = curve.getTangentAt(wrapT);
        // Bark uses vertical cross-sections. Tilting the rope with the slope
        // cuts its upper/lower arcs into those sections on an ascent.
        const axis = new Vector3(wrapDirection.x, 0, wrapDirection.z).normalize();
        builder.add(
          new TorusGeometry(wrapRadius, ropeRadius, 7, 64),
          "#ab9560",
          [
            wrapPoint.x,
            wrapPoint.y - radius - PHASE_FOUR_BRANCH_CLEARANCE,
            wrapPoint.z,
          ],
          undefined,
          new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis),
        );
      }
    }
  }
  if (path.kind !== "branch") {
    for (const sign of [-1, 1]) {
      const [start, end] = phaseFourRailingRange(path, sign);
      const line: Point3[] = [],
        lower: Point3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = start + (end - start) * i / 24;
        const p = curve.getPoint(t),
          dir = curve.getTangent(t);
        dir.y = 0;
        dir.normalize();
        const x = p.x + dir.z * path.width * 0.5 * sign,
          z = p.z - dir.x * path.width * 0.5 * sign;
        line.push([x, p.y + (path.kind === "bridge" ? 1.07 : 0.05), z]);
        lower.push([x, p.y + 0.42, z]);
        if (path.kind === "bridge" && i % 4 === 0)
          builder.beam([x, p.y - 0.2, z], [x, p.y + 1.05, z], 0.065, "#a68b55");
      }
      builder.tube(line, path.kind === "ladder" ? 0.095 : 0.075, "#ab9257", 36);
      if (path.kind === "bridge") builder.tube(lower, 0.042, "#85733f", 36);
    }
  }
}

function platform(
  builder: AssetBuilder,
  p: Point3,
  width: number,
  depth: number,
  seed: number,
) {
  const rng = random(seed);
  for (let i = 0; i < Math.ceil(depth / 0.55); i++) {
    const z = p[2] - depth / 2 + ((i + 0.5) * depth) / Math.ceil(depth / 0.55);
    builder.add(
      new BoxGeometry(
        width + rng() * 0.15,
        0.28,
        depth / Math.ceil(depth / 0.55) - 0.022,
      ),
      palette.wood[(i + seed) % 4],
      [p[0], p[1] - 0.14, z],
    );
    for (const sign of [-1, 1])
      builder.add(new CylinderGeometry(0.035, 0.035, 0.016, 5), "#493d2c", [
        p[0] + sign * (width / 2 - 0.35),
        p[1] + 0.012,
        z,
      ]);
  }
  for (const sign of [-1, 1]) {
    const x = p[0] + sign * (width / 2 - 0.3);
    builder.beam(
      [x, p[1] - 0.5, p[2] - depth / 2 - 0.15],
      [x, p[1] - 0.5, p[2] + depth / 2 + 0.15],
      0.22,
      "#65432a",
    );
    const post: Point3 = [x, p[1], p[2] + depth / 2 - 0.25];
    builder.beam(
      post,
      [post[0], post[1] + 1.1, post[2]],
      0.16,
      "#806037",
      0.14,
    );
    for (let wrap = 0; wrap < 4; wrap++)
      builder.add(
        new TorusGeometry(0.17, 0.032, 5, 10),
        "#c1ad74",
        [post[0], post[1] + 0.65 + wrap * 0.07, post[2]],
        undefined,
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
      );
    plant(
      builder,
      [x, p[1] + 0.03, p[2] + depth / 2 - 0.7],
      0.8,
      seed + (sign > 0 ? 2 : 0),
    );
    for (let i = 0; i < 6; i++)
      builder.add(
        new IcosahedronGeometry(1, 1),
        palette.moss[i % 3],
        [
          x + (rng() - 0.5) * 0.5,
          p[1] + 0.015,
          p[2] - depth / 2 + rng() * depth,
        ],
        [0.42, 0.055, 0.5],
        undefined,
        "foliage",
      );
  }
}

function torch(builder: AssetBuilder, p: Point3) {
  builder.beam(p, [p[0], p[1] + 1.3, p[2]], 0.075, "#483622");
  builder.add(new CylinderGeometry(0.15, 0.08, 0.24, 7), "#655237", [
    p[0],
    p[1] + 1.25,
    p[2],
  ]);
  builder.add(
    new IcosahedronGeometry(1, 1),
    "#ffd47c",
    [p[0], p[1] + 1.65, p[2]],
    [0.13, 0.38, 0.13],
    undefined,
    "glow",
  );
}

function grownLimb(
  builder: AssetBuilder,
  points: Point3[],
  baseRadius: number,
  tipRadius: number,
  color: string,
) {
  const curve = new CatmullRomCurve3(points.map(point));
  const rings = 28,
    sides = 10;
  const geometry = new TubeGeometry(curve, rings, 1, sides, false);
  const vertices = geometry.getAttribute("position");
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings,
      center = curve.getPointAt(t);
    const radius =
      baseRadius + (tipRadius - baseRadius) * (t * t * (3 - 2 * t));
    for (let side = 0; side <= sides; side++) {
      const i = ring * (sides + 1) + side;
      vertices.setXYZ(
        i,
        center.x + (vertices.getX(i) - center.x) * radius,
        center.y + (vertices.getY(i) - center.y) * radius,
        center.z + (vertices.getZ(i) - center.z) * radius,
      );
    }
  }
  closeTubeEnds(geometry, rings, sides);
  builder.add(geometry, color);
  const frames = curve.computeFrenetFrames(rings, false);
  // Raised bark follows the grain around the broad, tapering crotch.
  for (let ridge = 0; ridge < 9; ridge++) {
    const ridgePoints: Point3[] = [];
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings,
        p = curve.getPointAt(t);
      const a = (ridge * Math.PI * 2) / 9 + Math.sin(t * 4 + ridge) * 0.05;
      const radius =
        baseRadius + (tipRadius - baseRadius) * (t * t * (3 - 2 * t));
      p.addScaledVector(frames.normals[ring], Math.cos(a) * radius * 0.98);
      p.addScaledVector(frames.binormals[ring], Math.sin(a) * radius * 0.98);
      ridgePoints.push(p.toArray() as Point3);
    }
    builder.tube(
      ridgePoints,
      Math.min(0.095, tipRadius * 0.05),
      ridge % 2 ? "#5d3d26" : "#95683c",
      rings,
    );
  }
}

function connectDeckToTree(
  builder: AssetBuilder,
  deck: (typeof PHASE_FOUR_PLATFORMS)[number],
) {
  // Walking boughs already extend into the trunks as continuous geometry.
  if (PHASE_FOUR_PATHS.some((path) =>
    path.kind === "branch" && (path.from === deck.id || path.to === deck.id),
  )) return;
  const tree = nearestDeckTree(deck);
  const [x, y, z] = deck.center;
  const direction = new Vector3(
    x - tree.position[0],
    0,
    z - tree.position[2],
  ).normalize();
  const r = tree.radius;
  const branchRadius = 1.95;
  const centerY = y - branchRadius - PHASE_FOUR_BRANCH_CLEARANCE - 0.12;
  // The branch begins inside the trunk, broadens at the crotch, and continues
  // underneath the platform into the walking boughs instead of ending in air.
  grownLimb(
    builder,
    [
      [tree.position[0], centerY - 2.6, tree.position[2]],
      [
        tree.position[0] + direction.x * r * 0.85,
        centerY - 1.1,
        tree.position[2] + direction.z * r * 0.85,
      ],
      [x - direction.x * 1.5, centerY - 0.2, z - direction.z * 1.5],
      [x + direction.x * 0.8, centerY, z + direction.z * 0.8],
    ],
    Math.max(r * 0.9, branchRadius * 1.35),
    branchRadius * 1.03,
    palette.bark[tree.seed % 4],
  );
}

export type AnchorTree = { position: Point3; radius: number; seed: number };

function vineAttachment(
  builder: AssetBuilder,
  tree: AnchorTree,
  anchor: Point3,
  wrapped = true,
) {
  const direction = new Vector3(
    anchor[0] - tree.position[0],
    0,
    anchor[2] - tree.position[2],
  ).normalize();
  grownLimb(
    builder,
    [
      [tree.position[0], anchor[1] - 2.1, tree.position[2]],
      [
        tree.position[0] + direction.x * tree.radius,
        anchor[1] - 0.25,
        tree.position[2] + direction.z * tree.radius,
      ],
      [
        anchor[0] + direction.x * 0.7,
        anchor[1] + 0.16,
        anchor[2] + direction.z * 0.7,
      ],
    ],
    tree.radius * 0.4,
    0.27,
    palette.bark[tree.seed % 4],
  );
  if (wrapped)
    builder.add(
      createPhaseFourVineTieGeometry(tree, anchor),
      "#4b682c",
      undefined,
      undefined,
      undefined,
      "foliage",
    );
}

export function createPhaseFourVineTieGeometry(
  tree: Pick<AnchorTree, "position">,
  anchor: Point3,
) {
  const direction = new Vector3(
    anchor[0] - tree.position[0],
    0,
    anchor[2] - tree.position[2],
  ).normalize();
  const curl: Vector3[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36,
      a = t * Math.PI * 4.5,
      along = (t - 0.5) * 1.2;
    curl.push(
      new Vector3(
        anchor[0] + direction.x * along + direction.z * Math.cos(a) * 0.4,
        anchor[1] + Math.sin(a) * 0.4,
        anchor[2] + direction.z * along - direction.x * Math.cos(a) * 0.4,
      ),
    );
  }
  return new TubeGeometry(new CatmullRomCurve3(curl), 48, 0.075, 7, false);
}

export function createPhaseFourEnvironment() {
  const builder = new AssetBuilder();
  builder.add(
    createPhaseFourGroundGeometry(),
    null,
    undefined,
    undefined,
    undefined,
    "ground",
  );
  PHASE_FOUR_TREES.forEach((tree) =>
    builder.scoped(`tree-${tree.seed}`, () =>
      giantTree(builder, tree.position, tree.radius, tree.height, tree.seed),
    ),
  );
  HARVESTABLE_TREE_VINES.forEach((hv) => {
    const tree = PHASE_FOUR_TREES.find((t) => t.seed === hv.seed)!;
    builder.scoped(`liana-${hv.id}`, () =>
      builder.tube(
        treeVineCurvePoints(tree.position, tree.radius, tree.height, tree.seed, hv.vine),
        0.11,
        "#4c6b2b",
        20,
        "foliage",
      ),
    );
  });
  PHASE_FOUR_PLATFORMS.forEach((deck, i) =>
    builder.scoped(`platform-${deck.id}`, () => {
      builder.scoped(`support-${deck.id}`, () => connectDeckToTree(builder, deck));
      platform(builder, deck.center, deck.width, deck.depth, i * 7 + 3);
      torch(builder, [
        deck.center[0] - deck.width / 2 + 0.4,
        deck.center[1],
        deck.center[2] + 1.5,
      ]);
    }),
  );
  PHASE_FOUR_PATHS.forEach((path, i) =>
    builder.scoped(`path-${path.id}`, () =>
      canopyPath(builder, path, i * 17 + 4),
    ),
  );
  builder.scoped("pull-vine", () => {
    // The liana must read as tied off, not floating free - anchor its top
    // end to the nearest trunk (tree 1, already the "plateau" span's rear
    // support) with the same grown-branch + wrapped-coil visual used for the
    // swing spans, so the whole thing looks load-bearing.
    vineAttachment(
      builder,
      PHASE_FOUR_TREES[1],
      PHASE_FOUR_PULL_VINE_CURVE.getPointAt(1).toArray() as Point3,
      true,
    );
    builder.add(
      new TubeGeometry(PHASE_FOUR_PULL_VINE_CURVE, 160, 0.1, 7, false),
      "#536d2e",
      undefined,
      undefined,
      undefined,
      "foliage",
    );
    for (let i = 1; i < 22; i++) {
      const p = PHASE_FOUR_PULL_VINE_CURVE.getPointAt(i / 22);
      builder.add(
        createPhaseFourVineLeafGeometry(),
        palette.leaf[(i + 2) % 5],
        p.toArray() as Point3,
        undefined,
        new Quaternion().setFromAxisAngle(UP, i * 2.1),
        "foliage",
      );
    }
  });
  PHASE_FOUR_SWING_SITES.forEach((site) => {
    builder.scoped(`swing-support-${site.id}`, () => {
      const span = site.vine.twoPoint!;
      vineAttachment(
        builder,
        PHASE_FOUR_TREES[span.frontTreeIndex],
        [site.vine.x, site.vine.attachY, site.vine.z],
        false,
      );
      vineAttachment(
        builder,
        PHASE_FOUR_TREES[span.rearTreeIndex],
        [span.rear.x, span.rear.y, span.rear.z],
        false,
      );
    });
  });
  // Looped lianas hang below the walkways, leaving the deck surfaces clear.
  PHASE_FOUR_PATHS.filter((path) => path.kind === "branch").forEach((path) => {
    builder.scoped(`liana-${path.id}`, () => {
      const curve = phaseFourPathCurve(path),
        points: Point3[] = [];
      for (let i = 0; i <= 12; i++) {
        const p = curve.getPoint(i / 12),
          d = curve.getTangent(i / 12);
        points.push([
          p.x + d.z * (path.width * 0.5 + 0.1),
          p.y - 0.6 - Math.sin((i / 12) * Math.PI) * 4,
          p.z - d.x * (path.width * 0.5 + 0.1),
        ]);
      }
      builder.tube(points, 0.095, "#365c2b", 24, "foliage");
    });
  });
  const rng = random(204);
  // Distant trunks, layered crowns and stone banks frame a winding river
  // valley. This range of z crosses the cliff (see phaseFourCliffBlend), so
  // a single flat trunk-base Y buried every one of these on the plateau side
  // - each tree's base now follows the real ground height at its own spot.
  builder.scoped("distant", () => {
    for (let i = 0; i < 24; i++) {
      const rawX = i < 12 ? -36 - rng() * 26 : 34 + rng() * 24;
      const rawZ = 24 - rng() * 94;
      const radius = 1.5 + rng() * 1.2;
      const height = 25 + rng() * 18;
      const [clearedX, clearedZ] = clearRiverBank(
        rawX,
        rawZ,
        radius,
        PHASE_FOUR_RIVER,
      );
      const [x, z] = clearRiverBank(
        clearedX,
        clearedZ,
        radius,
        PHASE_FOUR_UPPER_RIVER,
      );
      if (!clearsSummitShrine(x, z)) continue;
      giantTree(
        builder,
        [x, phaseFourGroundHeight(x, z) - ROOT_EMBED_DEPTH, z],
        radius,
        height,
        200 + i,
        false,
      );
    }
    for (let i = 0; i < 9; i++) {
      const rawX = -35 + i * 9,
        rawZ = -63 - rng() * 15;
      const radius = 1.7 + rng();
      const height = 29 + rng() * 11;
      const [x, z] = clearRiverBank(
        rawX,
        rawZ,
        radius,
        PHASE_FOUR_UPPER_RIVER,
      );
      if (!clearsSummitShrine(x, z)) continue;
      giantTree(
        builder,
        [x, phaseFourGroundHeight(x, z) - ROOT_EMBED_DEPTH, z],
        radius,
        height,
        450 + i,
        false,
      );
    }
  });
  for (let i = 0; i < 52; i++) {
    const side = i % 2 ? -1 : 1,
      z = 35 - rng() * 89;
    const x = side * (19 + rng() * 17);
    builder.rock(
      [x, -6, z],
      [4 + rng() * 6, 2 + rng() * 6, 4 + rng() * 6],
      i * 3,
    );
    if (i % 3 === 0)
      plant(
        builder,
        [x, phaseFourGroundHeight(x, z) + 0.04, z],
        2.5 + rng(),
        i * 7,
      );
  }
  const river = new CatmullRomCurve3(PHASE_FOUR_RIVER.map(point));
  for (let i = 0; i < 32; i++) {
    const t = i / 31,
      p = river.getPoint(t),
      d = river.getTangent(t);
    for (const sign of [-1, 1]) {
      const x = p.x + d.z * 5.2 * sign,
        z = p.z - d.x * 5.2 * sign;
      builder.rock(
        [x, -5.8, z],
        [2.3 + rng(), 1.4 + rng(), 2.6 + rng()],
        80 + i,
      );
      if (i % 3 === 0)
        plant(builder, [x, phaseFourGroundHeight(x, z) + 0.04, z], 1.4, i + 22);
    }
  }
  const falls = PHASE_FOUR_WATERFALL;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++)
      builder.rock(
        [
          falls.position[0] + (col - 2) * 4,
          row === 3 && Math.abs(col - 2) <= 1 ? 8.1 : -3 + row * 4.7,
          falls.position[2] - 5.2 - rng(),
        ],
        [3.1, 3.3, 3.5],
        row * 7 + col,
        false,
        palette.cliff,
      );
  }
  builder.rock([2, -5, 0], [1.8, 1.5, 1.3], 94);
  builder.rock([7, -5, 15], [1.6, 1.1, 1.9], 96);
  builder.rock([10, -4.8, -33], [2, 1.4, 1.6], 99);
  for (let i = 0; i < 120; i++) {
    const x = (rng() - 0.5) * 95,
      z = 42 - rng() * 110,
      y = phaseFourGroundHeight(x, z);
    if (y > -4.8) plant(builder, [x, y + 0.04, z], 0.4 + rng() * 0.65, 720 + i);
  }
  return builder.finish("Phase4_CanopyVillage");
}

/** Standalone authored assets, also exportable as ordinary GLB files. */
export function createPhaseFourAssetLibrary(): Record<string, Group> {
  const build = (name: string, draw: (b: AssetBuilder) => void) => {
    const b = new AssetBuilder();
    draw(b);
    return b.finish(name);
  };
  return {
    tree: build("GiantTree", (b) => giantTree(b, [0, 0, 0], 3, 36, 41)),
    branch: build("MossyBranch", (b) =>
      canopyPath(
        b,
        {
          id: "asset",
          from: "",
          to: "",
          kind: "branch",
          width: 3.2,
          points: [
            [0, 2, 0],
            [0, 2.6, -4],
            [1, 3, -8],
          ],
        },
        4,
      ),
    ),
    support: build("WoodenPlatform", (b) => platform(b, [0, 3, 0], 7, 6, 3)),
    vine: build("HangingVine", (b) => {
      b.tube(
        [
          [0, 8, 0],
          [0.3, 5, 0],
          [-0.2, 2, 0],
          [0, 0, 0],
        ],
        0.085,
        "#54732e",
        24,
      );
      plant(b, [0.15, 5, 0], 0.45, 41);
    }),
    ladder: build("RopeLadder", (b) =>
      canopyPath(
        b,
        {
          id: "asset",
          from: "",
          to: "",
          kind: "ladder",
          width: 1.4,
          points: [
            [0, 0, 0],
            [0, 5, -7.6],
          ],
        },
        8,
      ),
    ),
    bridge: build("RopeBridge", (b) =>
      canopyPath(
        b,
        {
          id: "asset",
          from: "",
          to: "",
          kind: "bridge",
          width: 2.2,
          points: [
            [0, 2, 0],
            [0, 0.5, -6],
            [0, 2, -12],
          ],
        },
        9,
      ),
    ),
    rock: build("MossyRock", (b) => b.rock([0, 1, 0], [2, 1.5, 1.6], 9)),
    ground: build("ForestGround", (b) =>
      b.add(
        createPhaseFourGroundGeometry(),
        null,
        undefined,
        undefined,
        undefined,
        "ground",
      ),
    ),
    fern: build("TropicalFern", (b) => plant(b, [0, 0, 0], 1.8, 61)),
    torch: build("Torch", (b) => torch(b, [0, 0, 0])),
    river: build("River", (b) => {
      const path = {
        id: "river",
        from: "",
        to: "",
        kind: "bridge" as const,
        width: 9,
        points: [
          [0, 0, 0],
          [2, 0, -10],
          [-1, 0, -20],
        ] as Point3[],
      };
      b.add(createPhaseFourPathCollider(path), "#399b98");
    }),
    waterfall: build("Waterfall", (b) => {
      for (let i = 0; i < 9; i++)
        b.tube(
          [
            [(i - 4) * 0.65, 16, 0],
            [(i - 4) * 0.67, 9, 0.55],
            [(i - 4) * 0.73, 0, 1.5],
          ],
          0.46,
          i % 3 ? "#b4e9dd" : "#60bcb7",
          16,
        );
    }),
  };
}

/** Physics uses the complete visible bough, including the roots under each deck. */
export function createCanopySupportColliders(scene: Group) {
  const result: { name: string; vertices: Float32Array; indices: Uint32Array }[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object instanceof Mesh) || !object.userData.canopySupport) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    result.push({ name: object.name,
      vertices: Float32Array.from(geometry.getAttribute("position").array),
      indices: geometry.index ? Uint32Array.from(geometry.index.array)
        : Uint32Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i),
    });
    geometry.dispose();
  });
  return result;
}
