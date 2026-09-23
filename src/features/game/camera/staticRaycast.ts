import { Mesh } from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";

/** Keep exact surface hits without scanning every triangle of a merged tree. */
export function accelerateStaticRaycast(mesh: Mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundsTree) {
    // Preserve triangle order for draw ranges, exported art and colliders.
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
    // Keep the CPU index for as long as the geometry exists. Three.dispose()
    // only releases GPU storage; React Strict Mode also calls it on mount.
  }
  mesh.raycast = acceleratedRaycast;
}
