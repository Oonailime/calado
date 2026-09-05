import assert from "node:assert/strict";
import { before, test } from "node:test";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Mesh, Raycaster, Vector3 } from "three";
import {
  BRIDGE,
  BRIDGE_COLLIDER_CENTER_Y,
  BRIDGE_COLLIDER_HALF_HEIGHT,
  BRIDGE_ORIGIN_Y,
  CHARACTER_CAPSULE_HALF_HEIGHT,
  CHARACTER_CAPSULE_RADIUS,
  BEACH_SHORE_Y,
  ISLANDS,
  ISLAND_BASE_Y,
  ISLAND_SURFACE_Y,
  characterSpawn,
} from "../src/features/game/world/layout";
import {
  beachRampGeometry,
  islandEdgeDistance,
  islandGeometry,
  organicIslandShape,
  safeGround,
  waterDepth,
} from "../src/features/game/world/terrain";
import { anchors } from "../src/features/game/state/rules";

before(async () => {
  await RAPIER.init();
});

function terrainWorld() {
  const world = new RAPIER.World({ x: 0, y: -12, z: 0 });
  for (const island of ISLANDS) {
    const geometry = islandGeometry(
      organicIslandShape(island.halfWidth, island.halfDepth, island.seed),
    );
    // Match react-three-rapier's automatic trimesh conversion.
    const indexed = mergeVertices(geometry);
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        Float32Array.from(indexed.getAttribute("position").array),
        Uint32Array.from(indexed.getIndex()!.array),
      ).setTranslation(island.x, ISLAND_BASE_Y, island.z),
    );
    indexed.dispose();
    geometry.dispose();

    const beach = beachRampGeometry(
      organicIslandShape(island.halfWidth, island.halfDepth, island.seed),
      island.z,
    );
    const indexedBeach = mergeVertices(beach);
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        Float32Array.from(indexedBeach.getAttribute("position").array),
        Uint32Array.from(indexedBeach.getIndex()!.array),
      ).setTranslation(island.x, 0, island.z),
    );
    indexedBeach.dispose();
    beach.dispose();
  }
  world.step();
  return world;
}

test("colisor coincide com a superfície visual e com as bordas orgânicas das duas ilhas", () => {
  const world = terrainWorld();
  try {
    for (const island of ISLANDS) {
      const geometry = islandGeometry(
        organicIslandShape(island.halfWidth, island.halfDepth, island.seed),
      );
      const mesh = new Mesh(geometry);
      mesh.position.set(island.x, ISLAND_BASE_Y, island.z);
      mesh.updateMatrixWorld();
      let checked = 0;
      for (
        let x = -island.halfWidth * 1.5;
        x <= island.halfWidth * 1.5;
        x += 0.7
      ) {
        for (
          let z = -island.halfDepth * 1.5;
          z <= island.halfDepth * 1.5;
          z += 0.7
        ) {
          const origin = { x: x + island.x, y: 5, z: z + island.z };
          const visible = new Raycaster(
            new Vector3(origin.x, origin.y, origin.z),
            new Vector3(0, -1, 0),
          ).intersectObject(mesh)[0];
          if (!visible) continue;
          const hit = world.castRay(
            new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }),
            6,
            true,
          );
          assert.ok(
            hit,
            `Solo visível sem colisão em ${origin.x}, ${origin.z}`,
          );
          assert.ok(Math.abs(5 - hit.timeOfImpact - visible.point.y) < 0.001);
          assert.ok(islandEdgeDistance(origin.x, origin.z) <= 0);
          checked++;
        }
      }
      assert.ok(checked > 100);
      geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
    }
  } finally {
    world.free();
  }
});

test("a faixa de praia é uma rampa visível e física até perto da água", () => {
  const world = terrainWorld();
  try {
    for (const island of ISLANDS) {
      const shape = organicIslandShape(
        island.halfWidth,
        island.halfDepth,
        island.seed,
      );
      const geometry = beachRampGeometry(shape, island.z);
      const mesh = new Mesh(geometry);
      mesh.position.set(island.x, 0, island.z);
      mesh.updateMatrixWorld();
      const first = shape
        .getPoints()
        .reduce((best, point) =>
          island.z > BRIDGE.z
            ? point.y < best.y
              ? point
              : best
            : point.y > best.y
              ? point
              : best,
        );
      const origin = new Vector3(
        island.x + first.x * 1.16,
        5,
        island.z - first.y * 1.16,
      );
      const visible = new Raycaster(origin, new Vector3(0, -1, 0))
        .intersectObject(mesh)
        .at(0);
      assert.ok(visible);
      const physical = world.castRay(
        new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }),
        6,
        true,
      );
      assert.ok(physical);
      const physicalY = origin.y - physical.timeOfImpact;
      assert.ok(Math.abs(physicalY - visible.point.y) < 0.002);
      assert.ok(physicalY > BEACH_SHORE_Y);
      assert.ok(physicalY < ISLAND_SURFACE_Y);
      geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
    }
  } finally {
    world.free();
  }
});

