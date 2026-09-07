import assert from "node:assert/strict";
import { test } from "node:test";
import { ISLANDS, PORTAL } from "../src/features/game/world/layout";
import {
  advancePortalConstruction,
  isOriginalPortalRune,
  portalActivationProgress,
  PORTAL_LETTERS,
  PORTAL_SOLID_END,
  portalPartOrder,
  portalPieceProgress,
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
  assert.ok(PORTAL.groundInset > 0);
});

test("portal só se constrói após concluir a segunda fase", () => {
  assert.equal(advancePortalConstruction(0.4, 1, false, true, false), 0);
  assert.equal(advancePortalConstruction(0.4, 1, true, false, false), 0.4);
  assert.equal(advancePortalConstruction(0, 1, true, true, true), 1);
  assert.ok(advancePortalConstruction(0, 1, true, true, false) > 0);
  assert.equal(advancePortalConstruction(0.9, 10, true, true, false), 1);
});

test("peças sólidas terminam antes de o interior azul ligar", () => {
  const total = 20;
  assert.equal(portalActivationProgress(PORTAL_SOLID_END), 0);
  for (let index = 0; index < total; index += 1)
    assert.equal(portalPieceProgress(index, total, PORTAL_SOLID_END), 1);
  assert.ok(portalActivationProgress((PORTAL_SOLID_END + 1) / 2) > 0);
  assert.equal(portalActivationProgress(1), 1);
});

test("fundação, piso, pilares e arco são montados nessa ordem", () => {
  assert.ok(portalPartOrder("Foundation") < portalPartOrder("FloorPaver_01"));
  assert.ok(portalPartOrder("FloorPaver_12") < portalPartOrder("Pillar_L_1"));
  assert.ok(portalPartOrder("Pillar_R_4") < portalPartOrder("ArchStone_1"));
  assert.ok(portalPartOrder("ArchStone_8") < portalPartOrder("RunePlaque_Top"));
});

test("runas originais dão lugar a K, M e I", () => {
  assert.deepEqual(PORTAL_LETTERS, ["K", "M", "I"]);
  assert.equal(isOriginalPortalRune("RuneTop_Center"), true);
  assert.equal(isOriginalPortalRune("RuneLeft_Diag"), true);
  assert.equal(isOriginalPortalRune("RuneRight_2"), true);
  assert.equal(isOriginalPortalRune("RuneDot_3"), true);
  assert.equal(isOriginalPortalRune("RunePlaque_Top"), false);
});
