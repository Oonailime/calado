// Rebuild the game asset from the supplied sculpt; run with node.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
const source = await readFile("assets_referencia/padlock/ornate_padlock.glb");
const sourceJSON = JSON.parse(
  source.subarray(20, 20 + source.readUInt32LE(12)).toString(),
);
const gltf = await new GLTFLoader().parseAsync(
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
  "",
);
gltf.scene.updateMatrixWorld(true);
const parts = [];
gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
  parts.push(geometry);
});
const geometry = mergeVertices(mergeGeometries(parts), 1e-5);
await MeshoptSimplifier.ready;
const originalTriangles = geometry.index.count / 3;
const [indices, error] = MeshoptSimplifier.simplify(
  new Uint32Array(geometry.index.array),
  geometry.attributes.position.array,
  3,
  75000,
  0.003,
);
const [remap, count] = MeshoptSimplifier.compactMesh(indices);
const positions = new Float32Array(count * 3);
for (let i = 0; i < remap.length; i++) {
  if (remap[i] === 0xffffffff) continue;
  positions.set(
    geometry.attributes.position.array.subarray(i * 3, i * 3 + 3),
    remap[i] * 3,
  );
}
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setIndex(new BufferAttribute(indices, 1));
geometry.computeVertexNormals();
geometry.computeBoundingBox();
// Ground and normalize the sculpt to the original prop's footprint.
const bounds = geometry.boundingBox;
const scale = 1.05 / (bounds.max.y - bounds.min.y);
geometry.translate(
  -(bounds.min.x + bounds.max.x) / 2,
  -bounds.min.y,
  -(bounds.min.z + bounds.max.z) / 2,
);
geometry.scale(scale, scale, scale);
const colors = new Float32Array(count * 3);
const bronze = new Color("#ad8b4e"),
  patina = new Color("#59694e"),
  color = new Color();
for (let i = 0; i < count; i++) {
  const x = positions[i * 3],
    y = positions[i * 3 + 1],
    z = positions[i * 3 + 2];
  const weathering =
    (Math.sin(x * 23 + y * 11) * Math.sin(z * 29 - y * 17) + 1) / 2;
  color
    .copy(bronze)
    .lerp(patina, weathering * 0.38)
    .multiplyScalar(0.88 + 0.12 * Math.sin(x * 67 + z * 51) ** 2);
  colors.set(color.toArray(), i * 3);
}
geometry.setAttribute("color", new BufferAttribute(colors, 3));
const material = new MeshStandardMaterial({
  vertexColors: true,
  metalness: 0.42,
  roughness: 0.72,
});
material.name = "Aged temple bronze";
// The source is a single fused sculpt. Separate only the two straight legs
// above their sockets, preserving the ornate body and the complete arch.
const SHACKLE_Y = 0.755;
const pivot = [0.215, SHACKLE_Y, 0];
const buckets = [[], []],
  cuts = [new Map(), new Map()];
const attributes = ["position", "normal", "color"].map((name) =>
  geometry.getAttribute(name),
);
function vertex(index) {
  return attributes.flatMap((a) => [
    a.getX(index),
    a.getY(index),
    a.getZ(index),
  ]);
}
function cut(poly, upper) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const insideA = upper ? a[1] >= SHACKLE_Y : a[1] <= SHACKLE_Y;
    const insideB = upper ? b[1] >= SHACKLE_Y : b[1] <= SHACKLE_Y;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (SHACKLE_Y - a[1]) / (b[1] - a[1]);
      const v = a.map((n, j) => n + (b[j] - n) * t);
      result.push(v);
      cuts[v[0] < 0 ? 0 : 1].set(`${v[0].toFixed(6)},${v[2].toFixed(6)}`, v);
    }
  }
  return result;
}
for (let i = 0; i < indices.length; i += 3) {
  const tri = [
    vertex(indices[i]),
    vertex(indices[i + 1]),
    vertex(indices[i + 2]),
  ];
  for (let side = 0; side < 2; side++) {
    const poly = cut(tri, side === 1);
    for (let j = 1; j < poly.length - 1; j++)
      buckets[side].push(poly[0], poly[j], poly[j + 1]);
  }
}
// Seal each circular cut so an opened shackle has solid metal ends.
for (const points of cuts) {
  const rim = [...points.values()];
  const cx = rim.reduce((s, v) => s + v[0], 0) / rim.length,
    cz = rim.reduce((s, v) => s + v[2], 0) / rim.length;
  rim.sort(
    (a, b) =>
      Math.atan2(a[2] - cz, a[0] - cx) - Math.atan2(b[2] - cz, b[0] - cx),
  );
  for (let side = 0; side < 2; side++) {
    const normal = [0, side === 0 ? 1 : -1, 0],
      rgb = bronze.toArray();
    const center = [cx, SHACKLE_Y, cz, ...normal, ...rgb];
    for (let i = 0; i < rim.length; i++) {
      const a = [...rim[i].slice(0, 3), ...normal, ...rgb],
        b = [...rim[(i + 1) % rim.length].slice(0, 3), ...normal, ...rgb];
      buckets[side].push(center, ...(side === 0 ? [b, a] : [a, b]));
    }
  }
}
const scene = new Group();
scene.name = "OrnatePadlock";
for (let side = 0; side < 2; side++) {
  const vertices = buckets[side],
    part = new BufferGeometry();
  for (let a = 0; a < 3; a++)
    part.setAttribute(
      ["position", "normal", "color"][a],
      new BufferAttribute(
        new Float32Array(vertices.flatMap((v) => v.slice(a * 3, a * 3 + 3))),
        3,
      ),
    );
  const compact = mergeVertices(part, 1e-5);
  const mesh = new Mesh(compact, material);
  mesh.name = side === 0 ? "OrnatePadlockBody" : "OrnatePadlockArch";
  if (side === 0) scene.add(mesh);
  else {
    compact.translate(-pivot[0], -pivot[1], -pivot[2]);
    const shackle = new Group();
    shackle.name = "OrnatePadlockShackle";
    shackle.position.set(...pivot);
    shackle.userData.closedY = pivot[1];
    shackle.add(mesh);
    scene.add(shackle);
  }
}
scene.userData = {
  attribution: sourceJSON.asset.extras,
  originalTriangles,
  triangles: buckets.reduce((n, v) => n + v.length / 3, 0),
  simplificationError: error,
};
const output = await new GLTFExporter().parseAsync(scene, { binary: true });
await mkdir("public/assets/models/padlock", { recursive: true });
await writeFile(
  "public/assets/models/padlock/ornate-padlock.glb",
  Buffer.from(output),
);
console.log(
  JSON.stringify({
    originalTriangles,
    triangles: buckets.reduce((n, v) => n + v.length / 3, 0),
    error,
    bytes: output.byteLength,
  }),
);