test("cápsulas repousam sobre o solo no nascimento, checkpoint e fora do antigo retângulo", () => {
  const world = terrainWorld();
  try {
    const positions = [false, true].flatMap((checkpoint) =>
      ([0, 1, 2] as const).map((id) => characterSpawn(id, checkpoint)),
    );
    for (const island of ISLANDS)
      positions.push({ x: island.halfWidth + 0.4, y: 3, z: island.z });
    const bodies = positions.map((p) => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, p.y, p.z)
          .lockRotations()
          .setGravityScale(1.5),
      );
      world.createCollider(
        RAPIER.ColliderDesc.capsule(
          CHARACTER_CAPSULE_HALF_HEIGHT,
          CHARACTER_CAPSULE_RADIUS,
        ),
        body,
      );
      return body;
    });
    for (let frame = 0; frame < 240; frame++) world.step();
    for (const body of bodies) {
      const feet =
        body.translation().y -
        CHARACTER_CAPSULE_HALF_HEIGHT -
        CHARACTER_CAPSULE_RADIUS;
      assert.ok(Math.abs(feet - ISLAND_SURFACE_Y) < 0.02, `Pés em y=${feet}`);
      assert.ok(Math.abs(body.linvel().y) < 0.01);
    }
  } finally {
    world.free();
  }
});

test("ponte tem piso nivelado com as ilhas e o vão não recebe solo invisível", () => {
  const world = terrainWorld();
  const ray = new RAPIER.Ray(
    { x: 0, y: 5, z: BRIDGE.z },
    { x: 0, y: -1, z: 0 },
  );
  try {
    assert.equal(world.castRay(ray, 10, true), null);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        BRIDGE.halfWidth,
        BRIDGE_COLLIDER_HALF_HEIGHT,
        BRIDGE.length / 2,
      ).setTranslation(
        0,
        ISLAND_SURFACE_Y + BRIDGE_ORIGIN_Y + BRIDGE_COLLIDER_CENTER_Y,
        BRIDGE.z,
      ),
    );
    world.step();
    const hit = world.castRay(ray, 10, true);
    assert.ok(hit);
    assert.ok(Math.abs(5 - hit.timeOfImpact - ISLAND_SURFACE_Y) < 0.001);
  } finally {
    world.free();
  }
});

test("ilhas ampliadas preservam as duas margens e o canal do rio", () => {
  assert.ok(ISLANDS[0].halfWidth >= 9);
  assert.ok(ISLANDS[1].halfWidth >= 10);
  assert.equal(
    safeGround(0, BRIDGE.z + BRIDGE.length / 2, false),
    true,
  );
  assert.equal(
    safeGround(0, BRIDGE.z - BRIDGE.length / 2, false),
    true,
  );
  assert.equal(safeGround(0, BRIDGE.z, false), false);
  assert.ok(waterDepth(0, BRIDGE.z, false) > 0.2);
});

test("navegação e âncoras usam a altura e o contorno real do terreno", () => {
  for (const anchor of Object.values(anchors).flat()) {
    assert.equal(anchor.y, ISLAND_SURFACE_Y);
    assert.equal(safeGround(anchor.x, anchor.z, false), true);
  }
  for (const island of ISLANDS) {
    assert.equal(waterDepth(island.halfWidth + 0.4, island.z, false), 0);
    assert.equal(safeGround(island.halfWidth + 0.4, island.z, false), true);
  }
  assert.equal(safeGround(0, BRIDGE.z, false), false);
  assert.equal(safeGround(0, BRIDGE.z, true), true);
  assert.equal(waterDepth(0, BRIDGE.z, true), 0);
  assert.equal(safeGround(30, 0, true), false);
});
