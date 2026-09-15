import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Group, LoadingManager, Matrix4, Vector3 } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  applyContactMotion,
  buildRig,
  restoreNeutralPose,
} from "../src/features/game/characters/Monkey";
import {
  CLASSIC_QUADRUPED_CLIP,
  proceduralMonkeyMotion,
  type MonkeyLocomotion,
} from "../src/features/game/characters/monkeyMotion";
import {
  sampleHandReach,
  suspensionBasis,
  handoffShoulderTurn,
} from "../src/features/game/characters/brachiationPose";

function fixture() {
  globalThis.document ??= {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
    }),
  } as unknown as Document;
  const bytes = readFileSync("public/assets/models/monkey.fbx");
  const template = new FBXLoader(
    new LoadingManager().setURLModifier(() => ""),
  ).parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const rig = buildRig(template, 2);
  const parent = new Group();
  parent.position.set(12, 8, -15);
  parent.rotation.y = 0.7;
  parent.add(rig.model);
  const point = (name: string) =>
    rig.model.getObjectByName(name)!.getWorldPosition(new Vector3());
  restoreNeutralPose(rig);
  parent.updateMatrixWorld(true);
  return { rig, parent, point };
}

test("triângulo coincide com Spine e Arm01; mão presa e pernas conservam medidas em coordenadas mundiais", () => {
  const { rig, parent, point } = fixture();
  const anchor = point("Arm01_L").add(
    new Vector3(0, rig.armCalibration.left!.armLength * 0.98, 0),
  );
  const locomotion: MonkeyLocomotion = {
    speed: 0,
    grounded: false,
    motion: "vine-swing",
    vineAnchor: anchor,
    hands: {
      left: { grabbed: true, reaching: false, anchor },
      right: { grabbed: false, reaching: false },
    },
  };
  const lengths = [
    point("Foot_L").distanceTo(point("Foot_L001")),
    point("Foot_L001").distanceTo(point("Foot_L002")),
  ];
  for (let frame = 0; frame < 120; frame++) {
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-swing", frame / 60, 1 / 60, locomotion);
    parent.updateMatrixWorld(true);
    assert.ok(
      point("Spine").distanceTo(new Vector3().copy(rig.bodyPose.base)) < 1e-6,
    );
    assert.ok(
      point("Arm01_L").distanceTo(
        new Vector3().copy(rig.bodyPose.leftShoulder),
      ) < 1e-6,
    );
    assert.ok(
      point("Arm01_R").distanceTo(
        new Vector3().copy(rig.bodyPose.rightShoulder),
      ) < 1e-6,
    );
    assert.ok(
      point("Hand_L").distanceTo(anchor) < 0.002,
      `mão afastada: ${point("Hand_L").distanceTo(anchor)}`,
    );
    assert.ok(
      Math.abs(point("Foot_L").distanceTo(point("Foot_L001")) - lengths[0]) <
        1e-5,
    );
    assert.ok(
      Math.abs(point("Foot_L001").distanceTo(point("Foot_L002")) - lengths[1]) <
        1e-5,
    );
  }
  assert.ok(point("Foot_L002").y < point("Spine").y - 0.45);
});

test("mão livre do FBX percorre o arco inteiro e termina no apoio sem teleporte na pegada", () => {
  const { rig, parent, point } = fixture();
  const shoulder = point("Arm01_R");
  const origin = shoulder.clone().add(new Vector3(0, -0.32, 0.08));
  const target = shoulder.clone().add(new Vector3(0, 0.34, 0.05));
  const wrist = new Vector3();
  const locomotion: MonkeyLocomotion = {
    speed: 0,
    grounded: false,
    hands: {
      left: {
        grabbed: false,
        reaching: false,
        point: point("Arm01_L").add(new Vector3(0, -0.32, 0)),
      },
      right: { grabbed: false, reaching: true, point: wrist, target },
    },
  };
  const previous = origin.clone();
  for (let frame = 0; frame <= 36; frame++) {
    sampleHandReach(
      wrist,
      origin,
      target,
      frame / 36,
      new Vector3(0, 0, 1),
      0.05,
    );
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-grab", frame / 60, 1 / 60, locomotion);
    parent.updateMatrixWorld(true);
    const actual = point("Hand_R");
    assert.ok(
      actual.distanceTo(wrist) < 0.002,
      `quadro ${frame}: mão deve seguir o ponto intermediário`,
    );
    assert.ok(
      actual.distanceTo(previous) < 0.04,
      `quadro ${frame}: braço saltou`,
    );
    previous.copy(actual);
  }
  locomotion.vineAnchor = target;
  locomotion.hands!.right.grabbed = true;
  locomotion.hands!.right.reaching = false;
  locomotion.hands!.right.anchor = target;
  restoreNeutralPose(rig);
  applyContactMotion(rig, "vine-swing", 0, 1 / 60, locomotion);
  assert.ok(point("Hand_R").distanceTo(previous) < 0.002);
});

