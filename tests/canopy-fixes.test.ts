import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Material } from "three";
import { accelerateStaticRaycast } from "../src/features/game/camera/staticRaycast";
import { islandFollowerTarget } from "../src/features/game/characters/followerNavigation";
import { CANOPY_BRIDGE_CURVE, CANOPY_BRIDGE_SITE, CANOPY_HARVESTS, CANOPY_PRISM_SOCKETS, CANOPY_STUMPS } from "../src/features/game/world/canopyCooperationLayout";
import { canopyHarvestCurve, createPhaseFourEnvironment, phaseFourBranchVinePoints, phaseFourPathCurve, PHASE_FOUR_BRANCH_CLEARANCE } from "../src/features/game/world/phaseFourAssets";
import { PHASE_FOUR_PATHS, PHASE_FOUR_PLATFORMS } from "../src/features/game/world/phaseFourLayout";

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

test("each harvestable vine is its own scenery group, so its whole length can blink alone", () => {
  const scene = createPhaseFourEnvironment();
  const materials = new Map<Material, number>();
  scene.traverse(object => {
    if (object instanceof Mesh) materials.set(object.material as Material, (materials.get(object.material as Material) ?? 0) + 1);
  });
  for (const site of CANOPY_HARVESTS) {
    const group = scene.getObjectByName(`Phase4_CanopyVillage_liana-${site.id}`);
    assert.ok(group, `${site.id} vine group`);
    const meshes = group.children.filter((child): child is Mesh => child instanceof Mesh);
    assert.ok(meshes.length > 0);
    // Fading its material must not fade any other scenery.
    for (const mesh of meshes) assert.equal(materials.get(mesh.material as Material), 1);
    // The grab spot sits on that same vine.
    const curve = canopyHarvestCurve(site.id);
    const grab = new Vector3(...site.position);
    const nearest = Math.min(...curve.getSpacedPoints(200).map(p => p.distanceTo(grab)));
    assert.ok(nearest < 1.5);
  }
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
  });
});

test("decorative lianas spiral around each walking bough outside its bark", () => {
  for (const path of PHASE_FOUR_PATHS.filter(path => path.kind === "branch")) {
    const curve = phaseFourPathCurve(path);
    const points = phaseFourBranchVinePoints(path);
    const radius = path.width * 0.58;
    let above = false, below = false;
    for (let i = 0; i < points.length; i++) {
      const center = curve.getPointAt(i / (points.length - 1));
      center.y -= radius + PHASE_FOUR_BRANCH_CLEARANCE;
      const vine = new Vector3(...points[i]);
      assert.ok(vine.distanceTo(center) > radius + 0.095);
      above ||= vine.y > center.y + radius * 0.8;
      below ||= vine.y < center.y - radius * 0.8;
    }
    assert.equal(above && below, true, path.id);
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
