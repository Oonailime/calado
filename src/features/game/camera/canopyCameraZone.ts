type Point = { x: number; y: number; z: number };
type Tree = { position: readonly [number, number, number]; radius: number; height: number };

/** A crown can surround the camera without crossing the ray toward the monkey. */
export function cameraInsideTreeCrown(camera: Point, tree: Tree) {
  const height = camera.y - tree.position[1];
  return height >= tree.height * 0.48 &&
    height <= tree.height * 1.2 &&
    Math.hypot(camera.x - tree.position[0], camera.z - tree.position[2]) < tree.radius * 5.3;
}

export function cameraNearCanopySupport(
  camera: Point,
  player: Point,
  bounds: { min: Point; max: Point },
) {
  if (bounds.max.y < player.y - 0.1) return false;
  const dx = Math.max(bounds.min.x - camera.x, 0, camera.x - bounds.max.x);
  const dy = Math.max(bounds.min.y - camera.y, 0, camera.y - bounds.max.y);
  const dz = Math.max(bounds.min.z - camera.z, 0, camera.z - bounds.max.z);
  return Math.hypot(dx, dy, dz) < 5;
}

export function canopyVineLeafOpacity(distanceToCamera: number) {
  return Math.max(0.06, Math.min(1, (distanceToCamera - 1.2) / 1.8));
}
