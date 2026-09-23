import assert from "node:assert/strict";
import { test } from "node:test";
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import { createPhaseTwoTrees } from "../src/features/game/world/phaseTwoAssets";
import { PHASE_TWO_TREE, phaseTwoGroundHeight } from "../src/features/game/world/phaseTwoLayout";
import { createTreePortalFit, fitTreePortalGeometry, treePortalEntryAnchor, TREE_PORTAL_CENTER_Y, TREE_PORTAL_RADIUS_Y } from "../src/features/game/world/treePortalFit";
import { isInsideOpenPortal } from "../src/features/game/world/portalEntry";

test("plasma follows the cherry's actual root flare and stays in front of every bark ridge", () => {
  const assets = createPhaseTwoTrees();
  const anchor = { x: PHASE_TWO_TREE[0] - 0.48, y: phaseTwoGroundHeight(...PHASE_TWO_TREE) + 0.08,
    z: PHASE_TWO_TREE[1] + 0.87, rotationY: 0.013, halfWidth: 0.8, halfDepth: 0.7, groundInset: 0 };
  const fit = createTreePortalFit(assets.bark, anchor);
  const plasmaGeometry = fitTreePortalGeometry(new PlaneGeometry(0.84 * 1.88, TREE_PORTAL_RADIUS_Y * 1.88, 16, 80).translate(0, 0, 0.08), fit, TREE_PORTAL_CENTER_Y);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const plasma = new Mesh(plasmaGeometry, material);
  plasma.position.set(anchor.x, anchor.y + TREE_PORTAL_CENTER_Y, anchor.z);
  plasma.rotation.y = anchor.rotationY;
  plasma.updateMatrixWorld();
  const bark = new Mesh(assets.bark, material);
  const normal = new Vector3(Math.sin(anchor.rotationY), 0, Math.cos(anchor.rotationY));
  const right = new Vector3(Math.cos(anchor.rotationY), 0, -Math.sin(anchor.rotationY));
  const ray = new Raycaster();
  let checked = 0;
  for (let y = -1.25; y < 1.26; y += 0.065) for (let x = -0.76; x < 0.77; x += 0.06) {
    if ((x / (0.84 * 0.94)) ** 2 + (y / (TREE_PORTAL_RADIUS_Y * 0.94)) ** 2 > 0.98) continue;
    const origin = new Vector3(anchor.x, anchor.y + TREE_PORTAL_CENTER_Y + y, anchor.z).addScaledVector(right, x).addScaledVector(normal, 8);
    ray.set(origin, normal.clone().negate());
    const surface = ray.intersectObject(plasma)[0], wood = ray.intersectObject(bark)[0];
    assert.ok(surface);
    if (wood) {
      assert.ok(surface.distance + 0.04 < wood.distance, `bark crosses plasma at ${x}, ${y}: ${surface.distance} / ${wood.distance}`);
      checked++;
    }
  }
  assert.ok(checked > 500);
  assert.ok(fit.depths[8] > fit.depths[40] + 0.6, "portal must bend forward with the roots instead of floating as a flat panel");
  const entry = treePortalEntryAnchor(anchor, fit, anchor.y + 0.6);
  assert.equal(isInsideOpenPortal({ x: entry.x, y: anchor.y + 0.6, z: entry.z + 0.4 }, true, entry), true);
  plasmaGeometry.dispose(); material.dispose(); Object.values(assets).forEach(g => g.dispose());
});
