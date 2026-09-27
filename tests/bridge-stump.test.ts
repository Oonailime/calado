import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { BRIDGE_STUMP_MODEL_URLS } from "../src/features/game/world/BridgeBuildStump";
import { QUALITY_PROFILES } from "../src/features/game/quality";

const TIERS = ["low", "medium", "high", "ultra"] as const;

function readGlb(url: string) {
  const glb = readFileSync(`public${url}`);
  const length = glb.readUInt32LE(12);
  return { size: glb.length, gltf: JSON.parse(glb.subarray(20, 20 + length).toString("utf8")) };
}

test("toco de construção tem uma versão para cada qualidade gráfica", () => {
  assert.deepEqual(Object.keys(BRIDGE_STUMP_MODEL_URLS).sort(), Object.keys(QUALITY_PROFILES).sort());
  const sizes = TIERS.map(tier => statSync(`public${BRIDGE_STUMP_MODEL_URLS[tier]}`).size);
  sizes.slice(1).forEach((size, i) => assert.ok(size >= sizes[i], "uma qualidade menor nunca baixa mais"));
  assert.ok(sizes[3] < 3 * 1024 * 1024 && sizes[0] < 1024 * 1024);
});

test("cada versão do toco é leve, texturizada e apoiada no chão com a mesma largura", () => {
  for (const url of new Set(Object.values(BRIDGE_STUMP_MODEL_URLS))) {
    const { gltf } = readGlb(url);
    const [primitive] = gltf.meshes[0].primitives;
    assert.ok(gltf.accessors[primitive.indices].count / 3 <= 40000, url);
    const material = gltf.materials[primitive.material];
    assert.ok(material.pbrMetallicRoughness.baseColorTexture, url);
    assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture, url);
    assert.ok(material.normalTexture, url);
    assert.ok(gltf.images.every((image: { mimeType: string }) => image.mimeType === "image/jpeg"), url);
    const { min, max } = gltf.accessors[primitive.attributes.POSITION];
    assert.ok(Math.abs(min[1]) < 0.01, url);
    assert.ok(Math.abs(max[0] - min[0] - 1.16) < 0.01, url);
  }
});
