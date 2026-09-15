import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnimationMixer, Bone, LoadingManager } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const sourcePath = path.resolve(
  process.argv[2] || "public/assets/models/monkey.fbx",
);
const outputPath = path.resolve(
  process.argv[3] || "docs/rig/monkey-quadruped-motion.json",
);
const clipName = process.argv[4] || "monkey_run";
const sampleRate = 30;
const emptyImage = () => ({
  addEventListener() {},
  removeEventListener() {},
  setAttribute() {},
  get src() {
    return "";
  },
  set src(_) {},
});
globalThis.document ??= { createElementNS: emptyImage };

const manager = new LoadingManager();
manager.setURLModifier(
  () => "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
);
const bytes = await readFile(sourcePath);
const data = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
);
const model = new FBXLoader(manager).parse(data, path.dirname(sourcePath));
const clip = model.animations.find((animation) =>
  animation.name.endsWith(clipName),
);
if (!clip) throw new Error(`Animation clip not found: ${clipName}`);

const sourceBones = [];
model.traverse((object) => {
  if (object.isBone) sourceBones.push(object);
});
const initial = new Map(
  sourceBones.map((bone) => [
    bone,
    {
      position: bone.position.toArray(),
      quaternion: bone.quaternion.toArray(),
      scale: bone.scale.toArray(),
    },
  ]),
);
const mixer = new AnimationMixer(model);
mixer.clipAction(clip).play();
const frameCount = Math.ceil(clip.duration * sampleRate);
const round = (value) => Number(value.toFixed(6));
const vector = (value) => value.toArray().map(round);

const records = Object.fromEntries(
  sourceBones.map((bone) => [
    bone.name,
    {
      parent:
        bone.parent instanceof Bone
          ? bone.parent.name
          : (bone.parent?.name ?? null),
      bind: initial.get(bone),
      samples: [],
    },
  ]),
);

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  mixer.setTime(time);
  for (const bone of sourceBones) {
    records[bone.name].samples.push({
      time: round(time),
      position: vector(bone.position),
      quaternion: vector(bone.quaternion),
      scale: vector(bone.scale),
    });
  }
}

for (const bone of sourceBones) {
  const record = records[bone.name];
  const rest = initial.get(bone).quaternion;
  const positionMin = [Infinity, Infinity, Infinity];
  const positionMax = [-Infinity, -Infinity, -Infinity];
  let rotationRangeRadians = 0;
  for (const sample of record.samples) {
    for (let axis = 0; axis < 3; axis += 1) {
      positionMin[axis] = Math.min(positionMin[axis], sample.position[axis]);
      positionMax[axis] = Math.max(positionMax[axis], sample.position[axis]);
    }
    const dot = Math.min(
      1,
      Math.abs(
        rest[0] * sample.quaternion[0] +
          rest[1] * sample.quaternion[1] +
          rest[2] * sample.quaternion[2] +
          rest[3] * sample.quaternion[3],
      ),
    );
    rotationRangeRadians = Math.max(rotationRangeRadians, 2 * Math.acos(dot));
  }
  record.envelope = {
    positionMin: positionMin.map(round),
    positionMax: positionMax.map(round),
    rotationRangeRadians: round(rotationRangeRadians),
  };
}

const report = {
  schema: "monkey-classic-motion/v1",
  source: path.relative(process.cwd(), sourcePath).replaceAll("\\", "/"),
  clip: clipName,
  locomotion: "classic-quadruped",
  duration: round(clip.duration),
  sampleRate,
  frameCount,
  coordinateSystem: {
    side: "left=+X, right=-X",
    note: "Local FBX transforms sampled after AnimationMixer evaluation.",
  },
  bones: records,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `Analyzed ${sourceBones.length} bones across ${frameCount} frames -> ${outputPath}\n`,
);
