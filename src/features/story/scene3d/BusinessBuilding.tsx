import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AnimationMixer,
  Group,
  Mesh,
  type AnimationAction,
  type AnimationClip,
} from "three";
import {
  BUILDING_LABELS,
  BUSINESS_URL,
  buildingIndex,
  type BuildingId,
} from "./buildings";
import { houseYaw, houseDoorOpenness, ORIGINAL_ROUTE, type StoryRoute } from "./cameraRig";
import { letteringTexture } from "./signage";
import type { Locale } from "@/content/story";

type BusinessRig = {
  scene: Group;
  mixer: AnimationMixer;
  door: AnimationAction;
};
const RIGS = new WeakMap<Group, BusinessRig>();
function businessRig(template: Group, clips: AnimationClip[]) {
  let rig = RIGS.get(template);
  if (!rig) {
    const scene = template.clone(true);
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const mixer = new AnimationMixer(scene);
    const door = mixer.clipAction(
      clips.find((clip) => clip.name === "Door_Open")!,
    );
    door.play();
    door.paused = true;
    rig = { scene, mixer, door };
    RIGS.set(template, rig);
  }
  return rig;
}

export default function BusinessBuilding({
  id,
  progress,
  reduced,
  locale,
  route = ORIGINAL_ROUTE,
}: {
  id: BuildingId;
  progress: number;
  reduced: boolean;
  locale: Locale;
  // Where the houses stand and how large they are drawn (design2 has its own).
  route?: StoryRoute;
}) {
  const gltf = useLoader(GLTFLoader, BUSINESS_URL);
  const index = buildingIndex(id);
  const point = route.points[index];
  useFrame(() => {
    const rig = businessRig(gltf.scene, gltf.animations);
    rig.door.time =
      houseDoorOpenness(index, progress, reduced, route) * rig.door.getClip().duration;
    rig.mixer.update(0);
  });
  // The authored asset is already grounded, 2.9m tall, and aligned by its
  // doorway (x=0, z=1.2), rather than the asymmetric building's bounding box.
  return (
    <group
      name="story-business"
      position={[point.x, 0, point.z]}
      rotation={[0, houseYaw(index, route), 0]}
      scale={route.houseScale}
    >
      <primitive object={businessRig(gltf.scene, gltf.animations).scene} />
      <mesh position={[0, 1.04, 1.225]}>
        <planeGeometry args={[0.75, 0.18]} />
        <meshBasicMaterial
          map={letteringTexture(BUILDING_LABELS[id][locale])}
          transparent
          alphaTest={0.02}
        />
      </mesh>
    </group>
  );
}
