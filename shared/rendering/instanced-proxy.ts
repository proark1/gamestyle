import * as T from 'three';

type Slot = { source: T.Mesh; instance: T.InstancedMesh; index: number };

/** Draws many copies of one small model as a handful of instanced draw calls.
 *
 *  The source groups stay in the scene untouched, so animation, raycasting and
 *  userData all keep working: only rendering is taken over. Their meshes are
 *  hidden, which the renderer honours and the raycaster ignores, and each one's
 *  world matrix is copied into an instance every frame.
 *
 *  Callers must toggle visibility on groups rather than on the leaf meshes
 *  handed over here; a hidden leaf is how this class marks its own. */
export class InstancedProxy {
  private slots: Slot[] = [];
  private roots: T.Object3D[] = [];
  private instances: T.InstancedMesh[] = [];
  private hidden = new T.Matrix4().makeScale(0, 0, 0);

  constructor(private root: T.Object3D) {}

  /** Groups must already be built and share model shape; call once. */
  adopt(groups: T.Object3D[]) {
    this.roots = groups;
    const buckets = new Map<string, T.Mesh[]>();
    for (const group of groups)
      group.traverse((object) => {
        if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh)
          return;
        if (Array.isArray(object.material)) return;
        const key = [
          object.geometry.uuid,
          object.material.uuid,
          object.castShadow,
          object.receiveShadow,
          object.renderOrder,
        ].join('|');
        const bucket = buckets.get(key) ?? [];
        bucket.push(object);
        buckets.set(key, bucket);
      });
    for (const sources of buckets.values()) {
      const first = sources[0];
      const instance = new T.InstancedMesh(
        first.geometry,
        first.material,
        sources.length,
      );
      instance.castShadow = first.castShadow;
      instance.receiveShadow = first.receiveShadow;
      instance.renderOrder = first.renderOrder;
      // Instances span the whole herd, so the shared bounds cannot be culled
      // per copy without hiding copies that are still on screen.
      instance.frustumCulled = false;
      instance.instanceMatrix.setUsage(T.DynamicDrawUsage);
      sources.forEach((source, index) => {
        source.visible = false;
        source.userData.instanced = true;
        this.slots.push({ source, instance, index });
      });
      this.instances.push(instance);
      this.root.add(instance);
    }
    this.update();
  }

  /** A leaf is hidden by this class, so its own flag is not the answer. */
  private shown(mesh: T.Mesh) {
    for (let node = mesh.parent; node; node = node.parent)
      if (!node.visible) return false;
    return true;
  }

  /** Run after the frame's animation and before rendering. */
  update() {
    // Only the adopted subtrees need fresh matrices; forcing the whole scene
    // would cost more than the draw calls this saves.
    for (const root of this.roots) root.updateWorldMatrix(true, true);
    const live = new Map<T.InstancedMesh, number>();
    for (const { source, instance, index } of this.slots) {
      const shown = this.shown(source);
      instance.setMatrixAt(index, shown ? source.matrixWorld : this.hidden);
      if (shown) live.set(instance, (live.get(instance) ?? 0) + 1);
    }
    for (const instance of this.instances) {
      // A bucket whose copies are all hidden would still cost a draw call.
      instance.visible = (live.get(instance) ?? 0) > 0;
      instance.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const instance of this.instances) {
      instance.removeFromParent();
      instance.dispose();
    }
    for (const { source } of this.slots) {
      source.visible = true;
      delete source.userData.instanced;
    }
    this.instances = [];
    this.slots = [];
    this.roots = [];
  }
}
