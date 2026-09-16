import { Bone, type Object3D } from "three";

export type MonkeyRigCategory =
  "root" | "torso" | "head" | "face" | "arm" | "hand" | "leg" | "tail";

export type MonkeyRigBone = {
  name: string;
  parent: string | null;
  position: readonly [number, number, number];
  category: MonkeyRigCategory;
  deform: boolean;
  sourceAliases: readonly string[];
};

export type MonkeyRigControl = {
  name: string;
  target: string;
  kind: "fk" | "ik" | "pole" | "pose";
};

const bones: MonkeyRigBone[] = [];
function add(
  name: string,
  parent: string | null,
  position: readonly [number, number, number],
  category: MonkeyRigCategory,
  sourceAliases: readonly string[] = [],
  deform = true,
) {
  bones.push({ name, parent, position, category, sourceAliases, deform });
}

// World-space reference coordinates describe a neutral gibbon-like anatomy.
// They are used by the rig inspector and as an unambiguous retargeting
// contract; the imported FBX keeps its own bind transforms and proportions.
add(
  "Root",
  null,
  [0, 0, 0],
  "root",
  ["Armature_deform", "display_gibbon"],
  false,
);
add("Hips", "Root", [0, 0.96, 0], "root", ["Spine", "DEF-pelvis"]);
add("Spine_01", "Hips", [0, 1.1, 0], "torso", [
  "Spine001",
  "Spine.001",
  "DEF-belly",
]);
add("Spine_02", "Spine_01", [0, 1.24, 0], "torso");
add("Spine_03", "Spine_02", [0, 1.38, 0], "torso");
add("Chest", "Spine_03", [0, 1.53, 0], "torso");
add("UpperChest", "Chest", [0, 1.66, 0], "torso", [
  "Spine002",
  "Spine.002",
  "DEF-chest",
]);
add("Neck_01", "UpperChest", [0, 1.78, 0], "head", ["neck001", "neck.001"]);
add("Neck_02", "Neck_01", [0, 1.88, 0], "head");
add("Head", "Neck_02", [0, 2.03, 0.015], "head", ["Head", "DEF-head"]);
add("Jaw", "Head", [0, 1.97, 0.105], "face", ["mouth"]);
add("Eye_L", "Head", [0.055, 2.075, 0.105], "face", ["eye_L"]);
add("Eye_R", "Head", [-0.055, 2.075, 0.105], "face", ["eye_R"]);
add("UpperEyelid_L", "Eye_L", [0.055, 2.087, 0.112], "face", [], false);
add("UpperEyelid_R", "Eye_R", [-0.055, 2.087, 0.112], "face", [], false);
add("LowerEyelid_L", "Eye_L", [0.055, 2.063, 0.112], "face", [], false);
add("LowerEyelid_R", "Eye_R", [-0.055, 2.063, 0.112], "face", [], false);
add("Brow_L", "Head", [0.06, 2.115, 0.105], "face", [], false);
add("Brow_R", "Head", [-0.06, 2.115, 0.105], "face", [], false);
// The shipped monkey FBX uses compact numeric suffixes (ear_L001). The
// dotted aliases are kept for Blender-authored variants, but must not be the
// only spelling or Kikazaru's hands have no target during his power pose.
add("Ear_L", "Head", [0.145, 2.035, 0], "face", ["ear_L001", "ear_L.001"]);
add("Ear_R", "Head", [-0.145, 2.035, 0], "face", ["ear_R001", "ear_R.001"]);

const fingerOffsets = [
  ["Thumb", 0.04, 0.035],
  ["Index", 0.025, 0.01],
  ["Middle", 0, 0],
  ["Ring", -0.025, -0.005],
  ["Pinky", -0.047, -0.012],
] as const;