test("soltar o cipó começa nas duas mãos visíveis e continua suavemente no voo", () => {
  const { rig, parent, point } = fixture();
  const anchor = point("Arm01_L")
    .lerp(point("Arm01_R"), 0.5)
    .add(new Vector3(0, 0.32, 0));
  const locomotion: MonkeyLocomotion = {
    speed: 0,
    grounded: false,
    vineAnchor: anchor,
  };
  for (let frame = 0; frame < 60; frame++) {
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-swing", frame / 60, 1 / 60, locomotion);
  }
  const previous = [point("Hand_L"), point("Hand_R")];
  locomotion.vineAnchor = undefined;
  for (let frame = 0; frame < 60; frame++) {
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-jump", frame / 60, 1 / 60, locomotion);
    parent.updateMatrixWorld(true);
    for (const [index, name] of ["Hand_L", "Hand_R"].entries()) {
      const current = point(name);
      assert.ok(
        current.distanceTo(previous[index]) < (frame === 0 ? 0.002 : 0.055),
        `quadro ${frame}: ${name} saltou ${current.distanceTo(previous[index])}`,
      );
      previous[index].copy(current);
    }
  }
});

test("ossos dos ombros ficam paralelos ao percurso inclinado durante a oscilação do tronco", () => {
  const { rig, parent, point } = fixture();
  const travel = new Vector3(1, 0.2, -0.5).normalize();
  const basis = {
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
  };
  const matrix = new Matrix4();
  for (let frame = 0; frame < 90; frame++) {
    suspensionBasis(basis, travel, Math.sin(frame / 15) * 0.25, 0);
    parent.quaternion.setFromRotationMatrix(
      matrix.makeBasis(basis.right.clone().negate(), basis.up, basis.forward),
    );
    restoreNeutralPose(rig);
    applyContactMotion(rig, "vine-swing", frame / 60, 1 / 60, {
      speed: 0,
      grounded: false,
      bodyBasis: basis,
    });
    const bar = point("Arm01_L").sub(point("Arm01_R"));
    assert.ok(Math.abs(bar.length() - rig.bodyDimensions.shoulderWidth) < 1e-6);
    assert.ok(Math.abs(bar.normalize().dot(travel)) > 0.999999);
    assert.ok(
      point("Spine").distanceTo(new Vector3().copy(rig.bodyPose.base)) < 1e-6,
    );
  }
});

test("apoio duplo fixa as duas mãos enquanto o FBX gira e alterna os ombros", () => {
  const { rig, parent, point } = fixture();
  const basis = {
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
  };
  const matrix = new Matrix4();
  const oldGrip = new Vector3(0, 2, 0),
    nextGrip = new Vector3(0.46, 2, 0);
  const offset = rig.armCalibration.left!.shoulderOffset;
  const radius = rig.armCalibration.left!.armLength * 0.98;
  const right = new Vector3();
  for (const from of ["left", "right"] as const) {
    for (let frame = 0; frame <= 60; frame++) {
      const progress = frame / 60;
      suspensionBasis(
        basis,
        { x: 1, y: 0, z: 0 },
        0,
        handoffShoulderTurn(from, progress),
      );
      parent.quaternion.setFromRotationMatrix(
        matrix.makeBasis(
          right.copy(basis.right).negate(),
          basis.up,
          basis.forward,
        ),
      );
      const leftAnchor = from === "left" ? oldGrip : nextGrip;
      const rightAnchor = from === "left" ? nextGrip : oldGrip;
      const a = leftAnchor.clone().addScaledVector(right, -offset.x);
      const b = rightAnchor.clone().addScaledVector(right, offset.x);
      const drop = Math.sqrt(radius * radius - a.distanceToSquared(b) / 4);
      parent.position
        .copy(a)
        .lerp(b, 0.5)
        .addScaledVector(basis.up, -offset.y - drop)
        .addScaledVector(basis.forward, -offset.z);
      restoreNeutralPose(rig);
      applyContactMotion(rig, "vine-swing", frame / 60, 1 / 60, {
        speed: 0,
        grounded: false,
        bodyBasis: basis,
        vineAnchor: oldGrip,
        hands: {
          left: { grabbed: true, reaching: false, anchor: leftAnchor },
          right: { grabbed: true, reaching: false, anchor: rightAnchor },
        },
      });
      parent.updateMatrixWorld(true);
      assert.ok(point("Hand_L").distanceTo(leftAnchor) < 0.002);
      assert.ok(point("Hand_R").distanceTo(rightAnchor) < 0.002);
      const bar = point("Arm01_L").sub(point("Arm01_R"));
      assert.ok(
        Math.abs(bar.length() - rig.bodyDimensions.shoulderWidth) < 1e-6,
      );
      if (frame === 30)
        assert.ok(
          Math.abs(bar.x) < 1e-6,
          "ombros perpendiculares no meio da troca",
        );
      if (frame === 60)
        assert.ok(
          from === "left" ? bar.x < 0 : bar.x > 0,
          "novo ombro à frente",
        );
    }
  }
});

test("caminhada preserva o clipe original e não passa pelo solver procedural", () => {
  const { rig } = fixture();
  assert.equal(proceduralMonkeyMotion("biped-walk"), undefined);
  assert.ok(rig.actions.run!.getClip().name.endsWith(CLASSIC_QUADRUPED_CLIP));
  assert.equal(rig.actions.motion["biped-walk"], undefined);
  assert.equal(proceduralMonkeyMotion("vine-grab"), "vine-grab");
  assert.equal(proceduralMonkeyMotion("tree-climb"), "tree-climb");
});
