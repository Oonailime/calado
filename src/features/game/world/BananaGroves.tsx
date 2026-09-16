import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  Box3,
  Group,
  Mesh,
  Vector3,
  type Material,
  type MeshPhongMaterial,
  type MeshStandardMaterial,
} from "three";
import { anchors } from "../state/rules";
import { ISLAND_SURFACE_Y } from "./layout";

// The source FBX's leaf material comes in shiny (plastic-looking under this
// scene's directional light) — flatten whatever specular/metalness property
// it has, whether it loaded as Phong or Standard, instead of a glossy shine.
function dullMaterial(material: Material) {
  const standard = material as Partial<MeshStandardMaterial>;
  if (standard.metalness !== undefined) standard.metalness = 0;
  if (standard.roughness !== undefined) standard.roughness = 1;
  const phong = material as Partial<MeshPhongMaterial>;
  if (phong.shininess !== undefined) phong.shininess = 4;
  standard.emissive?.set("#000000");
}

export const BANANA_PLANT_URL = "/assets/models/banana/PlantWithBananas.fbx";
export const BANANA_MODEL_URL = "/assets/models/banana/banana.glb";
export const BANANA_PLANT_HEIGHT = 3.2;

function preparePlant(template: Group) {
  const plant = template.clone(true) as Group;
  const bounds = new Box3().setFromObject(plant);
  const size = new Vector3();
  bounds.getSize(size);
  const scale = size.y > 0 ? BANANA_PLANT_HEIGHT / size.y : 1;
  plant.scale.setScalar(scale);
  plant.position.y = -bounds.min.y * scale;
  plant.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh;
      // Shared source geometry: compute once, before the first camera ray.
      // Leaf bounds reject empty space without visiting every triangle.
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        dullMaterial,
      );
    }
  });
  return plant;
}

export default function BananaGroves() {
  const { gl, camera, scene } = useThree();
  const plantSource = useLoader(FBXLoader, BANANA_PLANT_URL);
  const plants = useMemo(
    () => anchors.bananas.map(() => preparePlant(plantSource)),
    [plantSource],
  );

  useEffect(() => {
    // Compile the exact transparent variant ahead of the first obstruction.
    // This group is never rendered; geometry/textures remain shared with FBX.
    const warmup = new Group();
    const materials = new Map<Material, Material>();
    plants[0]?.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const originals: Material[] = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const variants = originals.map((original) => {
        let material = materials.get(original);
        if (!material) {
          material = original.clone();
          if (
            !material.transparent &&
            material.opacity >= 0.99 &&
            material.type !== "MeshBasicMaterial"
          ) {
            material.transparent = true;
            material.opacity = 0.16;
            material.depthWrite = false;
          }
          materials.set(original, material);
        }
        return material;
      });
      const mesh = new Mesh(
        child.geometry,
        Array.isArray(child.material) ? variants : variants[0],
      );
      mesh.castShadow = child.castShadow;
      mesh.receiveShadow = child.receiveShadow;
      warmup.add(mesh);
    });
    let disposed = false;
    let complete = false;
    const release = () => materials.forEach((material) => material.dispose());
    void gl
      .compileAsync(warmup, camera, scene)
      .catch(() => {
        // Normal rendering can compile on demand if warmup is unavailable.
      })
      .finally(() => {
        complete = true;
        if (disposed) release();
      });
    return () => {
      disposed = true;
      if (complete) release();
    };
  }, [plants, gl, camera, scene]);

  return (
    <>
      {anchors.bananas.map((spot, index) => (
        <group
          key={`${spot.x}:${spot.z}`}
          position={[spot.x, ISLAND_SURFACE_Y, spot.z]}
        >
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1.15, 0.38]} position={[0, 1.15, 0]} />
          </RigidBody>
          <primitive object={plants[index]} dispose={null} />
        </group>
      ))}
    </>
  );
}
