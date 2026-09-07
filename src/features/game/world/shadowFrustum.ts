import { Box3, OrthographicCamera, Vector3 } from "three";

// Must mirror Game.tsx's own directional light exactly — position and target
// determine both the light's direction and, for shadows, where the ortho
// shadow camera sits and looks.
const LIGHT_POSITION = new Vector3(10, 18, 8);
const LIGHT_TARGET = new Vector3(0, 0, 0);

// A generous box around both islands (see layout.ts's ISLANDS for the
// authoritative footprint) — wide enough for the 1.32x beach-ramp scale and
// vegetation scattered slightly past each island's nominal half-extent, tall
// enough for totems, trees and standing characters. The previous hand-picked
// camera-left/right/top/bottom values undershot this, which is why a couple
// of palm trees at the edge of an island fell outside the shadow camera and
// never got a shadow at all.
const WORLD_BOUNDS = new Box3(
  new Vector3(-16, -1, -45),
  new Vector3(16, 7.5, 24),
);

function computeShadowFrustum() {
  const camera = new OrthographicCamera();
  camera.position.copy(LIGHT_POSITION);
  camera.lookAt(LIGHT_TARGET);
  camera.updateMatrixWorld(true);
  const toLightSpace = camera.matrixWorld.clone().invert();

  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const x of [WORLD_BOUNDS.min.x, WORLD_BOUNDS.max.x])
    for (const y of [WORLD_BOUNDS.min.y, WORLD_BOUNDS.max.y])
      for (const z of [WORLD_BOUNDS.min.z, WORLD_BOUNDS.max.z]) {
        const local = new Vector3(x, y, z).applyMatrix4(toLightSpace);
        xs.push(local.x);
        ys.push(local.y);
        zs.push(local.z);
      }
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.max(...ys),
    bottom: Math.min(...ys),
    // The camera looks down its own local -Z, so points in front of it have
    // negative local Z — near/far are distances, hence the sign flip.
    near: -Math.max(...zs),
    far: -Math.min(...zs),
  };
}

// Computed once at module load — the light and world bounds above are fixed
// constants, not runtime state.
export const SHADOW_FRUSTUM = computeShadowFrustum();
