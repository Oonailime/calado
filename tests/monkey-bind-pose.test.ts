import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LoadingManager, Vector3, type SkinnedMesh } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { restoreMonkeyBindPose } from "../src/features/game/characters/monkeyBindPose";

function loadModel() {
  globalThis.document ??= {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
    }),
  } as unknown as Document;
  const bytes = readFileSync("public/assets/models/monkey.fbx");
  const model = new FBXLoader(
    new LoadingManager().setURLModifier(() => ""),
  ).parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  return model;
}

test("bind real é simétrico e vertical, sem aplicar duas vezes a escala FBX", () => {
  const model = loadModel();
  const point = (name: string) =>
    model.getObjectByName(name)!.getWorldPosition(new Vector3());
  const originalArmLength = point("Arm01_L").distanceTo(point("Arm02_L"));
  restoreMonkeyBindPose(model);
  assert.ok(
    Math.abs(
      point("Arm01_L").distanceTo(point("Arm02_L")) / originalArmLength - 1,
    ) < 0.001,
  );
  for (const [left, right] of [
    ["Arm01_L", "Arm01_R"],
    ["Foot_L", "Foot_R"],
    ["Foot_L001", "Foot_R001"],
  ]) {
    const a = point(left),
      b = point(right);
    assert.ok(Math.abs(a.x + b.x) < 1e-7);
    assert.ok(Math.abs(a.y - b.y) < 1e-7);
    assert.ok(Math.abs(a.z - b.z) < 1e-7);
  }
  assert.ok(point("Arm01_L").y > point("Spine").y);
  assert.ok(point("Foot_L001").y < point("Foot_L").y);
});

test("root e terminais faciais não carregam pesos; Spine é pai das pernas e cauda", () => {
  const model = loadModel();
  const terminals = new Set([
    "Armature_deform",
    "mouth_end",
    "eye_L_end",
    "eye_R_end",
    "ear_R001_end",
    "ear_L001_end",
  ]);
  for (const name of terminals) assert.ok(model.getObjectByName(name), name);
  model.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const indices = mesh.geometry.getAttribute("skinIndex");
    const weights = mesh.geometry.getAttribute("skinWeight");
    for (let vertex = 0; vertex < weights.count; vertex++)
      for (let c = 0; c < 4; c++)
        if (weights.getComponent(vertex, c) > 0)
          assert.equal(
            terminals.has(
              mesh.skeleton.bones[indices.getComponent(vertex, c)].name,
            ),
            false,
          );
  });
  for (const name of ["Foot_L", "Foot_R", "tail000"])
    assert.equal(model.getObjectByName(name)?.parent?.name, "Spine");
});
