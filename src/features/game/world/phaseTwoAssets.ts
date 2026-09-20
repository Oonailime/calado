import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  PHASE_TWO_TABLE,
  PHASE_TWO_CHESS_SCALE,
  PHASE_TWO_CHESS_BACK_RANK,
  PHASE_TWO_TREE,
  PHASE_TWO_VOLCANOES,
  phaseTwoGroundHeight as ground,
  phaseTwoNoise,
  phaseTwoRandom as rand,
} from "./phaseTwoLayout";

type Point = [number, number, number];

// Bake static objects into a few vertex-colored meshes instead of thousands of draw calls.
class Batch {
  parts: BufferGeometry[] = [];
  add(
    g: BufferGeometry,
    color: string,
    p: Point = [0, 0, 0],
    scale: Point = [1, 1, 1],
    q = new Quaternion(),
  ) {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    flat.deleteAttribute("uv");
    flat.applyMatrix4(
      new Matrix4().compose(new Vector3(...p), q, new Vector3(...scale)),
    );
    const c = new Color(color),
      colors = new Float32Array(flat.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    this.parts.push(flat);
  }
  box(p: Point, scale: Point, color: string) {
    this.add(new BoxGeometry(), color, p, scale);
  }
  branch(
    a: Point,
    b: Point,
    radius: number,
    tip: number,
    color: string,
    sides = 8,
  ) {
    const start = new Vector3(...a),
      end = new Vector3(...b),
      delta = end.clone().sub(start);
    this.add(
      new CylinderGeometry(tip, radius, delta.length(), sides),
      color,
      start.add(end).multiplyScalar(0.5).toArray() as Point,
      [1, 1, 1],
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
  }
  finish() {
    const result = mergeGeometries(this.parts)!;
    this.parts.forEach((p) => p.dispose());
    result.computeBoundingSphere();
    return result;
  }
}

export function createPhaseTwoTerrain() {
  const segments = 300,
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const dark = new Color("#292a2c"),
    light = new Color("#69635e"),
    c = new Color();
  for (let row = 0; row <= segments; row++) {
    const z = -260 + (row * 520) / segments;
    for (let col = 0; col <= segments; col++) {
      const x = -220 + (col * 440) / segments,
        y = ground(x, z);
      const n = phaseTwoNoise(x * 0.63, z * 0.63);
      c.copy(dark).lerp(
        light,
        n * 0.65 + phaseTwoNoise(x * 0.07, z * 0.07) * 0.25,
      );
      positions.push(x, y, z);
      colors.push(c.r, c.g, c.b);
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

export function createPhaseTwoRocks() {
  const batch = new Batch();
  // The tallest volcano's own summit/crater rim reads oddly with a loose
  // scattered rock perched on it — keep that small cap clear.
  const tallest = PHASE_TWO_VOLCANOES.reduce((a, b) =>
    b.height > a.height ? b : a,
  );
  // Scattered across the same enlarged, now-symmetric footprint as the
  // terrain (see createPhaseTwoTerrain) so rocks keep covering ground in
  // every direction out to the new boundary, not just in front of it — at a
  // lower density than the original per-area count, which felt too dense
  // once spread over this much bigger area.
  for (let i = 0; i < 1200; i++) {
    const x = (rand(i * 7 + 1) - 0.5) * 380,
      z = (rand(i * 7 + 2) - 0.5) * 470;
    if (Math.hypot((x + 4) / 1.25, z - 5) < 11) continue;
    if (Math.hypot(x - tallest.x, z - tallest.z) < tallest.radius * 0.25)
      continue;
    const size = 0.3 + Math.pow(rand(i * 7 + 3), 3) * 4.8;
    const g = new IcosahedronGeometry(1, 1),
      pos = g.getAttribute("position");
    for (let k = 0; k < pos.count; k++) {
      const rough =
        0.8 + phaseTwoNoise(pos.getX(k) * 3 + i, pos.getZ(k) * 3) * 0.4;
      pos.setXYZ(
        k,
        pos.getX(k) * rough,
        pos.getY(k) * rough,
        pos.getZ(k) * rough,
      );
    }
    g.computeVertexNormals();
    batch.add(
      g,
      ["#333236", "#484346", "#59524e", "#252629"][i % 4],
      [x, ground(x, z) + size * 0.17, z],
      [size, size * (0.6 + rand(i + 82)), size * 0.7],
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i),
    );
  }
  // Columns expose the layered basalt beneath the sanctuary's edge.
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2,
      x = -4 + Math.cos(a) * 14,
      z = 5 + Math.sin(a) * 11;
    batch.add(
      new CylinderGeometry(0.8, 1.2, 7 + rand(i) * 2, 5),
      "#353235",
      [x, ground(x, z) - 2.7, z],
      [1.4, 1, 1],
    );
  }
  return batch.finish();
}

// Tapered, ridged curved limbs keep the trunk organic instead of joining straight rods.
function curvedLimb(
  batch: Batch,
  points: Point[],
  radius: number,
  tip: number,
  seed: number,
) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const segments = radius > 0.2 ? 22 : 9,
    sides = radius > 0.2 ? 12 : 6;
  const frames = curve.computeFrenetFrames(segments, false);
  const vertices: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      center = curve.getPointAt(t);
    const r = tip + (radius - tip) * Math.pow(1 - t, 1.3);
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const ridge = 1 + Math.sin(angle * 5 + t * 5 + seed) * 0.12;
      const offset = frames.normals[i]
        .clone()
        .multiplyScalar(Math.cos(angle) * r * ridge)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * r * ridge);
      vertices.push(
        center.x + offset.x,
        center.y + offset.y,
        center.z + offset.z,
      );
      if (i < segments && j < sides) {
        const k = i * (sides + 1) + j,
          n = k + sides + 1;
        indices.push(k, k + 1, n, k + 1, n + 1, n);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  batch.add(g, radius > 0.2 ? "#49352e" : "#654439");
  return curve;
}

function cherryFlowerGeometry(petalCount = 5) {
  // Five cupped petals with a notched outer edge, rather than solid polygonal balls.
  const p: number[] = [];
  for (let petal = 0; petal < petalCount; petal++) {
    const angle = (petal / 5) * Math.PI * 2;
    const ring = [
      [0, 0.12],
      [-0.4, 0.55],
      [-0.28, 0.95],
      [0, 0.84],
      [0.28, 0.95],
      [0.4, 0.55],
    ];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      for (const [x, z] of [[0, 0.48], a, b]) {
        p.push(
          Math.cos(angle) * x - Math.sin(angle) * z,
          z * z * 0.18,
          Math.sin(angle) * x + Math.cos(angle) * z,
        );
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

export function createPhaseTwoTrees() {
  const bark = new Batch(),
    petals = new Batch();
  const [tx, tz] = PHASE_TWO_TREE,
    ty = ground(tx, tz);
  const at = (x: number, y: number, z: number): Point => [
    tx + x,
    ty + y,
    tz + z,
  ];
  const trunk = curvedLimb(
    bark,
    [
      at(0, -0.12, 0),
      at(-0.6, 2.4, 0.15),
      at(0.1, 4.8, -0.1),
      at(1.55, 7, -0.3),
      at(1.8, 9.7, -0.8),
      at(1.25, 12.4, -1.2),
    ],
    1.05,
    0.1,
    2,
  );
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399,
      r = 2.5 + rand(i + 81) * 1.6;
    const x = tx + Math.cos(a) * r,
      z = tz + Math.sin(a) * r;
    curvedLimb(
      bark,
      [
        at(-0.15, 1.2, 0),
        at(Math.cos(a) * r * 0.4, 0.38, Math.sin(a) * r * 0.4),
        [x, ground(x, z) + 0.025, z],
      ],
      0.38,
      0.015,
      i,
    );
  }
  const flower = cherryFlowerGeometry();
  const blossomColors = ["#f2a8c2", "#f7c6d5", "#ffe1e8", "#dd769e", "#efb2ca"];
  const sources: number[] = [];
  for (let i = 0; i < 32; i++) {
    const a = i * 2.399 + 0.25;
    const crown = i >= 18 && i < 24;
    const middle = i >= 24;
    const reach = crown ? 2.4 + rand(i * 9) * 3 : 6.2 + rand(i * 9) * 3.1;
    const attach = trunk.getPointAt(
      crown ? 0.79 : middle ? 0.65 : 0.35 + rand(i + 22) * 0.24,
    );
    const end = at(
      Math.cos(a) * reach + 0.65,
      crown
        ? 13.1 + rand(i) * 1.2
        : middle
          ? 12.2 + rand(i) * 0.8
          : 10 + rand(i + 11) * 3,
      Math.sin(a) * reach * 0.78 - 0.3,
    );
    const limb = curvedLimb(
      bark,
      [
        attach.toArray() as Point,
        [
          attach.x + Math.cos(a) * reach * 0.3,
          attach.y + 1.5,
          attach.z + Math.sin(a) * reach * 0.25,
        ],
        [end[0] - Math.cos(a) * 1.3, end[1] - 0.2, end[2] - Math.sin(a) * 1.1],
        end,
      ],
      crown ? 0.18 : 0.34,
      0.025,
      i,
    );
    for (let j = 0; j < 7; j++) {
      const attachTwig = limb.getPointAt(0.38 + j * 0.085);
      const spread = a + (rand(i * 70 + j) - 0.5) * 2.5;
      const tip: Point = [
        attachTwig.x + Math.cos(spread) * (1.4 + rand(i + j)),
        attachTwig.y + 0.45 + rand(i * 7 + j) * 1.5,
        attachTwig.z + Math.sin(spread) * 1.6,
      ];
      const twig = curvedLimb(
        bark,
        [
          attachTwig.toArray() as Point,
          [
            tip[0] - Math.cos(spread) * 0.6,
            tip[1] + 0.1,
            tip[2] - Math.sin(spread) * 0.6,
          ],
          tip,
        ],
        0.055,
        0.006,
        i + j,
      );
      for (let k = 0; k < 42; k++) {
        const seed = i * 10000 + j * 100 + k,
          t = 0.22 + rand(seed + 1) * 0.78;
        const center = twig.getPointAt(t);
        const p: Point = [
          center.x + (rand(seed + 2) - 0.5) * 1.2,
          center.y + (rand(seed + 3) - 0.5) * 0.85,
          center.z + (rand(seed + 4) - 0.5) * 1.2,
        ];
        const size = 0.1 + rand(seed + 5) * 0.07;
        petals.add(
          flower.clone(),
          blossomColors[k % 5],
          p,
          [size, size, size],
          new Quaternion().setFromEuler(
            new Euler(
              rand(seed + 6) * 3,
              rand(seed + 7) * 6,
              rand(seed + 8) * 3,
            ),
          ),
        );
        sources.push(...p);
      }
    }
  }
  const fallenPetal = cherryFlowerGeometry(1);
  for (let i = 0; i < 1600; i++) {
    const a = rand(i * 4) * Math.PI * 2,
      r = Math.sqrt(rand(i * 4 + 1)) * 12;
    const x = tx + Math.cos(a) * r,
      z = tz + Math.sin(a) * r;
    const size = 0.07 + rand(i) * 0.045;
    petals.add(
      fallenPetal.clone(),
      blossomColors[i % 5],
      [x, ground(x, z) + 0.045, z],
      [size, size, size],
    );
  }
  flower.dispose();
  fallenPetal.dispose();
  const petalSources = new BufferGeometry();
  petalSources.setAttribute("position", new Float32BufferAttribute(sources, 3));
  const dead = new Batch();
  // Spread over a larger patch than the original, reaching toward both the
  // outer and the mirrored-behind volcano rings (see PHASE_TWO_VOLCANOES) so
  // the dry grove keeps the valley floor dressed all the way out on every
  // side instead of stopping well short of it.
  for (let i = 0; i < 650; i++) {
    const x = 18 + rand(i * 6 + 1) * 90,
      z = -63 + rand(i * 6 + 2) * 260;
    if (ground(x, z) > 4) continue;
    const y = ground(x, z),
      h = 3 + rand(i * 6 + 3) * 7;
    dead.branch([x, y, z], [x + 0.2, y + h, z], 0.18, 0.018, "#242226", 6);
    for (let j = 0; j < 9; j++) {
      const a = j * 2.399 + i,
        level = y + h * (0.22 + j * 0.075),
        length = h * (0.23 - j * 0.012);
      const end: Point = [
        x + Math.cos(a) * length,
        level + length * 0.5,
        z + Math.sin(a) * length,
      ];
      dead.branch([x, level, z], end, 0.055, 0.012, "#302b2c", 5);
      dead.branch(
        end,
        [end[0] + 0.13, end[1] + length * 0.6, end[2] - 0.12],
        0.022,
        0.004,
        "#302b2c",
        4,
      );
    }
  }
  return {
    petalSources,
    bark: bark.finish(),
    blossoms: petals.finish(),
    dead: dead.finish(),
  };
}

export type ChessPieceKind =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";

// Base folder for the imported monkey-sculpted piece models — see
// public/assets/models/chess-monkey/ (recentered + decimated from the
// assets_referencia/chess_monkey .blend sources). Exported so PhaseTwo.tsx
// can load them all with a single useLoader(GLTFLoader, [...]) call.
export const PHASE_TWO_CHESS_PIECE_KINDS: ChessPieceKind[] = [
  "pawn",
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
];
export const PHASE_TWO_CHESS_PIECE_URL = (kind: ChessPieceKind) =>
  `/assets/models/chess-monkey/${kind}.glb`;

// Matches the previous procedural set's own height hierarchy exactly — only
// the pawn and the king stood out from the rest — so swapping in the sculpted
// monkey pieces keeps "the same proportion" the board already had.
const PIECE_HEIGHT: Record<ChessPieceKind, number> = {
  pawn: 0.28,
  rook: 0.43,
  knight: 0.43,
  bishop: 0.43,
  queen: 0.43,
  king: 0.52,
};
// The sculpts are stockier than the old lathe-turned pieces (a monkey figure
// rather than an abstract spindle), so scaling every one of them to hit its
// target height outright would spill well past its own square at the board's
// tight 0.3 spacing. Capping the horizontal scale — independent of the
// vertical one — keeps every piece's footprint inside its square while still
// hitting the full target height whenever the model's own proportions allow.
const PIECE_FOOTPRINT_CAP = 0.26;

function pieceFit(geometry: BufferGeometry, targetHeight: number) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const vertical = targetHeight / height;
  const horizontal = Math.min(vertical, PIECE_FOOTPRINT_CAP / footprint);
  return { vertical, horizontal };
}

export function createPhaseTwoChess(
  pieces: Record<ChessPieceKind, BufferGeometry>,
) {
  const batch = new Batch();
  const x = 0,
    z = 0,
    y = 0;
  batch.box([x, y + 1.2, z], [2.8, 0.26, 2.8], "#503221");
  batch.box([x, y + 1.35, z], [2.62, 0.055, 2.62], "#bb8b49");
  for (const dx of [-1.05, 1.05])
    for (const dz of [-1.05, 1.05]) {
      batch.box([x + dx, y + 0.55, z + dz], [0.25, 1.1, 0.25], "#37291f");
    }
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      batch.box(
        [x + (col - 3.5) * 0.3, y + 1.391, z + (row - 3.5) * 0.3],
        [0.298, 0.04, 0.298],
        (row + col) % 2 ? "#352724" : "#e6c38b",
      );
    }
  const order = PHASE_TWO_CHESS_BACK_RANK;
  const fit = Object.fromEntries(
    PHASE_TWO_CHESS_PIECE_KINDS.map((kind) => [
      kind,
      pieceFit(pieces[kind], PIECE_HEIGHT[kind]),
    ]),
  ) as Record<ChessPieceKind, { vertical: number; horizontal: number }>;
  // The armies face one another across the board rather than both facing the
  // same way the model happened to be sculpted in.
  const facing = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
  for (let side = 0; side < 2; side++)
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 8; col++) {
        const px = x + (col - 3.5) * 0.3,
          pz = z + ((side ? 7 - row : row) - 3.5) * 0.3;
        const py = y + 1.415,
          kind: ChessPieceKind = row ? "pawn" : order[col],
          color = side ? "#4a2f1c" : "#f2ede2";
        const { vertical, horizontal } = fit[kind];
        batch.add(
          pieces[kind].clone(),
          color,
          [px, py, pz],
          [horizontal, vertical, horizontal],
          side ? facing : undefined,
        );
      }
  for (const sz of [-2.35, 2.35]) {
    batch.add(new CylinderGeometry(0.61, 0.72, 0.78, 9), "#463b35", [
      x,
      y + 0.39,
      z + sz,
    ]);
    batch.add(new CylinderGeometry(0.65, 0.63, 0.11, 12), "#8e7460", [
      x,
      y + 0.8,
      z + sz,
    ]);
    for (let k = 1; k <= 4; k++)
      batch.add(
        new TorusGeometry(k * 0.12, 0.008, 3, 24),
        "#514032",
        [x, y + 0.86, z + sz],
        [1, 1, 1],
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
      );
  }
  const result = batch.finish();
  result.scale(
    PHASE_TWO_CHESS_SCALE,
    PHASE_TWO_CHESS_SCALE,
    PHASE_TWO_CHESS_SCALE,
  );
  result.translate(
    PHASE_TWO_TABLE[0],
    ground(...PHASE_TWO_TABLE),
    PHASE_TWO_TABLE[1],
  );
  result.computeBoundingSphere();
  return result;
}

export function createPhaseTwoLantern() {
  const batch = new Batch(),
    x = 2.3,
    z = 3,
    y = ground(x, z);
  batch.box([x, y + 0.12, z], [0.8, 0.24, 0.8], "#55422f");
  batch.box([x, y + 1.22, z], [0.76, 0.1, 0.76], "#71532e");
  for (const dx of [-0.28, 0.28])
    for (const dz of [-0.28, 0.28])
      batch.branch(
        [x + dx, y + 0.22, z + dz],
        [x + dx, y + 1.2, z + dz],
        0.04,
        0.035,
        "#725633",
      );
  batch.add(
    new CylinderGeometry(0.1, 0.61, 0.35, 4),
    "#4b3726",
    [x, y + 1.43, z],
    [1, 1, 1],
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
  );
  batch.add(new SphereGeometry(0.07, 8, 6), "#bc965b", [x, y + 1.67, z]);
  batch.add(new TorusGeometry(0.14, 0.025, 6, 16), "#a4814f", [x, y + 1.84, z]);
  batch.add(new CylinderGeometry(0.12, 0.16, 0.28, 12), "#e4bf79", [
    x,
    y + 0.4,
    z,
  ]);
  return batch.finish();
}

export function createPhaseTwoLava() {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  function ribbon(points: Point[], width: number) {
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
    const steps = 180,
      base = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        p = curve.getPoint(t),
        tangent = curve.getTangent(t);
      const w = width * (0.8 + Math.sin(t * 47) * 0.18);
      for (let side = 0; side < 2; side++) {
        const x = p.x + tangent.z * (side - 0.5) * w,
          z = p.z - tangent.x * (side - 0.5) * w;
        positions.push(x, ground(x, z) + 0.13, z);
        uvs.push(side, t * 24);
      }
      if (i < steps) {
        const a = base + i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  ribbon(
    [
      [45, 0, -117],
      [39, 0, -89],
      [50, 0, -64],
      [22, 0, -36],
      [31, 0, -18],
      [19, 0, -3],
      [30, 0, 14],
      [45, 0, 37],
      [57, 0, 63],
    ],
    2.5,
  );
  ribbon(
    [
      [18, 0, -34],
      [6, 0, -22],
      [13, 0, -14],
      [19, 0, -3],
    ],
    0.8,
  );
  for (const v of PHASE_TWO_VOLCANOES) {
    for (let j = 0; j < 4; j++) {
      const a = j * 1.8 + v.seed;
      const points: Point[] = [];
      for (let k = 0; k < 8; k++) {
        const r = v.radius * (0.11 + k * 0.105),
          angle = a + Math.sin(k * 1.6 + v.seed) * 0.07;
        points.push([v.x + Math.cos(angle) * r, 0, v.z + Math.sin(angle) * r]);
      }
      ribbon(points, j === 0 ? 0.85 : 0.24);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Particle origins are sampled from rendered flowers, never a bounding box above the crown. */
export function createPhaseTwoMotes(
  petalSources: BufferGeometry,
  count: number,
) {
  const positions: number[] = [],
    seeds: number[] = [],
    types: number[] = [],
    floors: number[] = [];
  const flowers = petalSources.getAttribute("position");
  for (let i = 0; i < count; i++) {
    const petal = i < count * 0.45;
    const flower = Math.floor(rand(i * 4) * flowers.count);
    const x = petal ? flowers.getX(flower) : (rand(i * 4) - 0.5) * 100;
    const y = petal ? flowers.getY(flower) : rand(i * 4 + 1) * 32;
    const z = petal ? flowers.getZ(flower) : -35 + rand(i * 4 + 2) * 70;
    positions.push(x, y, z);
    seeds.push(rand(i * 4 + 3));
    types.push(petal ? 1 : 0);
    floors.push(ground(x, z) + 0.045);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
  g.setAttribute("aType", new Float32BufferAttribute(types, 1));
  g.setAttribute("aFloor", new Float32BufferAttribute(floors, 1));
  return g;
}
