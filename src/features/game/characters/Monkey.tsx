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
  Euler,
  Group,
  LoadingManager,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import { CHARACTERS, type CharacterId, type Vec3 } from "../types";
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
import { VerletSystem } from "./verlet";
import {
  CLASSIC_QUADRUPED_CLIP,
  monkeyRenderMotion,
  type MonkeyLocomotion,
  type MonkeyMotion,
} from "./monkeyMotion";
import { monkeyRigBone, resolveMonkeyRig } from "./monkeyRig";
import { restoreMonkeyBindPose } from "./monkeyBindPose";
import { SuspendedLeg } from "./suspendedLeg";
import { sampleSwingSurfaceFoot } from "./swingSurface";
import { limitSuspendedElbowPole, sampleHandReach } from "./brachiationPose";
import { solveTwoBoneJoint, type LocalBasis } from "./brachiationPhysics";
import { LOCOMOTION_TUNING, WORLD_GRAVITY } from "./locomotionConfig";
import {
  solveProceduralBodyPose,
  type ProceduralBodyDimensions,
  type ProceduralBodyPose,
} from "./proceduralBodyRig";

const MODEL_URL = "/assets/models/monkey.fbx";
const TARGET_HEIGHT = 0.72;
const IDLE_CLIP = "monkey_idleC";
const FAST_CLIP = "monkey_fastwalk";
const STAND_CLIP = "monkey_idle_E";
// Fallback for distance-driven callers. The story supplies its calibrated
// value explicitly so every route segment contains four to five steps.
const DEFAULT_METERS_PER_STRIDE = 1.6;
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
  root?: Bone;
  spine?: Bone;
  waist?: Bone;
  chest?: Bone;
  neck?: Bone;
  clavicleL?: Bone;
  armL?: Bone;
  forearmL?: Bone;
  handL?: Bone;
  clavicleR?: Bone;
  armR?: Bone;
  forearmR?: Bone;
  handR?: Bone;
  head?: Bone;
  eyeL?: Bone;
  eyeR?: Bone;
  earL?: Bone;
  earR?: Bone;
  mouth?: Bone;
  thighL?: Bone;
  shinL?: Bone;
  footL?: Bone;
  ballL?: Bone;
  thighR?: Bone;
  shinR?: Bone;
  footR?: Bone;
  ballR?: Bone;
};
type NeutralBoneTransform = {
  bone: Bone;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
};
type ArmCalibration = {
  armLength: number;
  rootReach: number;
  shoulderOffset: Vector3;
};
type Rig = {
  model: Group;
  mixer: AnimationMixer;
  actions: {
    idle?: AnimationAction;
    run?: AnimationAction;
    walk?: AnimationAction;
    stand?: AnimationAction;
    motion: Partial<Record<MonkeyMotion, AnimationAction>>;
  };
  bones: Bones;
  baseScale: number;
  modelPosition: Vector3;
  rootPosition?: Vector3;
  motionRoot?: Object3D;
  motionRootPosition?: Vector3;
  motionRootQuaternion?: Quaternion;
  motionRootScale?: Vector3;
  /** Blender's cleared-action/rest pose, captured before any mixer action. */
  neutralPose: NeutralBoneTransform[];
  verletArms?: VerletArms;
  /**
   * Physical reach is calibrated once while the imported model still has its
   * uniform bind scale.  The later squash/stretch is visual-only and must not
   * silently change a locomotion constraint.
   */
  armCalibration: Partial<Record<"left" | "right", ArmCalibration>>;
  bodyDimensions: ProceduralBodyDimensions;
  bodyPose: ProceduralBodyPose;
  bodyBasis: LocalBasis;
  suspendedLegs?: Partial<Record<"left" | "right", SuspendedLeg>>;
  lastHands?: { left: Vector3; right: Vector3 };
  releaseHands?: { left: Vector3; right: Vector3 };
  entryHands?: { left: Vector3; right: Vector3 };
  lastMotion?: MonkeyMotion;
  lastMotionTime?: number;
  tail: Bone[];
  headYaw?: number;
  headPitch?: number;
};

// A real Verlet-simulated elbow per arm (see verlet.ts), used while gripping
// a vine: shoulder and hand are pinned each frame from the actual bone/anchor
// world positions, gravity is left free to settle the elbow between them,
// exactly as the reference's simple_rig drives its two-bone IK's bend plane
// instead of a hand-authored constant.
type VerletArms = {
  system: VerletSystem;
  shoulderL: number;
  elbowL: number;
  handL: number;
  shoulderR: number;
  elbowR: number;
  handR: number;
  bonesMeasured: boolean;
};
const RIG_CACHE = new WeakMap<Group, Partial<Record<CharacterId, Rig>>>();

