import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, type Mesh } from "three";
import { angleTo, pathSegments } from "./cameraRig";

const ROCK_URL = "/assets/models/rock/rock-path.glb";
const TILE_SPACING = 1.85;
// Sinks the tile so only its top surface shows above the grass.
const EMBED_Y = -0.12;

export default function RockPath() {
  const gltf = useLoader(GLTFLoader, ROCK_URL);
  const group = useMemo(() => {
    const built = new Group();
    for (const [from, to] of pathSegments()) {
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      const yaw = angleTo(from, to);
      const count = Math.max(1, Math.round(length / TILE_SPACING));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const clone = gltf.scene.clone(true);
        clone.traverse((child) => {
          if ((child as Mesh).isMesh) (child as Mesh).receiveShadow = true;
        });
        clone.position.set(
          from.x + (to.x - from.x) * t,
          EMBED_Y,
          from.z + (to.z - from.z) * t,
        );
        clone.rotation.y = yaw;
        built.add(clone);
      }
    }
    return built;
  }, [gltf]);
  return <primitive object={group} />;
}
