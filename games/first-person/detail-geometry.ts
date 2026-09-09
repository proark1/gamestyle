import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type XYZ = [number, number, number];
export function mesh(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  material: T.Material,
  position: XYZ = [0, 0, 0],
) {
  const m = new T.Mesh(geometry, material);
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function rounded(
  parent: T.Object3D,
  size: XYZ,
  position: XYZ,
  material: T.Material,
  radius = 0.025,
) {
  return mesh(
    parent,
    new RoundedBoxGeometry(
      ...size,
      Math.min(...size) < 0.07 ? 1 : 2,
      Math.min(radius, Math.min(...size) / 2),
    ),
    material,
    position,
  );
}
export function cyl(
  parent: T.Object3D,
  top: number,
  bottom: number,
  height: number,
  position: XYZ,
  material: T.Material,
  segments = 24,
  open = false,
) {
  return mesh(
    parent,
    new T.CylinderGeometry(top, bottom, height, segments, 1, open),
    material,
    position,
  );
}
export function ellipsoid(
  parent: T.Object3D,
  size: XYZ,
  position: XYZ,
  material: T.Material,
) {
  const m = mesh(parent, new T.SphereGeometry(1, 16, 10), material, position);
  m.scale.set(...size);
  return m;
}
export function ring(
  parent: T.Object3D,
  radius: number,
  tube: number,
  position: XYZ,
  material: T.Material,
  arc = Math.PI * 2,
) {
  return mesh(
    parent,
    new T.TorusGeometry(radius, tube, 8, 36, arc),
    material,
    position,
  );
}
export function rod(
  parent: T.Object3D,
  from: XYZ,
  to: XYZ,
  radius: number,
  material: T.Material,
  endRadius = radius,
) {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to),
    center = a.clone().add(b).multiplyScalar(0.5);
  const m = cyl(
    parent,
    endRadius,
    radius,
    a.distanceTo(b),
    [center.x, center.y, center.z],
    material,
    12,
  );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
}
export function tube(
  parent: T.Object3D,
  points: XYZ[],
  radius: number,
  material: T.Material,
) {
  return mesh(
    parent,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      Math.max(12, points.length * 3),
      radius,
      6,
      false,
    ),
    material,
  );
}
export function panel(
  parent: T.Object3D,
  corners: XYZ[],
  material: T.Material,
) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.Float32BufferAttribute(corners.flat(), 3),
  );
  geometry.setAttribute(
    'uv',
    new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

/** Bake only static model geometry. Materials remain shared and owned by the scene. */
export function bakeModel(group: T.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(),
    batches = new Map<T.Material, T.BufferGeometry[]>();
  const originals = new Set<T.BufferGeometry>();
  group.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const g = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    g.applyMatrix4(
      new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
    );
    for (const key of Object.keys(g.attributes))
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    const batch = batches.get(object.material) ?? [];
    batch.push(g);
    batches.set(object.material, batch);
    originals.add(object.geometry);
  });
  group.clear();
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error('Detail model has incompatible geometry.');
    mesh(group, merged, material);
    for (const g of geometries) g.dispose();
  }
  for (const g of originals) g.dispose();
  return group;
}
