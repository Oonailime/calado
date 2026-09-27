import { type BufferGeometry, type Material, MeshPhysicalMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The portal is an emissive translucent sheet. Physical transmission would
// render the whole opaque world again, resolve MSAA and generate mipmaps.
// Clone locally: the loaded GLTF is shared by the departure/arrival portals.
export function createPortalSurfaceMaterial(source: Material): Material {
  const material = source.clone();
  if (material instanceof MeshPhysicalMaterial) material.transmission = 0;
  material.depthWrite = false;
  material.forceSinglePass = true;
  return material;
}

type Part = { geometry: BufferGeometry; material: Material | Material[] };

// Construction still uses the individual pieces. Once settled, meshes with
// the same material can share a draw call (and a shadow draw call).
export function batchPortalParts(parts: Part[]): Part[] {
  const buckets = new Map<Material, Map<string, BufferGeometry[]>>();
  const result: Part[] = [];
  for (const part of parts) {
    if (Array.isArray(part.material)) {
      result.push(part);
      continue;
    }
    const layout = JSON.stringify([
      !!part.geometry.index,
      Object.entries(part.geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
        .map(([name, attribute]) => [name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name]),
    ]);
    let layouts = buckets.get(part.material);
    if (!layouts) buckets.set(part.material, layouts = new Map());
    const bucket = layouts.get(layout) ?? [];
    bucket.push(part.geometry);
    layouts.set(layout, bucket);
  }
  for (const [material, layouts] of buckets) {
    for (const geometries of layouts.values()) {
      const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
      if (geometry) {
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        result.push({ geometry, material });
      } else {
        result.push(...geometries.map((geometry) => ({ geometry, material })));
      }
    }
  }
  return result;
}
