import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyMonkeySurface,
  monkeyAnimation,
  monkeySurfaceColor,
  MONKEY_DETAIL_COLOR,
  MONKEY_EYE_COLOR,
  MONKEY_EYE_WHITE,
  MONKEY_FACE_COLORS,
} from "../src/features/game/characters/monkeyAppearance";
import { CHARACTERS } from "../src/features/game/types";

const surface = (
  name: string,
  sourceBrightness = 0.8,
  position = { x: 0, y: 1.4, z: 0.08 },
) =>
  classifyMonkeySurface({
    influences: [{ name, weight: 1 }],
    sourceBrightness,
    ...position,
  });

test("rosto, olhos, patas e interior da orelha recebem regiões distintas", () => {
  assert.equal(surface("Head"), "face");
  assert.equal(surface("eye_L", 0.05), "eye");
  assert.equal(surface("eye_R", 0.7), "eyeWhite");
  assert.equal(surface("Hand_finger_L002"), "paw");
  assert.equal(surface("Foot_R003"), "paw");
  assert.equal(surface("ear_L001", 0.05), "innerEar");
  assert.equal(surface("ear_L001", 0.8), "fur");
  assert.equal(surface("Spine", 0.8), "fur");
});

test("paleta mantém rosto diferente da pelagem e detalhes cinza-escuros", () => {
  for (const id of [0, 1, 2] as const) {
    assert.notEqual(MONKEY_FACE_COLORS[id], CHARACTERS[id].color);
    assert.equal(monkeySurfaceColor("face", id), MONKEY_FACE_COLORS[id]);
    assert.equal(monkeySurfaceColor("paw", id), MONKEY_DETAIL_COLOR);
    assert.equal(monkeySurfaceColor("innerEar", id), MONKEY_DETAIL_COLOR);
    assert.equal(monkeySurfaceColor("eye", id), MONKEY_EYE_COLOR);
    assert.equal(monkeySurfaceColor("eyeWhite", id), MONKEY_EYE_WHITE);
  }
});

test("a animação de caminhada também permanece ativa durante o pulo", () => {
  assert.equal(monkeyAnimation(true, 0, false), "idle");
  assert.equal(monkeyAnimation(true, 1, false), "run");
  assert.equal(monkeyAnimation(false, 0, false), "run");
});
