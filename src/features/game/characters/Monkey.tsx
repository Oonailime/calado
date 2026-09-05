import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
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
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type Object3D,
} from "three";
import { CHARACTERS, type CharacterId } from "../types";
import {
  classifyMonkeySurface,
  monkeyAnimation,
  monkeySurfaceColor,
  type BoneInfluence,
} from "./monkeyAppearance";

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
  shoulderL?: Bone;
  armL?: Bone;
  handL?: Bone;
  shoulderR?: Bone;
  armR?: Bone;
  handR?: Bone;
  head?: Bone;
};
type Rig = {
  model: Group;
  mixer: AnimationMixer;
  actions: { idle?: AnimationAction; run?: AnimationAction };
  bones: Bones;
  rest: Map<Bone, { x: number; y: number; z: number }>;
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
    shoulderL: findBone(model, "Shoulder_L"),
    armL: findBone(model, "Arm01_L"),
    handL: findBone(model, "Hand_L"),
    shoulderR: findBone(model, "Shoulder_R"),
    armR: findBone(model, "Arm01_R"),
    handR: findBone(model, "Hand_R"),
    head: findBone(model, "Head"),
  };
  const rest = new Map<Bone, { x: number; y: number; z: number }>();
  Object.values(bones).forEach((bone) => {
    if (bone)
      rest.set(bone, {
        x: bone.rotation.x,
        y: bone.rotation.y,
        z: bone.rotation.z,
      });
  });

  if (id === 0 && bones.head) {
    const eyeL = findBone(model, "eye_L");
    const eyeR = findBone(model, "eye_R");
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
    rest,
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
function poseTo(bone: Bone, x: number, y: number, z: number) {
  bone.rotation.x += (x - bone.rotation.x) * 0.25;
  bone.rotation.y += (y - bone.rotation.y) * 0.25;
  bone.rotation.z += (z - bone.rotation.z) * 0.25;
}
function restore(bone: Bone | undefined, rest: Rig["rest"]) {
  if (!bone) return;
  const target = rest.get(bone);
  if (!target) return;
  bone.rotation.x += (target.x - bone.rotation.x) * 0.2;
  bone.rotation.y += (target.y - bone.rotation.y) * 0.2;
  bone.rotation.z += (target.z - bone.rotation.z) * 0.2;
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
  const activeAction = useRef<"idle" | "run">("idle");
  const switchCooldown = useRef(0);
  const phase = useRef(0);

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
    const running = wantRun === "run";
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

    phase.current += dt * (running ? 5.4 + speed * 1.3 : 1.1);
    const b = rig.bones;
    if (power && id === 0 && b.shoulderL && b.shoulderR && b.armL && b.armR) {
      const flutter = Math.sin(phase.current * 3.2) * 0.05;
      poseTo(b.shoulderL, -1.7, 0.3, 0.4 + flutter);
      poseTo(b.armL, -0.6, 0, 0.2);
      poseTo(b.shoulderR, -1.7, -0.3, -0.4 - flutter);
      poseTo(b.armR, -0.6, 0, -0.2);
    } else if (
      power &&
      id === 1 &&
      b.shoulderL &&
      b.shoulderR &&
      b.armL &&
      b.armR
    ) {
      const tremble = Math.sin(phase.current * 9) * 0.03;
      poseTo(b.shoulderL, -1.5, 0.9, 0.3);
      poseTo(b.armL, -0.4 + tremble, 0, 0.1);
      poseTo(b.shoulderR, -1.5, -0.9, -0.3);
      poseTo(b.armR, -0.4 - tremble, 0, -0.1);
    } else {
      restore(b.shoulderL, rig.rest);
      restore(b.armL, rig.rest);
      restore(b.shoulderR, rig.rest);
      restore(b.armR, rig.rest);
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

  return <primitive object={getRig(template, id).model} />;
}
