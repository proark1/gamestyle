import * as T from 'three';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { sofa as createSofa } from '../../shared/rendering/sofa';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import type { Look } from '../../shared/wardrobe/look';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import {
  COTTAGE_WALLS,
  COTTAGES,
  DOOR,
  FOUNDATIONS,
  GATE,
  LEVEL,
  PINES,
  ROUTE,
} from './level';
import { SOFA_CENTER, SOFA_SCALE } from './types';

function pine(group: T.Group, x: number, y: number, z: number, size = 1) {
  box(group, [0.24, 1.6 * size, 0.24], [x, y + 0.8 * size, z], '#897453');
  for (let i = 0; i < 3; i++) {
    const m = new T.Mesh(
      new T.ConeGeometry((1.15 - i * 0.23) * size, 1.8 * size, 7),
      material(i % 2 ? '#6e9279' : '#7f9e7e'),
    );
    m.position.set(x, y + (1.8 + i * 0.7) * size, z);
    m.castShadow = true;
    group.add(m);
  }
}
function cottage(
  group: T.Group,
  x: number,
  y: number,
  z: number,
  color: string,
) {
  box(group, COTTAGE_WALLS, [x, y + 1.3, z], color, true);
  for (const side of [-1, 1]) {
    const roof = box(
      group,
      [1.95, 0.22, 3.2],
      [x + side * 0.77, y + 3.03, z],
      '#b77f60',
    );
    roof.rotation.z = -side * 0.45;
  }
  box(group, [0.55, 1.3, 0.55], [x + 0.8, y + 3.5, z - 0.5], '#ad9a7d');
  box(group, [0.75, 1.55, 0.08], [x, y + 0.8, z + 1.34], '#52776a', true);
  for (const side of [-1, 1]) {
    box(
      group,
      [0.68, 0.76, 0.09],
      [x + side, y + 1.55, z + 1.34],
      '#f2d68a',
      true,
    );
    box(group, [0.05, 0.8, 0.1], [x + side, y + 1.55, z + 1.4], '#778a6c');
    box(group, [0.82, 0.17, 0.35], [x + side, y + 1.1, z + 1.46], '#927450');
  }
}
export function deliverySofa() {
  const g = new T.Group(),
    sofa = createSofa();
  sofa.scale.setScalar(SOFA_SCALE);
  sofa.position.y = -SOFA_CENTER;
  g.add(sofa);
  for (const x of [-2.1, 2.1])
    box(g, [0.08, 0.18, 0.42], [x, -0.08, 0.15], '#725b43', true);
  batchScenery(g);
  return g;
}
/** A mover: the shared worker in a player's look, with its torso merged. */
export function deliveryWorker(color: number, look?: Look) {
  const g = dressedWorker(color, {}, look).model,
    body = g.userData.body as T.Group;
  const limbs = ['legL', 'legR', 'armL', 'armR'].map(
    (key) => g.userData[key] as T.Group,
  );
  // Merge the rigid torso while preserving each animated limb's pivot.
  limbs.forEach((limb) => limb.removeFromParent());
  batchScenery(body);
  limbs.forEach((limb) => body.add(limb));
  return g;
}
/** Walks a mover, arms out to grip the sofa; `now` is in milliseconds. */
export function poseDeliveryWorker(
  model: T.Object3D,
  now: number,
  pose: {
    moving: boolean;
    gripping: boolean;
    stumbling: boolean;
    color: number;
  },
) {
  const stride = pose.moving ? Math.sin(now / 95 + pose.color) * 0.5 : 0;
  model.userData.legL.rotation.x = stride;
  model.userData.legR.rotation.x = -stride;
  model.userData.armL.rotation.x = pose.gripping ? -1.15 : -stride * 0.7;
  model.userData.armR.rotation.x = pose.gripping ? -1.15 : stride * 0.7;
  model.userData.body.rotation.z = pose.stumbling
    ? Math.sin(now / 65) * 0.15
    : 0;
}
export function goatModel() {
  const g = new T.Group();
  box(g, [0.75, 0.66, 1.18], [0, 0.76, 0], '#eee6cf', true);
  box(g, [0.49, 0.56, 0.47], [0, 1.22, 0.62], '#e2d8ba', true);
  for (const side of [-1, 1]) {
    box(g, [0.2, 0.11, 0.35], [side * 0.33, 1.36, 0.57], '#e2d8ba', true);
    const horn = box(g, [0.1, 0.39, 0.1], [side * 0.15, 1.64, 0.52], '#8a795d');
    horn.rotation.x = -0.4;
    box(g, [0.03, 0.075, 0.08], [side * 0.254, 1.24, 0.74], '#374c42');
    for (const z of [-0.4, 0.4]) {
      const leg = box(g, [0.16, 0.52, 0.17], [side * 0.25, 0.3, z], '#726e55');
      g.userData[`leg${side}${z}`] = leg;
    }
  }
  box(g, [0.14, 0.24, 0.16], [0, 0.91, 0.85], '#c1bda1');
  box(g, [0.79, 0.16, 0.15], [0, 0.92, 0.35], '#b68a3d');
  batchScenery(g);
  return g;
}
export function villageModel() {
  const group = new T.Group(),
    scenery = new T.Group(),
    bridges = new Map<string, T.Mesh>();
  group.add(scenery);
  for (const shape of LEVEL) {
    const mesh = box(
      shape.bridge ? group : scenery,
      shape.size,
      [shape.position.x, shape.position.y, shape.position.z],
      shape.color,
    );
    mesh.quaternion.set(
      shape.quaternion.x,
      shape.quaternion.y,
      shape.quaternion.z,
      shape.quaternion.w,
    );
    if (shape.bridge) bridges.set(shape.id, mesh);
  }
  // Exposed stone piers leave open air between roads: a fall can reach the foot.
  for (let i = 1; i < ROUTE.length; i++) {
    const p = ROUTE[i];
    box(
      scenery,
      [3.5, p.y + 0.5, 3.5],
      [p.x, (p.y - 0.5) / 2 - 0.5, p.z],
      i % 2 ? '#aab092' : '#9ea58a',
      true,
    );
  }
  for (const f of FOUNDATIONS)
    box(
      scenery,
      f.size,
      [f.position.x, f.position.y, f.position.z],
      f.color,
      true,
    );
  for (const side of [-1, 1]) {
    for (let j = 0; j <= 25; j++) {
      const t = j / 25,
        x = 10 - t * 20,
        y = 4 + t * 3 - Math.sin(Math.PI * t) * 0.3;
      if (j % 5 === 0)
        box(
          scenery,
          [0.13, 1.1, 0.13],
          [x, y + 0.55, 6 + side * 1.8],
          '#887451',
        );
      if (j < 25) {
        const t2 = (j + 1) / 25;
        beam(
          scenery,
          [x, y + 1.05, 6 + side * 1.8],
          [
            10 - t2 * 20,
            5.05 + t2 * 3 - Math.sin(Math.PI * t2) * 0.3,
            6 + side * 1.8,
          ],
          0.055,
          '#837550',
        );
      }
    }
  }
  for (const c of COTTAGES) cottage(scenery, c.x, c.y, c.z, c.color);
  for (const p of PINES) pine(scenery, p.x, -0.6, p.z, p.size);
  // Distant mountain silhouettes frame the miniature village.
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(
      new T.ConeGeometry(10 + (i % 3) * 3, 19 + (i % 2) * 8, 5),
      material(i % 2 ? '#a9bba7' : '#b6c5b2'),
    );
    m.position.set(-39 + i * 15, 4, -48 - (i % 2) * 8);
    scenery.add(m);
  }
  // Customer house (No. 4) - authentic alpine brick house with terracotta tile roof:
  const backRoof = box(
    scenery,
    [5.2, 0.24, 9.4],
    [-9.3, 26.35, -23],
    '#b77f60',
  );
  backRoof.rotation.z = -0.38;
  const frontRoof = box(
    scenery,
    [1.8, 0.22, 9.4],
    [-4.1, 26.2, -23],
    '#b77f60',
  );
  frontRoof.rotation.z = 0.35;
  box(scenery, [0.28, 0.28, 9.4], [-7.2, 27.25, -23], '#7e5c3c');
  for (let rz = -27.2; rz <= -18.8; rz += 1.4) {
    box(scenery, [0.12, 0.15, 0.12], [-11.6, 25.4, rz], '#6b4d32');
    box(scenery, [0.12, 0.15, 0.12], [-3.1, 25.5, rz], '#6b4d32');
  }
  for (const sz of [-27.2, -18.8]) {
    const rearBarge = box(
      scenery,
      [5.3, 0.28, 0.15],
      [-9.3, 26.45, sz],
      '#6b4d32',
    );
    rearBarge.rotation.z = -0.38;
    const frontBarge = box(
      scenery,
      [1.9, 0.28, 0.15],
      [-4.1, 26.3, sz],
      '#6b4d32',
    );
    frontBarge.rotation.z = 0.35;
  }
  box(scenery, [8.6, 0.35, 0.2], [-7.2, 22.15, -27.35], '#8f9680');
  box(scenery, [8.6, 0.35, 0.2], [-7.2, 22.15, -18.65], '#8f9680');
  box(scenery, [0.2, 0.35, 9.0], [-11.35, 22.15, -23], '#8f9680');
  for (const [qx, qz] of [
    [-11.2, -27.2],
    [-11.2, -18.8],
    [-3.2, -27.2],
    [-3.2, -18.8],
  ]) {
    for (let qy = 22.4; qy < 25.5; qy += 0.8) {
      box(scenery, [0.52, 0.35, 0.52], [qx, qy, qz], '#d5bf9b');
    }
  }
  box(scenery, [0.44, 0.4, 3.8], [-3.2, 25.3, -23], '#6b5037');
  for (const [wz, sign] of [
    [-27.2, -1],
    [-18.8, 1],
  ] as const) {
    box(scenery, [1.5, 0.14, 0.45], [-7.2, 23.3, wz + sign * 0.15], '#927450');
    box(scenery, [1.3, 0.24, 0.35], [-7.2, 23.48, wz + sign * 0.25], '#52776a');
    box(scenery, [1.3, 1.2, 0.1], [-7.2, 24.15, wz + sign * 0.05], '#fbe28c');
    box(scenery, [0.08, 1.2, 0.12], [-7.2, 24.15, wz + sign * 0.05], '#6b5037');
    box(scenery, [1.3, 0.08, 0.12], [-7.2, 24.15, wz + sign * 0.05], '#6b5037');
  }
  box(scenery, [1.2, 5.2, 1.2], [-11.3, 25.5, -20.8], '#a5573e');
  box(scenery, [1.4, 0.18, 1.4], [-11.3, 28.15, -20.8], '#8a7e70');
  box(scenery, [0.5, 0.65, 0.5], [-11.3, 28.55, -20.8], '#b76a4a');
  box(scenery, [0.55, 1.5, 1.8], [-10.8, 22.75, -20.8], '#3a3632');
  box(scenery, [0.3, 0.2, 1.0], [-10.7, 22.15, -20.8], '#e67329');
  box(scenery, [0.08, 0.5, 0.6], [-3.0, 23.8, -20.6], '#3d5448');
  box(scenery, [0.32, 0.06, 0.06], [-3.0, 24.6, -21.0], '#333333');
  box(scenery, [0.22, 0.32, 0.22], [-2.85, 24.45, -21.0], '#ffeaa7');
  box(scenery, [0.12, 0.95, 6.0], [1.85, 22.45, -23], '#837550');
  for (const pz of [-25.8, -23.0, -20.2])
    box(scenery, [0.16, 1.05, 0.16], [1.85, 22.5, pz], '#725f3f');
  box(scenery, [5.8, 0.032, 6.0], [-7.2, 22.032, -23], '#375b4c');
  box(scenery, [5.2, 0.035, 5.4], [-7.2, 22.035, -23], '#e2be68');
  box(scenery, [4.6, 0.038, 4.8], [-7.2, 22.038, -23], '#2e4f42');
  const house = label('NO. 4  ·  SOFA HERE', '#f4dda0', '#385b4c', 4.1);
  house.position.set(-7.2, 26.5, -23);
  group.add(house);
  for (const [text, x, y, z] of [
    ['DELIVERY CO.', -13, 3, 16],
    ['↑ THIS WAY', 8, 4.6, 15],
    ['MIND THE GAP', 4.4, 14.5, -6.3],
    ['ICE. GOOD LUCK.', -7, 18.4, -13],
    ['FREE HAND →', 1, 12.5, 0.8],
  ] as const) {
    const sign = label(text, '#f1dfb1', '#46634f', 3.1);
    sign.position.set(x, y, z);
    group.add(sign);
  }
  // Detailed vintage delivery van:
  const truck = new T.Group();
  box(truck, [4.8, 0.25, 1.6], [-14.2, 0.35, 18], '#2c302e');
  box(truck, [0.25, 0.28, 2.3], [-11.35, 0.38, 18], '#c5bea8');
  box(truck, [0.25, 0.28, 2.3], [-16.95, 0.38, 18], '#c5bea8');
  for (const z of [16.7, 19.3])
    box(truck, [0.8, 0.08, 0.2], [-12.4, 0.28, z], '#5a5e58');
  for (const x of [-15.8, -12.6])
    for (const z of [16.82, 19.18]) {
      box(truck, [0.82, 0.82, 0.3], [x, 0.24, z], '#2b2d2f', true);
      box(truck, [0.46, 0.46, 0.32], [x, 0.24, z], '#ede4cb', true);
      box(truck, [0.14, 0.14, 0.34], [x, 0.24, z], '#c89e47');
      box(truck, [1.05, 0.18, 0.32], [x, 0.72, z], '#c99638');
    }
  box(truck, [1.6, 1.7, 2.2], [-12.4, 1.15, 18], '#d6a64c', true);
  box(truck, [0.7, 1.1, 2.0], [-11.35, 0.85, 18], '#c99638', true);
  box(truck, [1.75, 0.15, 2.3], [-12.4, 2.05, 18], '#b88a32');
  box(truck, [0.06, 0.65, 1.2], [-10.97, 0.85, 18], '#3a3d3b');
  box(truck, [0.07, 0.08, 1.2], [-10.96, 1.12, 18], '#e2dac2');
  for (const z of [17.15, 18.85]) {
    box(truck, [0.08, 0.32, 0.32], [-10.96, 0.88, z], '#f0ede0');
    box(truck, [0.09, 0.24, 0.24], [-10.95, 0.88, z], '#fff6bd');
    box(truck, [0.08, 0.12, 0.16], [-10.96, 0.58, z], '#e8882d');
  }
  box(truck, [0.06, 0.8, 1.8], [-11.57, 1.5, 18], '#8cb2aa');
  for (const z of [16.88, 19.12]) {
    const sign = z > 18 ? 1 : -1;
    box(truck, [0.75, 0.55, 0.05], [-12.35, 1.52, z], '#8cb2aa');
    box(truck, [0.15, 0.05, 0.08], [-12.1, 1.05, z + sign * 0.04], '#444846');
    box(truck, [0.16, 0.28, 0.08], [-11.65, 1.45, z + sign * 0.2], '#444846');
    box(truck, [0.06, 0.06, 0.2], [-11.65, 1.4, z + sign * 0.1], '#444846');
  }
  box(truck, [3.6, 2.35, 2.4], [-15.0, 1.45, 18], '#ede2c4', true);
  box(truck, [3.62, 0.32, 2.42], [-15.0, 1.45, 18], '#4b6d5b');
  box(truck, [3.7, 0.12, 2.48], [-15.0, 2.65, 18], '#cfbe95');
  for (const x of [-16.78, -13.22])
    for (const z of [16.82, 19.18])
      box(truck, [0.1, 2.38, 0.1], [x, 1.45, z], '#cfbe95');
  box(truck, [0.06, 2.05, 2.1], [-16.82, 1.42, 18], '#dfd3b3');
  box(truck, [0.07, 2.05, 0.05], [-16.82, 1.42, 18], '#3a3834');
  for (const z of [17.8, 18.2])
    box(truck, [0.1, 0.25, 0.06], [-16.84, 1.35, z], '#3a3834');
  for (const z of [17.05, 18.95]) {
    box(truck, [0.08, 0.3, 0.18], [-16.83, 0.6, z], '#8b251e');
    box(truck, [0.09, 0.1, 0.18], [-16.83, 0.45, z], '#e8882d');
  }
  scenery.add(truck);
  // Gate without coplanar z-fighting:
  const gate = new T.Group();
  gate.position.set(GATE.x, GATE.y, GATE.z - 2.3);
  group.add(gate);
  for (const y of [0.45, 1.35])
    box(gate, [0.1, 0.18, 4.6], [-0.05, y, 2.3], '#9c7d51');
  beam(gate, [-0.05, 0.45, 0.4], [-0.05, 1.35, 4.2], 0.09, '#9c7d51');
  for (let z = 0.25; z < 4.55; z += 0.52)
    box(gate, [0.1, 1.75, 0.2], [0.05, 0.9, z], '#b79967');
  box(gate, [0.18, 1.95, 0.22], [0, 0.98, 0.12], '#886d44');
  box(gate, [0.18, 1.95, 0.22], [0, 0.98, 4.48], '#886d44');
  for (const y of [0.45, 1.35])
    box(gate, [0.22, 0.12, 0.42], [0, y, 0.25], '#3a3835');
  box(gate, [0.22, 0.1, 0.32], [0, 0.9, 4.45], '#725b43');
  const door = new T.Group();
  door.position.set(DOOR.x, DOOR.y, DOOR.z);
  group.add(door);
  box(door, [0.24, 3, 3.7], [0, 1.5, 1.85], '#567966', true);
  box(door, [0.3, 0.15, 0.16], [0.13, 1.3, 3.35], '#e8bb54', true);
  batchScenery(scenery);
  batchScenery(gate);
  return { group, gate, door, bridges };
}
