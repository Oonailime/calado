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
import { cameraInsideTreeCrown, cameraNearCanopySupport, canopyVineLeafOpacity } from "../src/features/game/camera/canopyCameraZone";
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

test("the high plateau tree fades its crown without fading lower branches", () => {
  const scene = createPhaseFourEnvironment();
  const tree = scene.getObjectByName("Phase4_CanopyVillage_tree-91");
  assert.ok(tree);
  const crown = tree.children.find(object => object.userData.canopyCrown);
  const limb = tree.children.find(object => object.name.endsWith("tree_91_tree_branch_0"));
  const trunk = tree.children.find(object => object.name.endsWith("tree_91_solid"));
  assert.ok(crown && limb && trunk);
  assert.notEqual(crown.userData.cameraOcclusionGroup, limb.userData.cameraOcclusionGroup);
  assert.notEqual(limb.userData.cameraOcclusionGroup, trunk.userData.cameraOcclusionGroup);
  const lowerSupport = scene.getObjectByName("Phase4_CanopyVillage_support_crown_solid");
  const lowerBough = scene.getObjectByName("Phase4_CanopyVillage_bough_root_road_solid");
  const upperSupport = scene.getObjectByName("Phase4_CanopyVillage_support_vine_plateau_solid");
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
