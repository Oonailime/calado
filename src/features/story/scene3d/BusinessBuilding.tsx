import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Mesh, Vector3, type Object3D } from "three";
import {
  BUILDING_LABELS,
  BUSINESS_URL,
  buildingIndex,
  type BuildingId,
} from "./buildings";
import { PATH_POINTS, houseYaw } from "./cameraRig";
import { letteringTexture } from "./signage";
import type { Locale } from "@/content/story";

// The kit's raw units don't match anything (a tiny fraction of a world
// unit before its own baked node scale) — normalize by real height like
// Vegetation.tsx/Grass.tsx do for their own oddly-scaled source assets,
// landing a little taller than the doll-house kit for a "bigger workplace"
// read next to the houses.
const TARGET_HEIGHT = 2.9;

function shadowed(object: Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      (child as Mesh).castShadow = true;
      (child as Mesh).receiveShadow = true;
    }
  });
  return object;
}

export default function BusinessBuilding({
  id,
  locale,
}: {
  id: BuildingId;
  locale: Locale;
}) {
  const gltf = useLoader(GLTFLoader, BUSINESS_URL);
  const built = useMemo(() => {
    const model = shadowed(gltf.scene.clone(true));
    const box = new Box3().setFromObject(model);
    const size = new Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    model.scale.setScalar(scale);
    model.position.set(-centerX * scale, -box.min.y * scale, -centerZ * scale);

    const halfDepth = (size.z * scale) / 2;
    return { model, halfDepth };
  }, [gltf]);

  const index = buildingIndex(id);
  const point = PATH_POINTS[index];

  return (
    <group position={[point.x, 0, point.z]} rotation={[0, houseYaw(index), 0]}>
      <primitive object={built.model} />
      <mesh position={[0, TARGET_HEIGHT * 0.58, built.halfDepth + 0.015]}>
        <planeGeometry args={[1.2, 0.32]} />
        <meshBasicMaterial
          map={letteringTexture(BUILDING_LABELS[id][locale])}
          transparent
          alphaTest={0.02}
        />
      </mesh>
    </group>
  );
}
