import assert from "node:assert/strict";
import { test } from "node:test";
import { CatmullRomCurve3, Mesh, Raycaster, Vector3 } from "three";
import { gameMapFromQuery } from "../src/features/game/state/store";
import {
  climbingPosition,
  nearestArborealInteraction,
  vineLength,
} from "../src/features/game/world/forestLayout";
import {
  createPhaseFourBranchGeometry,
  createPhaseFourPathCollider,
  createGiantTreeRootGeometry,
  GIANT_TREE_ROOT_REACH,
  ROOT_EMBED_DEPTH,
  phaseFourPathCurve,
  phaseFourRailingRange,
} from "../src/features/game/world/phaseFourAssets";
import {
  PHASE_FOUR_TREES,
  PHASE_FOUR_LADDER_SITE,
  PHASE_FOUR_PATHS,
  PHASE_FOUR_PLATFORMS,
  PHASE_FOUR_SWING_SITES,
  PHASE_FOUR_PULL_VINE_CURVE,
  PHASE_FOUR_PULL_VINE_POINTS,
  PHASE_FOUR_SPAWN,
  PHASE_FOUR_RIVER,
  PHASE_FOUR_UPPER_RIVER,
  phaseFourAdjacentSite,
  phaseFourCharacterSpawn,
} from "../src/features/game/world/phaseFourLayout";
import {
  createPhaseFourGroundGeometry,
  phaseFourCliffBlend,
  phaseFourGroundHeight,
} from "../src/features/game/world/phaseFourTerrain";

