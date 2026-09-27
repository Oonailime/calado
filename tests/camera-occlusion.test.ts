import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
  type Intersection,
} from "three";
import { occlusionRaycast } from "../src/features/game/camera/occlusionRaycast";
import { cameraInsideTreeCrown, cameraNearCanopySupport, canopyVineLeafOpacity, playerNearCanopyTree } from "../src/features/game/camera/canopyCameraZone";
import {
  PHASE_FOUR_CLEAR_VIEW_MIN_Y,
  PHASE_FOUR_CLEAR_VIEW_TREES,
  PHASE_FOUR_SPAWN,
  PHASE_FOUR_SWING_SITES,
} from "../src/features/game/world/phaseFourLayout";
import { createPhaseFourEnvironment } from "../src/features/game/world/phaseFourAssets";

test("occlusion keeps exactly the original hits between camera and player", () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial();
  const meshes = [2, 5, 12].map((z) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.z = z;
    mesh.updateMatrixWorld();
    return mesh;
  });
  const origin = new Vector3();
  const player = new Vector3(0, 0, 8);
  const ray = new Raycaster(origin, new Vector3(0, 0, 1));
  const expected = ray
    .intersectObjects(meshes, false)
    .filter((hit) => hit.distance < 7.65);
  const actual = occlusionRaycast(
    ray,
    origin,
    player,
    0.35,
    meshes,
    [],
    new Vector3(),
  );
  assert.deepEqual(
    actual.map((hit) => [hit.object.uuid, hit.distance]),
    expected.map((hit) => [hit.object.uuid, hit.distance]),
  );
  geometry.dispose();
  material.dispose();
});

test("meshes beyond the player never enter triangle intersection testing", () => {
  const geometry = new BoxGeometry(1, 1, 1, 40, 40, 40);
  const material = new MeshStandardMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.position.z = 30;
  mesh.updateMatrixWorld();
  let trianglePasses = 0;
  Object.assign(mesh, {
    _computeIntersections() {
      trianglePasses++;
    },
  });
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, 1));
  ray.intersectObject(mesh, false);
  assert.equal(trianglePasses, 1);
  trianglePasses = 0;
  occlusionRaycast(
    ray,
    new Vector3(),
    new Vector3(0, 0, 8),
    0.35,
    [mesh],
    [],
    new Vector3(),
  );
  assert.equal(trianglePasses, 0);
  geometry.dispose();
  material.dispose();
});

test("camera inside player clearance clears old hits", () => {
  const hits = [{} as Intersection];
  occlusionRaycast(
    new Raycaster(),
    new Vector3(),
    new Vector3(0, 0, 0.1),
    0.35,
    [],
    hits,
    new Vector3(),
  );
  assert.equal(hits.length, 0);
});

test("high plateau tree fades while its crown surrounds the camera", () => {
  const tree = { position: [-13, -4.401, -11] as const, radius: 3.8, height: 43 };
  assert.equal(cameraInsideTreeCrown({ x: -7, y: 26, z: 0 }, tree), true);
  assert.equal(cameraInsideTreeCrown({ x: -7, y: 10, z: 0 }, tree), false);
  assert.equal(cameraInsideTreeCrown({ x: 20, y: 26, z: 0 }, tree), false);
});

test("nearby vine support fades even when it misses the camera-to-player ray", () => {
  const bounds = { min: { x: -8, y: 23, z: -10 }, max: { x: -4, y: 31, z: -6 } };
  const player = { x: -3, y: 25, z: -7 };
  assert.equal(cameraNearCanopySupport({ x: -3, y: 26, z: -5 }, player, bounds), true);
  assert.equal(cameraNearCanopySupport({ x: 5, y: 26, z: -5 }, player, bounds), false);
  assert.equal(cameraNearCanopySupport(
    { x: -3, y: 26, z: -5 },
    player,
    { min: { x: -8, y: 19, z: -10 }, max: { x: -4, y: 23, z: -6 } },
  ), false);
});

test("vine leaves clear the camera without hiding the traversable rope", () => {
  assert.equal(canopyVineLeafOpacity(0.5), 0.06);
  assert.ok(canopyVineLeafOpacity(2) > 0.06);
  assert.equal(canopyVineLeafOpacity(3), 1);
});