for (const [suffix, side] of [
  ["L", 1],
  ["R", -1],
] as const) {
  const aliases = (rightLegacy: string, unity: string) => {
    const legacy =
      suffix === "L" ? rightLegacy.replace("_R", "_L") : rightLegacy;
    const exported = suffix === "L" ? unity.replace("_R", "_L") : unity;
    const blender = exported.replace(/_([LR])$/, ".$1");
    return [legacy, exported, blender];
  };
  add(
    `Clavicle_${suffix}`,
    "UpperChest",
    [side * 0.13, 1.65, 0],
    "arm",
    aliases("Shoulder_R", "DEF-shoulder_R"),
  );
  add(
    `Scapula_${suffix}`,
    `Clavicle_${suffix}`,
    [side * 0.23, 1.62, -0.015],
    "arm",
  );
  add(
    `UpperArm_${suffix}`,
    `Scapula_${suffix}`,
    [side * 0.36, 1.55, 0],
    "arm",
    aliases("Arm01_R", "DEF-upper_arm_R"),
  );
  add(
    `UpperArmTwist_${suffix}`,
    `UpperArm_${suffix}`,
    [side * 0.48, 1.42, 0.01],
    "arm",
  );
  add(
    `Forearm_${suffix}`,
    `UpperArmTwist_${suffix}`,
    [side * 0.58, 1.28, 0.015],
    "arm",
    aliases("Arm02_R", "DEF-forearm_R"),
  );
  add(
    `ForearmTwist_${suffix}_01`,
    `Forearm_${suffix}`,
    [side * 0.66, 1.15, 0.02],
    "arm",
  );
  add(
    `ForearmTwist_${suffix}_02`,
    `ForearmTwist_${suffix}_01`,
    [side * 0.72, 1.03, 0.025],
    "arm",
  );
  add(
    `Hand_${suffix}`,
    `ForearmTwist_${suffix}_02`,
    [side * 0.76, 0.92, 0.035],
    "hand",
    aliases("Hand_R", "DEF-hand_R"),
  );

  for (const [finger, lateral, forward] of fingerOffsets) {
    const direction = finger === "Thumb" ? side * 0.55 : side * 0.18;
    const firstAliases =
      finger === "Thumb"
        ? [`Hand_thum_${suffix}.001`]
        : finger === "Middle"
          ? [`Hand_finger_${suffix}.002`]
          : [];
    const secondAliases =
      finger === "Thumb"
        ? [`Hand_thum_${suffix}.002`]
        : finger === "Middle"
          ? [`Hand_finger_${suffix}.003`]
          : [];
    add(
      `${finger}_${suffix}_01`,
      `Hand_${suffix}`,
      [side * (0.77 + lateral), 0.875, 0.045 + forward],
      "hand",
      firstAliases,
    );
    add(
      `${finger}_${suffix}_02`,
      `${finger}_${suffix}_01`,
      [side * (0.775 + lateral + direction * 0.025), 0.83, 0.052 + forward],
      "hand",
      secondAliases,
    );
    add(
      `${finger}_${suffix}_03`,
      `${finger}_${suffix}_02`,
      [side * (0.78 + lateral + direction * 0.04), 0.79, 0.055 + forward],
      "hand",
      [],
    );
  }

  add(
    `Thigh_${suffix}`,
    "Hips",
    [side * 0.14, 0.86, 0],
    "leg",
    aliases("Foot_R", "DEF-thigh_R"),
  );
  add(
    `ThighTwist_${suffix}`,
    `Thigh_${suffix}`,
    [side * 0.145, 0.69, 0.005],
    "leg",
  );
  add(
    `Shin_${suffix}`,
    `ThighTwist_${suffix}`,
    [side * 0.15, 0.51, 0.012],
    "leg",
    [
      ...aliases("Foot_R001", "DEF-shin_R"),
      suffix === "L" ? "Foot_L.001" : "Foot_R.001",
    ],
  );
  add(
    `ShinTwist_${suffix}`,
    `Shin_${suffix}`,
    [side * 0.15, 0.31, 0.025],
    "leg",
  );
  add(
    `Foot_${suffix}`,
    `ShinTwist_${suffix}`,
    [side * 0.15, 0.12, 0.065],
    "leg",
    [
      ...aliases("Foot_R002", "DEF-foot_R"),
      suffix === "L" ? "Foot_L.002" : "Foot_R.002",
    ],
  );
  add(`Ball_${suffix}`, `Foot_${suffix}`, [side * 0.15, 0.065, 0.18], "leg", [
    `Foot_${suffix}003`,
    `Foot_${suffix}.003`,
  ]);
  add(`Toe_${suffix}`, `Ball_${suffix}`, [side * 0.15, 0.06, 0.29], "leg", [
    `Foot_thum_${suffix}001`,
    `Foot_thum_${suffix}.001`,
  ]);
}

