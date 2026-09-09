import * as T from 'three';
import { box, material, label } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { BREWER, FAN, LIMBS, STOVE } from './types';

export function cylinder(
  g: T.Object3D,
  radius: number,
  height: number,
  pos: number[],
  color: string,
  top = radius,
) {
  const m = new T.Mesh(
    new T.CylinderGeometry(top, radius, height, 12),
    material(color),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function torus(
  g: T.Object3D,
  radius: number,
  tube: number,
  pos: number[],
  color: string,
) {
  const m = new T.Mesh(
    new T.TorusGeometry(radius, tube, 6, 20),
    material(color),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  g.add(m);
  return m;
}
export function createKitchen(scene: T.Scene) {
  const g = new T.Group();
  scene.add(g);
  box(g, [15, 0.4, 12], [0, -0.3, 0], '#d5b383', true);
  for (let x = -7; x <= 6; x++)
    for (let z = -5; z <= 5; z++)
      box(
        g,
        [0.98, 0.05, 0.98],
        [x + 0.5, -0.065, z + 0.5],
        (x + z) % 2 === 0 ? '#f7e8c7' : '#dfd8b9',
      );
  box(g, [15, 4.5, 0.24], [0, 2.1, -5.8], '#ead9b1', true);
  box(g, [0.24, 4.5, 12], [-7.4, 2.1, 0], '#f1e0ba', true);
  box(g, [14.6, 0.2, 0.18], [0, 0.1, -5.64], '#afba95');
  box(g, [0.18, 0.2, 11.5], [-7.25, 0.1, 0], '#afba95');
  // Tiled backsplash and a run of toy-like cabinets.
  for (let z = -3; z <= 1; z += 2) {
    box(g, [2.45, 1.6, 1.92], [-5.8, 0.8, z], '#689e94', true);
    box(g, [0.1, 1.22, 1.68], [-4.55, 0.82, z], '#83b4a2', true);
    box(g, [0.14, 0.11, 0.55], [-4.45, 1.25, z], '#d7ba71', true);
  }
  box(g, [2.65, 0.22, 6.1], [-5.7, 1.65, -1], '#f8eed5', true);
  box(g, [1.55, 0.08, 1.55], [STOVE.x, 1.8, STOVE.z], '#344f4b', true);
  const fire = torus(g, 0.47, 0.075, [STOVE.x, 1.86, STOVE.z], '#f5a33d');
  fire.rotation.x = Math.PI / 2;
  cylinder(g, 0.25, 0.12, [STOVE.x, 1.83, STOVE.z], '#d67837');
  box(g, [0.8, 1, 0.65], [BREWER.x - 0.7, 2.25, BREWER.z], '#d47759', true);
  box(g, [0.86, 0.12, 0.8], [BREWER.x - 0.55, 1.86, BREWER.z], '#294a43', true);
  box(g, [0.35, 0.08, 0.2], [BREWER.x - 0.3, 2.54, BREWER.z], '#f7df9b');
  const hobLabel = label('PANCAKES', '#fff4d7', '#385952', 1.8);
  hobLabel.position.set(-5.4, 3, -3.2);
  g.add(hobLabel);
  const coffeeLabel = label('COFFEE', '#fff4d7', '#385952', 1.6);
  coffeeLabel.position.set(-5.4, 3.25, 1.25);
  g.add(coffeeLabel);
  // Window, fridge, shelves and recognizable kitchen clutter stay behind the play area.
  box(g, [3.1, 2.3, 0.16], [-2.7, 2.85, -5.6], '#fcf2d2', true);
  box(g, [2.75, 1.96, 0.08], [-2.7, 2.85, -5.48], '#a4d3cf');
  box(g, [0.12, 2, 0.1], [-2.7, 2.85, -5.39], '#f8eccc');
  box(g, [2.8, 0.13, 0.1], [-2.7, 2.85, -5.38], '#f8eccc');
  box(g, [3.2, 0.16, 0.45], [-2.7, 1.72, -5.37], '#e0bb7e', true);
  box(g, [1.75, 3.8, 1.4], [5.7, 1.9, -4.6], '#dfab55', true);
  box(g, [1.6, 2.3, 0.12], [5.7, 1.25, -3.86], '#ecc175', true);
  box(g, [1.6, 1.12, 0.12], [5.7, 3.01, -3.86], '#f0c983', true);
  box(g, [0.11, 0.66, 0.12], [5.07, 1.8, -3.75], '#758c7d', true);
  box(g, [0.11, 0.5, 0.12], [5.07, 3.05, -3.75], '#758c7d', true);
  box(g, [2.3, 0.14, 0.7], [1.6, 3, -5.35], '#bc925c', true);
  for (let i = 0; i < 3; i++)
    cylinder(
      g,
      0.19,
      0.45,
      [0.95 + i * 0.56, 3.3, -5.32],
      ['#d77c60', '#7fa9a2', '#e5c074'][i],
    );
  cylinder(g, 0.28, 0.4, [-3.8, 1.98, -5.25], '#cc7b56', 0.34);
  for (let i = 0; i < 5; i++) {
    const leaf = new T.Mesh(
      new T.IcosahedronGeometry(0.28, 0),
      material(i % 2 ? '#6d9c69' : '#91b57a'),
    );
    leaf.scale.set(0.55, 1.8, 0.7);
    leaf.position.set(
      -3.8 + Math.sin(i * 2) * 0.18,
      2.4,
      -5.23 + Math.cos(i * 2) * 0.16,
    );
    leaf.rotation.z = Math.sin(i) * 0.6;
    g.add(leaf);
  }
  const clockFace = cylinder(g, 0.5, 0.08, [1.6, 4.02, -5.56], '#fff4d5');
  clockFace.rotation.x = Math.PI / 2;
  box(g, [0.07, 0.32, 0.06], [1.6, 4.15, -5.48], '#355b50');
  box(g, [0.3, 0.07, 0.06], [1.72, 4.02, -5.47], '#355b50');
  box(g, [3, 0.03, 1.6], [-2.5, 0.01, 4.5], '#d57f62', true);
  for (let i = 0; i < 6; i++)
    box(g, [2.7, 0.015, 0.04], [-2.5, 0.035, 3.87 + i * 0.24], '#f4d7a7');
  batchScenery(g);
  const fan = new T.Group();
  fan.position.set(FAN.x, FAN.y, FAN.z);
  g.add(fan);
  cylinder(fan, 0.17, 0.65, [0, 0.25, 0], '#b3a27d');
  const blades = new T.Group();
  fan.add(blades);
  cylinder(blades, 0.31, 0.25, [0, 0, 0], '#dba95c');
  for (let i = 0; i < 4; i++) {
    const blade = new T.Group();
    blade.rotation.y = (i * Math.PI) / 2;
    box(blade, [1.4, 0.09, 0.3], [0.93, 0, 0], '#699f98', true);
    blades.add(blade);
  }
  return blades;
}
export function createRobot() {
  const body = new T.Group();
  box(body, [1.2, 1.35, 0.85], [0, 2, 0], '#efe1bc', true);
  box(body, [0.75, 0.65, 0.1], [0, 2.12, 0.47], '#698f83', true);
  for (let i = 0; i < 4; i++)
    cylinder(
      body,
      0.06,
      0.07,
      [-0.22 + i * 0.15, 2.12, 0.56],
      LIMBS[i].color,
    ).rotation.x = Math.PI / 2;
  cylinder(body, 0.21, 0.22, [0, 2.76, 0], '#546e64');
  box(body, [1.4, 0.88, 1.05], [0, 3.24, 0], '#f9edcc', true);
  box(body, [1.08, 0.46, 0.07], [0, 3.23, 0.55], '#344f4b', true);
  box(body, [0.16, 0.19, 0.06], [-0.28, 3.26, 0.6], '#f6c967', true);
  box(body, [0.16, 0.19, 0.06], [0.28, 3.26, 0.6], '#f6c967', true);
  box(body, [0.23, 0.05, 0.07], [0, 3.08, 0.6], '#e5c8a0');
  cylinder(body, 0.04, 0.3, [0.28, 3.83, 0], '#8d9d84');
  const antenna = new T.Mesh(
    new T.IcosahedronGeometry(0.12, 1),
    material('#d57f62'),
  );
  antenna.position.set(0.28, 4.03, 0);
  body.add(antenna);
  const limbs = LIMBS.map((l, i) => {
    const group = new T.Group();
    const segments = [
      box(group, [0.25, 1, 0.25], [0, 0, 0], l.color, true),
      box(group, [0.21, 1, 0.21], [0, 0, 0], l.color, true),
    ];
    const joint = new T.Mesh(
      new T.IcosahedronGeometry(0.22, 1),
      material('#7b8e7b'),
    );
    group.add(joint);
    const tip = box(
      group,
      i < 2 ? [0.44, 0.3, 0.46] : [0.49, 0.32, 0.8],
      [0, 0, 0],
      l.color,
      true,
    );
    if (i < 2) {
      box(tip, [0.1, 0.15, 0.22], [-0.25, 0, 0.1], '#e6d2a4', true);
      box(tip, [0.1, 0.15, 0.22], [0.25, 0, 0.1], '#e6d2a4', true);
    }
    const tag = label(l.short, l.color, '#fffaf0', 0.56);
    group.add(tag);
    return { group, segments, joint, tip, tag };
  });
  return { body, limbs };
}
export function createTable() {
  const g = new T.Group();
  box(g, [2.9, 0.21, 2.2], [0, 1.55, 0], '#d4a060', true);
  box(g, [2.1, 0.035, 1.45], [0, 1.68, 0], '#fcf0d6', true);
  for (const x of [-1.15, 1.15])
    for (const z of [-0.8, 0.8])
      box(g, [0.17, 1.5, 0.17], [x, 0.75, z], '#ae8353', true);
  cylinder(g, 0.63, 0.08, [-0.6, 1.75, 0], '#fdf9e9');
  const cakes = new T.Group();
  cakes.position.set(-0.6, 1.82, 0);
  g.add(cakes);
  for (let i = 0; i < 3; i++)
    cylinder(
      cakes,
      0.43 - i * 0.015,
      0.13,
      [0, i * 0.13, 0],
      i % 2 ? '#d49c4d' : '#e8ba68',
    );
  const mug = new T.Group();
  mug.position.set(0.6, 1.72, -0.4);
  g.add(mug);
  cylinder(mug, 0.25, 0.45, [0, 0.22, 0], '#cc795b');
  cylinder(mug, 0.21, 0.025, [0, 0.456, 0], '#fff0cc');
  torus(mug, 0.15, 0.06, [0.29, 0.24, 0], '#cc795b');
  const coffee = cylinder(mug, 0.2, 0.025, [0, 0.465, 0], '#6b4932');
  const order = label('BREAKFAST HERE', '#f5c457', '#294a43', 2.2);
  order.position.set(0, 2.75, -0.65);
  g.add(order);
  return { group: g, cakes, coffee };
}
export function createUtensil(id: 'pan' | 'jug') {
  const g = new T.Group();
  const food = new T.Group();
  g.add(food);
  if (id === 'pan') {
    cylinder(g, 0.57, 0.13, [0, 0.05, 0], '#415b54');
    const rim = torus(g, 0.53, 0.055, [0, 0.12, 0], '#6d7c6a');
    rim.rotation.x = Math.PI / 2;
    box(g, [0.2, 0.14, 0.9], [0, 0.03, 0.75], '#ab7650', true);
    cylinder(food, 0.43, 0.08, [0, 0.15, 0], '#e9ba68');
  } else {
    cylinder(g, 0.32, 0.65, [0, 0.32, 0], '#89b5a8', 0.22);
    cylinder(g, 0.24, 0.07, [0, 0.68, 0], '#f3db9f');
    torus(g, 0.23, 0.07, [0.36, 0.36, 0], '#486f64');
    const spout = cylinder(g, 0.08, 0.37, [-0.27, 0.49, 0], '#689b8b', 0.11);
    spout.rotation.z = -0.8;
    const stream = cylinder(food, 0.034, 0.6, [-0.43, -0.1, 0], '#815134');
    stream.rotation.z = -0.1;
  }
  return { group: g, food };
}
