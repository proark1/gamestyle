import { disposeGeometry } from './primitives';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Static scenery shares draw calls without changing visible geometry or raycasts.
 *  Anything still animated or toggled at runtime belongs in `keep`: merging it
 *  would flatten it into the batch and freeze it in place. */
export function batchScenery(
  root: T.Object3D,
  keep: T.Object3D[] = [],
  consolidateMaterials = false,
) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const excluded = new Set<T.Object3D>();
  for (const node of keep) node.traverse((o) => excluded.add(o));
  const batches = new Map<string, T.Mesh[]>();
  const materials = new Map<string, T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    if (excluded.has(object)) return;
    if (consolidateMaterials) {
      const {
        uuid: _uuid,
        metadata: _metadata,
        ...properties
      } = object.material.toJSON();
      const signature = JSON.stringify(properties);
      const material = materials.get(signature);
      if (material && material !== object.material) {
        if (!object.material.userData.shared) object.material.dispose();
        object.material = material;
      } else materials.set(signature, object.material);
    }
    const key = [
      object.material.uuid,
      object.castShadow,
      object.receiveShadow,
      !!object.userData.surface,
      !!object.geometry.index,
      Object.keys(object.geometry.attributes).sort().join(','),
    ].join(':');
    const batch = batches.get(key) ?? [];
    batch.push(object);
    batches.set(key, batch);
  });
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) =>
      mesh.geometry
        .clone()
        .applyMatrix4(
          new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
        ),
    );
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!geometry) continue;
    const first = meshes[0],
      merged = new T.Mesh(geometry, first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.userData.surface = first.userData.surface;
    root.add(merged);
    for (const mesh of meshes) {
      mesh.removeFromParent();
      disposeGeometry(mesh.geometry);
    }
  }
}
