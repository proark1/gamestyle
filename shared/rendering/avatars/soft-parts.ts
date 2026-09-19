import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Smooth building blocks for the rounder potential avatars (Jelly, Pip, Pals
 * and Snug). Materials and geometries are cached and shared by every model, so a
 * crowd of them stays cheap; callers place meshes by transform only.
 */
type Point = [number, number, number];

const materials = new Map<string, T.MeshStandardMaterial>();
const geometries = new Map<string, T.BufferGeometry>();
let shine: T.MeshBasicMaterial | undefined;

export function surface(color: string, roughness = 0.7) {
  const key = `${color}:${roughness}`;
  let material = materials.get(key);
  if (!material) {
    material = new T.MeshStandardMaterial({ color, roughness });
    materials.set(key, material);
  }
  return material;
}

function cached(key: string, make: () => T.BufferGeometry) {
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = make();
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

function place(parent: T.Object3D, mesh: T.Mesh, position: Point) {
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** An ellipsoid with the given radii. */
export function soft(
  parent: T.Object3D,
  radii: Point,
  position: Point,
  color: string,
) {
  const mesh = new T.Mesh(
    cached('sphere', () => new T.SphereGeometry(1, 32, 22)),
    surface(color),
  );
  mesh.scale.set(...radii);
  return place(parent, mesh, position);
}

/** A box with rounded edges of the given radius. */
export function rounded(
  parent: T.Object3D,
  size: Point,
  position: Point,
  color: string,
  radius: number,
) {
  const geometry = cached(
    `box:${size.join(':')}:${radius}`,
    () => new RoundedBoxGeometry(...size, 4, radius),
  );
  return place(parent, new T.Mesh(geometry, surface(color)), position);
}

/** A capsule standing on Y: `length` is the straight middle between the caps. */
export function capsule(
  parent: T.Object3D,
  radius: number,
  length: number,
  position: Point,
  color: string,
) {
  const geometry = cached(
    `capsule:${radius}:${length}`,
    () => new T.CapsuleGeometry(radius, length, 10, 32),
  );
  return place(parent, new T.Mesh(geometry, surface(color)), position);
}

/** A lathe turned about Y from a profile of [radius, height] points. */
export function lathe(
  parent: T.Object3D,
  key: string,
  profile: () => [number, number][],
  position: Point,
  color: string,
) {
  const geometry = cached(
    `lathe:${key}`,
    () =>
      new T.LatheGeometry(
        profile().map(([x, y]) => new T.Vector2(x, y)),
        40,
      ),
  );
  return place(parent, new T.Mesh(geometry, surface(color)), position);
}

/** A mesh on a geometry of the caller's own, built once per `key`. */
export function custom(
  parent: T.Object3D,
  key: string,
  make: () => T.BufferGeometry,
  position: Point,
  color: string,
) {
  return place(
    parent,
    new T.Mesh(cached(`custom:${key}`, make), surface(color)),
    position,
  );
}

/** A cone standing on Y. */
export function cone(
  parent: T.Object3D,
  radius: number,
  height: number,
  position: Point,
  color: string,
) {
  const geometry = cached(
    `cone:${radius}:${height}`,
    () => new T.ConeGeometry(radius, height, 24),
  );
  return place(parent, new T.Mesh(geometry, surface(color)), position);
}

/** A smile: a thin tube through the given points. */
export function smile(parent: T.Object3D, points: Point[], color: string) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const mesh = new T.Mesh(
    cached(
      `smile:${points.flat().join(':')}`,
      () => new T.TubeGeometry(curve, 16, 0.012, 6, false),
    ),
    surface(color),
  );
  parent.add(mesh);
  return mesh;
}

/**
 * An eye: a dark oval with a highlight that stays bright in any light. The
 * group's scale is what a walk cycle squashes to blink.
 */
export function eye(
  parent: T.Object3D,
  radii: Point,
  position: Point,
  ink: string,
  white?: Point,
) {
  const group = new T.Group();
  group.position.set(...position);
  // The white sits back far enough that the dark pupil shows in front of it.
  if (white) soft(group, white, [0, 0, -white[2] * 0.7], '#fbf8f1');
  soft(group, radii, [0, 0, 0], ink);
  const glint = soft(
    group,
    [radii[0] * 0.34, radii[1] * 0.3, radii[2] * 0.4],
    [radii[0] * 0.3, radii[1] * 0.35, radii[2] * 0.75],
    ink,
  );
  glint.material = shine ??= new T.MeshBasicMaterial({
    color: '#ffffff',
    toneMapped: false,
  });
  parent.add(group);
  return group;
}

/** The same hue, lighter or darker. */
export function shade(hex: string, lightness: number) {
  const colour = new T.Color(hex);
  colour.offsetHSL(0, 0, lightness);
  return `#${colour.getHexString()}`;
}

/** A blink every few seconds: the eye's vertical scale at `time`. */
export function blink(time: number, offset = 1.5) {
  return (time + offset) % 3.9 < 0.12 ? 0.12 : 1;
}
