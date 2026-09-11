import * as T from 'three';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { sofa as createSofa } from '../../shared/rendering/sofa';
import { worker } from '../../shared/rendering/worker';
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
export function deliveryWorker(color: number) {
  const g = worker(color),
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
  // Open-front roof over the destination keeps the delivery zone visible.
  box(scenery, [6.7, 0.3, 2.3], [-6, 25.5, -25.4], '#af795b');
  const house = label('NO. 4  ·  SOFA HERE', '#f4dda0', '#385b4c', 4.1);
  house.position.set(-6, 26.4, -23);
  group.add(house);
  box(scenery, [4, 0.035, 4.4], [-6, 22.035, -23], '#91ae87');
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
  const truck = new T.Group();
  box(truck, [3.5, 2.3, 2.4], [-15, 1.2, 18], '#eadcb8', true);
  box(truck, [1.5, 1.75, 2.4], [-12.5, 0.98, 18], '#d6a64c', true);
  box(truck, [0.05, 0.8, 1.9], [-11.71, 1.38, 18], '#86a9a1');
  for (const x of [-16, -12.8])
    for (const z of [16.85, 19.15])
      box(truck, [0.8, 0.8, 0.28], [x, 0.2, z], '#526259', true);
  scenery.add(truck);
  const gate = new T.Group();
  gate.position.set(GATE.x, GATE.y, GATE.z - 2.3);
  group.add(gate);
  for (const y of [0.45, 1.35])
    box(gate, [0.19, 0.22, 4.6], [0, y, 2.3], '#9c7d51');
  for (let z = 0.2; z < 4.6; z += 0.55)
    box(gate, [0.19, 1.8, 0.23], [0, 0.9, z], '#b79967');
  const door = new T.Group();
  door.position.set(DOOR.x, DOOR.y, DOOR.z);
  group.add(door);
  box(door, [0.24, 3, 3.7], [0, 1.5, 1.85], '#567966', true);
  box(door, [0.3, 0.15, 0.16], [0.13, 1.3, 3.35], '#e8bb54', true);
  batchScenery(scenery);
  batchScenery(gate);
  return { group, gate, door, bridges };
}