function createMotionActions(
  mixer: AnimationMixer,
  baseClip: AnimationClip | undefined,
) {
  const actions: Partial<Record<MonkeyMotion, AnimationAction>> = {};
  if (!baseClip) return actions;
  for (const motion of [
    "tree-climb",
    "tree-descend",
    "vine-grab",
    "vine-swing",
    "vine-jump",
    "fall",
  ] as const satisfies readonly MonkeyMotion[]) {
    const clip = baseClip.clone();
    clip.name = `gibbon-procedural-${motion}`;
    actions[motion] = mixer.clipAction(clip);
  }
  return actions;
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
export function buildRig(template: Group, id: CharacterId): Rig {
  const model = cloneSkeleton(template) as Group;
  const box = new Box3().setFromObject(model);
  const importedPose: NeutralBoneTransform[] = [];
  model.traverse((child) => {
    if (!(child instanceof Bone)) return;
    importedPose.push({
      bone: child,
      position: child.position.clone(),
      quaternion: child.quaternion.clone(),
      scale: child.scale.clone(),
    });
  });
  // The FBX's loaded transforms contain a quadruped keyframe. Skin inverse
  // matrices are the source of the symmetric, upright anatomical bind pose.
  restoreMonkeyBindPose(model);
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

  const anatomicalRig = resolveMonkeyRig(model);
  const standard = (name: string) => monkeyRigBone(anatomicalRig, name);
  const bones: Bones = {
    root: standard("Root"),
    spine: standard("Hips"),
    waist: standard("Spine_01"),
    chest: standard("UpperChest"),
    neck: standard("Neck_01"),
    clavicleL: standard("Clavicle_L"),
    armL: standard("UpperArm_L"),
    forearmL: standard("Forearm_L"),
    handL: standard("Hand_L"),
    clavicleR: standard("Clavicle_R"),
    armR: standard("UpperArm_R"),
    forearmR: standard("Forearm_R"),
    handR: standard("Hand_R"),
    head: standard("Head"),
    eyeL: standard("Eye_L"),
    eyeR: standard("Eye_R"),
    earL: standard("Ear_L"),
    earR: standard("Ear_R"),
    mouth: standard("Jaw"),
    thighL: standard("Thigh_L"),
    shinL: standard("Shin_L"),
    footL: standard("Foot_L"),
    ballL: standard("Ball_L"),
    thighR: standard("Thigh_R"),
    shinR: standard("Shin_R"),
    footR: standard("Foot_R"),
    ballR: standard("Ball_R"),
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
  const runClip = clip(CLASSIC_QUADRUPED_CLIP);
  const walkClip = clip(FAST_CLIP);
  const standClip = clip(STAND_CLIP);
  const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
  const run = runClip
    ? mixer.clipAction(runClip)
    : walkClip
      ? mixer.clipAction(walkClip)
      : undefined;
  const walk = walkClip ? mixer.clipAction(walkClip) : run;
  const stand = standClip ? mixer.clipAction(standClip) : idle;
  const motion = createMotionActions(mixer, standClip ?? idleClip);
  const neutralPose: NeutralBoneTransform[] = [];
  model.traverse((child) => {
    if (!(child instanceof Bone)) return;
    neutralPose.push({
      bone: child,
      position: child.position.clone(),
      quaternion: child.quaternion.clone(),
      scale: child.scale.clone(),
    });
  });
  idle?.play();
  const motionRoot = model.getObjectByName("Animal_3146_Rig");
  const rig = {
    model,
    mixer,
    actions: { idle, run, walk, stand, motion },
    bones,
    baseScale: scale,
    modelPosition: model.position.clone(),
    rootPosition: bones.root?.position.clone(),
    motionRoot,
    motionRootPosition: motionRoot?.position.clone(),
    motionRootQuaternion: motionRoot?.quaternion.clone(),
    motionRootScale: motionRoot?.scale.clone(),
    neutralPose,
    tail: neutralPose
      .map(({ bone }) => bone)
      .filter((bone) => /^tail\d{3}(?:_end)?$/.test(bone.name)),
    armCalibration: {},
    bodyDimensions: {
      baseOffset: new Vector3(),
      baseToShoulderCenter: new Vector3(0, 0.3, 0),
      shoulderWidth: 0.24,
      baseToHipCenter: new Vector3(0, -0.02, 0),
      hipWidth: 0.16,
    },
    bodyPose: {
      leftShoulder: new Vector3(),
      rightShoulder: new Vector3(),
      base: new Vector3(),
      leftHip: new Vector3(),
      rightHip: new Vector3(),
    },
    bodyBasis: {
      forward: new Vector3(0, 0, 1),
      right: new Vector3(-1, 0, 0),
      up: new Vector3(0, 1, 0),
    },
  } satisfies Rig;
  // Ground the upright bind pose at the same foot plane as the original
  // model. The imported quadruped bounding box is much shorter than a T pose.
  if (bones.root && bones.footL && bones.footR) {
    model.updateWorldMatrix(true, true);
    const footY = Math.min(
      bones.footL.getWorldPosition(new Vector3()).y,
      bones.footR.getWorldPosition(new Vector3()).y,
    );
    const rootWorld = bones.root.getWorldPosition(new Vector3());
    rootWorld.y += -0.4 - footY;
    bones.root.parent!.worldToLocal(rootWorld);
    bones.root.position.copy(rootWorld);
    neutralPose
      .find((pose) => pose.bone === bones.root)!
      .position.copy(rootWorld);
  }
  calibrateNeutralBody(rig);
  calibrateNeutralArms(rig);
  for (const transform of importedPose) {
    transform.bone.position.copy(transform.position);
    transform.bone.quaternion.copy(transform.quaternion);
    transform.bone.scale.copy(transform.scale);
  }
  return rig;
}

function bonePoint(bone: Bone | undefined, out: Vector3) {
  if (!bone) return false;
  bone.getWorldPosition(out);
  return true;
}

function calibrateNeutralBody(rig: Rig) {
  rig.model.updateWorldMatrix(true, true);
  const base = new Vector3();
  const leftShoulder = new Vector3();
  const rightShoulder = new Vector3();
  const leftHip = new Vector3();
  const rightHip = new Vector3();
  if (
    !bonePoint(rig.bones.spine, base) ||
    !bonePoint(rig.bones.armL, leftShoulder) ||
    !bonePoint(rig.bones.armR, rightShoulder) ||
    !bonePoint(rig.bones.thighL, leftHip) ||
    !bonePoint(rig.bones.thighR, rightHip)
  )
    return;
  const shoulderCenter = leftShoulder.add(rightShoulder).multiplyScalar(0.5);
  const hipCenter = leftHip.add(rightHip).multiplyScalar(0.5);
  const dimensions = rig.bodyDimensions;
  (dimensions.baseOffset as Vector3).copy(base);
  (dimensions.baseToShoulderCenter as Vector3).copy(shoulderCenter).sub(base);
  (dimensions.baseToShoulderCenter as Vector3).x = 0;
  // armCalibration runs next, so use the measured neutral shoulder positions
  // here rather than the still-empty cache.
  dimensions.shoulderWidth = Math.max(
    0.02,
    Math.abs(
      (rig.bones.armL?.getWorldPosition(leftShoulder).x ?? 0) -
        (rig.bones.armR?.getWorldPosition(rightShoulder).x ?? 0),
    ),
  );
  (dimensions.baseToHipCenter as Vector3).copy(hipCenter).sub(base);
  (dimensions.baseToHipCenter as Vector3).x = 0;
  dimensions.hipWidth = Math.max(
    0.02,
    Math.abs(
      (rig.bones.thighL?.getWorldPosition(leftHip).x ?? 0) -
        (rig.bones.thighR?.getWorldPosition(rightHip).x ?? 0),
    ),
  );
}

function neutralArmCalibration(
  rig: Rig,
  upper: Bone | undefined,
  lower: Bone | undefined,
  end: Bone | undefined,
  side: "left" | "right",
) {
  if (!upper || !lower || !end) return undefined;
  // buildRig runs before the clone is parented under Character's physical
  // root. Its world coordinates therefore are exactly physical-root local
  // coordinates, including the model's ground-alignment offset and scale.
  rig.model.updateWorldMatrix(true, true);
  const shoulder = new Vector3();
  const elbow = new Vector3();
  const wrist = new Vector3();
  upper.getWorldPosition(shoulder);
  lower.getWorldPosition(elbow);
  end.getWorldPosition(wrist);
  const armLength = shoulder.distanceTo(elbow) + elbow.distanceTo(wrist);
  const base = rig.bodyDimensions.baseOffset;
  const shoulders = rig.bodyDimensions.baseToShoulderCenter;
  const shoulderOffset = new Vector3(
    base.x +
      shoulders.x +
      (side === "left" ? 1 : -1) * rig.bodyDimensions.shoulderWidth * 0.5,
    base.y + shoulders.y,
    base.z + shoulders.z,
  );
  return {
    armLength,
    rootReach: shoulderOffset.length() + armLength,
    shoulderOffset,
  } satisfies ArmCalibration;
}

function calibrateNeutralArms(rig: Rig) {
  const left = neutralArmCalibration(
    rig,
    rig.bones.armL,
    rig.bones.forearmL,
    rig.bones.handL,
    "left",
  );
  const right = neutralArmCalibration(
    rig,
    rig.bones.armR,
    rig.bones.forearmR,
    rig.bones.handR,
    "right",
  );
  if (left) rig.armCalibration.left = left;
  if (right) rig.armCalibration.right = right;
}

export function restoreNeutralPose(rig: Rig) {
  for (const transform of rig.neutralPose) {
    transform.bone.position.copy(transform.position);
    transform.bone.quaternion.copy(transform.quaternion);
    transform.bone.scale.copy(transform.scale);
  }
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
const WORLD_DOWN = new Vector3(
  WORLD_GRAVITY.x,
  WORLD_GRAVITY.y,
  WORLD_GRAVITY.z,
).normalize();
const WORLD_UP = WORLD_DOWN.clone().negate();
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
  previousLocal: new Quaternion(),
  desiredLocal: new Quaternion(),
  targetLocal: new Quaternion(),
  bananaPosition: new Vector3(),
  bananaOffset: new Vector3(),
  bananaWorld: new Quaternion(),
  poseOffset: new Vector3(),
  poseTargetL: new Vector3(),
  poseTargetR: new Vector3(),
  elbowTargetL: new Vector3(),
  elbowTargetR: new Vector3(),
  characterOrigin: new Vector3(),
  characterWorld: new Quaternion(),
  bendHint: new Vector3(),
  lookEuler: new Euler(0, 0, 0, "YXZ"),
  lookRotation: new Quaternion(),
  tailAnchor: new Vector3(),
  swayQuat: new Quaternion(),
  wrapQuat: new Quaternion(),
};

// Rotate only enough to point a bone's real chain axis at a target. FBX bone
// rolls differ per limb, so assuming +Y here is what caused the earlier
// corkscrew deformation.
function aimBoneAt(bone: Bone, child: Bone, target: Vector3) {
  if (!bone.parent) return;
  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(IK.bonePosition);
  IK.direction.subVectors(target, IK.bonePosition);
  if (IK.direction.lengthSq() < 1e-8) return;
  IK.direction.normalize();
  bone.getWorldQuaternion(IK.boneWorld);
  // FBX bones do not all point along +Y. Deriving the chain axis from the
  // actual child offset keeps elbows/knees stable when an end effector is
  // pinned to a branch or vine.
  IK.currentAxis
    .copy(child.position)
    .normalize()
    .applyQuaternion(IK.boneWorld)
    .normalize();
  IK.rotationDelta.setFromUnitVectors(IK.currentAxis, IK.direction);
  IK.desiredWorld.copy(IK.rotationDelta).multiply(IK.boneWorld);
  bone.parent.getWorldQuaternion(IK.parentWorld);
  IK.parentWorld.invert();
  bone.quaternion.copy(IK.parentWorld.multiply(IK.desiredWorld));
}

// Blend a bone's current rotation toward one that aims it at a world target,
// without fully committing - used to let the tail curl toward a grip while
// still easing in from whatever pose (sway, hang) it already had.
function blendAimBoneAt(
  bone: Bone,
  child: Bone,
  target: Vector3,
  blend: number,
) {
  if (blend <= 0.001) return;
  IK.swayQuat.copy(bone.quaternion);
  aimBoneAt(bone, child, target);
  if (blend < 0.999) {
    IK.wrapQuat.copy(bone.quaternion);
    bone.quaternion.copy(IK.swayQuat).slerp(IK.wrapQuat, blend);
  }
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
  if (IK.bend.lengthSq() < 1e-8) IK.bend.crossVectors(IK.direction, WORLD_UP);
  IK.bend.normalize();

  solveTwoBoneJoint(
    IK.solvedElbow,
    IK.shoulder,
    IK.target,
    IK.bend,
    upperLength,
    lowerLength,
  );
  IK.solvedElbow.lerp(IK.elbow, 1 - blend);

  aimBoneAt(upperArm, forearm, IK.solvedElbow);
  upperArm.updateWorldMatrix(true, true);
  aimBoneAt(forearm, hand, IK.target);
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

function characterTarget(
  rig: Rig,
  target: Vector3,
  x: number,
  y: number,
  z: number,
) {
  const parent = rig.model.parent;
  if (!parent) return target.set(x, y, z);
  parent.getWorldPosition(IK.characterOrigin);
  parent.getWorldQuaternion(IK.characterWorld);
  IK.poseOffset.set(x, y, z).applyQuaternion(IK.characterWorld);
  return target.copy(IK.characterOrigin).add(IK.poseOffset);
}

function characterDirection(rig: Rig, x: number, y: number, z: number) {
  const parent = rig.model.parent;
  if (!parent) return IK.bendHint.set(x, y, z).normalize();
  parent.getWorldQuaternion(IK.characterWorld);
  return IK.bendHint
    .set(x, y, z)
    .applyQuaternion(IK.characterWorld)
    .normalize();
}

function updateBodyControlRig(rig: Rig, locomotion: MonkeyLocomotion) {
  const parent = rig.model.parent;
  if (!parent) return rig.bodyPose;
  parent.updateWorldMatrix(true, false);
  parent.getWorldPosition(IK.characterOrigin);
  const basis = rig.bodyBasis;
  if (locomotion.bodyBasis) {
    Object.assign(basis.forward, locomotion.bodyBasis.forward);
    Object.assign(basis.right, locomotion.bodyBasis.right);
    Object.assign(basis.up, locomotion.bodyBasis.up);
  } else if (locomotion.forward && locomotion.right && locomotion.up) {
    basis.forward.x = locomotion.forward.x;
    basis.forward.y = locomotion.forward.y;
    basis.forward.z = locomotion.forward.z;
    basis.right.x = locomotion.right.x;
    basis.right.y = locomotion.right.y;
    basis.right.z = locomotion.right.z;
    basis.up.x = locomotion.up.x;
    basis.up.y = locomotion.up.y;
    basis.up.z = locomotion.up.z;
  } else {
    parent.getWorldQuaternion(IK.characterWorld);
    IK.direction.set(0, 0, 1).applyQuaternion(IK.characterWorld);
    basis.forward.x = IK.direction.x;
    basis.forward.y = IK.direction.y;
    basis.forward.z = IK.direction.z;
    IK.direction.set(-1, 0, 0).applyQuaternion(IK.characterWorld);
    basis.right.x = IK.direction.x;
    basis.right.y = IK.direction.y;
    basis.right.z = IK.direction.z;
    IK.direction.set(0, 1, 0).applyQuaternion(IK.characterWorld);
    basis.up.x = IK.direction.x;
    basis.up.y = IK.direction.y;
    basis.up.z = IK.direction.z;
  }
  const visualLift = rig.model.position.y - rig.modelPosition.y;
  IK.characterOrigin.addScaledVector(basis.up as Vector3, visualLift);
  return solveProceduralBodyPose(
    rig.bodyPose,
    IK.characterOrigin,
    basis,
    rig.bodyDimensions,
  );
}

function setBoneWorldPosition(bone: Bone | undefined, target: Readonly<Vec3>) {
  if (!bone?.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  IK.poseOffset.set(target.x, target.y, target.z);
  bone.parent.worldToLocal(IK.poseOffset);
  bone.position.copy(IK.poseOffset);
  bone.updateWorldMatrix(true, true);
}

function applyBodyControlRig(rig: Rig, locomotion: MonkeyLocomotion) {
  const pose = updateBodyControlRig(rig, locomotion);
  // Spine is the deforming pelvis and the parent of the torso, legs and tail.
  // Its world position follows the Rapier mass under gravity.
  setBoneWorldPosition(rig.bones.spine, pose.base);
  // Shoulder points are the ends of one rigid clavicle bar. The FBX has two
  // clavicle deformers, so aim them before either free arm is solved.
  if (rig.bones.clavicleL && rig.bones.armL) {
    aimBoneAt(
      rig.bones.clavicleL,
      rig.bones.armL,
      pose.leftShoulder as Vector3,
    );
    rig.bones.clavicleL.updateWorldMatrix(true, true);
  }
  if (rig.bones.clavicleR && rig.bones.armR) {
    aimBoneAt(
      rig.bones.clavicleR,
      rig.bones.armR,
      pose.rightShoulder as Vector3,
    );
    rig.bones.clavicleR.updateWorldMatrix(true, true);
  }
  setBoneWorldPosition(rig.bones.armL, pose.leftShoulder);
  setBoneWorldPosition(rig.bones.armR, pose.rightShoulder);
  // The two hip pivots live beside the triangle's lower point. They may move
  // with the rigid torso, while each leg below remains a free two-link
  // pendulum solved toward its own foot target.
  setBoneWorldPosition(rig.bones.thighL, pose.leftHip);
  setBoneWorldPosition(rig.bones.thighR, pose.rightHip);
}

function poseSuspendedLegs(
  rig: Rig,
  dt: number,
  locomotion: MonkeyLocomotion,
  flight = 0,
) {
  rig.suspendedLegs ??= {};
  for (const side of ["left", "right"] as const) {
    const upper = side === "left" ? rig.bones.thighL : rig.bones.thighR;
    const lower = side === "left" ? rig.bones.shinL : rig.bones.shinR;
    const end = side === "left" ? rig.bones.footL : rig.bones.footR;
    if (!upper || !lower || !end) continue;
    upper.getWorldPosition(IK.shoulder);
    let leg = rig.suspendedLegs[side];
    if (!leg) {
      lower.getWorldPosition(IK.elbow);
      end.getWorldPosition(IK.wrist);
      leg = new SuspendedLeg(IK.shoulder, IK.elbow, IK.wrist);
      rig.suspendedLegs[side] = leg;
    }
    const surface = locomotion.swingSurface;
    if (surface) {
      lower.getWorldPosition(IK.elbow);
      end.getWorldPosition(IK.wrist);
      const reach = IK.shoulder.distanceTo(IK.elbow) + IK.elbow.distanceTo(IK.wrist);
      if (sampleSwingSurfaceFoot(IK.poseTargetL, IK.shoulder, surface, side, reach * 0.98)) {
        solveTwoBone(rig, upper, lower, end, IK.poseTargetL, [side === "left" ? 0.4 : -0.4, 0, 1]);
        // Re-seed free legs at the contact pose before leaving the solid.
        lower.getWorldPosition(leg.knee);
        end.getWorldPosition(leg.foot);
        continue;
      }
    }
    leg.update(IK.shoulder, dt, {
      forward: rig.bodyBasis.forward,
      travel:
        locomotion.forward ?? IK.radial.copy(rig.bodyBasis.right).negate(),
      // Climbing a held rope (shift/ctrl) reads as active effort even while
      // the pendulum itself is nearly still, not just a free-hanging drift.
      pump: Math.min(
        1,
        Math.abs(locomotion.swingAngularVelocity ?? 0) * 0.35 +
          Math.abs(locomotion.climbRate ?? 0) * 0.55,
      ),
      grip: locomotion.hands?.[side].reaching
        ? MathUtils.smoothstep(
            locomotion.hands[side].reachProgress ?? 0,
            0.15,
            0.85,
          )
        : locomotion.hands?.[side].grabbed
          ? 0.85
          : 0,
      flight,
    });
    aimBoneAt(upper, lower, leg.knee);
    upper.updateWorldMatrix(true, true);
    aimBoneAt(lower, end, leg.foot);
    lower.updateWorldMatrix(true, true);
  }
  orientFeet(rig);
}

function solveTwoBone(
  rig: Rig,
  upper: Bone | undefined,
  lower: Bone | undefined,
  end: Bone | undefined,
  target: Vector3,
  bendLocal: readonly [number, number, number],
  blend = 1,
) {
  if (!upper || !lower || !end) return;
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(IK.shoulder);
  lower.getWorldPosition(IK.elbow);
  end.getWorldPosition(IK.wrist);
  const upperLength = IK.shoulder.distanceTo(IK.elbow);
  const lowerLength = IK.elbow.distanceTo(IK.wrist);
  if (upperLength < 1e-5 || lowerLength < 1e-5) return;

  IK.target.copy(IK.wrist).lerp(target, blend);
  IK.direction.subVectors(IK.target, IK.shoulder);
  const rawDistance = IK.direction.length();
  if (rawDistance < 1e-6) return;
  IK.direction.normalize();
  const distance = Math.min(
    upperLength + lowerLength - 1e-5,
    Math.max(Math.abs(upperLength - lowerLength) + 1e-5, rawDistance),
  );
  IK.target.copy(IK.shoulder).addScaledVector(IK.direction, distance);
  IK.bend.copy(characterDirection(rig, ...bendLocal));
  IK.bend.addScaledVector(IK.direction, -IK.bend.dot(IK.direction));
  if (IK.bend.lengthSq() < 1e-8)
    IK.bend.crossVectors(IK.direction, characterDirection(rig, 0, 1, 0));
  if (IK.bend.lengthSq() < 1e-8)
    IK.bend.crossVectors(IK.direction, characterDirection(rig, 1, 0, 0));
  IK.bend.normalize();
  solveTwoBoneJoint(
    IK.solvedElbow,
    IK.shoulder,
    IK.target,
    IK.bend,
    upperLength,
    lowerLength,
  );
  aimBoneAt(upper, lower, IK.solvedElbow);
  upper.updateWorldMatrix(true, true);
  aimBoneAt(lower, end, IK.target);
  lower.updateWorldMatrix(true, true);
}

function orientFoot(rig: Rig, foot: Bone | undefined, ball: Bone | undefined) {
  if (!foot || !ball) return;
  foot.updateWorldMatrix(true, true);
  foot.getWorldPosition(IK.bonePosition);
  ball.getWorldPosition(IK.wrist);
  const length = IK.bonePosition.distanceTo(IK.wrist);
  if (length < 1e-5) return;
  IK.target
    .copy(IK.bonePosition)
    .addScaledVector(characterDirection(rig, 0, -0.08, 1), length);
  aimBoneAt(foot, ball, IK.target);
  foot.updateWorldMatrix(true, true);
}

function orientFeet(rig: Rig) {
  orientFoot(rig, rig.bones.footL, rig.bones.ballL);
  orientFoot(rig, rig.bones.footR, rig.bones.ballR);
}

function aimBodySegment(
  rig: Rig,
  bone: Bone | undefined,
  child: Bone | undefined,
  directionLocal: readonly [number, number, number],
) {
  if (!bone || !child) return;
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(IK.bonePosition);
  child.getWorldPosition(IK.solvedElbow);
  const length = IK.bonePosition.distanceTo(IK.solvedElbow);
  if (length < 1e-5) return;
  IK.target
    .copy(IK.bonePosition)
    .addScaledVector(characterDirection(rig, ...directionLocal), length);
  aimBoneAt(bone, child, IK.target);
  bone.updateWorldMatrix(true, true);
}

function poseTorso(
  rig: Rig,
  lowerDirection: readonly [number, number, number],
  upperDirection: readonly [number, number, number],
  headDirection: readonly [number, number, number] = upperDirection,
) {
  // The FBX's `Spine` bone is the pelvis and parents both legs. Rotating it
  // as if it were a lumbar segment dragged the hip origins around the torso
  // and made the legs cross. The measured Blender recipe correctly begins at
  // Spine.001: pelvis stays the stable root, then every segment is aimed in
  // parent-before-child order.
  aimBodySegment(rig, rig.bones.waist, rig.bones.chest, lowerDirection);
  aimBodySegment(rig, rig.bones.chest, rig.bones.neck, upperDirection);
  // The head is its own segment. Reusing a strong torso lean here makes the
  // short neck visually merge with the chest, which was the "half a head"
  // deformation visible in the first procedural version.
  aimBodySegment(rig, rig.bones.neck, rig.bones.head, headDirection);
}

export function poseHeadTowardMotion(
  rig: Rig,
  locomotion: MonkeyLocomotion,
  dt: number,
) {
  const neck = rig.bones.neck;
  const head = rig.bones.head;
  if (!neck || !head) return;
  head.getWorldPosition(IK.head);
  const lookTarget = locomotion.nextVineAnchor;
  if (lookTarget) IK.target.set(lookTarget.x, lookTarget.y, lookTarget.z);
  else if (locomotion.velocity) {
    IK.direction.set(
      locomotion.velocity.x,
      locomotion.velocity.y,
      locomotion.velocity.z,
    );
    if (IK.direction.lengthSq() < 1e-6) return;
    IK.direction.normalize();
    IK.target.copy(IK.head).addScaledVector(IK.direction, 0.45);
  } else return;
  IK.direction.subVectors(IK.target, IK.head).normalize();
  const basis = rig.bodyBasis;
  const x = -IK.direction.dot(basis.right as Vector3);
  const z = IK.direction.dot(basis.forward as Vector3);
  const y = IK.direction.dot(basis.up as Vector3);
  const yaw = MathUtils.clamp(Math.atan2(x, z), -0.9, 0.9);
  const pitch = MathUtils.clamp(Math.atan2(y, Math.hypot(x, z)), -0.45, 0.65);
  const blend = 1 - Math.exp(-LOCOMOTION_TUNING.headSmoothing * dt);
  rig.headYaw = MathUtils.lerp(rig.headYaw ?? 0, yaw, blend);
  rig.headPitch = MathUtils.lerp(rig.headPitch ?? 0, pitch, blend);
  IK.lookRotation.setFromEuler(
    IK.lookEuler.set(-rig.headPitch, rig.headYaw, 0),
  );
  rig.model.parent?.getWorldQuaternion(IK.characterWorld);
  IK.rotationDelta
    .copy(IK.characterWorld)
    .multiply(IK.lookRotation)
    .multiply(IK.parentWorld.copy(IK.characterWorld).invert());
  head.getWorldQuaternion(IK.boneWorld);
  IK.desiredWorld.copy(IK.rotationDelta).multiply(IK.boneWorld);
  head.parent!.getWorldQuaternion(IK.parentWorld).invert();
  head.quaternion.copy(IK.parentWorld).multiply(IK.desiredWorld);
  head.updateWorldMatrix(true, true);
}

function cycle(value: number) {
  return MathUtils.euclideanModulo(value, 1);
}

// solveTwoBone's own `blend` only eases the IK target toward the limb's
// *current* world position each frame - it can't know a brand-new activity
// just started, so at high blend values (0.9+) a freshly entered motion
// still reaches most of the way to its target within a single frame. This
// ramps 0→1 over the activity's first fraction of a second so climb/grab
// poses ease in from whatever the limb was doing a moment before instead of
// snapping to the trunk/vine on the very first frame.
function enteringBlend(elapsed: number, duration = 0.22) {
  return MathUtils.smoothstep(elapsed, 0, duration);
}

function climbingContact(phase: number, high: number, low: number) {
  const planted = 0.67;
  if (phase < planted)
    return {
      y: MathUtils.lerp(high, low, phase / planted),
      z: 0.2,
    };
  const recovery = MathUtils.smoothstep(
    (phase - planted) / (1 - planted),
    0,
    1,
  );
  return {
    y: MathUtils.lerp(low, high, recovery),
    z: 0.2 - Math.sin(recovery * Math.PI) * 0.1,
  };
}

function ensureVerletArms(rig: Rig): VerletArms {
  if (rig.verletArms) return rig.verletArms;
  const system = new VerletSystem();
  const shoulderL = system.addPoint(new Vector3(), "shoulder_l");
  const elbowL = system.addPoint(new Vector3(), "elbow_l");
  const handL = system.addPoint(new Vector3(), "hand_l");
  const shoulderR = system.addPoint(new Vector3(), "shoulder_r");
  const elbowR = system.addPoint(new Vector3(), "elbow_r");
  const handR = system.addPoint(new Vector3(), "hand_r");
  for (const i of [shoulderL, handL, shoulderR, handR])
    system.points[i].pinned = true;
  const arms: VerletArms = {
    system,
    shoulderL,
    elbowL,
    handL,
    shoulderR,
    elbowR,
    handR,
    bonesMeasured: false,
  };
  rig.verletArms = arms;
  return arms;
}

// The gripping hand reaches for the vine roughly one arm's length from the
// hip, along the line toward the actual attach point - not the attach point
// itself, which sits well above the character for most of the swing.
function vineHandTarget(
  out: Vector3,
  hip: Vector3,
  anchor: Vector3,
  reach: number,
) {
  out.subVectors(anchor, hip);
  const distance = out.length();
  if (distance < 1e-5) return out.copy(hip);
  return out.multiplyScalar(reach / distance).add(hip);
}

// After this long standing still on one hand, the free hand starts fidgeting
// and the tail curls up to hook the vine as a third anchor point - it never
// grips as a real hand-over-hand contact, just reads as a resting monkey
// killing time instead of a statue.
const IDLE_FIDGET_DELAY = 10;
const IDLE_FIDGET_RAMP = 1.5;

function applyIdleVineFidget(
  rig: Rig,
  elapsed: number,
  locomotion: MonkeyLocomotion,
) {
  const idle = locomotion.idleElapsed ?? 0;
  const blend = MathUtils.smoothstep(
    (idle - IDLE_FIDGET_DELAY) / IDLE_FIDGET_RAMP,
    0,
    1,
  );
  const anchor = locomotion.vineAnchor;
  if (anchor) {
    IK.tailAnchor.set(anchor.x, anchor.y, anchor.z);
    for (let index = 0; index < rig.tail.length - 1; index++) {
      const t = index / Math.max(1, rig.tail.length - 2);
      // Only the outer half of the tail curls - the base stays with the
      // regular counter-sway so the wrap reads as reaching up, not the
      // whole tail snapping into a new shape.
      const segmentBlend = blend * MathUtils.smoothstep(t, 0.35, 0.85);
      blendAimBoneAt(
        rig.tail[index],
        rig.tail[index + 1],
        IK.tailAnchor,
        segmentBlend,
      );
    }
  }
  if (blend <= 0.001) return;
  const hands = locomotion.hands;
  const freeSide = !hands
    ? undefined
    : !hands.left.grabbed
      ? "left"
      : !hands.right.grabbed
        ? "right"
        : undefined;
  if (!freeSide) return;
  // A slow scratch-the-head cycle rather than a pose held statically.
  const cycle = 0.5 + 0.5 * Math.sin(elapsed * 1.6);
  poseArm(
    rig,
    freeSide === "left" ? rig.bones.armL : rig.bones.armR,
    freeSide === "left" ? rig.bones.forearmL : rig.bones.forearmR,
    freeSide === "left" ? rig.bones.handL : rig.bones.handR,
    rig.bones.head,
    blend * cycle,
  );
}

// A real Verlet-simulated elbow per arm while gripping a vine: shoulder and
// hand positions are pinned each frame from the actual bone/anchor world
// positions, and gravity is left free to settle the elbow between them. This
// is the reference's own technique (a Verlet.System driving two-bone IK's
// bend plane, see assets/moves/.../GibbonControl.cs's simple_rig) rather than
// a hand-authored constant bend direction.
function poseVineSwingArms(rig: Rig, dt: number, locomotion: MonkeyLocomotion) {
  const { armL, forearmL, handL, armR, forearmR, handR } = rig.bones;
  const {
    vineAnchor: anchor,
    previousVineAnchor,
    nextVineAnchor,
    brachiationProgress,
    gripHand,
  } = locomotion;
  if (!armL || !forearmL || !handL || !armR || !forearmR || !handR || !anchor)
    return false;

  const arms = ensureVerletArms(rig);
  const { system } = arms;
  const shoulderLPoint = system.points[arms.shoulderL];
  const shoulderRPoint = system.points[arms.shoulderR];
  const elbowLPoint = system.points[arms.elbowL];
  const elbowRPoint = system.points[arms.elbowR];
  const handLPoint = system.points[arms.handL];
  const handRPoint = system.points[arms.handR];

  armL.updateWorldMatrix(true, false);
  armR.updateWorldMatrix(true, false);
  armL.getWorldPosition(shoulderLPoint.pos);
  armR.getWorldPosition(shoulderRPoint.pos);

  if (!arms.bonesMeasured) {
    const elbowLWorld = forearmL.getWorldPosition(new Vector3());
    const handLWorld = handL.getWorldPosition(new Vector3());
    const elbowRWorld = forearmR.getWorldPosition(new Vector3());
    const handRWorld = handR.getWorldPosition(new Vector3());
    system.addBone(
      "upper_l",
      arms.shoulderL,
      arms.elbowL,
      shoulderLPoint.pos.distanceTo(elbowLWorld),
    );
    system.addBone(
      "lower_l",
      arms.elbowL,
      arms.handL,
      elbowLWorld.distanceTo(handLWorld),
    );
    system.addBone(
      "upper_r",
      arms.shoulderR,
      arms.elbowR,
      shoulderRPoint.pos.distanceTo(elbowRWorld),
    );
    system.addBone(
      "lower_r",
      arms.elbowR,
      arms.handR,
      elbowRWorld.distanceTo(handRWorld),
    );
    elbowLPoint.pos.copy(elbowLWorld);
    elbowLPoint.oldPos.copy(elbowLWorld);
    elbowRPoint.pos.copy(elbowRWorld);
    elbowRPoint.oldPos.copy(elbowRWorld);
    arms.bonesMeasured = true;
  }

  const reachL = system.bones[0].length[1] + system.bones[1].length[1];
  const reachR = system.bones[2].length[1] + system.bones[3].length[1];
  const hip = rig.model.getWorldPosition(IK.characterOrigin);
  IK.anchor.set(anchor.x, anchor.y, anchor.z);
  const physicalHands = locomotion.hands;
  if (physicalHands) {
    const left = physicalHands.left;
    const right = physicalHands.right;
    if (left.grabbed && left.anchor)
      handLPoint.pos.set(left.anchor.x, left.anchor.y, left.anchor.z);
    else if (left.point) handLPoint.pos.copy(left.point);
    else if (left.reaching && left.target)
      handLPoint.pos.set(left.target.x, left.target.y, left.target.z);
    else
      handLPoint.pos.copy(
        vineHandTarget(IK.poseTargetL, hip, IK.anchor, reachL * 0.78),
      );
    if (right.grabbed && right.anchor)
      handRPoint.pos.set(right.anchor.x, right.anchor.y, right.anchor.z);
    else if (right.point) handRPoint.pos.copy(right.point);
    else if (right.reaching && right.target)
      handRPoint.pos.set(right.target.x, right.target.y, right.target.z);
    else
      handRPoint.pos.copy(
        vineHandTarget(IK.poseTargetR, hip, IK.anchor, reachR * 0.78),
      );
  } else if (
    gripHand &&
    previousVineAnchor &&
    nextVineAnchor &&
    brachiationProgress !== undefined
  ) {
    // One hand is rigidly pinned to the authored support. The other follows
    // a raised reach arc from the support it just released to the next one,
    // then becomes the pinned hand on the following 180-degree body arc.
    const reachProgress = MathUtils.smoothstep(brachiationProgress, 0.08, 0.86);
    const freeTarget = IK.poseTargetL
      .set(previousVineAnchor.x, previousVineAnchor.y, previousVineAnchor.z)
      .lerp(
        IK.poseTargetR.set(
          nextVineAnchor.x,
          nextVineAnchor.y,
          nextVineAnchor.z,
        ),
        reachProgress,
      );
    freeTarget.y += Math.sin(reachProgress * Math.PI) * 0.16;
    if (gripHand === "left") {
      handLPoint.pos.copy(IK.anchor);
      handRPoint.pos.copy(freeTarget);
    } else {
      handRPoint.pos.copy(IK.anchor);
      handLPoint.pos.copy(freeTarget);
    }
  } else {
    // vineAnchor already denotes the rope's contact point, not its ceiling.
    handLPoint.pos.copy(IK.anchor);
    handRPoint.pos.copy(IK.anchor);
  }

  system.step(Math.min(dt, 1 / 60));
  // Verlet supplies a gravity-driven bend preference. Solve the final joint
  // analytically: a single constraint iteration cannot pin a two-link hand,
  // especially while the other hand reaches for an as-yet unreachable hold.
  for (const [side, shoulder, elbow, hand, upper, lower] of [
    ["left", shoulderLPoint, elbowLPoint, handLPoint, system.bones[0], system.bones[1]],
    ["right", shoulderRPoint, elbowRPoint, handRPoint, system.bones[2], system.bones[3]],
  ] as const) {
    IK.direction.subVectors(hand.pos, shoulder.pos);
    const distance = IK.direction.length();
    if (distance < 1e-6) IK.direction.copy(WORLD_UP);
    else IK.direction.divideScalar(distance);
    hand.pos
      .copy(shoulder.pos)
      .addScaledVector(
        IK.direction,
        MathUtils.clamp(
          distance,
          Math.abs(upper.length[1] - lower.length[1]) + 1e-5,
          upper.length[1] + lower.length[1] - 1e-5,
        ),
      );
    IK.bend.subVectors(elbow.pos, shoulder.pos);
    limitSuspendedElbowPole(IK.bend, IK.direction, IK.bend, rig.bodyBasis, side);
    solveTwoBoneJoint(
      elbow.pos,
      shoulder.pos,
      hand.pos,
      IK.bend,
      upper.length[1],
      lower.length[1],
    );
  }

  aimBoneAt(armL, forearmL, elbowLPoint.pos);
  armL.updateWorldMatrix(true, true);
  aimBoneAt(forearmL, handL, handLPoint.pos);
  forearmL.updateWorldMatrix(true, true);
  aimBoneAt(armR, forearmR, elbowRPoint.pos);
  armR.updateWorldMatrix(true, true);
  aimBoneAt(forearmR, handR, handRPoint.pos);
  forearmR.updateWorldMatrix(true, true);

  return true;
}

function measureRigArm(
  rig: Rig,
  locomotion: MonkeyLocomotion,
  id: CharacterId,
  upper: Bone | undefined,
  lower: Bone | undefined,
  end: Bone | undefined,
  side: "left" | "right",
) {
  if (!upper || !lower || !end) return;
  const debug = runtime.movementDebug[id];
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(IK.shoulder);
  end.getWorldPosition(IK.wrist);
  const current = IK.shoulder.distanceTo(IK.wrist);
  const physical = rig.armCalibration[side];
  if (!physical) return;
  if (side === "left") {
    locomotion.armLengthLeft = physical.armLength;
    locomotion.rootReachLeft = physical.rootReach;
    locomotion.shoulderOffsetLeft = physical.shoulderOffset;
    debug.leftShoulder.x = IK.shoulder.x;
    debug.leftShoulder.y = IK.shoulder.y;
    debug.leftShoulder.z = IK.shoulder.z;
    debug.leftHand.x = IK.wrist.x;
    debug.leftHand.y = IK.wrist.y;
    debug.leftHand.z = IK.wrist.z;
    debug.leftArmLength = current;
    debug.leftArmMax = physical.armLength;
  } else {
    locomotion.armLengthRight = physical.armLength;
    locomotion.rootReachRight = physical.rootReach;
    locomotion.shoulderOffsetRight = physical.shoulderOffset;
    debug.rightShoulder.x = IK.shoulder.x;
    debug.rightShoulder.y = IK.shoulder.y;
    debug.rightShoulder.z = IK.shoulder.z;
    debug.rightHand.x = IK.wrist.x;
    debug.rightHand.y = IK.wrist.y;
    debug.rightHand.z = IK.wrist.z;
    debug.rightArmLength = current;
    debug.rightArmMax = physical.armLength;
  }
}

function measureRigArms(
  rig: Rig,
  locomotion: MonkeyLocomotion,
  id: CharacterId,
) {
  measureRigArm(
    rig,
    locomotion,
    id,
    rig.bones.armL,
    rig.bones.forearmL,
    rig.bones.handL,
    "left",
  );
  measureRigArm(
    rig,
    locomotion,
    id,
    rig.bones.armR,
    rig.bones.forearmR,
    rig.bones.handR,
    "right",
  );
}

function writeDebugPoint(target: Vec3, source: Readonly<Vec3>) {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function measureBodyRig(
  rig: Rig,
  locomotion: MonkeyLocomotion,
  id: CharacterId,
) {
  const debug = runtime.movementDebug[id];
  // Draw the deform bones themselves, so debug cannot hide a detached solver.
  for (const [bone, point] of [
    [rig.bones.armL, debug.rigLeftShoulder],
    [rig.bones.armR, debug.rigRightShoulder],
    [rig.bones.spine, debug.rigBase],
    [rig.bones.thighL, debug.rigLeftHip],
    [rig.bones.thighR, debug.rigRightHip],
  ] as const) {
    if (bone) writeDebugPoint(point, bone.getWorldPosition(IK.bonePosition));
  }
  rig.bones.shinL?.getWorldPosition(IK.elbow);
  if (rig.bones.shinL) writeDebugPoint(debug.leftKnee, IK.elbow);
  rig.bones.footL?.getWorldPosition(IK.wrist);
  if (rig.bones.footL) writeDebugPoint(debug.leftFoot, IK.wrist);
  rig.bones.shinR?.getWorldPosition(IK.elbow);
  if (rig.bones.shinR) writeDebugPoint(debug.rightKnee, IK.elbow);
  rig.bones.footR?.getWorldPosition(IK.wrist);
  if (rig.bones.footR) writeDebugPoint(debug.rightFoot, IK.wrist);
}

// Reference: imagem_queda_referencia.jpg. Aim the complete limb chains from
// the bind pose, preserving bone lengths instead of stretching a walking clip.
function poseFreeFall(rig: Rig, elapsed: number) {
  poseTorso(rig, [0, 0.38, 0.92], [0, 0.45, 0.89], [0, 0.92, 0.38]);
  for (const side of ["left", "right"] as const) {
    const left = side === "left";
    const sign = left ? 1 : -1;
    const upper = left ? rig.bones.armL : rig.bones.armR;
    const lower = left ? rig.bones.forearmL : rig.bones.forearmR;
    const hand = left ? rig.bones.handL : rig.bones.handR;
    if (upper && lower && hand) {
      const reach = rig.armCalibration[side]!.armLength;
      const flutter = Math.sin(elapsed * 3.2 + (left ? 0 : 1.4)) * 0.025;
      // One hand reaches higher; the other opens forward, as in the image.
      const direction = characterDirection(rig, sign * 0.44, left ? 0.85 : 0.48, 0.65);
      upper.getWorldPosition(IK.poseTargetL);
      IK.poseTargetL.addScaledVector(direction, reach * (0.9 + flutter));
      solveTwoBone(rig, upper, lower, hand, IK.poseTargetL, [sign, -0.25, 0.2]);
    }
    const thigh = left ? rig.bones.thighL : rig.bones.thighR;
    const shin = left ? rig.bones.shinL : rig.bones.shinR;
    const foot = left ? rig.bones.footL : rig.bones.footR;
    if (thigh && shin && foot) {
      thigh.getWorldPosition(IK.poseTargetL);
      shin.getWorldPosition(IK.elbow);
      foot.getWorldPosition(IK.wrist);
      const reach = IK.poseTargetL.distanceTo(IK.elbow) + IK.elbow.distanceTo(IK.wrist);
      IK.poseTargetL.addScaledVector(characterDirection(rig, sign * 0.2, 0.35, -0.9), reach * 0.62);
      solveTwoBone(rig, thigh, shin, foot, IK.poseTargetL, [sign * 0.35, -1, -0.35]);
    }
  }
  orientFeet(rig);
}

export function applyContactMotion(
  rig: Rig,
  motion: MonkeyMotion,
  elapsed: number,
  dt: number,
  locomotion: MonkeyLocomotion,
) {
  rig.model.position.copy(rig.modelPosition);
  if (rig.lastMotion !== motion || elapsed < (rig.lastMotionTime ?? 0)) {
    rig.entryHands = rig.lastHands && {
      left: rig.lastHands.left.clone(),
      right: rig.lastHands.right.clone(),
    };
    rig.releaseHands = undefined;
    if (!motion.startsWith("vine-") || elapsed < (rig.lastMotionTime ?? 0)) {
      rig.suspendedLegs = undefined;
      rig.verletArms = undefined;
    }
  }
  poseContactMotion(rig, motion, elapsed, dt, locomotion);
  if (motion !== "fall") poseHeadTowardMotion(rig, locomotion, dt);
  // The cleared bind pose has a straight horizontal tail. Give its existing
  // bone chain a curved counter-swing so the whole model follows locomotion.
  for (let index = 0; index < rig.tail.length - 1; index++) {
    const t = index / Math.max(1, rig.tail.length - 2);
    aimBodySegment(rig, rig.tail[index], rig.tail[index + 1], motion === "fall" ? [
      Math.sin(elapsed * 2 - t * 2) * 0.07,
      Math.cos(t * Math.PI * 1.25),
      -Math.sin(t * Math.PI * 1.25),
    ] : [
      Math.sin(elapsed * 3 - t * 2) * 0.12,
      -0.25 - Math.sin(t * Math.PI * 1.4) * 0.65,
      -Math.cos(t * Math.PI * 0.6),
    ]);
  }
  rig.lastHands ??= { left: new Vector3(), right: new Vector3() };
  rig.bones.handL?.getWorldPosition(rig.lastHands.left);
  rig.bones.handR?.getWorldPosition(rig.lastHands.right);
  rig.lastMotion = motion;
  rig.lastMotionTime = elapsed;
}

function poseContactMotion(
  rig: Rig,
  motion: MonkeyMotion,
  elapsed: number,
  dt: number,
  locomotion: MonkeyLocomotion,
) {
  rig.model.rotation.x = 0;
  rig.model.rotation.z = 0;
  if (motion !== "vine-jump") rig.releaseHands = undefined;

  if (motion === "fall") {
    poseFreeFall(rig, elapsed);
    return;
  }

  if (motion === "tree-climb" || motion === "tree-descend") {
    const direction = motion === "tree-descend" ? -1 : 1;
    const phase = cycle((elapsed / 0.92) * direction);
    const shoulderY = rig.armCalibration.left?.shoulderOffset.y ?? 0.49;
    const handL = climbingContact(phase, shoulderY + 0.24, shoulderY - 0.08);
    const handR = climbingContact(
      cycle(phase + 0.5),
      shoulderY + 0.24,
      shoulderY - 0.08,
    );
    const footL = climbingContact(cycle(phase + 0.5), -0.08, -0.36);
    const footR = climbingContact(phase, -0.08, -0.36);
    const enter = enteringBlend(elapsed);
    // Keep the chest close to the bark. The head continues the same forward
    // lean as the chest/waist instead of straightening past them - the
    // previous, more vertical head direction fought that lean and read as
    // craning the neck back to stare straight up.
    poseTorso(rig, [0, 1, 0.16], [0, 1, 0.12], [0, 1, 0.14]);
    applyBodyControlRig(rig, locomotion);
    solveTwoBone(
      rig,
      rig.bones.armL,
      rig.bones.forearmL,
      rig.bones.handL,
      characterTarget(rig, IK.poseTargetL, 0.11, handL.y, handL.z + 0.075),
      [1, -0.2, -0.4],
      0.95 * enter,
    );
    solveTwoBone(
      rig,
      rig.bones.armR,
      rig.bones.forearmR,
      rig.bones.handR,
      characterTarget(rig, IK.poseTargetR, -0.11, handR.y, handR.z + 0.075),
      [-1, -0.2, -0.4],
      0.95 * enter,
    );
    solveTwoBone(
      rig,
      rig.bones.thighL,
      rig.bones.shinL,
      rig.bones.footL,
      characterTarget(rig, IK.poseTargetL, 0.12, footL.y, footL.z + 0.045),
      [0.7, 0, 1],
      0.9 * enter,
    );
    solveTwoBone(
      rig,
      rig.bones.thighR,
      rig.bones.shinR,
      rig.bones.footR,
      characterTarget(rig, IK.poseTargetR, -0.12, footR.y, footR.z + 0.045),
      [-0.7, 0, 1],
      0.9 * enter,
    );
    orientFeet(rig);
    return;
  }

  if (motion === "vine-pull") {
    // Hand-over-hand haul up a hanging liana: the body stays close to
    // vertical (unlike tree-climb's flat lean into a trunk) while the hands
    // alternate reaching high overhead and hauling down toward the chest,
    // reusing tree-climb's plant/recover cycle shape at a taller reach and a
    // near-centerline grip (one vine, not two-handed bark on either side).
    const phase = cycle(elapsed / 0.65);
    const shoulderY = rig.armCalibration.left?.shoulderOffset.y ?? 0.49;
    const reachHigh = shoulderY + 0.75;
    const reachLow = shoulderY - 0.05;
    const handL = climbingContact(phase, reachHigh, reachLow);
    const handR = climbingContact(cycle(phase + 0.5), reachHigh, reachLow);
    const enter = enteringBlend(elapsed);
    poseTorso(rig, [0, 1, 0.1], [0, 0.95, 0.2], [0, 0.85, 0.35]);
    applyBodyControlRig(rig, locomotion);
    solveTwoBone(
      rig,
      rig.bones.armL,
      rig.bones.forearmL,
      rig.bones.handL,
      characterTarget(
        rig,
        IK.poseTargetL,
        0.045,
        handL.y,
        handL.z * 0.35 - 0.08,
      ),
      [1, -0.2, 0],
      0.95 * enter,
    );
    solveTwoBone(
      rig,
      rig.bones.armR,
      rig.bones.forearmR,
      rig.bones.handR,
      characterTarget(
        rig,
        IK.poseTargetR,
        -0.045,
        handR.y,
        handR.z * 0.35 - 0.08,
      ),
      [-1, -0.2, 0],
      0.95 * enter,
    );
    poseSuspendedLegs(rig, dt, locomotion);
    return;
  }

  if (motion === "vine-grab") {
    const reach = MathUtils.smoothstep(Math.min(1, elapsed / 0.9), 0, 1);
    const handY = MathUtils.lerp(-0.12, 0.38, reach);
    const leftReach = locomotion.hands?.left;
    const rightReach = locomotion.hands?.right;
    const leftTarget = leftReach?.point
      ? IK.poseTargetL.copy(leftReach.point)
      : leftReach?.reaching && leftReach.target
        ? IK.poseTargetL.set(
            leftReach.target.x,
            leftReach.target.y,
            leftReach.target.z,
          )
        : characterTarget(rig, IK.poseTargetL, 0.055, handY, -0.05);
    const rightTarget = rightReach?.point
      ? IK.poseTargetR.copy(rightReach.point)
      : rightReach?.reaching && rightReach.target
        ? IK.poseTargetR.set(
            rightReach.target.x,
            rightReach.target.y,
            rightReach.target.z,
          )
        : characterTarget(rig, IK.poseTargetR, -0.055, handY + 0.025, -0.05);
    poseTorso(rig, [0, 0.92, 0.28], [0, 0.82, 0.42], [0, 0.5, 0.86]);
    applyBodyControlRig(rig, locomotion);
    if (!leftReach?.point && rig.entryHands)
      sampleHandReach(
        leftTarget,
        rig.entryHands.left,
        leftTarget,
        elapsed / 0.45,
        rig.bodyBasis.forward,
      );
    if (!rightReach?.point && rig.entryHands)
      sampleHandReach(
        rightTarget,
        rig.entryHands.right,
        rightTarget,
        elapsed / 0.45,
        rig.bodyBasis.forward,
      );
    solveTwoBone(
      rig,
      rig.bones.armL,
      rig.bones.forearmL,
      rig.bones.handL,
      leftTarget,
      [1, -0.2, 0],
      1,
    );
    solveTwoBone(
      rig,
      rig.bones.armR,
      rig.bones.forearmR,
      rig.bones.handR,
      rightTarget,
      [-1, -0.2, 0],
      1,
    );
    // Legs were untouched here before, so they simply froze in whatever pose
    // preceded the grab (mid-stride, mid-jump...) while the arms reached up -
    // the single biggest source of "legs don't move with the body". They now
    // gather under the hips as the hands commit, continuing naturally into
    // vine-swing's own hanging leg pose once the grab completes.
    poseSuspendedLegs(rig, dt, locomotion);
    return;
  }

  if (motion === "vine-swing") {
    // Keep the bind-pose torso above its falling pelvis. The physical root
    // supplies the swing, without an unrelated forward bend in the spine.
    const extension = Math.sin((locomotion.brachiationProgress ?? 0) * Math.PI);
    poseTorso(
      rig,
      [0, 1, 0.06 * extension],
      [0, 1, 0.1 * extension],
      [0, 1, 0.04],
    );
    applyBodyControlRig(rig, locomotion);
    // Parent-before-child is essential: first solve the rigid body triangle
    // and clavicle, only then pin each free arm to its contact/reach point.
    if (!poseVineSwingArms(rig, dt, locomotion)) {
      // No live anchor in a standalone preview: keep a readable hanging pose.
      solveTwoBone(
        rig,
        rig.bones.armL,
        rig.bones.forearmL,
        rig.bones.handL,
        characterTarget(rig, IK.poseTargetL, 0.05, 0.39, -0.04),
        [1, -0.2, 0],
      );
      solveTwoBone(
        rig,
        rig.bones.armR,
        rig.bones.forearmR,
        rig.bones.handR,
        characterTarget(rig, IK.poseTargetR, -0.05, 0.39, -0.04),
        [-1, -0.2, 0],
      );
    }
    poseSuspendedLegs(rig, dt, locomotion);
    applyIdleVineFidget(rig, elapsed, locomotion);
    return;
  }

  const release = MathUtils.smoothstep(Math.min(1, elapsed / 0.72), 0, 1);
  poseTorso(
    rig,
    [0, 1, release * 0.24],
    [0, 1, release * 0.32],
    [0, 1, 0.04 + release * 0.12],
  );
  applyBodyControlRig(rig, locomotion);
  const reachY = MathUtils.lerp(0.35, -0.02, release);
  const reachZ = MathUtils.lerp(-0.04, -0.25, release);
  if (!rig.releaseHands && rig.lastHands)
    rig.releaseHands = {
      left: rig.lastHands.left.clone(),
      right: rig.lastHands.right.clone(),
    };
  characterTarget(rig, IK.poseTargetL, 0.13, reachY, reachZ);
  characterTarget(rig, IK.poseTargetR, -0.13, reachY, reachZ);
  if (rig.releaseHands) {
    sampleHandReach(
      IK.poseTargetL,
      rig.releaseHands.left,
      IK.poseTargetL,
      elapsed / 0.45,
      rig.bodyBasis.forward,
      0.05,
    );
    sampleHandReach(
      IK.poseTargetR,
      rig.releaseHands.right,
      IK.poseTargetR,
      elapsed / 0.45,
      rig.bodyBasis.forward,
      0.05,
    );
  }
  solveTwoBone(
    rig,
    rig.bones.armL,
    rig.bones.forearmL,
    rig.bones.handL,
    IK.poseTargetL,
    [1, -0.2, -0.4],
    1,
  );
  solveTwoBone(
    rig,
    rig.bones.armR,
    rig.bones.forearmR,
    rig.bones.handR,
    IK.poseTargetR,
    [-1, -0.2, -0.4],
    1,
  );
  poseSuspendedLegs(rig, dt, locomotion, release);
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
  IK.bananaOffset.set(-0.3, 0.12, -0.05).applyQuaternion(banana.quaternion);
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
  locomotion: React.RefObject<MonkeyLocomotion>;
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
  const activeAction = useRef<"idle" | "run" | MonkeyMotion>("idle");
  const switchCooldown = useRef(0);
  const powerPoseBlend = useRef(0);
  const fallTransition = useRef<{
    active: boolean;
    elapsed: number;
    pose?: NeutralBoneTransform[];
  }>({ active: false, elapsed: 0 });

  useFrame(({ clock }, delta) => {
    const rig = getRig(template, id);
    const dt = Math.min(delta, 0.05);
    const { speed, grounded, distance, metersPerStride, motionTime } =
      locomotion.current;
    const motion = monkeyRenderMotion(locomotion.current);
    const fall = fallTransition.current;
    if (fall.active !== (motion === "fall")) {
      fall.active = motion === "fall";
      fall.elapsed = 0;
      fall.pose = rig.neutralPose.map(({ bone }) => ({
        bone,
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        scale: bone.scale.clone(),
      }));
    }
    fall.elapsed += dt;
    // Hysteresis + cooldown: without this, a companion hovering near the
    // follow-distance threshold flickers between idle/run several times a
    // second as its speed nudges past a single cutoff.
    const regularAction = monkeyAnimation(
      grounded,
      speed,
      activeAction.current === "run",
    );
    const wantAction =
      motion && rig.actions.motion[motion] ? motion : regularAction;
    switchCooldown.current = Math.max(0, switchCooldown.current - dt);
    const { idle, run, walk } = rig.actions;
    // The scroll-led intro uses the grounded fast-walk clip; the interactive
    // game keeps the run. This removes the airborne beats that read as jumps
    // when several route meters are scrubbed in a short scroll gesture.
    const movement = distance !== undefined ? (walk ?? run) : (run ?? walk);
    const actionFor = (key: "idle" | "run" | MonkeyMotion) =>
      key === "idle"
        ? idle
        : key === "run"
          ? movement
          : rig.actions.motion[key];
    const next = actionFor(wantAction);
    if (
      next &&
      activeAction.current !== wantAction &&
      switchCooldown.current <= 0
    ) {
      const previous = actionFor(activeAction.current);
      activeAction.current = wantAction;
      switchCooldown.current = 0.35;
      const prev = previous;
      next.reset().fadeIn(0.25).play();
      prev?.fadeOut(0.25);
    }
    // Distance-driven override: freeze the action clock and evaluate its pose
    // directly from route meters. Crossfades still advance on mixer time, but
    // scroll never queues cycles or adds an extra real-time animation step.
    const motionAction = motion ? rig.actions.motion[motion] : undefined;
    if (motionAction) {
      // All procedural solvers start from the same stable upright frame. The
      // reference video showed that trajectories/contacts should drive the
      // motion; allowing the native quadruped clip to keep playing underneath
      // reintroduced sliding and conflicting rotations.
      motionAction.timeScale = 0;
      motionAction.time = motionAction.getClip().duration * 0.12;
    } else if (movement && distance !== undefined) {
      const clipDuration = movement.getClip().duration;
      movement.timeScale = 0;
      movement.time =
        MathUtils.euclideanModulo(
          distance / (metersPerStride ?? DEFAULT_METERS_PER_STRIDE),
          1,
        ) * clipDuration;
    } else if (movement)
      // Freezing this clip mid-stride while airborne (as phase four used to,
      // via classicGroundMotion) reads as the walk pose getting stuck and the
      // jump squash pasted on top of it. Every map now keeps the clip
      // running through the jump, same as it always did outside phase four.
      movement.timeScale = grounded ? 0.85 + speed * 0.14 : 1.15;
    rig.mixer.update(dt);
    if (rig.motionRoot && rig.motionRootPosition && (motion || !locomotion.current.classicGroundMotion)) {
      rig.motionRoot.position.copy(rig.motionRootPosition);
      if (rig.motionRootQuaternion)
        rig.motionRoot.quaternion.copy(rig.motionRootQuaternion);
      if (rig.motionRootScale) rig.motionRoot.scale.copy(rig.motionRootScale);
    }
    if (motion) {
      // Equivalent to clearing the active Blender action and evaluating pose
      // transforms at identity: in Three.js the imported rest transforms are
      // not identity, so copy the captured FBX values instead. Procedural IK
      // now always starts from a stable, symmetric-in-time base and cannot be
      // overwritten by the mixer's sampled keyframe during this render pass.
      restoreNeutralPose(rig);
    } else if (rig.bones.root && rig.rootPosition) {
      rig.bones.root.position.x = rig.rootPosition.x;
      rig.bones.root.position.z = rig.rootPosition.z;
    }
    rig.model.position.copy(rig.modelPosition);
    rig.model.rotation.x = 0;
    rig.model.rotation.z = 0;
    // Changing scale after IK moves every solved contact off its anchor.
    if (motion) rig.model.scale.setScalar(rig.baseScale);
    if (!motion?.startsWith("vine-")) {
      rig.suspendedLegs = undefined;
      rig.verletArms = undefined;
    }
    if (motion)
      applyContactMotion(
        rig,
        motion,
        motion === "fall" ? fall.elapsed : (motionTime ?? clock.elapsedTime),
        dt,
        locomotion.current,
      );
    rig.lastHands ??= { left: new Vector3(), right: new Vector3() };
    rig.bones.handL?.getWorldPosition(rig.lastHands.left);
    rig.bones.handR?.getWorldPosition(rig.lastHands.right);
    measureRigArms(rig, locomotion.current, id);
    measureBodyRig(rig, locomotion.current, id);

    const now = performance.now();
    // Climbing/swinging and eating already drive the same arm bones through
    // their own IK; layering the cover-eyes/ears/mouth gesture on top of a
    // running animation snapped the arm to two targets at once. The gesture
    // just doesn't play while another animation owns the arms - the
    // gameplay effect (state.power/state.build) still fires regardless.
    const armsBusy = !!motion || runtime.eatingUntil[id] > now;
    const powerPoseActive =
      !armsBusy && (power || runtime.poseUntil[id] > now);
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
    const targetScaleY = grounded || motion ? 1 : 1.18;
    const targetScaleXZ = grounded || motion ? 1 : 0.9;
    rig.model.scale.y +=
      (rig.baseScale * targetScaleY - rig.model.scale.y) * 0.25;
    rig.model.scale.x +=
      (rig.baseScale * targetScaleXZ - rig.model.scale.x) * 0.25;
    rig.model.scale.z +=
      (rig.baseScale * targetScaleXZ - rig.model.scale.z) * 0.25;
    if (fall.pose) {
      // Blend the whole skeleton on entry and landing, not only the wrists.
      // A new grab must take its exact contact immediately.
      const contact = motion && motion !== "fall" && motion !== "vine-jump";
      const blend = contact ? 1 : MathUtils.smoothstep(fall.elapsed, 0, fall.active ? 0.28 : 0.18);
      for (const saved of fall.pose) {
        const bone = saved.bone;
        bone.position.lerpVectors(saved.position, bone.position, blend);
        IK.desiredWorld.copy(bone.quaternion);
        bone.quaternion.copy(saved.quaternion).slerp(IK.desiredWorld, blend);
        bone.scale.lerpVectors(saved.scale, bone.scale, blend);
      }
      if (blend >= 1) fall.pose = undefined;
      rig.model.updateWorldMatrix(true, true);
      rig.bones.handL?.getWorldPosition(rig.lastHands.left);
      rig.bones.handR?.getWorldPosition(rig.lastHands.right);
    }
  });

  return (
    <>
      <primitive object={getRig(template, id).model} />
      <primitive ref={eatingBananaRef} object={eatingBanana} />
    </>
  );
}
