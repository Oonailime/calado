import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from "three";
import { batchPortalParts, createPortalSurfaceMaterial } from "../src/features/game/world/portalRendering";

test("portal keeps its gel textures and glow without a scene transmission pass", () => {
  const source = new MeshPhysicalMaterial({
    transmission: 0.22, transparent: true, opacity: 0.84,
    emissive: "#00ccee", emissiveIntensity: 1.35,
    map: new Texture(), normalMap: new Texture(), emissiveMap: new Texture(),
  });
  const material = createPortalSurfaceMaterial(source) as MeshPhysicalMaterial;
  assert.notEqual(material, source);
  assert.equal(material.transmission, 0);
  assert.equal(material.opacity, source.opacity);
  assert.equal(material.transparent, true);
  assert.equal(material.map, source.map);
  assert.equal(material.normalMap, source.normalMap);
  assert.equal(material.emissiveMap, source.emissiveMap);
  assert.ok(material.emissive.equals(source.emissive));
  assert.equal(material.emissiveIntensity, source.emissiveIntensity);
  assert.equal(material.depthWrite, false);
  assert.equal(material.forceSinglePass, true);
  assert.equal(source.transmission, 0.22);
  assert.equal(source.depthWrite, true);
  material.dispose(); source.dispose();
});

test("settled portal batches stones without losing triangles or changing the animated pieces", () => {
  const stone = new MeshStandardMaterial();
  const floor = new MeshStandardMaterial();
  const first = new BoxGeometry().translate(-2, 0, 0);
  const second = new BoxGeometry().translate(2, 0, 0);
  const base = new BoxGeometry();
  const originals = [first, second, base].map(g => Array.from(g.attributes.position.array));
  const parts = [{ geometry: first, material: stone }, { geometry: second, material: stone }, { geometry: base, material: floor }];
  const batches = batchPortalParts(parts);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].geometry.index!.count, first.index!.count + second.index!.count);
  assert.equal(batches[0].geometry.boundingBox!.min.x, -2.5);
  assert.equal(batches[0].geometry.boundingBox!.max.x, 2.5);
  assert.equal(batches[1].geometry, base);
  parts.forEach((p, i) => assert.deepEqual(Array.from(p.geometry.attributes.position.array), originals[i]));
  assert.notEqual(batches[0].geometry, first);
  batches[0].geometry.dispose();
  parts.forEach(p => p.geometry.dispose()); stone.dispose(); floor.dispose();
});
