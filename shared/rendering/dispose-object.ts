import { Material, Texture, type Object3D, type BufferGeometry } from 'three';

/** Release resources owned by a subtree. Cached assets must mark userData.shared. */
export function disposeObject(root: Object3D) {
  const disposed = new Set<BufferGeometry | Material | Texture>();
  const release = (resource: BufferGeometry | Material | Texture) => {
    if (resource.userData.shared || disposed.has(resource)) return;
    disposed.add(resource);
    resource.dispose();
  };
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (mesh.geometry) release(mesh.geometry);
    for (const material of mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : []) {
      if (material.userData.shared) continue;
      for (const value of Object.values(material))
        if (value instanceof Texture) release(value);
      release(material);
    }
  });
}
