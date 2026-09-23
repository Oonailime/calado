import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "three";
import { runtime, useGame } from "../state/store";
import { ZOOM_MIN } from "../controls/useControls";
import { PHASE_FOUR_PLATFORMS } from "../world/phaseFourLayout";
import { occlusionRaycast } from "./occlusionRaycast";
import { InstanceOcclusion } from "./instanceOcclusion";
import { PHASE_TWO_TABLE, phaseTwoGroundHeight } from "../world/phaseTwoLayout";
import { phase2Chess } from "../world/phase2Chess";

const SHRINE_FOCUS = PHASE_FOUR_PLATFORMS.find(
  (deck) => deck.id === "summit-shrine",
)!.center;

// The volcanic map's camera fades between the standard close, character-
// hugging framing every other map uses (at minimum zoom, so scrolling all
// the way in reads the same as any other map) and its own wide, pulled-back
// valley framing (at rest and beyond, where scrolling out already composes
// the whole scene correctly and is left untouched).
const STANDARD_HEIGHT = 0.55;
const STANDARD_DISTANCE = 8;
const STANDARD_RISE_BASE = 2.1;
const PHASE2_HEIGHT = 6;
const PHASE2_DISTANCE = 28;
const PHASE2_RISE_BASE = 5;
const PHASE2_PULL_BACK = 14;

const OCCLUDER_OPACITY = 0.16;
const PLAYER_CLEARANCE = 0.35;
const OCCLUSION_SAMPLE_SECONDS = 0.06;
const OCCLUDER_CACHE_SECONDS = 0.5;
const RESTORE_DELAY_SECONDS = 0.08;
const RESTORE_SECONDS = 0.24;

