import { Object3D, type BufferGeometry, type Material } from "three";
import { ARBOREAL_SITES } from "./forestLayout";
import { ISLAND_SURFACE_Y } from "./layout";
import { createTreePortalFit, type TreePortalFit } from "./treePortalFit";

// The large tree to the right of the final puzzle, on the second island.
export const ISLAND_PORTAL_TREE = ARBOREAL_SITES.find(site => site.id === "south-east")!;
export const ISLAND_TREE_PORTAL = {
  x: ISLAND_PORTAL_TREE.tree.x,
  y: ISLAND_SURFACE_Y,
  z: ISLAND_PORTAL_TREE.tree.z,
  // Faces inward toward the puzzle and the path, turned ~10° off the island
  // axis so the doorway sits between two buttress roots and clear of the
  // plants around the trunk's base.
  rotationY: -1.75,
  halfWidth: 0.8,
  halfDepth: 0.7,
  groundInset: 0,
} as const;

// AssetBuilder names each merged layer's material; "solid" is trunk, ridges
// and buttresses.
const BARK_MATERIAL = "Phase4_solid";

const isBark = (material: Material | Material[]) =>
  (Array.isArray(material) ? material : [material]).some(m => m.name === BARK_MATERIAL);

// Fit to the bark only, like phase 2's cherry: the base plants stand ~1.5 m
// in front of the trunk and would tear the doorway's lower half off the tree.
export function fitIslandTreePortal(parts: readonly { geometry: BufferGeometry; material: Material | Material[] }[]): TreePortalFit {
  const bark = parts.find(part => isBark(part.material));
  if (!bark) throw new Error("Island portal tree has no bark layer");
  const transform = new Object3D();
  const tree = ISLAND_PORTAL_TREE.tree;
  transform.position.set(tree.x, ISLAND_SURFACE_Y, tree.z);
  transform.rotation.y = tree.rotationY;
  transform.scale.setScalar(tree.scale);
  transform.updateMatrix();
  const geometry = bark.geometry.clone().applyMatrix4(transform.matrix);
  const fit = createTreePortalFit(geometry, ISLAND_TREE_PORTAL);
  geometry.dispose();
  return fit;
}
