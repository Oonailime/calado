import { strict as assert } from "node:assert";
import test from "node:test";
import { CAMERA_FAR_ZOOM, cameraButtonZoom, cameraIsFar, joystickKeys, pinchZoom, ZOOM_MAX, ZOOM_MIN } from "../src/features/game/controls/touchInput";
import { touchHint } from "../src/features/game/ui/touchHints";

test("joystick has a dead zone and allows diagonal movement", () => {
  assert.deepEqual(joystickKeys(5, -5), []);
  assert.deepEqual(joystickKeys(30, -40), ["KeyW", "KeyD"]);
  assert.deepEqual(joystickKeys(-40, 35), ["KeyS", "KeyA"]);
});

test("pinch zoom follows finger distance and stays within camera limits", () => {
  assert.equal(pinchZoom(1, 100, 200), ZOOM_MIN);
  assert.equal(pinchZoom(1, 200, 100), ZOOM_MAX);
  assert.equal(pinchZoom(1, 0, 100), 1);
});

test("camera button pulls the view back and returns it to the previous zoom", () => {
  assert.ok(CAMERA_FAR_ZOOM > 1 && CAMERA_FAR_ZOOM <= ZOOM_MAX);
  assert.equal(cameraButtonZoom(0.8, 0.8), CAMERA_FAR_ZOOM);
  assert.equal(cameraIsFar(cameraButtonZoom(0.8, 0.8)), true);
  assert.equal(cameraButtonZoom(CAMERA_FAR_ZOOM, 0.8), 0.8);
  // Pinched out past the button's distance still counts as pulled back.
  assert.equal(cameraButtonZoom(ZOOM_MAX, 1), 1);
  assert.equal(cameraIsFar(1.2), false);
});

test("touch guidance names on-screen actions in both languages", () => {
  assert.equal(touchHint("WASD: balançar · E: alcançar · Shift/Alt: subir/descer · Espaço: soltar.", true, "KeyF"),
    "Joystick: balançar · Interagir: alcançar · Subir/Descer: subir/descer · Pular: soltar.");
  assert.equal(touchHint("WASD: swing · E: reach · Shift/Alt: climb · Space: release.", false, "KeyF"),
    "Joystick: swing · Interact: reach · Climb/Descend: climb · Jump: release.");
});

test("touch guidance turns key presses into taps and keeps sentences capitalised", () => {
  assert.equal(touchHint("O cadeado está aberto. Pressione 3 para controlar Iwazaru.", true, "KeyF"),
    "O cadeado está aberto. Toque no retrato do macaco para controlar Iwazaru.");
  assert.equal(touchHint("Aproxime Iwazaru (3) de cada palmeira marcada e pressione E ou Enter.", true, "KeyF"),
    "Aproxime Iwazaru (3) de cada palmeira marcada e toque em Interagir.");
  assert.equal(touchHint("Leve Iwazaru (3) ao mecanismo e pressione E, Enter ou G para concluir.", true, "KeyG"),
    "Leve Iwazaru (3) ao mecanismo e toque em Interagir ou Habilidade para concluir.");
  assert.equal(touchHint("Press Space to jump over obstacles.", false, "KeyF"),
    "Tap Jump to jump over obstacles.");
  assert.equal(touchHint("Take Iwazaru (3) to the mechanism and press E, Enter, or F to finish.", false, "KeyF"),
    "Take Iwazaru (3) to the mechanism and tap Interact or Ability to finish.");
});
