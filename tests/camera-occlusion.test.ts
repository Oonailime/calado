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
