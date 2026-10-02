import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

test("banana plant GLB keeps materials and Draco geometry within the mobile budget", () => {
  const bytes = readFileSync("public/assets/models/banana/PlantWithBananas.glb");
  assert.ok(bytes.byteLength < 3_000_000);
  assert.equal(bytes.toString("utf8", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  assert.ok(gltf.extensionsRequired?.includes("KHR_draco_mesh_compression"));
  assert.ok(gltf.meshes?.length > 0);
  assert.ok(gltf.images?.length > 0);
  assert.ok(gltf.materials?.length > 0);
});
