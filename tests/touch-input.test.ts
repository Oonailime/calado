import { strict as assert } from "node:assert";
import test from "node:test";
import { joystickKeys, pinchZoom, ZOOM_MAX, ZOOM_MIN } from "../src/features/game/controls/touchInput";
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

test("touch guidance names on-screen actions in both languages", () => {
  assert.equal(touchHint("WASD: balançar · E: alcançar · Shift/Alt: subir/descer · Espaço: soltar.", true, "KeyF"),
    "Joystick: balançar · Interagir: alcançar · Subir/Descer: subir/descer · Pular: soltar.");
  assert.equal(touchHint("WASD: swing · E: reach · Shift/Alt: climb · Space: release.", false, "KeyF"),
    "Joystick: swing · Interact: reach · Climb/Descend: climb · Jump: release.");
});
