import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, type Group } from "three";
import { anchors } from "../state/rules";

export const PADLOCK_MODEL_URL = "/assets/models/padlock/ornate-padlock.glb";

export default function Padlock({
  template,
  unlocked,
}: {
  template: Group;
  unlocked: boolean;
}) {
  const shackle = useRef<Group>(null);
  const model = useMemo(() => {
    const clone = template.clone(true);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return {
      body: clone.getObjectByName("OrnatePadlockBody")!,
      shackle: clone.getObjectByName("OrnatePadlockShackle")!,
    };
  }, [template]);
  useFrame((_, delta) => {
    if (!shackle.current) return;
    const t = 1 - Math.exp(-Math.min(delta, 0.05) * 7);
    const baseY = model.shackle.userData.closedY ?? 0.755;
    shackle.current.position.y +=
      (baseY + (unlocked ? 0.07 : 0) - shackle.current.position.y) * t;
    shackle.current.rotation.y +=
      ((unlocked ? -1.3 : 0) - shackle.current.rotation.y) * t;
  });
  return (
    <group
      name="island-padlock"
      position={[anchors.padlock.x, 0, anchors.padlock.z]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.75, 0.82, 40]} />
        <meshBasicMaterial
          color={unlocked ? "#8f9a86" : "#eac369"}
          transparent
          opacity={unlocked ? 0.3 : 0.55}
          depthWrite={false}
        />
      </mesh>
      <group name="OrnatePadlock" position={[0, 0.02, 0]}>
        <primitive object={model.body} />
        <primitive object={model.shackle} ref={shackle} />
      </group>
    </group>
  );
}