test("giant roots extend into solid tapered tips without open mesh edges", () => {
  const radius = 3;
  const geometry = createGiantTreeRootGeometry(radius);
  const positions = geometry.getAttribute("position");
  const indices = geometry.index!;
  const edges = new Map<string, number>();
  const key = (index: number) => [positions.getX(index), positions.getY(index), positions.getZ(index)]
    .map((v) => Math.round(v * 1e5)).join(",");
  for (let i = 0; i < indices.count; i += 3) {
    const face = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    for (let side = 0; side < 3; side++) {
      const edge = [key(face[side]), key(face[(side + 1) % 3])].sort().join("|");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  for (const [edge, count] of edges) assert.equal(count, 2, `open or overlapping edge: ${edge}`);
  const mesh = new Mesh(geometry);
  mesh.updateMatrixWorld();
  let previousHeight = Infinity;
  for (const z of [9, 10, 11, 11.3]) {
    const hits = new Raycaster(new Vector3(0, 5, z), new Vector3(0, -1, 0)).intersectObject(mesh);
    assert.ok(hits.length, "the extension must have outward-facing bark");
    assert.ok(hits[0].point.y < previousHeight, "the root must taper toward its tip");
    previousHeight = hits[0].point.y;
  }
  geometry.dispose();
});

test("the entire giant root spread clears both rivers and bases stay embedded", () => {
  const rivers = [PHASE_FOUR_RIVER, PHASE_FOUR_UPPER_RIVER].map((points) =>
    new CatmullRomCurve3(points.map((p) => new Vector3(...p))).getSpacedPoints(1200),
  );
  for (const tree of PHASE_FOUR_TREES) {
    const [x, y, z] = tree.position;
    for (const [index, samples] of rivers.entries()) {
      const distance = Math.min(...samples.map((p) => Math.hypot(x - p.x, z - p.z)));
      const waterHalfWidth = index === 0 ? 5 : 3.85;
      assert.ok(distance > tree.radius * GIANT_TREE_ROOT_REACH + waterHalfWidth + 0.75,
        `tree ${tree.seed}: roots intrude into river ${index}`);
    }
    assert.ok(Math.abs(y - (phaseFourGroundHeight(x, z) - ROOT_EMBED_DEPTH)) < 0.03,
      `tree ${tree.seed}: base no longer follows its new ground position`);
  }
});

test("phase4 resolves independently and all three spawns clear the arrival deck edges", () => {
  assert.equal(gameMapFromQuery("phase4"), "phase4");
  const deck = PHASE_FOUR_PLATFORMS[0];
  for (const id of [0, 1, 2] as const) {
    const p = phaseFourCharacterSpawn(id);
    assert.ok(Math.abs(p.x - deck.center[0]) < deck.width / 2 - 0.5);
    assert.ok(Math.abs(p.z - deck.center[2]) < deck.depth / 2 - 0.5);
    assert.ok(p.y > deck.center[1] + 0.55);
  }
});

test("the lower platforms retain their walking routes", () => {
  const visited = new Set(["arrival"]);
  for (let pass = 0; pass < PHASE_FOUR_PLATFORMS.length; pass++) {
    for (const path of PHASE_FOUR_PATHS) {
      if (visited.has(path.from)) visited.add(path.to);
      if (visited.has(path.to)) visited.add(path.from);
      assert.ok(path.width >= 1.4);
    }
  }
  for (const deck of PHASE_FOUR_PLATFORMS.filter(
    (deck) =>
      deck.id !== "vine-plateau" &&
      deck.id !== "waterfall-summit" &&
      // Reached only once the cube shrine unlocks, not via the base graph.
      deck.id !== "summit-shrine",
  ))
    assert.ok(visited.has(deck.id), deck.id);
});

test("the western bridge goes behind the tree with clearance for its full width", () => {
  const path = PHASE_FOUR_PATHS.find((p) => p.id === "crown-bridge")!;
  const curve = phaseFourPathCurve(path);
  for (let i = 0; i <= 600; i++) {
    const p = curve.getPoint(i / 600);
    for (const tree of PHASE_FOUR_TREES)
      assert.ok(Math.hypot(p.x - tree.position[0], p.z - tree.position[2]) >
        tree.radius + path.width / 2 + 0.3, `bridge clips tree ${tree.seed}`);
    if (Math.abs(p.x - PHASE_FOUR_TREES[1].position[0]) < 1)
      assert.ok(p.z < PHASE_FOUR_TREES[1].position[2] - 5, "cross behind the trunk");
  }
});

test("railings end at the platform edges instead of crossing their floors", () => {
  for (const path of PHASE_FOUR_PATHS.filter((p) => p.kind !== "branch")) {
    const curve = phaseFourPathCurve(path);
    for (const side of [-1, 1]) {
      const [start, end] = phaseFourRailingRange(path, side);
      assert.ok(start > 0 && end < 1 && end > start);
      for (let i = 0; i <= 120; i++) {
        const t = start + (end - start) * i / 120;
        const p = curve.getPoint(t), tangent = curve.getTangent(t);
        const length = Math.hypot(tangent.x, tangent.z);
        const x = p.x + tangent.z / length * path.width / 2 * side;
        const z = p.z - tangent.x / length * path.width / 2 * side;
        for (const deck of PHASE_FOUR_PLATFORMS.filter((d) => d.id === path.from || d.id === path.to))
          assert.ok(Math.abs(x - deck.center[0]) > deck.width / 2 + 0.1 ||
            Math.abs(z - deck.center[2]) > deck.depth / 2 + 0.1,
          `${path.id}: railing intrudes into ${deck.id}`);
      }
    }
  }
});

test("wide branch supports remain below every platform they cross", () => {
  for (const path of PHASE_FOUR_PATHS.filter((p) => p.kind === "branch")) {
    const geometry = createPhaseFourBranchGeometry(path);
    const mesh = new Mesh(geometry);
    mesh.updateMatrixWorld();
    for (const deck of PHASE_FOUR_PLATFORMS) {
      for (let x = -deck.width / 2; x <= deck.width / 2; x += 0.4)
        for (let z = -deck.depth / 2; z <= deck.depth / 2; z += 0.4) {
          const hits = new Raycaster(new Vector3(deck.center[0] + x, deck.center[1] + 10, deck.center[2] + z),
            new Vector3(0, -1, 0)).intersectObject(mesh);
          if (hits.length) assert.ok(hits[0].point.y < deck.center[1] - 0.28,
            `${path.id}: bark protrudes through ${deck.id}`);
        }
    }
    geometry.dispose();
  }
});

test("the pull vine reaches a high plateau and pendulums continue to the summit behind the waterfall", () => {
  const plateau = PHASE_FOUR_PLATFORMS.find(
    (deck) => deck.id === "vine-plateau",
  )!;
  const summit = PHASE_FOUR_PLATFORMS.find(
    (deck) => deck.id === "waterfall-summit",
  )!;
  assert.ok(plateau.center[1] > 20);
  assert.ok(
    Math.abs(PHASE_FOUR_LADDER_SITE.climb.topX! - plateau.center[0]) <
      plateau.width / 2 - 0.5,
  );
  assert.ok(
    Math.abs(PHASE_FOUR_LADDER_SITE.climb.topZ! - plateau.center[2]) <
      plateau.depth / 2 - 0.5,
  );
  assert.ok(
    Math.abs(PHASE_FOUR_LADDER_SITE.climb.topY! - plateau.center[1]) < 1,
  );
  assert.ok(
    summit.center[1] >
      Math.max(
        ...PHASE_FOUR_PLATFORMS.filter(
          // The shrine sits higher still, but it's reached by a footpath
          // once unlocked, not by this swing-vine sequence.
          (p) => p !== summit && p.id !== "summit-shrine",
        ).map((p) => p.center[1]),
      ),
  );
  assert.ok(summit.center[2] < -39);
  const grips = PHASE_FOUR_SWING_SITES.map((site) => site.vine.twoPoint!.grip);
  assert.ok(Math.abs(grips[0].x - plateau.center[0]) < plateau.width / 2);
  assert.ok(Math.abs(grips[0].z - plateau.center[2]) < plateau.depth / 2);
  assert.ok(Math.abs(grips.at(-1)!.x - summit.center[0]) < summit.width / 2);
  assert.ok(Math.abs(grips.at(-1)!.z - summit.center[2]) < summit.depth / 2);
  for (let i = 0; i < grips.length; i++) {
    assert.ok(grips[i].y > plateau.center[1]);
    if (i) {
      assert.ok(grips[i].z < grips[i - 1].z);
      assert.ok(
        Math.hypot(grips[i].x - grips[i - 1].x, grips[i].z - grips[i - 1].z) <
          10.5,
      );
    }
  }
});

test("the entire walking route has upward-facing continuous collision surfaces", () => {
  for (const path of PHASE_FOUR_PATHS) {
    const geometry = createPhaseFourPathCollider(path),
      mesh = new Mesh(geometry);
    mesh.updateMatrixWorld();
    const curve = phaseFourPathCurve(path);
    for (let i = 1; i < 100; i++) {
      const t = i / 100,
        p = curve.getPoint(t),
        tangent = curve.getTangent(t);
      assert.ok(Math.abs(tangent.y) < 0.72, `${path.id}: excessive slope`);
      const ray = new Raycaster(
        p.clone().add(new Vector3(0, 2, 0)),
        new Vector3(0, -1, 0),
      );
      const hits = ray.intersectObject(mesh);
      assert.ok(hits.length, `${path.id}: missing floor at ${t}`);
      assert.ok(
        Math.abs(hits[0].point.y - p.y) < 0.08,
        `${path.id}: surface offset`,
      );
    }
    geometry.dispose();
  }
});

test("the grab vine starts at the arrival deck and releases inside the high plateau", () => {
  const site = PHASE_FOUR_LADDER_SITE;
  const bottom = climbingPosition(site, 0),
    top = climbingPosition(site, 1);
  assert.equal(bottom.y, site.climb.baseY);
  assert.equal(top.y, site.climb.topY);
  assert.equal(nearestArborealInteraction(bottom, [site])?.kind, "tree");
  assert.equal(
    nearestArborealInteraction({ ...bottom, y: -3 }, [site]),
    undefined,
  );
  assert.equal(site.climb.dismount, true);
  const deck = PHASE_FOUR_PLATFORMS.find((p) => p.id === "vine-plateau")!;
  assert.ok(Math.abs(top.x - deck.center[0]) < deck.width / 2 - 0.5);
  assert.ok(Math.abs(top.z - deck.center[2]) < deck.depth / 2 - 0.5);
});

test("the dedicated pull vine is visible from the spawn deck and ends at the plateau", () => {
  const site = PHASE_FOUR_LADDER_SITE;
  const start = climbingPosition(site, 0);
  const end = climbingPosition(site, 1);
  const firstLow = PHASE_FOUR_PULL_VINE_POINTS[2];
  const final = PHASE_FOUR_PULL_VINE_POINTS.at(-1)!;
  assert.ok(
    Math.hypot(start.x - PHASE_FOUR_SPAWN.x, start.z - PHASE_FOUR_SPAWN.z) <
      1e-6,
  );
  assert.ok(Math.hypot(firstLow[0] - start.x, firstLow[2] - start.z) < 0.01);
  assert.ok(Math.abs(final[0] - end.x) < 1e-6);
  assert.ok(Math.abs(final[2] - end.z) < 1e-6);
  assert.ok(
    Math.abs(PHASE_FOUR_PULL_VINE_CURVE.getPointAt(1).y - final[1]) < 1e-6,
  );
});

test("bark stays beneath the underside of the wooden floor through every bend", () => {
  for (const path of PHASE_FOUR_PATHS.filter(
    (path) => path.kind === "branch",
  )) {
    const geometry = createPhaseFourBranchGeometry(path),
      mesh = new Mesh(geometry),
      curve = phaseFourPathCurve(path);
    mesh.updateMatrixWorld();
    for (let i = 1; i < 100; i++) {
      const p = curve.getPoint(i / 100);
      const hits = new Raycaster(
        p.clone().add(new Vector3(0, 1, 0)),
        new Vector3(0, -1, 0),
      ).intersectObject(mesh);
      assert.ok(hits.length, `${path.id}: no branch beneath floor`);
      assert.ok(
        hits[0].point.y < p.y - 0.2,
        `${path.id}: bark intersects planks at ${i}%`,
      );
    }
    geometry.dispose();
  }
});

test("two-ended vines are distributed across the route with independent wooden supports", () => {
  assert.ok(PHASE_FOUR_SWING_SITES.length >= 6);
  for (const rope of PHASE_FOUR_SWING_SITES) {
    const span = rope.vine.twoPoint!;
    assert.ok(span);
    assert.equal(rope.vine.disableCharacterCollision, true);
    assert.ok(!rope.vine.directGrip && !rope.vine.brachiation);
    assert.ok(PHASE_FOUR_TREES[span.frontTreeIndex]);
    assert.ok(PHASE_FOUR_TREES[span.rearTreeIndex]);
    assert.ok(span.grip.y < Math.min(rope.vine.attachY, span.rear.y) - 2);
    assert.ok(
      Math.hypot(rope.vine.x - span.rear.x, rope.vine.z - span.rear.z) > 8,
    );
    for (const tree of PHASE_FOUR_TREES)
      assert.ok(
        Math.hypot(
          span.grip.x - tree.position[0],
          span.grip.z - tree.position[2],
        ) >
          tree.radius * 0.86 + 0.4,
      );
  }
  assert.equal(
    PHASE_FOUR_SWING_SITES[0].vine.twoPoint?.fixedAttachment,
    "front",
  );
});

test("green ground covers the valley and the upper river continues into the waterfall", () => {
  for (const p of PHASE_FOUR_RIVER.slice(1))
    assert.ok(phaseFourGroundHeight(p[0], p[2]) < p[1] - 1);
  for (const x of [-40, -20, 30, 50])
    assert.ok(phaseFourGroundHeight(x, 14) > -4.8);
  const geometry = createPhaseFourGroundGeometry(),
    mesh = new Mesh(geometry);
  mesh.updateMatrixWorld();
  const hits = new Raycaster(
    new Vector3(-13, 20, 14),
    new Vector3(0, -1, 0),
  ).intersectObject(mesh);
  assert.ok(hits.length, "ground must face upward beneath the spawn platform");
  assert.ok(Math.abs(hits[0].point.y - phaseFourGroundHeight(-13, 14)) < 0.1);
  assert.equal(
    geometry.getAttribute("color").count,
    geometry.getAttribute("position").count,
  );
  const colors = geometry.getAttribute("color"),
    groundPositions = geometry.getAttribute("position");
  for (let i = 0; i < colors.count; i++) {
    const blend = phaseFourCliffBlend(groundPositions.getZ(i));
    const steepness = 4 * blend * (1 - blend);
    if (steepness > 0.5)
      assert.ok(
        colors.getX(i) >= colors.getY(i),
        "the cliff face must read as stone/earth, not grass",
      );
    else
      assert.ok(
        colors.getY(i) > colors.getX(i),
        "terrain must stay green away from the cliff",
      );
  }
  const source = PHASE_FOUR_UPPER_RIVER.at(-1)!;
  assert.equal(source[0], 14);
  assert.equal(source[1], 12.7);
  assert.equal(source[2], -39);
  for (const p of PHASE_FOUR_UPPER_RIVER.slice(0, -1))
    assert.ok(phaseFourGroundHeight(p[0], p[2]) < p[1]);
  geometry.dispose();
});

test("swinging ropes have reachable neighbours and match the deck heights", () => {
  for (const site of PHASE_FOUR_SWING_SITES) {
    assert.equal(vineLength(site), site.vine.length);
    assert.ok(
      (site.vine.grabRadius ?? 0) >= 0.9,
      `${site.id}: upper pendulum needs a forgiving handoff radius`,
    );
    assert.ok(
      site.vine.attachY - vineLength(site) > -2,
      "the pendulum clears the valley floor",
    );
  }
  for (const [i, site] of PHASE_FOUR_SWING_SITES.entries()) {
    assert.equal(
      phaseFourAdjacentSite(site, "next"),
      PHASE_FOUR_SWING_SITES[i + 1],
    );
    assert.equal(
      phaseFourAdjacentSite(site, "previous"),
      PHASE_FOUR_SWING_SITES[i - 1],
    );
  }
});
