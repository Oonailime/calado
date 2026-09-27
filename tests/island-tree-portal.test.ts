import assert from "node:assert/strict";
import { test } from "node:test";
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import { createPhaseOneTreeAsset } from "../src/features/game/world/Forest";
import { fitIslandTreePortal, ISLAND_PORTAL_TREE, ISLAND_TREE_PORTAL } from "../src/features/game/world/islandTreePortal";
import { fitTreePortalGeometry, treePortalEntryAnchor, TREE_PORTAL_CENTER_Y, TREE_PORTAL_RADIUS_X, TREE_PORTAL_RADIUS_Y } from "../src/features/game/world/treePortalFit";
import { isInsideOpenPortal } from "../src/features/game/world/portalEntry";

test("phase 1 tree portal hugs the island tree's bark in one continuous sheet", () => {
  const asset = createPhaseOneTreeAsset();
  const anchor = ISLAND_TREE_PORTAL;
  const fit = fitIslandTreePortal(asset.parts);
  const steps = fit.depths.slice(1).map((depth, i) => Math.abs(depth - fit.depths[i]));
  // The base plants used to push the lower half ~1.7 m off the trunk.
  assert.ok(Math.max(...steps) < 0.4, `doorway tears between rows: ${Math.max(...steps)}`);

  const material = new MeshBasicMaterial({ side: DoubleSide });
  const plasma = new Mesh(fitTreePortalGeometry(new PlaneGeometry(TREE_PORTAL_RADIUS_X * 1.88,
    TREE_PORTAL_RADIUS_Y * 1.88, 16, 80).translate(0, 0, 0.08), fit, TREE_PORTAL_CENTER_Y), material);
  plasma.position.set(anchor.x, anchor.y + TREE_PORTAL_CENTER_Y, anchor.z);
  plasma.rotation.y = anchor.rotationY;
  plasma.updateMatrixWorld();
  const tree = ISLAND_PORTAL_TREE.tree;
  const barkPart = asset.parts.find(part => !Array.isArray(part.material) && part.material.name === "Phase4_solid")!;
  const bark = new Mesh(barkPart.geometry, material);
  bark.position.set(tree.x, anchor.y, tree.z);
  bark.rotation.y = tree.rotationY;
  bark.scale.setScalar(tree.scale);
  bark.updateMatrixWorld();

  const normal = new Vector3(Math.sin(anchor.rotationY), 0, Math.cos(anchor.rotationY));
  const right = new Vector3(Math.cos(anchor.rotationY), 0, -Math.sin(anchor.rotationY));
  const ray = new Raycaster();
  let checked = 0;
  for (let y = -1.2; y < 1.21; y += 0.08) for (let x = -0.76; x < 0.77; x += 0.08) {
    if ((x / (TREE_PORTAL_RADIUS_X * 0.94)) ** 2 + (y / (TREE_PORTAL_RADIUS_Y * 0.94)) ** 2 > 0.98) continue;
    const origin = new Vector3(anchor.x, anchor.y + TREE_PORTAL_CENTER_Y + y, anchor.z)
      .addScaledVector(right, x).addScaledVector(normal, 8);
    ray.set(origin, normal.clone().negate());
    const surface = ray.intersectObject(plasma)[0], wood = ray.intersectObject(bark)[0];
    assert.ok(surface);
    assert.ok(wood, `no bark behind the doorway at ${x}, ${y}`);
    assert.ok(surface.distance + 0.04 < wood.distance, `bark crosses plasma at ${x}, ${y}`);
    // Close enough to read as an opening in the trunk, not a floating panel.
    assert.ok(wood.distance - surface.distance < 1.1, `plasma floats off the bark at ${x}, ${y}`);
    checked++;
  }
  assert.ok(checked > 200);

  const entry = treePortalEntryAnchor(anchor, fit, anchor.y + 0.6);
  const front = { x: entry.x + normal.x * 0.4, y: anchor.y + 0.6, z: entry.z + normal.z * 0.4 };
  assert.equal(isInsideOpenPortal(front, true, entry), true);
  plasma.geometry.dispose(); material.dispose();
  asset.parts.forEach(part => part.geometry.dispose());
});
