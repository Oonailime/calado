import { InstancedMesh, Matrix4, Mesh } from "three";

type DetachedInstance = {
  source: InstancedMesh;
  index: number;
  matrix: Matrix4;
  active: boolean;
};

/** Temporarily draw only an obstructing instance separately from its batch. */
export class InstanceOcclusion {
  readonly proxies = new Map<Mesh, DetachedInstance>();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);

  get(source: InstancedMesh, index: number) {
    for (const [proxy, entry] of this.proxies) {
      if (entry.source === source && entry.index === index) {
        if (!entry.active) {
          source.setMatrixAt(index, this.hidden);
          source.instanceMatrix.needsUpdate = true;
          proxy.visible = true;
          entry.active = true;
        }
        return proxy;
      }
    }
    const matrix = new Matrix4();
    source.getMatrixAt(index, matrix);
    const proxy = new Mesh(source.geometry, source.material);
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(matrix);
    proxy.matrixWorldNeedsUpdate = true;
    proxy.castShadow = source.castShadow;
    proxy.receiveShadow = source.receiveShadow;
    proxy.userData.cameraOcclusionProxy = true;
    if (source.instanceColor) {
      // Preserve per-instance tint when drawing outside the instanced batch.
      const originals = Array.isArray(source.material)
        ? source.material
        : [source.material];
      const tinted = originals.map((original) => {
        const material = original.clone();
        if ("color" in material) {
          const color = material.color as import("three").Color;
          const tint = color.clone();
          source.getColorAt(index, tint);
          color.multiply(tint);
        }
        return material;
      });
      proxy.material = Array.isArray(source.material) ? tinted : tinted[0];
    }
    source.add(proxy);
    proxy.updateWorldMatrix(true, false);
    source.setMatrixAt(index, this.hidden);
    source.instanceMatrix.needsUpdate = true;
    this.proxies.set(proxy, { source, index, matrix, active: true });
    return proxy;
  }

  suspend(proxy: Mesh) {
    const entry = this.proxies.get(proxy);
    if (!entry || !entry.active) return;
    entry.source.setMatrixAt(entry.index, entry.matrix);
    entry.source.instanceMatrix.needsUpdate = true;
    proxy.visible = false;
    entry.active = false;
  }

  restore(proxy: Mesh) {
    const entry = this.proxies.get(proxy);
    if (!entry) return;
    this.suspend(proxy);
    proxy.removeFromParent();
    if (entry.source.instanceColor) {
      const materials = Array.isArray(proxy.material)
        ? proxy.material
        : [proxy.material];
      materials.forEach((material) => material.dispose());
    }
    // Geometry and textures belong to the original batch and stay alive.
    this.proxies.delete(proxy);
  }
}
