import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  AnimationMixer,
  Bone,
  Box3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type Object3D,
} from "three";
import { CHARACTERS, type CharacterId } from "../types";
import { runtime } from "../state/store";
import {
  classifyMonkeySurface,
  eatingBananaScale,
  eatingPoseBlend,
  MONKEY_POWER_POSES,
  monkeyAnimation,
  monkeySurfaceColor,
  nextPowerPoseBlend,
  type PowerPoseGesture,
  type PowerPoseHand,
  type BoneInfluence,
} from "./monkeyAppearance";
import { BANANA_MODEL_URL } from "../world/BananaGroves";

const MODEL_URL = "/assets/models/monkey.fbx";
const TARGET_HEIGHT = 0.72;
const IDLE_CLIP = "monkey_idleC";
const RUN_CLIP = "monkey_run";
const FAST_CLIP = "monkey_fastwalk";
const EMPTY_TEXTURE =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

class MonkeyFBXLoader extends FBXLoader {
  constructor() {
    const manager = new LoadingManager();
    manager.setURLModifier((url) =>
      url.includes("Animal_3146_texture") ? EMPTY_TEXTURE : url,
    );
    super(manager);
  }
}

type Bones = {
  armL?: Bone;
  forearmL?: Bone;
  handL?: Bone;
  armR?: Bone;
  forearmR?: Bone;
  handR?: Bone;
  head?: Bone;
  eyeL?: Bone;
  eyeR?: Bone;
  earL?: Bone;
  earR?: Bone;
  mouth?: Bone;
};
type Rig = {
  model: Group;
  mixer: AnimationMixer;
  actions: { idle?: AnimationAction; run?: AnimationAction };
  bones: Bones;
  baseScale: number;
};
const RIG_CACHE = new WeakMap<Group, Partial<Record<CharacterId, Rig>>>();

