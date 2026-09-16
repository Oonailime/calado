import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Group, LoadingManager, Matrix4, Vector3, SkinnedMesh, AnimationMixer, Bone } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { applyContactMotion, buildRig, restoreNeutralPose } from "../src/features/game/characters/Monkey";
import { createVineWalk, sampleVineWalkPose, sampleWalkingVine, stepVineWalk, vineWalkInput, VINE_WALK_LENGTH, VINE_WALK_STRIDE } from "../src/features/game/characters/vineWalking";
import { PHASE_FOUR_LADDER_SITE, PHASE_FOUR_FEET_OFFSET } from "../src/features/game/world/phaseFourLayout";
import { climbingPosition, nearestArborealInteraction } from "../src/features/game/world/forestLayout";

const site = PHASE_FOUR_LADDER_SITE;
test("both decks offer the rope interaction, but the floor beneath does not", () => {
  for (const end of [0, 1]) {
    const p = climbingPosition(site, end);
    assert.equal(nearestArborealInteraction(p, [site])?.site.id, site.id);
    assert.equal(nearestArborealInteraction({ ...p, y: -3 }, [site]), undefined);
    assert.ok(Math.abs(sampleWalkingVine(end * VINE_WALK_LENGTH).y + PHASE_FOUR_FEET_OFFSET - p.y) < 0.001);
  }
});

test("camera-relative W/S reverses with camera heading throughout the route", () => {
  for (let d = 0; d <= VINE_WALK_LENGTH; d += 0.25) {
    assert.ok(vineWalkInput(d, 0, 1, 0) > 0);
    assert.ok(vineWalkInput(d, 0, -1, 0) < 0);
    assert.ok(vineWalkInput(d, Math.PI, 1, 0) < 0);
    assert.ok(vineWalkInput(d, Math.PI, -1, 0) > 0);
    assert.equal(vineWalkInput(d, 0, 0, 0), 0);
  }
});

test("walk can pause, reverse mid-route, reach the top and return to the arrival deck", () => {
  const walk = createVineWalk(climbingPosition(site, 0), false);
  for (let i = 0; i < 180; i++) stepVineWalk(walk, 1, 1 / 60);
  for (let i = 0; i < 30; i++) stepVineWalk(walk, 0, 1 / 60);
  const stopped = walk.position.clone();
  for (let i = 0; i < 120; i++) stepVineWalk(walk, 0, 1 / 60);
  assert.ok(stopped.distanceTo(walk.position) < 1e-9);
  const distance = walk.distance;
  for (let i = 0; i < 30; i++) stepVineWalk(walk, -1, 1 / 60);
  assert.ok(walk.distance < distance);
  for (const direction of [1, -1] as const) {
    let arrived = false;
    for (let i = 0; i < 1500 && !arrived; i++) arrived = stepVineWalk(walk, direction, 1 / 60);
    assert.equal(arrived, true);
    assert.equal(walk.distance, direction > 0 ? VINE_WALK_LENGTH : 0);
  }
});

test("gaze follows the destination in both directions, including the last step", () => {
  const walk = createVineWalk(climbingPosition(site, 0), false);
  for (const direction of [1, -1] as const) {
    walk.direction = direction;
    const exit = sampleWalkingVine(direction > 0 ? VINE_WALK_LENGTH : 0);
    for (const distance of [0, VINE_WALK_LENGTH / 2, VINE_WALK_LENGTH]) {
      walk.distance = distance;
      sampleVineWalkPose(walk);
      assert.ok(walk.lookTarget.distanceTo(exit) < 1.7);
      assert.ok(walk.lookTarget.clone().sub(walk.position).dot(new Vector3().copy(walk.basis.forward)) > 0);
    }
  }
});

test("longer steps keep planted hands and pushing feet fixed on the rope", () => {
  const walk = createVineWalk(climbingPosition(site, 0), false);
  for (const direction of [1, -1] as const) {
    walk.direction = direction;
    // At this phase the leading hand and opposite hind foot share support.
    walk.distance = 12 * VINE_WALK_STRIDE;
    sampleVineWalkPose(walk);
    const hand = walk.leftHand.clone(), foot = walk.rightFoot.clone();
    const extended = walk.stretch;
    walk.distance += direction * VINE_WALK_STRIDE * 0.02;
    sampleVineWalkPose(walk);
    assert.ok(hand.distanceTo(walk.leftHand) < 1e-8, "planted hand must not slide");
    assert.ok(foot.distanceTo(walk.rightFoot) < 1e-8, "pushing foot must not slide");
    walk.distance += direction * VINE_WALK_STRIDE * 0.23;
    sampleVineWalkPose(walk);
    assert.ok(extended > 0.95 && walk.stretch < 0.05,
      "the extended diagonal must gather again halfway through the step");
  }
});

