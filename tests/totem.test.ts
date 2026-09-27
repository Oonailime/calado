import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { CHARACTERS } from "../src/features/game/types";
import {
  TOTEM_MODEL_URL,
  TOTEM_SIZE,
  WISE_MONKEY_GESTURES,
} from "../src/features/game/world/Totem";

const MODEL_FILE = `public${TOTEM_MODEL_URL}`;

function readGltf() {
  const glb = readFileSync(MODEL_FILE);
  const length = glb.readUInt32LE(12);
  return JSON.parse(glb.subarray(20, 20 + length).toString("utf8"));
}

test("totem representa os três macacos sábios na ordem da escultura", () => {
  assert.deepEqual(WISE_MONKEY_GESTURES, ["ears", "mouth", "eyes"]);
  assert.deepEqual(
    [...WISE_MONKEY_GESTURES].sort(),
    CHARACTERS.map((character) => character.pose).sort(),
  );
});

test("modelo do totem é leve, texturizado e apoiado no chão", () => {
  assert.ok(statSync(MODEL_FILE).size < 5 * 1024 * 1024);
  const gltf = readGltf();
  const [primitive] = gltf.meshes[0].primitives;
  assert.ok(gltf.accessors[primitive.indices].count / 3 <= 60000);
  const material = gltf.materials[primitive.material];
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.ok(material.normalTexture);
  const { min } = gltf.accessors[primitive.attributes.POSITION];
  assert.ok(Math.abs(min[1]) < 0.01);
});

test("colisão do totem acompanha o tamanho do modelo", () => {
  const gltf = readGltf();
  const [primitive] = gltf.meshes[0].primitives;
  const { min, max } = gltf.accessors[primitive.attributes.POSITION];
  const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
  assert.ok(close(max[0], TOTEM_SIZE.halfWidth) && close(-min[0], TOTEM_SIZE.halfWidth));
  assert.ok(close(max[1], TOTEM_SIZE.height));
  assert.ok(close(max[2], TOTEM_SIZE.halfDepth) && close(-min[2], TOTEM_SIZE.halfDepth));
});
