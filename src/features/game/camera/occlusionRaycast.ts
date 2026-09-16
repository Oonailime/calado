import { type Intersection, Mesh, Raycaster, Vector3 } from "three";

/** Test only the visible segment, retaining exact mesh/leaf intersections. */
export function occlusionRaycast(
  raycaster: Raycaster,
  cameraPosition: Vector3,
  playerPosition: Vector3,
  clearance: number,
  meshes: Mesh[],
  hits: Intersection[],
  direction: Vector3,
) {
  hits.length = 0;
  direction.subVectors(playerPosition, cameraPosition);
  const distance = direction.length();
  if (distance <= clearance) return hits;
  raycaster.near = 0;
  raycaster.far = distance - clearance;
  raycaster.set(cameraPosition, direction.normalize());
  return raycaster.intersectObjects(meshes, false, hits);
}
