import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Material, Mesh, Object3D, Raycaster, Vector3 } from "three";
import { runtime, useGame } from "../state/store";

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

  useEffect(
    () => () => {
      for (const [mesh, entry] of faded.current) restoreMesh(mesh, entry, true);
      faded.current.clear();
      blocked.current.clear();
      occluders.current = [];
      occluderGroups.current.clear();
    },
    [],
  );

  useFrame(({ camera, scene }, delta) => {
    if (!running) return;
    const state = useGame.getState();
    const p = runtime.positions[state.puzzle.selected];
    const dt = Math.min(delta, 0.04);
    const pitch = state.reduced ? 0.43 : runtime.pitch;
    const distance = state.map === "phase4" ? 10 : 8;
    player.current.set(p.x, p.y + 0.55, p.z);
    look.current.lerp(player.current, 1 - Math.exp(-dt * 7));
    target.current.set(
      p.x + Math.sin(runtime.yaw) * distance,
      p.y + 2.1 + pitch * 5,
      p.z + Math.cos(runtime.yaw) * distance,
    );
    camera.position.lerp(
      target.current,
      1 - Math.exp(-dt * (state.reduced ? 10 : 5)),
    );
    camera.lookAt(look.current);

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
          if (!mesh.parent) {
            restoreMesh(mesh, entry, true);
            faded.current.delete(mesh);
          }
        }
        occluders.current = [];
        occluderGroups.current.clear();
        scene.traverse((object) => {
          if (
            object instanceof Mesh &&
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
      const toPlayer = view.current.subVectors(player.current, camera.position);
      const playerDistance = toPlayer.length();
      if (playerDistance > PLAYER_CLEARANCE) {
        raycaster.current.set(camera.position, toPlayer.normalize());
        occlusionHits.current.length = 0;
        raycaster.current.intersectObjects(
          occluders.current,
          false,
          occlusionHits.current,
        );
        for (const hit of occlusionHits.current) {
          if (hit.distance >= playerDistance - PLAYER_CLEARANCE) break;
          if (hit.object instanceof Mesh && visibleSolid(hit.object)) {
            const key =
              (hit.object.userData.cameraOcclusionGroup as
                string | undefined) ?? hit.object.uuid;
            const members = occluderGroups.current.get(key);
            if (members)
              members.forEach((member) => blocked.current.add(member));
            else blocked.current.add(hit.object);
          }
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
      entry.clearElapsed += dt;
      if (entry.clearElapsed < RESTORE_DELAY_SECONDS) continue;
      entry.restoreElapsed = Math.min(
        RESTORE_SECONDS,
        entry.restoreElapsed + dt,
      );
      const progress = entry.restoreElapsed / RESTORE_SECONDS;
      const eased = progress * progress * (3 - 2 * progress);
      const originals = materialList(entry.original);
      entry.faded.forEach((material, index) => {
        if (material === originals[index]) return;
        const snapshot = entry.snapshots[index];
        material.opacity =
          OCCLUDER_OPACITY + (snapshot.opacity - OCCLUDER_OPACITY) * eased;
      });
      if (progress >= 1) {
        restoreMesh(mesh, entry);
      }
    }
  });
  return null;
}
