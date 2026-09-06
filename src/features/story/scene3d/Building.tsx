import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, MeshStandardMaterial, type Mesh } from "three";
import {
  BUILDING_DIR,
  BUILDINGS,
  BUILDING_LABELS,
  PLANTER_URL,
  buildingIndex,
  type BuildingId,
} from "./buildings";
import { PATH_POINTS, houseYaw, houseDoorOpenness } from "./cameraRig";
import { letteringTexture } from "./signage";
import type { Locale } from "@/content/story";

const DOOR_OPEN_ANGLE = -Math.PI * 0.38;
const DOOR_DEPTH_SCALE = 0.4;
// Clearly proud of the wall's own outer surface (house front maxes out at
// ~1.17) instead of flush with it — flush left it sitting behind/inside the
// solid wall body, invisible regardless of rotation.
const DOOR_WALL_OFFSET = 1.09;
// The hinge sits at the door's own edge, placed near the house's actual
// corner (house half-width ~1.0) rather than centered on the wall.
const DOOR_CORNER_X = -0.95;
// A fixed dark-wood tone rather than the kit's own baked texture, which
// reads as barely distinguishable from a same-colored wall (e.g. the
// orange-on-orange school house) — a door needs to read as a door.
const DOOR_MATERIAL = new MeshStandardMaterial({
  color: "#3c2a18",
  roughness: 0.85,
});

function shadowed(object: import("three").Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      (child as Mesh).castShadow = true;
      (child as Mesh).receiveShadow = true;
    }
  });
  return object;
}

// A modular snap-together kit: House/Roof/Door/Window of the same part
// number share one local origin, so composing a building is just stacking
// all four GLBs at the same transform — no per-part offsets to hand-tune.
// The whole group is then rotated so the door (the kit's local +Z face)
// points back toward the point the character arrives from. The door itself
// is pulled out into its own hinge pivot so it can swing open on approach.
export default function Building({
  id,
  progress,
  reduced,
  locale,
}: {
  id: BuildingId;
  progress: number;
  reduced: boolean;
  locale: Locale;
}) {
  const parts = BUILDINGS[id];
  const gltfs = useLoader(GLTFLoader, [
    BUILDING_DIR + parts.house,
    BUILDING_DIR + parts.roof,
    BUILDING_DIR + parts.door,
    BUILDING_DIR + parts.window,
    PLANTER_URL,
  ]);
  const fixed = useMemo(() => {
    const built = new Group();
    // Roof02_Blue.glb and the planter are shared across buildings, so each
    // Building needs its own clone rather than reparenting the same
    // Object3D (a scene graph node can only live in one place at a time).
    const house = shadowed(gltfs[0].scene.clone(true));
    const roof = shadowed(gltfs[1].scene.clone(true));
    const window_ = shadowed(gltfs[3].scene.clone(true));
    const planter = shadowed(gltfs[4].scene.clone(true));
    planter.position.set(0.95, 0, 1.35);
    built.add(house, roof, window_, planter);
    return built;
  }, [gltfs]);
  const doorPivot = useMemo(() => {
    const clone = shadowed(gltfs[2].scene.clone(true));
    let mesh: Mesh | undefined;
    clone.traverse((child) => {
      if (!mesh && (child as Mesh).isMesh) mesh = child as Mesh;
    });
    if (mesh) {
      // This kit's door mesh sits well inside the house body — its own local
      // Z only reaches ~0.63 while the house's front wall is at ~1.17 —
      // rather than flush with the wall (confirmed against the real
      // bounding boxes, not assumed). Baking the mesh's world matrix into a
      // fresh geometry first (same technique as Vegetation.tsx) makes the
      // rest exact regardless of how the source hierarchy nested transforms.
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometry.computeBoundingBox();
      const doorBox = geometry.boundingBox;
      const outwardZ = doorBox ? doorBox.min.z : 0;
      const leftX = doorBox ? doorBox.min.x : 0;
      // Zero both the outward-facing surface and the left edge onto the
      // origin: scaling Z then compresses the exaggerated depth (this kit
      // merges frame + panel into one mesh) toward that face instead of the
      // geometry's arbitrary center, and — critically — the left edge
      // becomes the hinge sitting exactly at (0,0,0), the pivot's own
      // rotation center below. The wall offset belongs on the pivot's own
      // position, not baked into the geometry — putting it here instead
      // dragged the hinge itself away from the rotation center, making the
      // door swing like it was tracing a wide circle's rim instead of a
      // radius fixed at one end.
      geometry.translate(-leftX, 0, -outwardZ);
      geometry.scale(1, 1, DOOR_DEPTH_SCALE);
      mesh.geometry = geometry;
      mesh.material = DOOR_MATERIAL;
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
    }
    const pivot = new Group();
    // The rotation center itself: near the house's corner, pushed proud of
    // the wall's outer surface. The door mesh's hinge edge sits exactly
    // here (baked to local origin above), so it swings out like a radius
    // fixed at this point instead of orbiting around it at a distance.
    pivot.position.set(DOOR_CORNER_X, 0, DOOR_WALL_OFFSET);
    pivot.add(clone);
    return pivot;
  }, [gltfs]);
  const index = buildingIndex(id);
  const point = PATH_POINTS[index];
  const doorRef = useRef<Group>(null);
  useFrame(() => {
    if (!doorRef.current) return;
    const openness = houseDoorOpenness(index, progress, reduced);
    doorRef.current.rotation.y = DOOR_OPEN_ANGLE * openness;
  });
  return (
    <group position={[point.x, 0, point.z]} rotation={[0, houseYaw(index), 0]}>
      <primitive object={fixed} />
      <primitive ref={doorRef} object={doorPivot} />
      {/* Transparent lettering integrated into the +Z entrance facade. */}
      <mesh position={[0, 1.5, 1.19]}>
        <planeGeometry args={[0.82, 0.24]} />
        <meshBasicMaterial
          map={letteringTexture(BUILDING_LABELS[id][locale])}
          transparent
          alphaTest={0.02}
        />
      </mesh>
    </group>
  );
}
