import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import {
  LEG_LIMITS,
  SuspendedLeg,
} from "../src/features/game/characters/suspendedLeg";

const hip = new Vector3(0, 1, 0);
const createLeg = () =>
  new SuspendedLeg(hip, new Vector3(0, 1, 0.25), new Vector3(0, 1, 0.5));

test("coxa e canela caem por gravidade e conservam seus comprimentos", () => {
  const leg = createLeg();
  for (let i = 0; i < 600; i++) leg.update(hip, 1 / 60);
  assert.ok(leg.knee.y < 0.77);
  assert.ok(leg.foot.y < 0.53);
  assert.ok(Math.abs(leg.knee.distanceTo(hip) - 0.25) < 0.0001);
  assert.ok(Math.abs(leg.foot.distanceTo(leg.knee) - 0.25) < 0.0001);
});

test("gravidade das pernas usa o mesmo relógio a 30, 60 e 120 fps", () => {
  const outcomes = [30, 60, 120].map((fps) => {
    const leg = createLeg();
    for (let i = 0; i < fps * 2; i++) leg.update(hip, 1 / fps);
    return leg.foot.clone();
  });
  for (const result of outcomes)
    assert.ok(result.distanceTo(outcomes[0]) < 0.001);
});

test("pernas seguem a translação do quadril com inércia e suportam respawn", () => {
  const leg = createLeg();
  for (let i = 0; i < 120; i++) leg.update(hip, 1 / 60);
  const movedHip = hip.clone();
  for (let i = 0; i < 20; i++) {
    movedHip.x += 0.015;
    leg.update(movedHip, 1 / 60);
  }
  assert.ok(leg.foot.x < movedHip.x - 0.01);
  const respawn = movedHip.clone().add(new Vector3(100, 20, -40));
  leg.update(respawn, 1 / 60);
  assert.ok(leg.foot.distanceTo(respawn) < 0.501);
  assert.ok(Math.abs(leg.knee.distanceTo(respawn) - 0.25) < 0.001);
});

test("joelho é uma dobradiça e os dois sólidos nunca alongam sob aceleração", () => {
  const leg = createLeg();
  const moving = hip.clone();
  const forward = new Vector3(0, 0, 1);
  for (let i = 0; i < 600; i++) {
    moving.set(Math.sin(i / 20) * 0.4, 1 + Math.cos(i / 13) * 0.3, i / 300);
    leg.update(moving, 1 / 60, { forward, pump: (1 + Math.sin(i / 15)) / 2 });
    const thigh = leg.knee.clone().sub(moving).normalize();
    const shin = leg.foot.clone().sub(leg.knee).normalize();
    const hinge = forward
      .clone()
      .addScaledVector(thigh, -forward.dot(thigh))
      .normalize();
    assert.ok(shin.dot(hinge) <= 0, "joelho não deve inverter");
    assert.ok(-thigh.y >= Math.cos(LEG_LIMITS.hip) - 1e-6);
    assert.ok(
      leg.kneeFlexion >= LEG_LIMITS.kneeMin &&
        leg.kneeFlexion <= LEG_LIMITS.kneeMax,
    );
    assert.ok(Math.abs(leg.knee.distanceTo(moving) - 0.25) < 1e-8);
    assert.ok(Math.abs(leg.foot.distanceTo(leg.knee) - 0.25) < 1e-8);
  }
});

test("salto estende o joelho e leva as pernas para trás na direção real do percurso", () => {
  const leg = createLeg();
  const forward = new Vector3(0, 0, 1);
  const travel = new Vector3(1, 0, 0);
  for (let i = 0; i < 120; i++) leg.update(hip, 1 / 60, { forward, pump: 1 });
  const tucked = leg.kneeFlexion;
  const previous = leg.foot.clone();
  for (let i = 0; i < 90; i++) {
    leg.update(hip, 1 / 60, { forward, travel, flight: Math.min(1, i / 30) });
    assert.ok(
      leg.foot.distanceTo(previous) < 0.04,
      "extensão sem salto de posição",
    );
    assert.ok(Math.abs(leg.knee.distanceTo(hip) - leg.thighLength) < 1e-8);
    assert.ok(Math.abs(leg.foot.distanceTo(leg.knee) - leg.shinLength) < 1e-8);
    previous.copy(leg.foot);
  }
  assert.ok(leg.kneeFlexion < tucked * 0.5);
  assert.ok(leg.foot.clone().sub(hip).dot(travel) < -0.2);
});
