import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from '../palette';
import { ball } from '../primitives';

const SKIN = '#e6b18e';
const EAR = '#ce927c';
const HAIR = '#49332d';
const INK = '#302d33';
const TROUSERS = '#485565';
const CREAM = '#f4eee2';
// Keep smooth materials separate from the other avatars' faceted materials.
const materials = new Map<string, T.MeshStandardMaterial>();
const shapes = new Map<string, T.BufferGeometry>();
type Point = [number, number, number];

function surface(color: string) {
  let material = materials.get(color);
  if (!material) {
    material = new T.MeshStandardMaterial({ color, roughness: 0.72 });
    materials.set(color, material);
  }
  return material;
}

function soft(parent: T.Object3D, size: Point, position: Point, color: string) {
  const mesh = ball(parent, size, position, color, 32);
  mesh.material = surface(color);
  return mesh;
}

function rounded(
  parent: T.Object3D,
  size: Point,
  position: Point,
  color: string,
  radius: number,
) {
  const key = `${size.join(':')}:${radius}`;
  let geometry = shapes.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(...size, 4, radius);
    geometry.userData.shared = true;
    shapes.set(key, geometry);
  }
  const mesh = new T.Mesh(geometry, surface(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

type MiloRig = {
  body: T.Group;
  head: T.Group;
  eyes: T.Group[];
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
};

/** A rounded human with the shared worker's joints, feet at zero, facing +Z. */
export function milo(color = 0) {
  const shirt = COLORS[color % COLORS.length];
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);

  // A softly tailored sweater, with a little room around the waist.
  rounded(body, [0.53, 0.57, 0.37], [0, 0.99, 0], shirt, 0.15);
  rounded(body, [0.48, 0.08, 0.34], [0, 0.737, 0], shirt, 0.035);
  rounded(body, [0.43, 0.2, 0.31], [0, 0.66, 0], TROUSERS, 0.075);
  soft(body, [0.095, 0.14, 0.095], [0, 1.29, 0], SKIN);
  soft(body, [0.15, 0.035, 0.12], [0, 1.265, 0], CREAM);

  const head = new T.Group();
  head.position.set(0, 1.32, 0);
  body.add(head);
  soft(head, [0.265, 0.305, 0.235], [0, 0.25, 0], SKIN);
  // A small jaw and cheeks give the face shape without a mascot muzzle.
  soft(head, [0.19, 0.15, 0.19], [0, 0.115, 0.035], SKIN);
  for (const side of [-1, 1]) {
    soft(head, [0.05, 0.076, 0.043], [side * 0.257, 0.245, 0], SKIN);
    soft(head, [0.024, 0.043, 0.013], [side * 0.278, 0.245, 0.032], EAR);
  }

  const eyes = [-1, 1].map((side) => {
    const eye = new T.Group();
    eye.position.set(side * 0.095, 0.285, 0.211);
    soft(eye, [0.048, 0.057, 0.022], [0, 0, 0], CREAM);
    soft(eye, [0.024, 0.032, 0.014], [0.003, -0.002, 0.019], INK);
    soft(eye, [0.007, 0.009, 0.005], [-0.004, 0.009, 0.031], '#ffffff');
    head.add(eye);
    const brow = soft(
      head,
      [0.053, 0.012, 0.015],
      [side * 0.095, side < 0 ? 0.373 : 0.361, 0.218],
      HAIR,
    );
    brow.rotation.z = side < 0 ? -0.12 : 0.08;
    return eye;
  });
  soft(head, [0.034, 0.066, 0.036], [0, 0.225, 0.223], SKIN);
  soft(head, [0.045, 0.033, 0.044], [0, 0.191, 0.245], SKIN);

  const smile = new T.CatmullRomCurve3([
    new T.Vector3(-0.065, 0.119, 0.214),
    new T.Vector3(-0.025, 0.103, 0.227),
    new T.Vector3(0.025, 0.108, 0.227),
    new T.Vector3(0.065, 0.13, 0.214),
  ]);
  head.add(
    new T.Mesh(
      new T.TubeGeometry(smile, 16, 0.007, 6, false),
      surface('#995f54'),
    ),
  );

  // A continuous hair cap wraps the crown and back; swept locks soften its edge.
  const hairGeometry = new T.SphereGeometry(
    1,
    32,
    20,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.54,
  );
  const hair = new T.Mesh(hairGeometry, surface(HAIR));
  hair.scale.set(0.275, 0.24, 0.243);
  hair.position.set(0, 0.36, -0.023);
  hair.rotation.x = -0.22;
  hair.castShadow = true;
  head.add(hair);
  soft(head, [0.23, 0.2, 0.1], [0, 0.27, -0.17], HAIR);
  soft(head, [0.2, 0.085, 0.095], [-0.058, 0.46, 0.157], HAIR).rotation.z = 0.3;
  soft(head, [0.12, 0.07, 0.075], [0.123, 0.43, 0.157], HAIR).rotation.z = -0.4;
  for (const side of [-1, 1])
    soft(head, [0.032, 0.075, 0.058], [side * 0.244, 0.32, 0.012], HAIR);

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.125, 0.65, 0);
    rounded(leg, [0.195, 0.49, 0.225], [0, -0.235, 0], TROUSERS, 0.08);
    rounded(leg, [0.2, 0.06, 0.23], [0, -0.44, 0], TROUSERS, 0.02);
    rounded(leg, [0.23, 0.15, 0.36], [0, -0.545, 0.053], CREAM, 0.065);
    rounded(leg, [0.235, 0.05, 0.365], [0, -0.625, 0.053], '#d7d5cc', 0.023);
    rounded(leg, [0.125, 0.022, 0.085], [0, -0.475, 0.095], shirt, 0.01);
    body.add(leg);
    return leg;
  });

  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.275, 1.19, 0);
    const sleeve = new T.Group();
    sleeve.rotation.z = side * 0.16;
    rounded(sleeve, [0.185, 0.43, 0.22], [0, -0.145, 0], shirt, 0.085);
    rounded(sleeve, [0.155, 0.065, 0.185], [0, -0.34, 0], shirt, 0.025);
    soft(sleeve, [0.073, 0.093, 0.072], [0, -0.419, 0.012], SKIN);
    soft(sleeve, [0.031, 0.05, 0.035], [-side * 0.061, -0.408, 0.044], SKIN);
    arm.add(sleeve);
    body.add(arm);
    return arm;
  });

  Object.assign(root.userData, {
    body,
    head,
    eyes,
    legs,
    arms,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
  });
  return root;
}

/** An easy, slightly buoyant stride and a quiet idle with natural blinks. */
export function walkMilo(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as MiloRig;
  const beat = time * 7;
  const swing = walking ? Math.sin(beat) : 0;
  rig.legL.rotation.x = swing * 0.48;
  rig.legR.rotation.x = -swing * 0.48;
  rig.armL.rotation.x = -swing * 0.38;
  rig.armR.rotation.x = swing * 0.38;
  rig.body.position.y = walking ? Math.abs(swing) * 0.035 : 0;
  rig.body.rotation.y = swing * 0.035;
  rig.head.rotation.z = walking ? -swing * 0.035 : Math.sin(time * 1.2) * 0.025;
  rig.head.rotation.y = Math.sin(time * 0.7) * 0.035;
  const blink = Math.max(0, 1 - Math.abs((time % 4.6) - 3.8) / 0.09);
  for (const eye of rig.eyes) eye.scale.y = 1 - blink * 0.94;
}
