import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Mesh, Raycaster, Vector3 } from "three";
import { gameMapFromQuery } from "../src/features/game/state/store";
import {
  createPhaseTwoLava,
  createPhaseTwoTerrain,
  createPhaseTwoTrees,
  createPhaseTwoMotes,
  createPhaseTwoChess,
  PHASE_TWO_CHESS_PIECE_KINDS,
  type ChessPieceKind,
} from "../src/features/game/world/phaseTwoAssets";

// The real pieces are loaded GLTF models (see PhaseTwo.tsx); stand in with a
// small box resting on y=0, matching every piece's own base-centered pivot,
// so createPhaseTwoChess's per-kind scale fit has something sane to measure.
function stubPieceGeometries(): Record<ChessPieceKind, BoxGeometry> {
  return Object.fromEntries(
    PHASE_TWO_CHESS_PIECE_KINDS.map((kind) => {
      const box = new BoxGeometry(0.2, 0.4, 0.2);
      box.translate(0, 0.2, 0);
      return [kind, box];
    }),
  ) as Record<ChessPieceKind, BoxGeometry>;
}
import {
  PHASE_TWO_VOLCANOES,
  phaseTwoCharacterSpawn,
  phaseTwoGroundHeight,
  phaseTwoOutsideMap,
  PHASE_TWO_CHESS_BACK_RANK,
  PHASE_TWO_STOOLS,
  PHASE_TWO_TABLE,
  PHASE_TWO_TREE,
} from "../src/features/game/world/phaseTwoLayout";
import { PHASE_TWO_LAVA_STRIPS } from "../src/features/game/world/phaseTwoLava";

test("queens stand on their own color and kings face kings across the board", () => {
  const queen = PHASE_TWO_CHESS_BACK_RANK.indexOf("queen");
  const king = PHASE_TWO_CHESS_BACK_RANK.indexOf("king");
  assert.equal((queen + 0) % 2, 0, "light queen needs a light square");
  assert.equal((queen + 7) % 2, 1, "dark queen needs a dark square");
  assert.equal(Math.abs(queen - king), 1);
  assert.equal(PHASE_TWO_CHESS_BACK_RANK.length, 8);
});

test("the scaled chess set has stump seats behind both armies, with no old side seats", () => {
  const g = createPhaseTwoChess(stubPieceGeometries()),
    mesh = new Mesh(g);
  mesh.updateMatrixWorld();
  g.computeBoundingBox();
  assert.ok(
    g.boundingBox!.max.x - g.boundingBox!.min.x < 1.4,
    "board must fit the monkeys' scale",
  );
  for (const seat of PHASE_TWO_STOOLS) {
    assert.equal(seat.x, PHASE_TWO_TABLE[0]);
    const hits = new Raycaster(
      new Vector3(seat.x, 10, seat.z),
      new Vector3(0, -1, 0),
    ).intersectObject(mesh);
    assert.ok(
      hits.length,
      "each physical seat must coincide with a visible stump",
    );
    assert.ok(
      Math.abs(
        hits[0].point.y -
          phaseTwoGroundHeight(seat.x, seat.z) -
          seat.halfHeight * 2,
      ) < 0.04,
    );
  }
  for (const x of [-1.128, 1.128]) {
    assert.equal(
      new Raycaster(
        new Vector3(x, 10, PHASE_TWO_TABLE[1]),
        new Vector3(0, -1, 0),
      ).intersectObject(mesh).length,
      0,
    );
  }
  g.dispose();
});

