import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Mesh, MeshStandardMaterial, Raycaster, TubeGeometry, Vector3 } from "three";
import { accelerateStaticRaycast } from "../src/features/game/camera/staticRaycast";
import { islandFollowerTarget } from "../src/features/game/characters/followerNavigation";
import { CANOPY_BRIDGE_CURVE, CANOPY_BRIDGE_SITE, CANOPY_HARVESTS, CANOPY_PRISM_SOCKETS, CANOPY_STUMPS } from "../src/features/game/world/canopyCooperationLayout";
import { canopyHarvestCurve, createCanopyHarvestMarkerGeometry } from "../src/features/game/world/phaseFourAssets";
import { PHASE_FOUR_PLATFORMS } from "../src/features/game/world/phaseFourLayout";

test("built vine stays straight and connects the left corners of both decks", () => {
  const start = CANOPY_BRIDGE_CURVE.getPoint(0), end = CANOPY_BRIDGE_CURVE.getPoint(1);
  for (let i = 0; i <= 100; i++) {
    assert.ok(CANOPY_BRIDGE_CURVE.getPointAt(i / 100).distanceTo(start.clone().lerp(end, i / 100)) < 1e-8);
  }
  for (const [key, deckId] of [["lower", "falls"], ["upper", "waterfall-summit"]] as const) {
    const deck = PHASE_FOUR_PLATFORMS.find(d => d.id === deckId)!;
    const [x, y, z] = CANOPY_STUMPS[key];
    assert.ok(x - 0.32 > deck.center[0] - deck.width / 2);
    assert.ok(x < deck.center[0] - deck.width / 2 + 1);
    assert.ok(Math.abs(z - deck.center[2]) + 0.32 < deck.depth / 2);
    assert.equal(y, deck.center[1]);
  }
  assert.equal(CANOPY_BRIDGE_SITE.climb.x, start.x);
  assert.equal(CANOPY_BRIDGE_SITE.climb.topX, end.x);
});

test("prism centres lie on the pedestal's three front faces", () => {
  for (const socket of CANOPY_PRISM_SOCKETS) {
    const p = new Vector3(...socket.position);
    const faceRadius = (1.55 + (1.3 - 1.55) * p.y / 0.7) * Math.cos(Math.PI / 8);
    const normal = new Vector3(Math.sin(socket.angle), 0, Math.cos(socket.angle));
    assert.ok(Math.abs(p.dot(normal) - faceRadius) < 1e-8);
    const front = p.clone().addScaledVector(normal, 0.24);
    const back = p.clone().addScaledVector(normal, -0.24);
    assert.ok(front.dot(normal) > faceRadius && back.dot(normal) < faceRadius);
  }
});

test("harvest cuffs follow the same polygonal surface without crossing the vine", () => {
  for (const site of CANOPY_HARVESTS) {
    const curve = canopyHarvestCurve(site.id);
    const bark = new TubeGeometry(curve, 20, 0.11, 6, false);
    const cuff = createCanopyHarvestMarkerGeometry(site.id, site.position);
    const vertices = cuff.getAttribute("position"), barkVertices = bark.getAttribute("position");
    const indices = cuff.index!;
    for (let i = cuff.drawRange.start; i < cuff.drawRange.start + cuff.drawRange.count; i++) {
      const index = indices.getX(i);
      const a = new Vector3().fromBufferAttribute(vertices, index);
      const b = new Vector3().fromBufferAttribute(barkVertices, index);
      assert.ok(Math.abs(a.distanceTo(b) - 0.015) < 0.00001);
      assert.ok(a.distanceTo(new Vector3(...site.position)) < 1.5);
    }
    cuff.dispose(); bark.dispose();
  }
});

test("followers approach and cross the bridge in both directions", () => {
  const leader = { x: 0, y: 1.8, z: -22 };
  assert.deepEqual(islandFollowerTarget({ x: 4, y: 1.8, z: 2 }, leader, 0), { x: 0, z: 2, stopDistance: 0.2 });
  const entrance = islandFollowerTarget({ x: 0, y: 1.8, z: 2 }, leader, 0);
  assert.equal(entrance.x, 0);
  assert.ok(entrance.z < -15);
  const returning = islandFollowerTarget({ x: -4, y: 1.8, z: -22 }, { ...leader, z: 4 }, 1);
  assert.deepEqual(returning, { x: 0, z: -22, stopDistance: 0.2 });
  const crossing = islandFollowerTarget({ x: 0.2, y: 1, z: -10 }, { ...leader, x: 4, z: 4 }, 1);
  assert.equal(crossing.x, 0);
  assert.equal(crossing.z, 4);
});

test("accelerated camera queries retain exact hits across GPU disposal", () => {
  const geometry = new BoxGeometry(3, 3, 3, 40, 40, 40);
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  const ray = new Raycaster(new Vector3(0.3, 0.4, 8), new Vector3(0, 0, -1), 0, 12);
  const indexBefore = Array.from(geometry.index!.array);
  const before = ray.intersectObject(mesh).map(hit => hit.distance);
  accelerateStaticRaycast(mesh);
  assert.deepEqual(ray.intersectObject(mesh).map(hit => hit.distance), before);
  assert.deepEqual(Array.from(geometry.index!.array), indexBefore);
  ray.far = 2;
  assert.deepEqual(ray.intersectObject(mesh), []);
  geometry.dispose();
  ray.far = 12;
  assert.deepEqual(ray.intersectObject(mesh).map(hit => hit.distance), before);
});
