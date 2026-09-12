import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const materials = new Map<string, T.MeshStandardMaterial>();
const boxes = new Map<string, T.BufferGeometry>();
const spheres = new Map<number, T.BufferGeometry>();
const tapers = new Map<string, T.BufferGeometry>();

export function material(color: string) {
  if (!materials.has(color))
    materials.set(
      color,
      new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
    );
  return materials.get(color)!;
}

/** Box sizes repeat heavily across a scene, so the buffers are shared by size.
 *  Callers place meshes by transform and never edit these in place. */
function boxGeometry(size: number[], rounded: boolean) {
  const key = `${rounded ? 'r' : 'b'}:${size[0]}:${size[1]}:${size[2]}`;
  let geometry = boxes.get(key);
  if (!geometry) {
    geometry = rounded
      ? new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.075)
      : new T.BoxGeometry(...(size as [number, number, number]));
    geometry.userData.shared = true;
    boxes.set(key, geometry);
  }
  return geometry;
}

/** Safe to call on any mesh: shared buffers outlive the meshes that borrow them. */
export function disposeGeometry(geometry: T.BufferGeometry) {
  if (!geometry.userData.shared) geometry.dispose();
}

export function box(
  g: T.Object3D,
  size: number[],
  pos: number[],
  color: string,
  rounded = false,
) {
  const mesh = new T.Mesh(boxGeometry(size, rounded), material(color));
  mesh.position.set(...(pos as [number, number, number]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** A faceted ellipsoid: one shared unit sphere per detail level, scaled per mesh. */
export function ball(
  g: T.Object3D,
  size: number[],
  pos: number[],
  color: string,
  detail = 12,
) {
  let geometry = spheres.get(detail);
  if (!geometry) {
    geometry = new T.SphereGeometry(1, detail, Math.ceil((detail * 2) / 3));
    geometry.userData.shared = true;
    spheres.set(detail, geometry);
  }
  const mesh = new T.Mesh(geometry, material(color));
  mesh.scale.set(...(size as [number, number, number]));
  mesh.position.set(...(pos as [number, number, number]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** A cone or tapered cylinder along Y; a zero radius makes that end a point. */
export function taper(
  g: T.Object3D,
  top: number,
  bottom: number,
  height: number,
  pos: number[],
  color: string,
  sides = 8,
) {
  const key = `${top}:${bottom}:${height}:${sides}`;
  let geometry = tapers.get(key);
  if (!geometry) {
    geometry = new T.CylinderGeometry(top, bottom, height, sides);
    geometry.userData.shared = true;
    tapers.set(key, geometry);
  }
  const mesh = new T.Mesh(geometry, material(color));
  mesh.position.set(...(pos as [number, number, number]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function beam(
  g: T.Object3D,
  a: number[],
  b: number[],
  width: number,
  color: string,
) {
  const av = new T.Vector3(...(a as [number, number, number])),
    bv = new T.Vector3(...(b as [number, number, number]));
  const m = box(g, [width, av.distanceTo(bv), width], [0, 0, 0], color);
  m.position.copy(av).add(bv).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    bv.sub(av).normalize(),
  );
  return m;
}

export function label(text: string, bg = '#fff4d7', fg = '#294a45', width = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 18);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 67, 475);
  const map = new T.CanvasTexture(canvas);
  const s = new T.Sprite(new T.SpriteMaterial({ map, depthTest: false }));
  s.scale.set(width, width / 4, 1);
  return s;
}
