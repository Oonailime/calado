import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AnimationMixer, Mesh, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  houseDoorOpenness,
  houseYaw,
  PATH_POINTS,
  pathSegments,
  walkPoint,
  STORY_DOOR_FULL_OPEN_DISTANCE,
} from "../src/features/story/scene3d/cameraRig";

test("every door opens fully before the monkey reaches its facade in either scroll direction", () => {
  for (let index = 0; index < PATH_POINTS.length; index++) {
    assert.equal(houseDoorOpenness(index, index / 8), 1);
    for (let step = 0; step <= 800; step++) {
      const progress = step / 800;
      const p = walkPoint(progress);
      const d = Math.hypot(
        p.x - PATH_POINTS[index].x,
        p.z - PATH_POINTS[index].z,
      );
      if (d <= STORY_DOOR_FULL_OPEN_DISTANCE)
        assert.equal(houseDoorOpenness(index, progress), 1);
    }
  }
});

test("the wider workplace preserves long approach paths and continuous character movement", () => {
  for (const segment of pathSegments().slice(0, 5)) {
    assert.ok(
      Math.hypot(segment[1].x - segment[0].x, segment[1].z - segment[0].z) > 7,
    );
  }
  for (const progress of [3 / 8, 4 / 8, 5 / 8]) {
    const a = walkPoint(progress - 1e-7),
      b = walkPoint(progress + 1e-7);
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 1e-4);
  }
});

test("the business GLB has a working hinged door and its entrance lies on the incoming path", async () => {
  const bytes = await readFile(
    "public/assets/models/business/business-building-animated.glb",
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const hinge = gltf.scene.getObjectByName("BusinessDoorHinge")!;
  const threshold = gltf.scene.getObjectByName("DoorThreshold")!;
  assert.ok(hinge && threshold);
  const angle = houseYaw(4);
  const doorWorld = threshold.position
    .clone()
    .applyAxisAngle(new Vector3(0, 1, 0), angle);
  doorWorld.add(new Vector3(PATH_POINTS[4].x, 0, PATH_POINTS[4].z));
  const direction = new Vector3(
    PATH_POINTS[3].x - PATH_POINTS[4].x,
    0,
    PATH_POINTS[3].z - PATH_POINTS[4].z,
  ).normalize();
  const offset = doorWorld
    .clone()
    .sub(new Vector3(PATH_POINTS[4].x, 0, PATH_POINTS[4].z));
  assert.ok(offset.clone().cross(direction).length() < 1e-8);
  gltf.scene.updateMatrixWorld(true);
  const ray = new Raycaster(
    new Vector3(0, 0.45, 1.5),
    new Vector3(0, 0, -1),
    0,
    0.5,
  );
  const doorHits = () =>
    ray
      .intersectObject(gltf.scene, true)
      .filter((hit) => hit.object.name === "BusinessDoor");
  assert.ok(doorHits().length > 0, "closed door covers its doorway");
  const clip = gltf.animations.find((clip) => clip.name === "Door_Open")!;
  assert.ok(clip);
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip).play();
  action.paused = true;
  action.time = clip.duration;
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  assert.ok(Math.abs(hinge.rotation.y) > 1);
  assert.equal(doorHits().length, 0);
  assert.equal(
    ray.intersectObject(gltf.scene, true).length,
    0,
    "open door has no intact wall blocking entry",
  );
  action.time = 0;
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  assert.ok(
    doorHits().length > 0,
    "scrolling backwards restores the closed pose",
  );
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
});