test("actual FBX hands and feet reach the rope in both directions without stretching", () => {
  globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {} }) } as unknown as Document;
  const bytes = readFileSync("public/assets/models/monkey.fbx");
  const template = new FBXLoader(new LoadingManager().setURLModifier(() => "")).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const rig = buildRig(template, 1);
  const parent = new Group();
  parent.add(rig.model);
  const walk = createVineWalk(climbingPosition(site, 0), false);
  const idleReference = cloneSkeleton(template);
  const idleMixer = new AnimationMixer(idleReference);
  idleMixer.clipAction(template.animations.find((clip) => clip.name.endsWith("monkey_idleC"))!).play();
  let maxArmExtension = 0, maxLegExtension = 0;
  let lowestHip = Infinity, highestHip = -Infinity;
  const point = (bone: typeof rig.bones.handL) => bone!.getWorldPosition(new Vector3());
  walk.speed = 2;
  const armLength = point(rig.bones.armL).distanceTo(point(rig.bones.forearmL));
  for (const direction of [1, -1] as const) for (let d = 0; d <= VINE_WALK_LENGTH; d += 0.13) {
    walk.distance = d;
    walk.direction = direction;
    sampleVineWalkPose(walk);
    parent.position.copy(walk.position);
    parent.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().copy(walk.basis.right).negate(), new Vector3().copy(walk.basis.up), new Vector3().copy(walk.basis.forward)));
    restoreNeutralPose(rig);
    parent.updateMatrixWorld(true);
    applyContactMotion(rig, "vine-walk", d, 1 / 60, { speed: 2, grounded: false, vineWalk: walk });
    parent.updateMatrixWorld(true);
    const hip = parent.worldToLocal(point(rig.bones.spine));
    const chest = parent.worldToLocal(point(rig.bones.chest));
    assert.ok(hip.y > -0.36, "pelvis must stay clear of the rope");
    lowestHip = Math.min(lowestHip, hip.y);
    highestHip = Math.max(highestHip, hip.y);
    assert.ok(Math.abs(hip.y - (-0.22 - walk.stretch * 0.12)) < 1e-6,
      "body must lower during extension and rise during recovery");
    idleMixer.setTime(d);
    idleReference.updateMatrixWorld(true);
    assert.ok(Math.abs(chest.y - hip.y) < 0.09, "back must stay nearly horizontal");
    for (let index = 0; index < rig.tail.length - 1; index++) {
      const direction = parent.worldToLocal(point(rig.tail[index + 1]))
        .sub(parent.worldToLocal(point(rig.tail[index]))).normalize();
      const referenceDirection = idleReference.getObjectByName(rig.tail[index + 1].name)!.getWorldPosition(new Vector3())
        .sub(idleReference.getObjectByName(rig.tail[index].name)!.getWorldPosition(new Vector3())).normalize();
      assert.ok(direction.dot(referenceDirection) > 0.999, "tail must follow the animated standing idle cycle");
    }
    for (const [bone, target] of [[rig.bones.handL, walk.leftHand], [rig.bones.handR, walk.rightHand], [rig.bones.footL, walk.leftFoot], [rig.bones.footR, walk.rightFoot]] as const) {
      const error = point(bone).distanceTo(target);
      assert.ok(error < 0.035, `${bone?.name} dir=${direction} distance=${d}: contact error ${error}`);
    }
    for (const [shoulder, elbow, hand, side] of [
      [rig.bones.armL, rig.bones.forearmL, rig.bones.handL, 1],
      [rig.bones.armR, rig.bones.forearmR, rig.bones.handR, -1],
    ] as const) {
      const upper = point(shoulder), joint = point(elbow), wrist = point(hand);
      const reach = upper.distanceTo(joint) + joint.distanceTo(wrist);
      const extension = upper.distanceTo(wrist) / reach;
      maxArmExtension = Math.max(maxArmExtension, extension);
      assert.ok(extension < 0.995, `elbow must keep a small bend at ${d}: ${extension}`);
      const line = wrist.clone().sub(upper).normalize();
      const outward = joint.clone().sub(upper);
      outward.addScaledVector(line, -outward.dot(line));
      assert.ok(outward.dot(new Vector3().copy(walk.basis.right)) * -side > 0.02, `elbow must bend outward at ${d}`);
    }
    for (const [hipBone, knee, foot] of [
      [rig.bones.thighL, rig.bones.shinL, rig.bones.footL],
      [rig.bones.thighR, rig.bones.shinR, rig.bones.footR],
    ] as const) {
      const reach = point(hipBone).distanceTo(point(knee)) + point(knee).distanceTo(point(foot));
      maxLegExtension = Math.max(maxLegExtension, point(hipBone).distanceTo(point(foot)) / reach);
    }
    assert.ok(Math.abs(point(rig.bones.armL).distanceTo(point(rig.bones.forearmL)) - armLength) < 1e-6);
    if (d > 5 && d < VINE_WALK_LENGTH - 2)
      assert.ok(Math.abs(rig.headYaw ?? 0) < 0.45, `head must face along the rope at ${d}`);
  }
  assert.ok(maxArmExtension > 0.9, "leading arm must reach with a straighter elbow");
  assert.ok(maxLegExtension > 0.9, "trailing leg must extend during push-off");
  assert.ok(highestHip - lowestHip > 0.1, "body must visibly rise and lower during each stride");
  walk.distance = VINE_WALK_LENGTH / 2;
  walk.speed = 0;
  sampleVineWalkPose(walk);
  parent.position.copy(walk.position);
  parent.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().copy(walk.basis.right).negate(), new Vector3().copy(walk.basis.up), new Vector3().copy(walk.basis.forward)));
  let chestLow = Infinity, chestHigh = -Infinity;
  const tailTips: Vector3[] = [];
  for (let frame = 0; frame < 180; frame++) {
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-walk", frame / 60, 1 / 60, { speed: 0, grounded: false, vineWalk: walk });
    parent.updateMatrixWorld(true);
    const chestHeight = point(rig.bones.chest).dot(new Vector3().copy(walk.basis.up));
    tailTips.push(point(rig.tail.at(-1)).sub(point(rig.tail[0])));
    chestLow = Math.min(chestLow, chestHeight);
    chestHigh = Math.max(chestHigh, chestHeight);
    for (const [bone, target] of [[rig.bones.handL, walk.leftHand], [rig.bones.handR, walk.rightHand], [rig.bones.footL, walk.leftFoot], [rig.bones.footR, walk.rightFoot]] as const)
      assert.ok(point(bone).distanceTo(target) < 0.002, "breathing must keep the contacts pinned");
  }
  assert.ok(Math.max(...tailTips.map((tip) => tip.distanceTo(tailTips[0]))) > 0.025,
    "tail must continue swaying when stopped on the rope");
  assert.ok(chestHigh - chestLow > 0.008, "idle breathing must remain visible");
  const rope = Array.from({ length: 151 }, (_, i) => sampleWalkingVine(walk.distance - 1.5 + i * 0.02));
  const contactBones = new Set();
  for (const bone of [rig.bones.handL, rig.bones.handR, rig.bones.footL, rig.bones.footR])
    bone?.traverse((child) => contactBones.add(child));
  let minSkinDistance = Infinity;
  let skinSamples = 0;
  rig.model.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    object.skeleton.update();
    const geometry = object.geometry;
    const indices = geometry.getAttribute("skinIndex");
    const weights = geometry.getAttribute("skinWeight");
    const vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (contactBones.has(object.skeleton.bones[indices.getComponent(i, j)])) weight += weights.getComponent(i, j);
      if (weight < 0.8) continue;
      const vertex = new Vector3().fromBufferAttribute(vertices, i);
      object.applyBoneTransform(i, vertex);
      object.localToWorld(vertex);
      const clearance = Math.sqrt(Math.min(...rope.map((p) => p.distanceToSquared(vertex))));
      minSkinDistance = Math.min(minSkinDistance, clearance);
      skinSamples++;
    }
  });
  assert.ok(skinSamples > 100);
  assert.ok(minSkinDistance >= 0.095, `hand/foot skin penetrates rope: radius ${minSkinDistance}`);

});


test("all three monkeys start with the original ground idle pose", () => {
  globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {} }) } as unknown as Document;
  const bytes = readFileSync("public/assets/models/monkey.fbx");
  const template = new FBXLoader(new LoadingManager().setURLModifier(() => "")).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const idle = template.animations.find((clip) => clip.name.endsWith("monkey_idleC"))!;
  for (const id of [0, 1, 2] as const) {
    const rig = buildRig(template, id);
    const reference = cloneSkeleton(template);
    const mixer = new AnimationMixer(reference);
    mixer.clipAction(idle).play();
    for (const dt of [1 / 60, 1 / 60, 0.5]) {
      rig.mixer.update(dt);
      mixer.update(dt);
      reference.traverse((object) => {
        if (!(object instanceof Bone)) return;
        const actual = rig.model.getObjectByName(object.name)!;
        assert.ok(actual.position.distanceTo(object.position) < 1e-6, `monkey ${id}: ${object.name} starts displaced`);
        assert.ok(actual.quaternion.angleTo(object.quaternion) < 0.001, `monkey ${id}: ${object.name} starts tilted`);
      });
    }
  }
});