function findBone(root: Object3D, name: string): Bone | undefined {
  let found: Bone | undefined;
  root.traverse((o) => {
    if (!found && (o as Bone).isBone && o.name === name) found = o as Bone;
  });
  return found;
}
function findBoneStartingWith(
  root: Object3D,
  prefix: string,
): Bone | undefined {
  let found: Bone | undefined;
  root.traverse((object) => {
    if (!found && (object as Bone).isBone && object.name.startsWith(prefix))
      found = object as Bone;
  });
  return found;
}
function colorMonkeyMesh(mesh: SkinnedMesh, id: CharacterId) {
  mesh.geometry = mesh.geometry.clone();
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const source = geometry.getAttribute("color");
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const colors = new Float32Array(position.count * 3);
  const fur = new Color(CHARACTERS[id].color);

  for (let i = 0; i < position.count; i++) {
    const influences: BoneInfluence[] = [];
    for (let component = 0; component < 4; component++) {
      const weight = skinWeight.getComponent(i, component);
      const bone = mesh.skeleton.bones[skinIndex.getComponent(i, component)];
      if (bone && weight > 0) influences.push({ name: bone.name, weight });
    }
    const brightness = source
      ? (source.getX(i) + source.getY(i) + source.getZ(i)) / 3
      : 1;
    const surface = classifyMonkeySurface({
      influences,
      sourceBrightness: brightness,
      x: position.getX(i),
      y: position.getY(i),
      z: position.getZ(i),
    });
    const semanticColor = monkeySurfaceColor(surface, id);
    const color = semanticColor
      ? new Color(semanticColor)
      : fur
          .clone()
          .multiplyScalar(
            0.86 +
              ((Math.sin(position.getX(i) * 91 + position.getY(i) * 47) + 1) /
                2) *
                0.14,
          );
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  mesh.material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
  });
}
function bandana(color: string) {
  const mesh = new Mesh(
    new CylinderGeometry(0.017, 0.017, 0.034, 10, 1, true),
    new MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}
function buildRig(template: Group, id: CharacterId): Rig {
  const model = cloneSkeleton(template) as Group;
  const box = new Box3().setFromObject(model);
  const size = new Vector3();
  box.getSize(size);
  const scale = TARGET_HEIGHT / size.y;
  model.scale.setScalar(scale);
  model.position.set(0, -box.min.y * scale - 0.44, 0);

  model.traverse((child) => {
    if ((child as SkinnedMesh).isSkinnedMesh) {
      colorMonkeyMesh(child as SkinnedMesh, id);
      child.castShadow = true;
    }
  });

  const bones: Bones = {
    armL: findBone(model, "Arm01_L"),
    forearmL: findBone(model, "Arm02_L"),
    handL: findBone(model, "Hand_L"),
    armR: findBone(model, "Arm01_R"),
    forearmR: findBone(model, "Arm02_R"),
    handR: findBone(model, "Hand_R"),
    head: findBone(model, "Head"),
    eyeL: findBone(model, "eye_L"),
    eyeR: findBone(model, "eye_R"),
    earL: findBoneStartingWith(model, "ear_L"),
    earR: findBoneStartingWith(model, "ear_R"),
    mouth: findBone(model, "mouth"),
  };

  if (id === 0 && bones.head) {
    const { eyeL, eyeR } = bones;
    if (eyeL && eyeR) {
      const band = bandana(CHARACTERS[0].light);
      const mid = eyeL.position.clone().add(eyeR.position).multiplyScalar(0.5);
      band.position.copy(mid);
      band.position.z += 0.006;
      band.scale.setScalar(1 / scale);
      bones.head.add(band);
    }
  }

  const mixer = new AnimationMixer(model);
  const clip = (name: string) =>
    template.animations.find((a) => a.name.endsWith(name));
  const idleClip = clip(IDLE_CLIP);
  const runClip = clip(RUN_CLIP) ?? clip(FAST_CLIP);
  const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
  const run = runClip ? mixer.clipAction(runClip) : undefined;
  idle?.play();

  return {
    model,
    mixer,
    actions: { idle, run },
    bones,
    baseScale: scale,
  };
}
function getRig(template: Group, id: CharacterId): Rig {
  let byId = RIG_CACHE.get(template);
  if (!byId) {
    byId = {};
    RIG_CACHE.set(template, byId);
  }
  let rig = byId[id];
  if (!rig) {
    rig = buildRig(template, id);
    byId[id] = rig;
  }
  return rig;
}
const Y_AXIS = new Vector3(0, 1, 0);
const WORLD_DOWN = new Vector3(0, -1, 0);
const IK = {
  shoulder: new Vector3(),
  elbow: new Vector3(),
  wrist: new Vector3(),
  head: new Vector3(),
  anchor: new Vector3(),
  target: new Vector3(),
  direction: new Vector3(),
  radial: new Vector3(),
  outward: new Vector3(),
  bend: new Vector3(),
  solvedElbow: new Vector3(),
  currentAxis: new Vector3(),
  bonePosition: new Vector3(),
  parentWorld: new Quaternion(),
  boneWorld: new Quaternion(),
  rotationDelta: new Quaternion(),
  desiredWorld: new Quaternion(),
  bananaPosition: new Vector3(),
  bananaOffset: new Vector3(),
  bananaWorld: new Quaternion(),
};

// Rotate only enough to point the bone's natural +Y chain axis at a target.
// Keeping the existing twist from the source animation prevents corkscrew-like
// deformation in the arm and hand meshes.
function aimBoneAt(bone: Bone, target: Vector3) {
  if (!bone.parent) return;
  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(IK.bonePosition);
  IK.direction.subVectors(target, IK.bonePosition);
  if (IK.direction.lengthSq() < 1e-8) return;
  IK.direction.normalize();
  bone.getWorldQuaternion(IK.boneWorld);
  IK.currentAxis.copy(Y_AXIS).applyQuaternion(IK.boneWorld).normalize();
  IK.rotationDelta.setFromUnitVectors(IK.currentAxis, IK.direction);
  IK.desiredWorld.copy(IK.rotationDelta).multiply(IK.boneWorld);
  bone.parent.getWorldQuaternion(IK.parentWorld);
  IK.parentWorld.invert();
  bone.quaternion.copy(IK.parentWorld.multiply(IK.desiredWorld));
}

function poseArm(
  rig: Rig,
  upperArm: Bone | undefined,
  forearm: Bone | undefined,
  hand: Bone | undefined,
  anchor: Bone | undefined,
  blend: number,
) {
  if (!upperArm || !forearm || !hand || !anchor || !rig.bones.head) return;

  upperArm.updateWorldMatrix(true, true);
  upperArm.getWorldPosition(IK.shoulder);
  forearm.getWorldPosition(IK.elbow);
  hand.getWorldPosition(IK.wrist);
  anchor.getWorldPosition(IK.anchor);
  rig.bones.head.getWorldPosition(IK.head);

  const upperLength = IK.shoulder.distanceTo(IK.elbow);
  const lowerLength = IK.elbow.distanceTo(IK.wrist);
  if (upperLength < 1e-5 || lowerLength < 1e-5) return;

  // Stop the wrist just outside the face instead of pulling the hand through
  // it. The offset follows the real eye/ear/mouth position from this rig.
  IK.radial.subVectors(IK.anchor, IK.head);
  if (IK.radial.lengthSq() < 1e-8) IK.radial.set(0, 0, 1);
  IK.radial.normalize();
  IK.target
    .copy(IK.anchor)
    .addScaledVector(IK.radial, lowerLength * 0.12)
    .lerp(IK.wrist, 1 - blend);

  IK.direction.subVectors(IK.target, IK.shoulder);
  const rawDistance = IK.direction.length();
  if (rawDistance < 1e-6) return;
  IK.direction.normalize();
  const distance = Math.min(
    upperLength + lowerLength - 1e-5,
    Math.max(Math.abs(upperLength - lowerLength) + 1e-5, rawDistance),
  );
  IK.target.copy(IK.shoulder).addScaledVector(IK.direction, distance);

  // Prefer an elbow below and outside the torso. Projecting that preference
  // onto the bend plane gives a natural two-bone solution without changing
  // either bone's length.
  IK.outward.subVectors(IK.shoulder, IK.head);
  IK.outward.y = 0;
  if (IK.outward.lengthSq() < 1e-8) IK.outward.set(1, 0, 0);
  IK.outward.normalize();
  IK.bend
    .copy(WORLD_DOWN)
    .multiplyScalar(0.8)
    .addScaledVector(IK.outward, 0.65)
    .addScaledVector(IK.radial, 0.12)
    .addScaledVector(IK.direction, -IK.bend.dot(IK.direction));
  if (IK.bend.lengthSq() < 1e-8)
    IK.bend.crossVectors(IK.direction, Y_AXIS);
  IK.bend.normalize();

  const along =
    (upperLength * upperLength - lowerLength * lowerLength + distance * distance) /
    (2 * distance);
  const height = Math.sqrt(
    Math.max(0, upperLength * upperLength - along * along),
  );
  IK.solvedElbow
    .copy(IK.shoulder)
    .addScaledVector(IK.direction, along)
    .addScaledVector(IK.bend, height)
    .lerp(IK.elbow, 1 - blend);

  aimBoneAt(upperArm, IK.solvedElbow);
  upperArm.updateWorldMatrix(true, true);
  aimBoneAt(forearm, IK.target);
  forearm.updateWorldMatrix(true, true);
}

function faceAnchor(
  bones: Bones,
  gesture: PowerPoseGesture,
  hand: PowerPoseHand,
) {
  if (gesture === "eyes") return hand === "left" ? bones.eyeL : bones.eyeR;
  if (gesture === "ears") return hand === "left" ? bones.earL : bones.earR;
  return bones.mouth;
}

function applyPowerPose(rig: Rig, id: CharacterId, blend: number) {
  const pose = MONKEY_POWER_POSES[id];
  for (const side of pose.hands) {
    poseArm(
      rig,
      side === "left" ? rig.bones.armL : rig.bones.armR,
      side === "left" ? rig.bones.forearmL : rig.bones.forearmR,
      side === "left" ? rig.bones.handL : rig.bones.handR,
      faceAnchor(rig.bones, pose.gesture, side),
      blend,
    );
  }
}

const HELD_BANANA_SCALE = 4;
function placeBananaInHand(rig: Rig, banana: Group, biteScale: number) {
  const hand = rig.bones.handR;
  const parent = banana.parent;
  if (!hand || !parent) return;
  rig.model.updateWorldMatrix(true, true);
  parent.updateWorldMatrix(true, false);
  hand.getWorldPosition(IK.bananaPosition);
  hand.getWorldQuaternion(IK.bananaWorld);
  parent.worldToLocal(IK.bananaPosition);
  parent.getWorldQuaternion(IK.parentWorld).invert();
  banana.quaternion.copy(IK.parentWorld).multiply(IK.bananaWorld);
  banana.rotateX(-0.35);
  banana.rotateZ(Math.PI / 2);
  IK.bananaOffset
    .set(-0.3, 0.12, -0.05)
    .applyQuaternion(banana.quaternion);
  banana.position.copy(IK.bananaPosition).add(IK.bananaOffset);
  banana.scale.setScalar(HELD_BANANA_SCALE * biteScale);
}

export default function Monkey({
  id,
  power,
  locomotion,
}: {
  id: CharacterId;
  power: boolean;
  locomotion: React.RefObject<{ speed: number; grounded: boolean }>;
}) {
  const template = useLoader(MonkeyFBXLoader, MODEL_URL);
  const bananaTemplate = useLoader(GLTFLoader, BANANA_MODEL_URL);
  const eatingBanana = useMemo(() => {
    const banana = bananaTemplate.scene.clone(true) as Group;
    banana.visible = false;
    banana.traverse((child) => {
      if ((child as Mesh).isMesh) child.castShadow = true;
    });
    return banana;
  }, [bananaTemplate]);
  const eatingBananaRef = useRef<Group>(null);
  const activeAction = useRef<"idle" | "run">("idle");
  const switchCooldown = useRef(0);
  const powerPoseBlend = useRef(0);

  useFrame((_, delta) => {
    const rig = getRig(template, id);
    const dt = Math.min(delta, 0.05);
    const { speed, grounded } = locomotion.current;
    // Hysteresis + cooldown: without this, a companion hovering near the
    // follow-distance threshold flickers between idle/run several times a
    // second as its speed nudges past a single cutoff.
    const wantRun = monkeyAnimation(
      grounded,
      speed,
      activeAction.current === "run",
    );
    switchCooldown.current = Math.max(0, switchCooldown.current - dt);
    rig.mixer.update(dt);
    const { idle, run } = rig.actions;
    if (
      run &&
      idle &&
      activeAction.current !== wantRun &&
      switchCooldown.current <= 0
    ) {
      activeAction.current = wantRun;
      switchCooldown.current = 0.35;
      const next = wantRun === "run" ? run : idle;
      const prev = wantRun === "run" ? idle : run;
      next.reset().fadeIn(0.25).play();
      prev.fadeOut(0.25);
    }
    if (run) run.timeScale = grounded ? 0.85 + speed * 0.14 : 1.15;

    const now = performance.now();
    const powerPoseActive = power || runtime.poseUntil[id] > now;
    powerPoseBlend.current = nextPowerPoseBlend(
      powerPoseBlend.current,
      powerPoseActive,
      dt,
    );
    if (powerPoseBlend.current > 0.001)
      applyPowerPose(rig, id, powerPoseBlend.current);
    const eatBlend = eatingPoseBlend(
      runtime.eatingStarted[id],
      runtime.eatingUntil[id],
      now,
    );
    if (eatBlend > 0.001)
      poseArm(
        rig,
        rig.bones.armR,
        rig.bones.forearmR,
        rig.bones.handR,
        rig.bones.mouth,
        eatBlend,
      );
    const biteScale = eatingBananaScale(
      runtime.eatingStarted[id],
      runtime.eatingUntil[id],
      now,
    );
    const banana = eatingBananaRef.current;
    if (banana) {
      banana.visible = biteScale > 0;
      if (banana.visible) placeBananaInHand(rig, banana, biteScale);
    }
    // No jump clip exists in the source rig, and posing individual leg
    // bones on top of a still-playing walk/idle clip twisted the mesh badly
    // (the clip keeps driving the lower leg/foot chain relative to a parent
    // bone that no longer matches, since only the upper leg was overridden).
    // A whole-model squash-and-stretch is a safe way to sell a jump instead:
    // it can't desync from the skeleton because it never touches a bone.
    const targetScaleY = grounded ? 1 : 1.18;
    const targetScaleXZ = grounded ? 1 : 0.9;
    rig.model.scale.y +=
      (rig.baseScale * targetScaleY - rig.model.scale.y) * 0.25;
    rig.model.scale.x +=
      (rig.baseScale * targetScaleXZ - rig.model.scale.x) * 0.25;
    rig.model.scale.z +=
      (rig.baseScale * targetScaleXZ - rig.model.scale.z) * 0.25;
  });

  return (
    <>
      <primitive object={getRig(template, id).model} />
      <primitive ref={eatingBananaRef} object={eatingBanana} />
    </>
  );
}
