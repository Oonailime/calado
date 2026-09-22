import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import type { PortalAnchor } from "./portalEntry";

export const TREE_PORTAL_CENTER_Y = 1.9;
export const TREE_PORTAL_RADIUS_X = 0.84;
export const TREE_PORTAL_RADIUS_Y = 1.25;
export type TreePortalFit = { minY: number; step: number; depths: readonly number[] };

/** Profile the actual bark, including root flare, in the portal's local frame. */
export function createTreePortalFit(bark: BufferGeometry, anchor: PortalAnchor): TreePortalFit {
  const angle = anchor.rotationY ?? 0, c = Math.cos(angle), s = Math.sin(angle);
  const positions = bark.getAttribute("position");
  const indices = bark.index;
  const vertices: number[] = [];
  const triangle = [new Vector3(), new Vector3(), new Vector3()];
  // Raycast only the small doorway patch, never the cherry crown/branches.
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    triangle.forEach((p, j) => {
      p.fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j);
      const dx = p.x - anchor.x, dz = p.z - anchor.z;
      p.set(c * dx - s * dz, p.y - (anchor.y ?? 0), s * dx + c * dz);
    });
    if (Math.max(...triangle.map(p => p.x)) < -1.2 || Math.min(...triangle.map(p => p.x)) > 1.2 ||
      Math.max(...triangle.map(p => p.y)) < 0 || Math.min(...triangle.map(p => p.y)) > 3.2) continue;
    triangle.forEach(p => vertices.push(p.x, p.y, p.z));
  }
  const patch = new BufferGeometry();
  patch.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(patch, material);
  const ray = new Raycaster();
  const direction = new Vector3(0, 0, -1);
  const minY = 0, step = 0.04, raw: number[] = [];
  for (let row = 0; row <= 80; row++) {
    const y = row * step;
    let front = 0;
    const radius = Math.max(0.35, 1.12 * Math.sqrt(Math.max(0, 1 - ((y - TREE_PORTAL_CENTER_Y) / 1.5) ** 2)));
    for (let col = 0; col <= 32; col++) {
      ray.set(new Vector3((col / 16 - 1) * radius, y, 8), direction);
      const hit = ray.intersectObject(mesh, false)[0];
      if (hit) front = Math.max(front, hit.point.z);
    }
    raw.push(front);
  }
  patch.dispose(); material.dispose();
  // A conservative envelope prevents a triangle/ridge between sampled rows
  // from poking through. The plasma retains depth testing against the world.
  const depths = raw.map((depth, i) => Math.max(depth, raw[Math.max(0, i - 1)], raw[Math.min(raw.length - 1, i + 1)]) + 0.085);
  return { minY, step, depths };
}

export function treePortalDepth(fit: TreePortalFit, height: number) {
  const row = Math.max(0, Math.min(fit.depths.length - 1, (height - fit.minY) / fit.step));
  const i = Math.floor(row), t = row - i;
  return fit.depths[i] * (1 - t) + fit.depths[Math.min(fit.depths.length - 1, i + 1)] * t;
}

export function fitTreePortalGeometry(geometry: BufferGeometry, fit: TreePortalFit | undefined, offsetY = 0) {
  if (!fit) return geometry;
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) positions.setZ(i,
    positions.getZ(i) + treePortalDepth(fit, positions.getY(i) + offsetY));
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function treePortalEntryAnchor(anchor: PortalAnchor, fit: TreePortalFit | undefined, characterY: number): PortalAnchor {
  if (!fit) return anchor;
  const depth = treePortalDepth(fit, characterY - (anchor.y ?? 0)) + 0.08;
  return { ...anchor, x: anchor.x + Math.sin(anchor.rotationY ?? 0) * depth,
    z: anchor.z + Math.cos(anchor.rotationY ?? 0) * depth };
}

/** Translate tube rings as a whole so following the bark never flattens a vine. */
export function fitTreePortalTube(geometry: BufferGeometry, fit: TreePortalFit | undefined, offsetY: number, sides: number, root = false) {
  if (!fit) return geometry;
  const positions = geometry.getAttribute("position");
  for (let start = 0; start < positions.count; start += sides + 1) {
    let y = 0;
    for (let j = 0; j < sides; j++) y += positions.getY(start + j) / sides;
    const blend = root ? Math.max(0, Math.min(1, y / 0.9)) : 1;
    const depth = treePortalDepth(fit, y + offsetY) * blend;
    for (let j = 0; j <= sides; j++) positions.setZ(start + j, positions.getZ(start + j) + depth);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