test("the high plateau tree fades trunk, limbs and crown as one unit", () => {
  const scene = createPhaseFourEnvironment();
  const tree = scene.getObjectByName("Phase4_CanopyVillage_tree-91");
  assert.ok(tree);
  const crown = tree.children.find(object => object.userData.canopyCrown);
  const limb = tree.children.find(object => object.name.endsWith("tree_91_tree_branch_0"));
  const trunk = tree.children.find(object => object.name.endsWith("tree_91_solid"));
  assert.ok(crown && limb && trunk);
  assert.equal(crown.userData.cameraOcclusionGroup, limb.userData.cameraOcclusionGroup);
  assert.equal(limb.userData.cameraOcclusionGroup, trunk.userData.cameraOcclusionGroup);
  for (const part of tree.children) {
    assert.equal(part.userData.cameraOccluder, true);
    assert.equal(part.userData.cameraOcclusionGroup, crown.userData.cameraOcclusionGroup);
  }
  // Other playable trees keep independently fading crown, limbs and trunk.
  const other = scene.getObjectByName("Phase4_CanopyVillage_tree-73");
  assert.ok(other);
  const otherCrown = other.children.find(object => object.userData.canopyCrown);
  const otherTrunk = other.children.find(object => object.name.endsWith("tree_73_solid"));
  assert.ok(otherCrown && otherTrunk);
  assert.notEqual(otherCrown.userData.cameraOcclusionGroup, otherTrunk.userData.cameraOcclusionGroup);
  const lowerSupport = scene.getObjectByName("Phase4_CanopyVillage_support_crown");
  const lowerBough = scene.getObjectByName("Phase4_CanopyVillage_bough_root_road");
  const upperSupport = scene.getObjectByName("Phase4_CanopyVillage_support_vine_plateau");
  assert.ok(lowerSupport && lowerBough && upperSupport);
  assert.equal(lowerSupport.userData.cameraOccluder, false);
  assert.equal(lowerBough.userData.cameraOccluder, false);
  assert.equal(upperSupport.userData.cameraOccluder, true);
  assert.equal(limb.userData.cameraOccluder, true);
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
  });
});

test("the first pendulum's two trees clear around the player up in the canopy", () => {
  assert.deepEqual(PHASE_FOUR_CLEAR_VIEW_TREES.map(tree => tree.seed), [91, 73]);
  const near = (point: { x: number; y: number; z: number }) =>
    PHASE_FOUR_CLEAR_VIEW_TREES.map(tree => playerNearCanopyTree(point, tree, PHASE_FOUR_CLEAR_VIEW_MIN_Y));
  const grip = (index: number) => PHASE_FOUR_SWING_SITES[index].vine.twoPoint!.grip;
  // On the high plateau and along the first swings, both trees clear.
  assert.deepEqual(near({ x: -3, y: 23.2, z: -7 }), [true, true]);
  assert.deepEqual(near(grip(0)), [true, true]);
  assert.deepEqual(near(grip(1)), [true, true]);
  // At the arrival clearing and past the waterfall they stay opaque.
  assert.deepEqual(near(PHASE_FOUR_SPAWN), [false, false]);
  assert.deepEqual(near(grip(3)), [false, false]);
});

test("tree leaves, limbs and vine attachments carry the tree they belong to", () => {
  const scene = createPhaseFourEnvironment();
  for (const seed of [91, 73]) {
    const tree = scene.getObjectByName(`Phase4_CanopyVillage_tree-${seed}`);
    assert.ok(tree);
    const crown = tree.children.find(object => object.userData.canopyCrown);
    const limbs = tree.children.filter(object => object.userData.canopyBranch);
    assert.equal(crown?.userData.canopyTreeSeed, seed);
    assert.equal(limbs.length, 7);
    for (const limb of limbs) assert.equal(limb.userData.canopyTreeSeed, seed);
  }
  const support = scene.getObjectByName("Phase4_CanopyVillage_swing-support-phase4-swing-plateau");
  assert.ok(support);
  assert.deepEqual(support.children[0].userData.swingSupportTreeSeeds, [91, 73]);
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
  });
});
