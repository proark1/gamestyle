import * as T from 'three';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { worker } from '../../shared/rendering/worker';
import { GATE, PANEL, LADDER_EXIT } from './types';
import { FARM_COVER } from './visibility';
export function ladder() {
  const g = new T.Group();
  for (const x of [-0.4, 0.4])
    box(g, [0.12, 0.12, 3.4], [x, 0.16, -1.25], '#b59159', true);
  for (let z = -2.7; z < 0.5; z += 0.48)
    box(g, [0.85, 0.1, 0.1], [0, 0.16, z], '#dcc38a');
  return g;
}
export function keyModel() {
  const g = new T.Group(),
    ring = new T.Mesh(
      new T.TorusGeometry(0.2, 0.065, 5, 12),
      material('#f7cd62'),
    );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  box(g, [0.1, 0.1, 0.5], [0, 0, 0.35], '#f7cd62');
  box(g, [0.25, 0.1, 0.1], [0.08, 0, 0.52], '#f7cd62');
  return g;
}
export function cowModel(index: number) {
  const g = new T.Group(),
    body = new T.Group(),
    head = new T.Group();
  g.add(body);
  g.userData.body = body;
  box(body, [1.05, 0.8, 1.65], [0, 0.93, 0], '#f1eed9', true);
  box(
    body,
    [0.66, 0.045, 0.64],
    [index % 2 ? 0.17 : -0.17, 1.35, -0.25],
    '#49534a',
    true,
  );
  for (const side of [-1, 1])
    box(
      body,
      [0.045, 0.5, 0.7],
      [side * 0.53, 0.99, (index % 3) * 0.22 - 0.35],
      '#49534a',
      true,
    );
  head.position.set(0, 1.15, 0.85);
  body.add(head);
  g.userData.head = head;
  box(head, [0.73, 0.62, 0.65], [0, 0, 0.1], '#eeecd8', true);
  box(head, [0.77, 0.32, 0.42], [0, -0.22, 0.45], '#d9987e', true);
  for (const x of [-0.22, 0.22]) {
    box(head, [0.085, 0.095, 0.035], [x, 0.07, 0.435], '#343e36');
    box(head, [0.07, 0.05, 0.02], [x, -0.22, 0.665], '#9d6257');
    box(head, [0.28, 0.12, 0.26], [x * 2, 0.16, 0.01], '#49534a', true);
    beam(head, [x, 0.3, -0.05], [x * 1.2, 0.55, 0.01], 0.09, '#c8b988');
  }
  const legs: T.Group[] = [];
  for (const x of [-0.35, 0.35])
    for (const z of [-0.57, 0.57]) {
      const leg = new T.Group();
      leg.position.set(x, 0.62, z);
      box(leg, [0.19, 0.43, 0.23], [0, -0.22, 0], '#eeecd8', true);
      box(leg, [0.23, 0.17, 0.29], [0, -0.45, 0.03], '#49534a', true);
      body.add(leg);
      legs.push(leg);
    }
  g.userData.legs = legs;
  beam(body, [0, 1.05, -0.85], [0.1, 0.65, -1.08], 0.065, '#e6e3ca');
  box(body, [0.16, 0.22, 0.15], [0.1, 0.59, -1.08], '#49534a', true);
  const load = ladder();
  load.position.set(0, 0, -0.2);
  load.visible = false;
  g.add(load);
  g.userData.ladder = load;
  const key = keyModel();
  key.position.set(0.72, 0.78, 0.25);
  key.rotation.z = Math.PI / 2;
  key.visible = false;
  g.add(key);
  g.userData.key = key;
  const exposed = new T.Group();
  const exposureRing = new T.Mesh(
    new T.RingGeometry(1.02, 1.12, 40),
    new T.MeshBasicMaterial({
      color: '#ff9c32',
      side: T.DoubleSide,
      depthTest: false,
    }),
  );
  exposureRing.rotation.x = -Math.PI / 2;
  exposureRing.position.y = 0.15;
  exposureRing.renderOrder = 6;
  const warning = label('EXPOSED!', '#ffda68', '#682600', 3.4);
  warning.material.toneMapped = false;
  warning.position.y = 2.5;
  exposed.add(exposureRing, warning);
  exposed.visible = false;
  g.add(exposed);
  g.userData.exposed = exposed;
  const sparks = new T.Group();
  const sparkMaterial = new T.MeshBasicMaterial({
    color: '#1686df',
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const points = [
      [0.75, 0.65],
      [1, 1.1],
      [0.87, 1.22],
      [1.16, 1.72],
    ].map(([radius, height]) => [
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    ]);
    for (let j = 1; j < points.length; j++) {
      const arc: T.Mesh = beam(
        sparks,
        points[j - 1],
        points[j],
        0.055,
        '#c8faff',
      );
      arc.material = sparkMaterial;
      arc.castShadow = false;
    }
  }
  sparks.visible = false;
  g.add(sparks);
  g.userData.sparks = sparks;
  g.userData.sparkMaterial = sparkMaterial;
  return g;
}
function tree(g: T.Group, x: number, z: number, size = 1) {
  box(g, [0.35, 2, 0.35], [x, 0.8, z], '#8f825d');
  const leaves = new T.Mesh(
    new T.IcosahedronGeometry(1.8, 1),
    material('#88a177'),
  );
  leaves.position.set(x, 2.8, z);
  leaves.scale.set(size, size * 1.12, size);
  leaves.castShadow = true;
  g.add(leaves);
}
export function farmModel() {
  const g = new T.Group();
  box(g, [22, 1.1, 22], [0, -0.56, 0], '#94a680', true);
  const cover = new T.Group();
  for (const bale of FARM_COVER) {
    box(
      cover,
      [bale.width, 1.65, bale.depth],
      [bale.x, 0.93, bale.z],
      '#d4b563',
      true,
    );
    for (const y of [0.55, 1.1])
      box(
        cover,
        [bale.width + 0.025, 0.05, bale.depth + 0.025],
        [bale.x, y, bale.z],
        '#a48b48',
      );
    for (const offset of [-0.27, 0.27])
      box(
        cover,
        [0.055, 1.68, bale.depth + 0.04],
        [bale.x + bale.width * offset, 0.93, bale.z],
        '#907f4e',
      );
  }
  g.add(cover);
  box(g, [21.8, 0.12, 21.8], [0, 0.03, 0], '#aabd8a', true);
  const ground = new T.Mesh(new T.PlaneGeometry(180, 180), material('#bac5a0'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  ground.receiveShadow = true;
  g.add(ground);
  for (let i = 0; i < 85; i++) {
    const x = ((i * 7.381) % 19) - 9.5,
      z = ((i * 11.313) % 19) - 9.5;
    box(
      g,
      [0.16, 0.1, 0.07],
      [x, 0.14, z],
      i % 4 === 0 ? '#e8d99c' : '#879e6c',
    );
  }
  const wires = new T.Group();
  g.add(wires);
  for (const side of [-1, 1])
    for (let i = -10; i <= 10; i += 2) {
      box(g, [0.2, 1.2, 0.2], [i, 0.6, side * 10], '#c7bb8b', true);
      box(g, [0.2, 1.2, 0.2], [side * 10, 0.6, i], '#c7bb8b', true);
      if (i < 10)
        for (const y of [0.48, 0.9]) {
          if (!(side === 1 && i >= -2 && i < 2))
            box(wires, [2, 0.035, 0.035], [i + 1, y, side * 10], '#f4e7ac');
          box(wires, [0.035, 0.035, 2], [side * 10, y, i + 1], '#f4e7ac');
        }
    }
  const gate = new T.Group();
  gate.position.set(-2, 0, 10);
  g.add(gate);
  for (const y of [0.4, 0.95]) box(gate, [4, 0.15, 0.18], [2, y, 0], '#ddc893');
  beam(gate, [0.1, 0.3, 0], [3.9, 1.1, 0], 0.13, '#ddc893');
  const wireMaterial = new T.MeshStandardMaterial({
    color: '#2a7ea7',
    emissive: '#2d99c4',
    emissiveIntensity: 0.5,
    roughness: 0.35,
  });
  wires.traverse((object) => {
    if (object instanceof T.Mesh) object.material = wireMaterial;
  });
  // Gate locks can open before power is cut; live wires still span that exit.
  for (const y of [0.48, 0.9]) {
    const wire = box(wires, [4, 0.035, 0.035], [0, y, 10], '#b8f5ff');
    wire.material = wireMaterial;
  }
  box(g, [3.8, 3.4, 3.1], [-7, 1.55, -12.6], '#bf8065', true);
  for (const x of [-8.2, -7.6, -7, -6.4, -5.8])
    box(g, [0.06, 3.2, 0.04], [x, 1.5, -11.02], '#d4987c');
  for (const side of [-1, 1]) {
    const roof = box(
      g,
      [2.6, 0.2, 3.8],
      [-7 + side * 1.03, 3.62, -12.6],
      '#4e7665',
    );
    roof.rotation.z = side * -0.45;
  }
  box(g, [1.5, 2.2, 0.12], [-7, 1, -10.98], '#ead4a0');
  box(g, [1.22, 1.95, 0.14], [-7, 1, -10.88], '#af725b');
  beam(g, [-7.5, 0.15, -10.78], [-6.5, 1.85, -10.78], 0.12, '#ead4a0');
  box(g, [3, 2, 2.4], [7, 0.9, -12], '#7e9c81', true);
  box(g, [3.5, 0.18, 2.9], [7, 2, -12], '#567b6c');
  for (let i = 0; i < 5; i++)
    box(
      g,
      [0.95, 0.55, 0.75],
      [-9 + (i % 2), 0.35 + Math.floor(i / 2) * 0.5, -12 - (i % 2) * 0.3],
      '#d1b666',
      true,
    );
  for (const [x, z, s] of [
    [-14, -8, 1.3],
    [13, -9, 1.2],
    [-14, 5, 1.5],
    [14, 11, 1.4],
    [0, -16, 1.1],
    [-8, 15, 1.3],
  ])
    tree(g, x, z, s);
  box(g, [0.6, 1.6, 0.35], [PANEL.x, 0.8, PANEL.z], '#6d7d66', true);
  const panelLight = box(
    g,
    [0.25, 0.19, 0.08],
    [PANEL.x, 1.27, PANEL.z + 0.21],
    '#f2ca63',
  );
  box(g, [0.1, 0.45, 0.1], [PANEL.x, 0.8, PANEL.z + 0.25], '#d9d4b3');
  for (const [text, x, z, width] of [
    ['POWER', PANEL.x, PANEL.z, 1.9],
    ['GATE', GATE.x, 10, 2],
    ['LADDER', 10, LADDER_EXIT.z, 2.1],
    ['BARN KEY', -7, -7.5, 2.4],
    ['SHED KEY', 7, -7.5, 2.4],
  ] as const) {
    const sign = label(text, '#fff0c8', '#4b674c', width);
    sign.position.set(x, 2.1, z);
    g.add(sign);
  }
  box(g, [2.6, 0.3, 1.2], [-3, 0.22, -6.9], '#b2b9a0', true);
  box(g, [2.3, 0.06, 0.92], [-3, 0.4, -6.9], '#84b9ac', true);
  const escapeLadder = ladder();
  escapeLadder.position.set(9.7, 0.18, 5);
  escapeLadder.rotation.z = -0.55;
  escapeLadder.rotation.y = Math.PI / 2;
  escapeLadder.visible = false;
  g.add(escapeLadder);
  const farmer = worker(0);
  const flashlight = new T.Group();
  flashlight.position.set(0.46, 1.03, 0.42);
  const barrel = new T.Mesh(
    new T.CylinderGeometry(0.12, 0.085, 0.36, 10),
    material('#354350'),
  );
  barrel.rotation.x = Math.PI / 2;
  const lens = new T.Mesh(
    new T.CircleGeometry(0.105, 16),
    new T.MeshBasicMaterial({ color: '#ffdf9b', toneMapped: false }),
  );
  lens.position.z = 0.185;
  flashlight.add(barrel, lens);
  flashlight.visible = false;
  farmer.add(flashlight);
  g.add(farmer);
  return {
    group: g,
    gate,
    wires,
    wireMaterial,
    panelLight,
    escapeLadder,
    farmer,
    flashlight,
    cover,
  };
}
