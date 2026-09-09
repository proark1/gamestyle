import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Static scenery shares draw calls without changing visible geometry or raycasts. */
export function batchScenery(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, T.Mesh[]>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
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
      mesh.geometry.dispose();
    }
  }
}
