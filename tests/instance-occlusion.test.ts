import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import { InstanceOcclusion } from "../src/features/game/camera/instanceOcclusion";

test("fading one tree preserves every other instance and the shared material", () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const source = new InstancedMesh(geometry, material, 3);
  const matrices = [0, 4, 8].map((x) => new Matrix4().makeTranslation(x, 0, 0));
  matrices.forEach((matrix, index) => source.setMatrixAt(index, matrix));
  source.position.set(2, 0, 0);
  source.updateMatrixWorld(true);
  const instances = new InstanceOcclusion();
  const proxy = instances.get(source, 1);
  const fade = material.clone();
  fade.transparent = true;
  fade.opacity = 0.16;
  proxy.material = fade;
  assert.equal(source.material, material);
  assert.equal(material.opacity, 1);
  assert.equal(material.transparent, false);
  const matrix = new Matrix4();
  for (const index of [0, 2]) {
    source.getMatrixAt(index, matrix);
    assert.deepEqual(matrix.elements, matrices[index].elements);
  }
  assert.deepEqual(proxy.getWorldPosition(new Vector3()).toArray(), [6, 0, 0]);
  assert.equal(instances.get(source, 1), proxy);
  const ray = new Raycaster(new Vector3(6, 0, 5), new Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(proxy, false).length > 0);
  assert.equal(ray.intersectObject(source, false).length, 0);
  proxy.material = material;
  instances.suspend(proxy);
  assert.equal(proxy.visible, false);
  source.getMatrixAt(1, matrix);
  assert.deepEqual(matrix.elements, matrices[1].elements);
  assert.equal(instances.get(source, 1), proxy);
  assert.equal(proxy.visible, true);
  instances.restore(proxy);
  source.getMatrixAt(1, matrix);
  assert.deepEqual(matrix.elements, matrices[1].elements);
  assert.equal(instances.proxies.size, 0);
  assert.equal(proxy.parent, null);
  fade.dispose();
  geometry.dispose();
  material.dispose();
});

test("separate obstructing trees restore independently and retain instance tint", () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ color: "#c08040" });
  const source = new InstancedMesh(geometry, material, 2);
  source.setMatrixAt(0, new Matrix4());
  source.setMatrixAt(1, new Matrix4().makeTranslation(5, 0, 0));
  const tint = new Color(0.5, 0.75, 1);
  source.setColorAt(0, tint);
  source.setColorAt(1, tint);
  const instances = new InstanceOcclusion();
  const first = instances.get(source, 0);
  const second = instances.get(source, 1);
  assert.ok(
    (first.material as MeshStandardMaterial).color.equals(
      material.color.clone().multiply(tint),
    ),
  );
  instances.restore(first);
  assert.equal(instances.proxies.size, 1);
  assert.equal(second.parent, source);
  instances.restore(second);
  assert.equal(instances.proxies.size, 0);
  geometry.dispose();
  material.dispose();
});
