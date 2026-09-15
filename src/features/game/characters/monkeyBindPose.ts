import { Bone, Matrix4, type Object3D, type SkinnedMesh } from "three";

/** Restore the actual skin bind pose, including a non-bone FBX scale parent. */
export function restoreMonkeyBindPose(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const bindWorld = new Map<Bone, Matrix4>();
  root.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.bones.forEach((bone, index) => {
      bindWorld.set(bone, mesh.skeleton.boneInverses[index].clone().invert());
    });
  });
  const local = new Matrix4();
  root.traverse((object) => {
    if (!(object instanceof Bone)) return;
    const bind = bindWorld.get(object);
    if (!bind) return;
    const parent = object.parent;
    const parentWorld =
      parent instanceof Bone
        ? (bindWorld.get(parent) ?? parent.matrixWorld)
        : parent?.matrixWorld;
    local.copy(bind);
    if (parentWorld)
      local.premultiply(new Matrix4().copy(parentWorld).invert());
    local.decompose(object.position, object.quaternion, object.scale);
  });
  root.updateWorldMatrix(true, true);
}