let tailParent = "Hips";
for (let index = 1; index <= 8; index += 1) {
  const name = `Tail_${String(index).padStart(2, "0")}`;
  add(
    name,
    tailParent,
    [
      0,
      0.94 - index * 0.035 + Math.max(0, index - 5) * 0.045,
      -0.09 - index * 0.13,
    ],
    "tail",
    [
      `tail${String(index - 1).padStart(3, "0")}`,
      `tail.${String(index - 1).padStart(3, "0")}`,
    ],
  );
  tailParent = name;
}

export const MONKEY_RIG_BONES = bones as readonly MonkeyRigBone[];

export const MONKEY_RIG_CONTROLS: readonly MonkeyRigControl[] = [
  { name: "RootControl", target: "Root", kind: "fk" },
  { name: "HipControl", target: "Hips", kind: "fk" },
  { name: "ChestControl", target: "UpperChest", kind: "fk" },
  { name: "HeadControl", target: "Head", kind: "fk" },
  ...(["L", "R"] as const).flatMap((side) => [
    { name: `HandIK_${side}`, target: `Hand_${side}`, kind: "ik" as const },
    {
      name: `ElbowPole_${side}`,
      target: `Forearm_${side}`,
      kind: "pole" as const,
    },
    { name: `FootIK_${side}`, target: `Foot_${side}`, kind: "ik" as const },
    { name: `KneePole_${side}`, target: `Shin_${side}`, kind: "pole" as const },
    {
      name: `HeelControl_${side}`,
      target: `Foot_${side}`,
      kind: "pose" as const,
    },
    {
      name: `ToeControl_${side}`,
      target: `Toe_${side}`,
      kind: "pose" as const,
    },
    {
      name: `ClavicleControl_${side}`,
      target: `Clavicle_${side}`,
      kind: "fk" as const,
    },
    {
      name: `ScapulaControl_${side}`,
      target: `Scapula_${side}`,
      kind: "fk" as const,
    },
  ]),
  { name: "TailControl_01", target: "Tail_01", kind: "fk" },
  { name: "TailControl_02", target: "Tail_05", kind: "fk" },
] as const;

export type ResolvedMonkeyRig = {
  bones: Map<string, Bone>;
  missing: string[];
  sourceNames: Set<string>;
};

export function resolveMonkeyRig(root: Object3D): ResolvedMonkeyRig {
  const source = new Map<string, Bone>();
  root.traverse((object) => {
    if ((object as Bone).isBone) source.set(object.name, object as Bone);
  });
  const resolved = new Map<string, Bone>();
  const missing: string[] = [];
  for (const definition of MONKEY_RIG_BONES) {
    const match = definition.sourceAliases
      .map((alias) => source.get(alias))
      .find((bone): bone is Bone => Boolean(bone));
    if (match) resolved.set(definition.name, match);
    else if (definition.deform) missing.push(definition.name);
  }
  return { bones: resolved, missing, sourceNames: new Set(source.keys()) };
}

export function monkeyRigBone(
  rig: ResolvedMonkeyRig,
  name: string,
): Bone | undefined {
  return rig.bones.get(name);
}
