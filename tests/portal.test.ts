import assert from "node:assert/strict";
import { test } from "node:test";
import { ISLANDS, PORTAL } from "../src/features/game/world/layout";
import {
  advancePortalConstruction,
  portalConstructionScale,
} from "../src/features/game/world/portalAnimation";
import { islandEdgeDistance } from "../src/features/game/world/terrain";

test("portal e toda a base ficam apoiados dentro da ilha 2", () => {
  const island2 = ISLANDS[1];
  assert.ok(PORTAL.z < island2.z);
  for (const x of [PORTAL.x - PORTAL.halfWidth, PORTAL.x + PORTAL.halfWidth])
    for (const z of [PORTAL.z - PORTAL.halfDepth, PORTAL.z + PORTAL.halfDepth])
      assert.ok(
        islandEdgeDistance(x, z) < -0.4,
        `base fora da ilha em (${x}, ${z})`,
      );
});

test("portal só se constrói após concluir a segunda fase", () => {
  assert.equal(advancePortalConstruction(0.4, 1, false, true, false), 0);
  assert.equal(advancePortalConstruction(0.4, 1, true, false, false), 0.4);
  assert.equal(advancePortalConstruction(0, 1, true, true, true), 1);
  assert.ok(advancePortalConstruction(0, 1, true, true, false) > 0);
  assert.equal(advancePortalConstruction(0.9, 10, true, true, false), 1);
});

test("animação cresce a partir da base sem escala negativa", () => {
  const start = portalConstructionScale(0);
  const middle = portalConstructionScale(0.5);
  const end = portalConstructionScale(1);
  assert.ok(start.vertical > 0);
  assert.ok(start.vertical < middle.vertical);
  assert.ok(middle.vertical < end.vertical);
  assert.equal(end.vertical, 1);
  assert.equal(end.horizontal, 1);
});