test("the enlarged cherry crown emits every falling petal from an actual flower", () => {
  const trees = createPhaseTwoTrees();
  const flowers = trees.petalSources.getAttribute("position");
  const origins = new Set<string>();
  let top = -Infinity;
  for (let i = 0; i < flowers.count; i++) {
    origins.add([flowers.getX(i), flowers.getY(i), flowers.getZ(i)].join(","));
    top = Math.max(top, flowers.getY(i));
  }
  assert.ok(top - phaseTwoGroundHeight(...PHASE_TWO_TREE) > 15);
  for (const count of [180, 650]) {
    const motes = createPhaseTwoMotes(trees.petalSources, count);
    const p = motes.getAttribute("position"),
      type = motes.getAttribute("aType"),
      floor = motes.getAttribute("aFloor");
    for (let i = 0; i < p.count; i++)
      if (type.getX(i) === 1) {
        assert.ok(
          origins.has([p.getX(i), p.getY(i), p.getZ(i)].join(",")),
          "petals cannot spawn in empty air above the crown",
        );
        assert.ok(floor.getX(i) < p.getY(i));
      }
    motes.dispose();
  }
  Object.values(trees).forEach((g) => g.dispose());
});

test("phase2 is a distinct direct map route and preserves existing routes", () => {
  for (const map of ["phase2", "phase3", "islands"] as const)
    assert.equal(gameMapFromQuery(map), map);
  assert.equal(gameMapFromQuery("phase4"), "phase3");
  assert.equal(gameMapFromQuery("invalid"), undefined);
  assert.equal(gameMapFromQuery(null), undefined);
});

test("all phase2 spawns stand above the actual upward-facing terrain triangles", () => {
  const geometry = createPhaseTwoTerrain(),
    mesh = new Mesh(geometry);
  mesh.updateMatrixWorld();
  for (const id of [0, 1, 2] as const) {
    const p = phaseTwoCharacterSpawn(id);
    const hit = new Raycaster(
      new Vector3(p.x, p.y, p.z),
      new Vector3(0, -1, 0),
    ).intersectObject(mesh)[0];
    assert.ok(hit, `missing collider surface for monkey ${id}`);
    assert.ok(hit.distance > 0.55 && hit.distance < 0.8);
    assert.equal(phaseTwoOutsideMap(p), false);
  }
  assert.equal(phaseTwoOutsideMap({ x: 208, y: 0, z: 0 }), true);
  assert.equal(phaseTwoOutsideMap({ x: 0, y: -25, z: 0 }), true);
  geometry.dispose();
});

test("volcano craters are recessed and all lava vertices follow the terrain", () => {
  for (const v of PHASE_TWO_VOLCANOES) {
    const center = phaseTwoGroundHeight(v.x, v.z);
    const rim = phaseTwoGroundHeight(v.x + v.radius * 0.14, v.z);
    assert.ok(rim > center, `volcano ${v.seed} needs an open crater`);
  }
  const g = createPhaseTwoLava(),
    p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) assert.ok(Number.isFinite(p.getY(i)));
  // Each edge's height is a ±3-sample moving average of the raw terrain
  // along the curve (see createPhaseTwoLava's SMOOTH_RADIUS), not the exact
  // value at that point — a ribbon crossing a steep crater wall can
  // legitimately end up several units from the raw sample at one spot,
  // that's the noise the smoothing exists to absorb. Recompute the same
  // average independently here and check it matches, rather than asserting
  // an absolute tolerance that steep terrain would fail either way.
  const SMOOTH_RADIUS = 3;
  let offset = 0;
  for (const strip of PHASE_TWO_LAVA_STRIPS) {
    for (const side of [0, 1]) {
      const sections = strip.length / 2;
      const raw = Array.from({ length: sections }, (_, s) => {
        const point = strip[s * 2 + side];
        return phaseTwoGroundHeight(point.x, point.z);
      });
      for (let s = 0; s < sections; s++) {
        let sum = 0, count = 0;
        for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
          const idx = s + k;
          if (idx < 0 || idx >= sections) continue;
          sum += raw[idx];
          count++;
        }
        const expected = sum / count + 0.13;
        assert.ok(Math.abs(p.getY(offset + s * 2 + side) - expected) < 0.001);
      }
    }
    offset += strip.length;
  }
  g.dispose();
});
