import { useMemo } from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Mesh, type Group } from "three";
import { anchors } from "../state/rules";
import { ISLAND_SURFACE_Y } from "./layout";

export const BRIDGE_STUMP_MODEL_URL = "/assets/models/bridge-stump/carved-stump.glb";
const STUMP_SCALE = 0.5;

export default function BridgeBuildStump({ template }: { template: Group }) {
  const model = useMemo(() => {
    const clone = template.clone(true);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [template]);

  return (
    <group
      position={[
        anchors.bridgeBuild.x,
        anchors.bridgeBuild.y - ISLAND_SURFACE_Y,
        anchors.bridgeBuild.z,
      ]}
      rotation={[0, -Math.PI / 2, 0]}
      name="bridge-build-stump"
    >
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[0.31 * STUMP_SCALE, 0.57 * STUMP_SCALE]}
          position={[0, 0.31 * STUMP_SCALE, 0]}
        />
      </RigidBody>
      <primitive object={model} scale={STUMP_SCALE} />
    </group>
  );
}
