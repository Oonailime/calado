import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Bone, Group } from "three";
import { CLASSIC_QUADRUPED_CLIP } from "../src/features/game/characters/monkeyMotion";
import {
  MONKEY_RIG_BONES,
  MONKEY_RIG_CONTROLS,
  resolveMonkeyRig,
} from "../src/features/game/characters/monkeyRig";

test("rig canônico tem anatomia completa e hierarquia válida", () => {
  assert.equal(MONKEY_RIG_BONES.length, 89);
  assert.equal(MONKEY_RIG_CONTROLS.length, 22);
  const names = new Set<string>();
  for (const bone of MONKEY_RIG_BONES) {
    assert.equal(names.has(bone.name), false, `bone duplicado: ${bone.name}`);
    if (bone.parent) {
      assert.equal(
        names.has(bone.parent),
        true,
        `${bone.name} aparece antes do parent ${bone.parent}`,
      );
    }
    names.add(bone.name);
  }
  for (const required of [
    "Hips",
    "Spine_03",
    "UpperChest",
    "Scapula_L",
    "ForearmTwist_R_02",
    "Pinky_L_03",
    "Toe_R",
    "Tail_08",
  ]) {
    assert.equal(
      names.has(required),
      true,
      `bone obrigatório ausente: ${required}`,
    );
  }
  for (const control of MONKEY_RIG_CONTROLS)
    assert.equal(
      names.has(control.target),
      true,
      `alvo ausente: ${control.target}`,
    );
});

test("aliases corrigem os nomes compactos reais do FBX antigo", () => {
  const root = new Group();
  // The exported FBX mixes compact numeric suffixes with Blender-style names
  // depending on the bone family. A mismatch silently turns that IK segment
  // into a no-op, so exercise the exact names recorded by the rig report.
  for (const name of [
    "Armature_deform",
    "Spine",
    "Spine001",
    "Spine002",
    "Shoulder_L",
    "Arm01_L",
    "Arm02_L",
    "Hand_L",
    "Foot_L",
    "Foot_L001",
    "Foot_L002",
    "Foot_L003",
    "ear_L001",
    "ear_R001",
  ]) {
    const bone = new Bone();
    bone.name = name;
    root.add(bone);
  }
  const rig = resolveMonkeyRig(root);
  assert.equal(rig.bones.get("Hips")?.name, "Spine");
  assert.equal(rig.bones.get("Spine_01")?.name, "Spine001");
  assert.equal(rig.bones.get("UpperChest")?.name, "Spine002");
  assert.equal(rig.bones.get("UpperArm_L")?.name, "Arm01_L");
  assert.equal(rig.bones.get("Thigh_L")?.name, "Foot_L");
  assert.equal(rig.bones.get("Shin_L")?.name, "Foot_L001");
  assert.equal(rig.bones.get("Foot_L")?.name, "Foot_L002");
  assert.equal(rig.bones.get("Ball_L")?.name, "Foot_L003");
  assert.equal(rig.bones.get("Ear_L")?.name, "ear_L001");
  assert.equal(rig.bones.get("Ear_R")?.name, "ear_R001");
});

test("caminhada quadrúpede clássica permanece amostrada e independente", () => {
  const report = JSON.parse(
    readFileSync("docs/rig/monkey-quadruped-motion.json", "utf8"),
  ) as {
    clip: string;
    locomotion: string;
    frameCount: number;
    bones: Record<string, { samples: unknown[] }>;
  };
  assert.equal(CLASSIC_QUADRUPED_CLIP, "monkey_run");
  assert.equal(report.clip, CLASSIC_QUADRUPED_CLIP);
  assert.equal(report.locomotion, "classic-quadruped");
  assert.equal(report.frameCount, 53);
  assert.equal(Object.keys(report.bones).length, 58);
  assert.equal(report.bones.Spine.samples.length, report.frameCount);
  assert.equal(report.bones.tail008.samples.length, report.frameCount);
});