type MaterialSnapshot = {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

type FadeEntry = {
  original: Material | Material[];
  faded: Material[];
  snapshots: MaterialSnapshot[];
  active: boolean;
  clearElapsed: number;
  restoreElapsed: number;
};

function visibleSolid(mesh: Mesh) {
  if (!mesh.visible) return false;
  let parent: Object3D | null = mesh;
  while (parent) {
    if (!parent.visible || parent.userData.cameraOccluder === false)
      return false;
    const name = parent.name.toLowerCase();
    if (
      name.startsWith("character") ||
      name.includes("water") ||
      name.includes("spray") ||
      name.includes("swingingvine")
    )
      return false;
    parent = parent.parent;
  }
  return true;
}

function materialList(material: Material | Material[]) {
  return Array.isArray(material) ? material : [material];
}

function canFade(material: Material) {
  return (
    !material.transparent &&
    material.opacity >= 0.99 &&
    material.type !== "MeshBasicMaterial"
  );
}

function fadeMesh(mesh: Mesh): FadeEntry | undefined {
  const original = mesh.material;
  const originals = materialList(original);
  const snapshots = originals.map((material) => ({
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  }));
  if (!originals.some(canFade)) return undefined;
  const faded = originals.map((material) => {
    if (!canFade(material)) return material;
    const clone = material.clone();
    clone.opacity = OCCLUDER_OPACITY;
    clone.transparent = true;
    clone.depthWrite = false;
    clone.needsUpdate = true;
    return clone;
  });
  mesh.material = Array.isArray(original) ? faded : faded[0];
  return {
    original,
    faded,
    snapshots,
    active: true,
    clearElapsed: 0,
    restoreElapsed: 0,
  };
}

function activateFade(mesh: Mesh, entry: FadeEntry) {
  mesh.material = Array.isArray(entry.original) ? entry.faded : entry.faded[0];
  entry.active = true;
  entry.clearElapsed = 0;
  entry.restoreElapsed = 0;
}

function restoreMesh(mesh: Mesh, entry: FadeEntry, dispose = false) {
  mesh.material = entry.original;
  const originals = materialList(entry.original);
  entry.faded.forEach((material, index) => {
    if (dispose && material !== originals[index]) material.dispose();
  });
  entry.active = false;
}

function advanceRestore(mesh: Mesh, entry: FadeEntry, dt: number) {
  entry.clearElapsed += dt;
  if (entry.clearElapsed < RESTORE_DELAY_SECONDS) return;
  entry.restoreElapsed = Math.min(RESTORE_SECONDS, entry.restoreElapsed + dt);
  const progress = entry.restoreElapsed / RESTORE_SECONDS;
  const eased = progress * progress * (3 - 2 * progress);
  const originals = materialList(entry.original);
  entry.faded.forEach((material, index) => {
    if (material === originals[index]) return;
    const snapshot = entry.snapshots[index];
    material.opacity =
      OCCLUDER_OPACITY + (snapshot.opacity - OCCLUDER_OPACITY) * eased;
  });
  if (progress >= 1) restoreMesh(mesh, entry);
}

export default function FollowCamera({ running }: { running: boolean }) {
  const look = useRef(new Vector3(0, 0.9, 3));
  const target = useRef(new Vector3());
  const player = useRef(new Vector3());
  const view = useRef(new Vector3());
  const raycaster = useRef(new Raycaster());
  const occlusionHits = useRef<ReturnType<Raycaster["intersectObjects"]>>([]);
  const sampleElapsed = useRef(OCCLUSION_SAMPLE_SECONDS);
  const occluderCacheElapsed = useRef(OCCLUDER_CACHE_SECONDS);
  const occluders = useRef<Mesh[]>([]);
  const occluderGroups = useRef(new Map<string, Mesh[]>());
  const blocked = useRef(new Set<Mesh>());
  const faded = useRef(new Map<Mesh, FadeEntry>());
  const instances = useRef(new InstanceOcclusion());
  const rayTargets = useRef<Mesh[]>([]);

  useEffect(
    () => () => {
      for (const [mesh, entry] of faded.current) restoreMesh(mesh, entry, true);
      faded.current.clear();
      for (const proxy of instances.current.proxies.keys())
        instances.current.restore(proxy);
      blocked.current.clear();
      occluders.current = [];
      occluderGroups.current.clear();
    },
    [],
  );

  useFrame(({ camera, scene, size }, delta) => {
    if (!running) return;
    const state = useGame.getState();
    const dt = Math.min(delta, 0.04);
    const pitch = runtime.chessActive ? 0.5 : state.reduced ? 0.43 : runtime.pitch;
    // While the shrine's puzzle overlay is open, frame the cube itself
    // instead of the selected character — same orbit math, tighter distance.
    const focusingCube = state.cubePuzzleOpen;
    const focusingChess = state.map === "phase2" && phase2Chess.getSnapshot().mode !== "idle";
    if (camera instanceof PerspectiveCamera) {
      // Leave the right-hand tab clear while retaining the animated board
      // in the visible portion of the map. Clear the offset on exit.
      if (focusingChess && size.width > 760)
        camera.setViewOffset(size.width, size.height, Math.min(420, size.width * 0.92) / 2, 0, size.width, size.height);
      else if (camera.view?.enabled) camera.clearViewOffset();
    }
    // Left at 1x while focusing the shrine — that view keeps its own fixed,
    // deliberately tight distance regardless of the player's zoom setting.
    const zoom = focusingCube || focusingChess ? 1 : runtime.zoom;
    // 0 at minimum zoom (matches every other map's close framing exactly),
    // 1 at rest and beyond (the volcanic map's own wide valley framing,
    // scaled up further by `zoom` below exactly as before).
    const phase2Blend =
      state.map === "phase2"
        ? Math.min(1, Math.max(0, (zoom - ZOOM_MIN) / (1 - ZOOM_MIN)))
        : 0;
    const p = focusingCube
      ? { x: SHRINE_FOCUS[0], y: SHRINE_FOCUS[1] + 1.85, z: SHRINE_FOCUS[2] }
      : focusingChess
        ? { x: PHASE_TWO_TABLE[0], y: phaseTwoGroundHeight(...PHASE_TWO_TABLE) + 0.69, z: PHASE_TWO_TABLE[1] }
      : runtime.positions[state.puzzle.selected];
    const height = focusingCube
      ? 0
      : focusingChess
        ? 0
      : state.map === "phase2"
        ? STANDARD_HEIGHT + (PHASE2_HEIGHT - STANDARD_HEIGHT) * phase2Blend
        : 0.55;
    const distanceBase = focusingCube
      ? 3.6
      : focusingChess
        ? 1.25
      : state.map === "phase2"
        ? STANDARD_DISTANCE + (PHASE2_DISTANCE - STANDARD_DISTANCE) * phase2Blend
        : state.map === "phase3"
          ? 10
          : 8;
    const distance = distanceBase * zoom;
    player.current.set(p.x, p.y + height, p.z);
    if (state.map === "phase2" && !focusingChess) {
      const pull = PHASE2_PULL_BACK * phase2Blend;
      player.current.x -= Math.sin(runtime.yaw) * pull;
      player.current.z -= Math.cos(runtime.yaw) * pull;
    }
    look.current.lerp(player.current, 1 - Math.exp(-dt * 7));
    const riseBase = focusingCube
      ? 0.9
      : focusingChess
        ? 0.25
      : state.map === "phase2"
        ? STANDARD_RISE_BASE + (PHASE2_RISE_BASE - STANDARD_RISE_BASE) * phase2Blend
        : 2.1;
    const rise = (riseBase + pitch * (focusingCube ? 2 : 5)) * zoom;
    target.current.set(
      p.x + Math.sin(runtime.yaw) * distance,
      p.y + height + rise,
      p.z + Math.cos(runtime.yaw) * distance,
    );
    if (focusingChess) target.current.set(p.x, p.y + 2.6, p.z + (phase2Chess.getSnapshot().playerColor === "w" ? -1.25 : 1.25));
    camera.position.lerp(
      target.current,
      1 - Math.exp(-dt * (state.reduced ? 10 : 5)),
    );
    camera.lookAt(look.current);
    // Occlusion still targets the character when the volcanic camera frames the valley.
    if (state.map === "phase2") player.current.set(p.x, p.y + 0.55, p.z);

    // The occlusion system below fades anything between the camera and
    // `player.current` — meant for trees blocking the character. While
    // focusing the shrine, that same point sits inside/behind the cube and
    // pedestal, which were getting faded as if they were occluders blocking
    // a (nonexistent) character standing there. Skip it entirely and make
    // sure nothing is left stuck translucent from before the overlay opened.
    if (focusingCube) {
      for (const [mesh, entry] of faded.current)
        if (entry.active) restoreMesh(mesh, entry, true);
      faded.current.clear();
      blocked.current.clear();
      return;
    }

    // Phase 2 uses a pulled-back valley camera and deliberately excludes its
    // large merged terrain/tree meshes from camera occlusion. Keeping the
    // remaining chess/lantern meshes in the raycast path still makes every
    // character switch resample the scene and can synchronously compile a
    // transparent material when one of them is hit. There is no useful
    // character-sized foliage to fade on this map, so skip the whole pass and
    // release state left by another map before returning.
    if (state.map === "phase2") {
      for (const [mesh, entry] of faded.current)
        if (entry.active) restoreMesh(mesh, entry, true);
      faded.current.clear();
      blocked.current.clear();
      for (const proxy of instances.current.proxies.keys())
        instances.current.restore(proxy);
      return;
    }

    sampleElapsed.current += dt;
    if (sampleElapsed.current >= OCCLUSION_SAMPLE_SECONDS) {
      sampleElapsed.current = 0;
      occluderCacheElapsed.current += OCCLUSION_SAMPLE_SECONDS;
      if (
        occluderCacheElapsed.current >= OCCLUDER_CACHE_SECONDS ||
        occluders.current.length === 0
      ) {
        occluderCacheElapsed.current = 0;
        for (const [mesh, entry] of faded.current) {
          // Map changes remove and dispose old meshes while the camera stays
          // mounted. Drop those cached materials before the next raycast.
          let ancestor: Object3D | null = mesh;
          while (ancestor && ancestor !== scene) ancestor = ancestor.parent;
          if (!ancestor) {
            restoreMesh(mesh, entry, true);
            instances.current.restore(mesh);
            faded.current.delete(mesh);
          }
        }
        occluders.current = [];
        occluderGroups.current.clear();
        scene.traverse((object) => {
          if (
            object instanceof Mesh &&
            !object.userData.cameraOcclusionProxy &&
            visibleSolid(object) &&
            (faded.current.has(object) ||
              materialList(object.material).some(canFade))
          ) {
            occluders.current.push(object);
            const key =
              (object.userData.cameraOcclusionGroup as string | undefined) ??
              object.uuid;
            const members = occluderGroups.current.get(key) ?? [];
            members.push(object);
            occluderGroups.current.set(key, members);
          }
        });
      }
      blocked.current.clear();
      rayTargets.current.length = 0;
      rayTargets.current.push(...occluders.current);
      for (const proxy of instances.current.proxies.keys()) {
        if (proxy.visible) rayTargets.current.push(proxy);
      }
      occlusionRaycast(
        raycaster.current,
        camera.position,
        player.current,
        PLAYER_CLEARANCE,
        rayTargets.current,
        occlusionHits.current,
        view.current,
      );
      for (const hit of occlusionHits.current) {
        if (hit.distance >= raycaster.current.far) break;
        if (hit.object instanceof Mesh && visibleSolid(hit.object)) {
          if (
            hit.object instanceof InstancedMesh &&
            hit.instanceId !== undefined
          ) {
            blocked.current.add(
              instances.current.get(hit.object, hit.instanceId),
            );
            continue;
          }
          if (hit.object.userData.cameraOcclusionProxy) {
            blocked.current.add(hit.object);
            continue;
          }
          const key =
            (hit.object.userData.cameraOcclusionGroup as string | undefined) ??
            hit.object.uuid;
          const members = occluderGroups.current.get(key);
          if (members) members.forEach((member) => blocked.current.add(member));
          else blocked.current.add(hit.object);
        }
      }
    }

    for (const mesh of blocked.current) {
      if (!mesh.visible) continue;
      let entry = faded.current.get(mesh);
      if (!entry) {
        entry = fadeMesh(mesh);
        if (entry) faded.current.set(mesh, entry);
      }
      if (!entry) continue;
      if (!entry.active) activateFade(mesh, entry);
      const originals = materialList(entry.original);
      entry.faded.forEach((material, index) => {
        if (material !== originals[index]) {
          material.opacity = OCCLUDER_OPACITY;
          material.transparent = true;
          material.depthWrite = false;
        }
      });
    }

    for (const [mesh, entry] of faded.current) {
      if (!entry.active) continue;
      if (blocked.current.has(mesh)) continue;
      advanceRestore(mesh, entry, dt);
      if (!entry.active && instances.current.proxies.has(mesh)) {
        // Retain the transparent material for the next pass by this tree.
        instances.current.suspend(mesh);
      }
    }
  });
  return null;
}
