import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AnimationMixer,
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import {
  BUILDING_LABELS,
  SCHOOL_URL,
  buildingIndex,
  type BuildingId,
} from "./buildings";
import { PATH_POINTS, houseYaw, houseDoorOpenness } from "./cameraRig";
import { letteringTexture } from "./signage";
import type { Locale } from "@/content/story";

// A school should read as a building rather than a doll house beside the
// 0.72-unit monkey. Normalize from the asset's measured bounds instead of
// depending on its authored units.
const SCHOOL_TARGET_HEIGHT = 3.6;
// The original ESCOLA letters occupy this span inside RoofSignAnchor. Dynamic
// lettering replaces those meshes at the exact same front-gable location.
const LETTERING_WIDTH = 5.6;
const LETTERING_HEIGHT = 1.2;

function shadowed<T extends Object3D>(object: T): T {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      (child as Mesh).castShadow = true;
      (child as Mesh).receiveShadow = true;
    }
  });
  return object;
}

type SchoolRig = {
  scene: Group;
  mixer: AnimationMixer;
  doorAction?: AnimationAction;
  bellAction?: AnimationAction;
};

// A per-(id, locale) build cached off the loaded template, same plain-function
// (non-hook) pattern as Monkey.tsx's RIG_CACHE/getRig — mutating the mixer's
// actions every frame is fine on a plain cached object, but ESLint's
// react-hooks immutability rule (rightly) rejects mutating a useMemo result,
// so this can't just live in a useMemo like the static buildings do.
const RIG_CACHE = new WeakMap<Group, Map<string, SchoolRig>>();

function buildSchoolRig(
  template: Group,
  id: BuildingId,
  locale: Locale,
  animations: AnimationClip[],
): SchoolRig {
  const scene = shadowed(template.clone(true));
  const bounds = new Box3().setFromObject(scene);
  const size = new Vector3();
  bounds.getSize(size);

  // Replace the model's original ESCOLA meshes in-place. This is its actual
  // front-gable sign, not the lateral or lower facade plaque anchors.
  const roof = scene.getObjectByName("RoofSignAnchor");
  if (roof) {
    roof.children.forEach((child) => {
      child.visible = false;
    });
    const lettering = new Mesh(
      new PlaneGeometry(LETTERING_WIDTH, LETTERING_HEIGHT),
      new MeshBasicMaterial({
        map: letteringTexture(BUILDING_LABELS[id][locale]),
        transparent: true,
        alphaTest: 0.02,
      }),
    );
    lettering.position.set(LETTERING_WIDTH / 2, LETTERING_HEIGHT * 0.45, 0.2);
    roof.add(lettering);
  }
  const lateralSignAnchor = scene.getObjectByName("SignAnchor");
  if (lateralSignAnchor) lateralSignAnchor.visible = false;
  const lowerSignAnchor = scene.getObjectByName("SignAnchor_Front");
  if (lowerSignAnchor) lowerSignAnchor.visible = false;

  // Both clips get scrubbed by hand (see useFrame below) rather than played
  // forward in real time, so bell/door state stays a pure function of
  // arrival-proximity like everything else in this scene.
  const mixer = new AnimationMixer(scene);
  const toAction = (name: string): AnimationAction | undefined => {
    const clip = animations.find((c) => c.name === name);
    if (!clip) return undefined;
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    return action;
  };
  const doorAction = toAction("Door_Open");
  const bellAction = toAction("Bell_Ring");

  scene.scale.setScalar(size.y > 0 ? SCHOOL_TARGET_HEIGHT / size.y : 1);
  return { scene, mixer, doorAction, bellAction };
}

function getSchoolRig(
  template: Group,
  id: BuildingId,
  locale: Locale,
  animations: AnimationClip[],
): SchoolRig {
  let byKey = RIG_CACHE.get(template);
  if (!byKey) {
    byKey = new Map();
    RIG_CACHE.set(template, byKey);
  }
  const key = `${id}:${locale}`;
  let rig = byKey.get(key);
  if (!rig) {
    rig = buildSchoolRig(template, id, locale, animations);
    byKey.set(key, rig);
  }
  return rig;
}

export default function SchoolBuilding({
  id,
  progress,
  reduced,
  locale,
}: {
  id: BuildingId;
  progress: number;
  reduced: boolean;
  locale: Locale;
}) {
  const gltf = useLoader(GLTFLoader, SCHOOL_URL);
  const index = buildingIndex(id);
  const point = PATH_POINTS[index];

  // Looked up fresh inside the callback (and again below for the JSX), same
  // as Monkey.tsx's own getRig(...) calls — a value merely read during
  // render isn't a hook value, so mutating it in useFrame is fine, but
  // closing over one bound in the render body would trip the immutability
  // rule above.
  useFrame((_, delta) => {
    const rig = getSchoolRig(gltf.scene, id, locale, gltf.animations);
    const openness = houseDoorOpenness(index, progress, reduced);
    if (rig.doorAction)
      rig.doorAction.time = openness * rig.doorAction.getClip().duration;
    if (rig.bellAction)
      rig.bellAction.time = openness * rig.bellAction.getClip().duration;
    rig.mixer.update(delta);
  });

  return (
    <group position={[point.x, 0, point.z]} rotation={[0, houseYaw(index), 0]}>
      <primitive
        object={getSchoolRig(gltf.scene, id, locale, gltf.animations).scene}
      />
    </group>
  );
}
