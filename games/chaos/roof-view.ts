import * as T from 'three';
import type { Piece, Vec } from './model';
import { footprint } from './placement';

export function underRoof(roof: Piece, point: Vec, margin = 0.3) {
  if (roof.kind !== 'roof' || !roof.placed || roof.hoisted) return false;
  const b = footprint('roof', roof, roof.rotation);
  return (
    point.x >= b.minX - margin &&
    point.x <= b.maxX + margin &&
    point.z >= b.minZ - margin &&
    point.z <= b.maxZ + margin
  );
}

/** Isolate each roof's materials: shared tile colours must never fade other objects. */
export function prepareRoof(group: T.Group) {
  const meshes: T.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    mesh.material = (mesh.material as T.MeshStandardMaterial).clone();
    mesh.userData.ownedMaterial = true;
    const edges = new T.LineSegments(
      new T.EdgesGeometry(mesh.geometry, 35),
      new T.LineBasicMaterial({
        color: '#995139',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    edges.visible = false;
    mesh.add(edges);
    mesh.userData.roofEdges = edges;
  }
  group.userData.roofMeshes = meshes;
  group.userData.roofOpacity = 1;
}

export function fadeRoof(group: T.Group, faded: boolean, dt: number) {
  const previous = group.userData.roofOpacity ?? 1;
  const opacity = T.MathUtils.damp(previous, faded ? 0.17 : 1, 16, dt);
  group.userData.roofOpacity =
    Math.abs(opacity - (faded ? 0.17 : 1)) < 0.005
      ? faded
        ? 0.17
        : 1
      : opacity;
  const transparent = group.userData.roofOpacity < 0.995;
  for (const mesh of (group.userData.roofMeshes ?? []) as T.Mesh[]) {
    const material = mesh.material as T.MeshStandardMaterial;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = group.userData.roofOpacity;
    material.depthWrite = !transparent;
    mesh.castShadow = !transparent;
    (mesh.userData.roofEdges as T.LineSegments).visible = transparent;
  }
}
