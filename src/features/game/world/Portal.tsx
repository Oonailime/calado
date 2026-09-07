import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Box3, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PORTAL } from "./layout";
import {
  advancePortalConstruction,
  portalConstructionScale,
} from "./portalAnimation";

export const PORTAL_MODEL_URL = "/assets/models/portal/zen-portal.glb";

function preparePortal(gltf: GLTF) {
  const scene = gltf.scene.clone(true);
  scene.rotation.x = -Math.PI / 2;
  scene.updateMatrixWorld(true);

  const bounds = new Box3().setFromObject(scene);
  const center = bounds.getCenter(new Vector3());
  // The source asset uses Z-up. After rotating it to Y-up, center it on the
  // horizontal plane and move its lowest vertex exactly onto the local floor.
  scene.position.set(-center.x, -bounds.min.y, -center.z);

  scene.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    const helper = mesh.name.endsWith("Anchor");
    const translucent =
      mesh.name === "PortalSurface" || mesh.name === "PortalGelHighlights";
    mesh.visible = !helper;
    mesh.castShadow = !helper && !translucent && !mesh.name.startsWith("Grass");
    mesh.receiveShadow = !helper && !translucent;
  });
  return scene;
}

export default function Portal({
  gltf,
  built,
  running,
  reduced,
}: {
  gltf: GLTF;
  built: boolean;
  running: boolean;
  reduced: boolean;
}) {
  const model = useMemo(() => preparePortal(gltf), [gltf]);
  const assembly = useRef<Group>(null);
  const aura = useRef<Mesh>(null);
  const construction = useRef(built ? 1 : 0);
  const previousBuilt = useRef(built);

  useEffect(() => {
    if (built !== previousBuilt.current) {
      construction.current = built && reduced ? 1 : 0;
      previousBuilt.current = built;
    }
  }, [built, reduced]);

  useFrame(({ clock }, delta) => {
    construction.current = advancePortalConstruction(
      construction.current,
      delta,
      built,
      running,
      reduced,
    );
    const progress = construction.current;
    const scale = portalConstructionScale(progress);
    if (assembly.current) {
      assembly.current.visible = built;
      assembly.current.scale.set(
        scale.horizontal,
        scale.vertical,
        scale.horizontal,
      );
    }
    if (aura.current) {
      const material = aura.current.material as MeshBasicMaterial;
      const constructing = built && progress < 1;
      aura.current.visible = constructing;
      aura.current.rotation.z = clock.elapsedTime * 0.7;
      aura.current.scale.setScalar(0.85 + progress * 0.35);
      material.opacity = constructing ? 0.55 * (1 - progress) : 0;
    }
  });

  return (
    <group position={[PORTAL.x, 0, PORTAL.z]}>
      {built && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.48, 1.9, 0.48]} position={[-1.55, 1.9, 0]} />
          <CuboidCollider args={[0.48, 1.9, 0.48]} position={[1.55, 1.9, 0]} />
        </RigidBody>
      )}
      <group ref={assembly} visible={built}>
        <primitive object={model} />
      </group>
      <mesh ref={aura} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[2.45, 2.62, 64]} />
        <meshBasicMaterial
          color="#6cf3ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
