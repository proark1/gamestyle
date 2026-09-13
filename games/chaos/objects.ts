import { mapConfig, type MapId } from './maps';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { PLAYER_COLORS, type ItemKind } from './model';
import { paintHex, type Appearance } from './appearance';
import { makeHomeModel } from './home-models';

const materials = new Map<string, T.MeshStandardMaterial>();
const boxes = new Map<string, T.BufferGeometry>();
/** Combine static scenery by material; preserve the animated crane hook subtree. */
function batchScenery(root: T.Group, animated: T.Object3D) {
  root.updateMatrixWorld(true);
  const excluded = new Set<T.Object3D>();
  animated.traverse((object) => excluded.add(object));
  const groups = new Map<string, T.Mesh[]>();
  root.traverse((object) => {
    if (
      !(object instanceof T.Mesh) ||
      excluded.has(object) ||
      Array.isArray(object.material)
    )
      return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${Object.keys(object.geometry.attributes).sort().join(',')}`;
    const group = groups.get(key) || [];
    group.push(object);
    groups.set(key, group);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrixWorld);
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!geometry) continue;
    const combined = new T.Mesh(geometry, meshes[0].material);
    combined.castShadow = meshes[0].castShadow;
    combined.receiveShadow = meshes[0].receiveShadow;
    for (const mesh of meshes) {
      mesh.removeFromParent();
      if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
    }
    root.add(combined);
  }
}
export const mat = (color: string) => {
  if (!materials.has(color))
    materials.set(
      color,
      new T.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }),
    );
  return materials.get(color)!;
};
export function box(
  g: T.Group,
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  rounded = false,
) {
  const key = `${w},${h},${d},${rounded}`;
  if (!boxes.has(key)) {
    const geometry = rounded
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.16)
      : new T.BoxGeometry(w, h, d);
    geometry.userData.shared = true;
    boxes.set(key, geometry);
  }
  const mesh = new T.Mesh(boxes.get(key), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function cylinder(
  g: T.Group,
  top: number,
  bottom: number,
  height: number,
  color: string,
  x: number,
  y: number,
  z: number,
  segments = 10,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(top, bottom, height, segments),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function sphere(
  g: T.Group,
  radius: number,
  color: string,
  x: number,
  y: number,
  z: number,
  detail = 1,
) {
  const mesh = new T.Mesh(
    new T.IcosahedronGeometry(radius, detail),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}
export function beam(
  g: T.Group,
  a: number[],
  b: number[],
  width: number,
  color: string,
) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b);
  const mesh = box(g, width, start.distanceTo(end), width, color);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    end.sub(start).normalize(),
  );
  return mesh;
}
export function label(
  text: string,
  color = '#293c3b',
  background = '#ffffff',
  scale = 2.3,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(5, 5, 502, 118, 30);
  ctx.fill();
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66, 465);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.scale.set(scale, scale / 4, 1);
  sprite.renderOrder = 3;
  return sprite;
}
/**
 * A site worker: the collection's shared worker in site overalls, a tool belt
 * and a striped hard hat in the player's colour. A player's own hat replaces
 * the hard hat; the tool belt always stays.
 */
export function worker(color = 0, look?: Look) {
  const c = PLAYER_COLORS[color % 4];
  const { model: g, worn } = dressedWorker(
    color,
    { shirt: c, overalls: '#355565', boots: '#384440', cap: false },
    look,
  );
  const body = g.userData.body as T.Group;
  if (!worn.hat) {
    box(body, 0.74, 0.1, 0.72, c, 0, WORKER_HEAD_TOP + 0.02, 0.04, true);
    box(body, 0.6, 0.28, 0.56, c, 0, WORKER_HEAD_TOP + 0.18, 0, true);
    box(body, 0.1, 0.32, 0.58, '#ffe6a0', 0, WORKER_HEAD_TOP + 0.2, 0, true);
  }
  box(body, 0.7, 0.1, 0.52, '#91623f', 0, 0.68, 0.035);
  box(body, 0.2, 0.2, 0.14, '#bc854f', 0.3, 0.58, 0.3, true);
  return g;
}
/**
 * Swings a worker's limbs. `time` is in seconds; `lag` is how far the model
 * trails the player it follows, which sets the stride; `bonked` runs from 0
 * to 1 through a knock on the head.
 */
export function animateWorker(
  model: T.Object3D,
  time: number,
  pose: {
    lag: number;
    bonked: number | null;
    holding: boolean;
    hammering: boolean;
  },
) {
  const sway = Math.sin(time * 10) * Math.min(pose.lag, 0.15);
  (model.userData.body as T.Group).rotation.z =
    pose.bonked === null ? sway : Math.sin(pose.bonked * Math.PI) * 1.3;
  const legs = model.userData.legs as T.Group[],
    arms = model.userData.arms as T.Group[];
  for (let i = 0; i < 2; i++) {
    const swing = Math.sin(time * 11 + i * Math.PI);
    legs[i].rotation.x = swing * Math.min(pose.lag * 5, 0.6);
    arms[i].rotation.x = pose.holding
      ? -2.4
      : pose.hammering
        ? -1.2 + Math.sin(time * 28) * 0.8
        : swing * Math.min(pose.lag * 3, 0.4);
  }
}
export function makePiece(kind: ItemKind, appearance: Appearance = {}) {
  const g = new T.Group();
  const paint = paintHex(appearance);
  if (makeHomeModel(g, kind, paint)) return g;
  const wood = '#bf956d',
    cream = paint || '#f0d7b4',
    dark = '#805d45';
  const panel = (w: number, h: number, y: number) => {
    box(g, w, h, 0.26, cream, 0, y, 0);
    if (appearance.finish === 'brickwork')
      for (const z of [-0.139, 0.139]) {
        for (let row = 0; row < Math.ceil(h / 0.28); row++) {
          const bottom = y - h / 2 + row * 0.28,
            height = Math.min(0.28, y + h / 2 - bottom);
          box(g, w, 0.018, 0.01, '#e8dfcc', 0, bottom, z);
          for (let x = -w / 2 + 0.48 + (row % 2) * 0.24; x < w / 2; x += 0.48)
            box(g, 0.018, height, 0.01, '#e8dfcc', x, bottom + height / 2, z);
        }
      }
  };
  if (
    ['wall', 'window', 'door'].includes(kind) &&
    appearance.finish &&
    appearance.finish !== 'classic'
  ) {
    if (kind === 'wall') panel(1.98, 2.7, 1.38);
    else if (kind === 'window') {
      panel(1.98, 0.78, 0.46);
      panel(1.98, 0.44, 2.48);
      [-0.86, 0.86].forEach((x) => box(g, 0.26, 1.44, 0.27, cream, x, 1.55, 0));
      box(g, 1.46, 1.42, 0.08, '#95d2d7', 0, 1.55, 0);
      box(g, 1.7, 0.1, 0.42, '#f3f2df', 0, 0.87, 0);
      box(g, 0.07, 1.4, 0.12, '#f3f2df', 0, 1.55, 0.04);
    } else {
      [-0.88, 0.88].forEach((x) => box(g, 0.22, 2.7, 0.35, cream, x, 1.38, 0));
      panel(1.98, 0.22, 2.62);
    }
    return g;
  }
  if (
    kind === 'floor' &&
    appearance.finish &&
    appearance.finish !== 'classic'
  ) {
    box(g, 1.98, 0.13, 1.98, '#91a39c', 0, 0.14, 0, true);
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++)
        box(
          g,
          0.468,
          0.03,
          0.468,
          appearance.finish === 'checker' && (x + z) % 2
            ? '#f3f2df'
            : paint || '#548dc5',
          -0.735 + x * 0.49,
          0.22,
          -0.735 + z * 0.49,
        );
    return g;
  }
  if (kind === 'fridge') {
    box(g, 1.05, 1.9, 1, '#8ec8bb', 0, 0.95, 0, true);
    box(g, 0.98, 1.12, 0.06, '#a8ddd0', 0, 0.63, 0.51, true);
    box(g, 0.98, 0.58, 0.06, '#a8ddd0', 0, 1.52, 0.51, true);
    [0.77, 1.5].forEach((y) =>
      box(g, 0.055, 0.32, 0.08, '#eaf4df', 0.36, y, 0.57, true),
    );
    box(g, 0.2, 0.18, 0.02, '#f5ca57', -0.22, 1.55, 0.56);
  } else if (kind === 'washer') {
    box(g, 1.15, 1.15, 1.1, '#e9efe8', 0, 0.575, 0, true);
    const rim = cylinder(g, 0.38, 0.38, 0.08, '#6e9296', 0, 0.52, 0.57, 20);
    rim.rotation.x = Math.PI / 2;
    const glass = cylinder(g, 0.29, 0.29, 0.09, '#375e68', 0, 0.52, 0.59, 20);
    glass.rotation.x = Math.PI / 2;
    box(g, 0.9, 0.17, 0.03, '#c8d6d0', 0, 0.99, 0.57, true);
    sphere(g, 0.07, '#dba754', 0.32, 0.99, 0.63);
  } else if (kind === 'clock') {
    box(g, 0.78, 2.24, 0.55, '#a57348', 0, 1.12, 0, true);
    box(g, 0.57, 1.05, 0.03, '#594737', 0, 0.78, 0.29);
    const face = cylinder(g, 0.28, 0.28, 0.04, '#fff0c9', 0, 1.78, 0.3, 20);
    face.rotation.x = Math.PI / 2;
    box(g, 0.025, 0.21, 0.04, dark, 0, 1.86, 0.34);
    beam(g, [0, 1.78, 0.34], [0.15, 1.72, 0.34], 0.025, dark);
    box(g, 0.025, 0.72, 0.03, '#e2b657', 0, 0.92, 0.33);
    sphere(g, 0.14, '#e2b657', 0, 0.56, 0.34);
  } else if (kind === 'duck') {
    const body = sphere(g, 0.28, '#ffd04f', 0, 0.23, 0, 2);
    body.scale.set(1, 0.75, 1.2);
    sphere(g, 0.19, '#ffe073', 0, 0.42, 0.19, 2);
    box(g, 0.22, 0.08, 0.2, '#ef9043', 0, 0.38, 0.36, true);
    [-0.13, 0.13].forEach((x) => sphere(g, 0.027, '#344842', x, 0.46, 0.3));
  }
  if (kind === 'wall') {
    box(g, 1.94, 2.55, 0.25, cream, 0, 1.33, 0, true);
    [-0.9, 0.9].forEach((x) => box(g, 0.13, 2.7, 0.32, wood, x, 1.38, 0));
    [0.17, 2.59].forEach((y) => box(g, 2, 0.13, 0.32, wood, 0, y, 0));
    beam(g, [-0.8, 0.27, 0.16], [0.8, 2.46, 0.16], 0.09, '#d0ac83');
  } else if (kind === 'window') {
    box(g, 1.94, 0.78, 0.26, cream, 0, 0.46, 0);
    box(g, 1.94, 0.44, 0.26, cream, 0, 2.42, 0);
    [-0.87, 0.87].forEach((x) => box(g, 0.25, 2.64, 0.3, wood, x, 1.36, 0));
    box(g, 1.5, 1.35, 0.08, '#95d2d7', 0, 1.51, 0);
    box(g, 1.7, 0.13, 0.45, '#f8f5e7', 0, 0.84, 0);
    box(g, 0.09, 1.4, 0.14, '#f8f5e7', 0, 1.52, 0.05);
    box(g, 1.5, 0.07, 0.14, '#f8f5e7', 0, 1.48, 0.05);
  } else if (kind === 'door') {
    [-0.88, 0.88].forEach((x) => box(g, 0.22, 2.7, 0.35, wood, x, 1.4, 0));
    box(g, 2, 0.21, 0.35, wood, 0, 2.64, 0);
    // The visible open doorway matches its physical frame.
    box(g, 0.15, 2.5, 0.42, '#df9c65', -0.9, 1.3, 0.25, true);
  } else if (kind === 'roof') {
    // A flat bearing frame meets every wall orientation at the 2.76-unit wall top.
    box(g, 2, 0.12, 2, '#bf956d', 0, 2.79, 0);
    const a = box(g, 2, 0.14, 1.17, '#d97554', 0, 3.03, -0.4775);
    a.rotation.x = -0.6;
    const b = box(g, 2, 0.14, 1.17, '#e68b5d', 0, 3.03, 0.4775);
    b.rotation.x = 0.6;
    for (let x = -0.9; x <= 1; x += 0.45) {
      beam(g, [x, 2.64, -0.98], [x, 3.42, 0], 0.055, '#b35e48');
      beam(g, [x, 3.42, 0], [x, 2.64, 0.98], 0.055, '#c06847');
    }
    box(g, 2, 0.14, 0.18, '#c16545', 0, 3.42, 0, true);
  } else if (kind === 'stairs') {
    for (let i = 0; i < 12; i++) {
      const h = (i + 1) * 0.25,
        z = 2 - (i + 0.5) / 3;
      box(g, 1.98, h, 1 / 3, wood, 0, h / 2, z, true);
      box(g, 1.96, 0.025, 0.3, '#dfbf91', 0, h + 0.012, z);
    }
    // Painted direction arrow is part of the stair tread, pointing upstairs.
    const arrow = new T.ArrowHelper(
      new T.Vector3(0, 0, -1),
      new T.Vector3(0, 0.29, 1.82),
      0.5,
      0xffcc4c,
      0.2,
      0.2,
    );
    g.add(arrow);
  } else if (kind === 'floor') {
    box(g, 1.98, 0.13, 1.98, wood, 0, 0.14, 0, true);
    for (let x = -0.74; x < 1; x += 0.49)
      box(g, 0.44, 0.03, 1.94, '#d9b38b', x, 0.22, 0);
  } else if (kind === 'sofa') {
    [-0.7, 0.7].forEach((x) =>
      [-0.35, 0.35].forEach((z) => box(g, 0.14, 0.24, 0.14, dark, x, 0.16, z)),
    );
    box(g, 1.95, 0.42, 0.96, '#d99929', 0, 0.43, 0, true);
    box(g, 1.9, 0.77, 0.24, '#e9b840', 0, 0.83, -0.44, true);
    [-0.91, 0.91].forEach((x) =>
      box(g, 0.25, 0.68, 1, '#edbe48', x, 0.69, 0, true),
    );
    [-0.4, 0.4].forEach((x) =>
      box(g, 0.73, 0.2, 0.73, '#f2c95c', x, 0.69, 0.04, true),
    );
    const cushion = box(g, 0.4, 0.43, 0.15, '#f1e4c5', -0.5, 0.97, -0.22, true);
    cushion.rotation.z = -0.18;
  } else if (kind === 'table') {
    [-0.65, 0.65].forEach((x) =>
      [-0.43, 0.43].forEach((z) => box(g, 0.14, 0.95, 0.14, dark, x, 0.53, z)),
    );
    box(g, 1.7, 0.16, 1.2, '#cfa06c', 0, 1.05, 0, true);
    box(g, 1.65, 0.015, 0.035, '#ad7d4f', 0, 1.138, -0.26);
    box(g, 1.65, 0.015, 0.035, '#ad7d4f', 0, 1.138, 0.26);
  } else if (kind === 'chair') {
    [-0.26, 0.26].forEach((x) =>
      [-0.25, 0.25].forEach((z) => box(g, 0.09, 0.62, 0.09, dark, x, 0.35, z)),
    );
    box(g, 0.75, 0.16, 0.7, '#6caa95', 0, 0.68, 0, true);
    [-0.27, 0.27].forEach((x) => box(g, 0.09, 0.9, 0.09, dark, x, 1, -0.28));
    box(g, 0.7, 0.5, 0.13, '#79b8a5', 0, 1.27, -0.28, true);
  } else if (kind === 'bed') {
    box(g, 1.55, 0.35, 2.1, wood, 0, 0.31, 0, true);
    box(g, 1.5, 0.3, 2, '#f4f0dd', 0, 0.6, 0, true);
    box(g, 1.55, 0.15, 1.45, '#83b8c5', 0, 0.8, 0.27, true);
    box(g, 1.2, 0.18, 0.48, '#fffcf3', 0, 0.83, -0.68, true);
    box(g, 1.66, 0.9, 0.15, wood, 0, 0.6, -1.07, true);
  } else if (kind === 'plant') {
    cylinder(g, 0.37, 0.26, 0.65, '#cd845d', 0, 0.38, 0);
    cylinder(g, 0.4, 0.38, 0.12, '#e5a278', 0, 0.7, 0);
    cylinder(g, 0.33, 0.33, 0.04, '#6d5844', 0, 0.765, 0);
    cylinder(g, 0.045, 0.045, 0.8, '#64815b', 0, 1.13, 0);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const leaf = sphere(
        g,
        0.32,
        i % 2 ? '#719951' : '#87ac61',
        Math.sin(angle) * 0.21,
        0.93 + i * 0.105,
        Math.cos(angle) * 0.21,
      );
      leaf.scale.set(0.68, 1.3, 0.54);
      leaf.rotation.z = Math.sin(angle) * 0.65;
    }
  } else if (kind === 'lamp') {
    cylinder(g, 0.32, 0.37, 0.12, '#4d6862', 0, 0.12, 0);
    cylinder(g, 0.035, 0.035, 1.85, '#516c67', 0, 1.03, 0);
    cylinder(g, 0.3, 0.56, 0.58, '#f5d993', 0, 1.97, 0);
    cylinder(g, 0.025, 0.025, 0.14, '#516c67', 0, 2.33, 0);
  } else if (kind === 'toilet') {
    box(g, 0.5, 0.55, 0.62, '#d9e6e3', 0, 0.32, 0.13, true);
    const bowl = sphere(g, 0.43, '#f3f7ee', 0, 0.64, 0.16, 2);
    bowl.scale.set(1, 0.5, 1.25);
    const seat = cylinder(g, 0.27, 0.27, 0.045, '#91a9a3', 0, 0.845, 0.18, 16);
    seat.scale.z = 1.3;
    box(g, 0.7, 0.94, 0.32, '#f5f8f1', 0, 0.59, -0.35, true);
    box(g, 0.75, 0.09, 0.38, '#e4ede5', 0, 1.09, -0.35, true);
    box(g, 0.12, 0.04, 0.09, '#a0b6ad', 0.21, 1.155, -0.35, true);
  } else if (kind === 'cone') {
    cone(g, 0, 0);
  } else if (kind === 'workbench') {
    [-0.85, 0.85].forEach((x) =>
      [-0.4, 0.4].forEach((z) =>
        box(g, 0.12, 1.1, 0.12, '#9a7754', x, 0.55, z),
      ),
    );
    box(g, 2.3, 0.18, 1.3, '#be9463', 0, 1.14, 0, true);
    box(g, 1.1, 0.15, 0.37, '#f0d7aa', -0.3, 1.32, 0.1);
    const saw = cylinder(g, 0.31, 0.31, 0.035, '#a3b3ac', 0.62, 1.4, -0.1, 14);
    saw.rotation.z = Math.PI / 2;
  } else if (kind === 'pallet') {
    for (let i = 0; i < 5; i++)
      box(g, 2.2, 0.13, 0.23, '#c69560', 0, 0.23, -0.6 + i * 0.3);
    [-0.8, 0.8].forEach((x) => box(g, 0.16, 0.16, 1.4, '#9b744f', x, 0.08, 0));
  } else if (kind === 'bricks') {
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++)
        box(
          g,
          0.58,
          0.22,
          0.36,
          y % 2 ? '#d99770' : '#c58460',
          -0.61 + x * 0.61,
          0.12 + y * 0.23,
          0,
          true,
        );
  } else if (kind === 'barrow') {
    box(g, 0.9, 0.36, 1.1, '#e8b644', 0, 0.75, 0, true);
    beam(g, [-0.38, 0.6, 0], [-0.38, 0.9, 1.3], 0.08, '#688077');
    beam(g, [0.38, 0.6, 0], [0.38, 0.9, 1.3], 0.08, '#688077');
    const wheel = cylinder(g, 0.28, 0.28, 0.17, '#435650', 0, 0.32, -0.48);
    wheel.rotation.z = Math.PI / 2;
  } else if (kind === 'bone') {
    box(g, 0.65, 0.19, 0.19, '#f6ecd3', 0, 0.16, 0, true);
    [-0.36, 0.36].forEach((x) =>
      [-0.1, 0.1].forEach((z) => sphere(g, 0.15, '#fff4df', x, 0.17, z, 1)),
    );
  }
  // Replace body finishes by assigning cached materials; never recolor a shared material.
  const surfaces: Partial<Record<ItemKind, string[]>> = {
    floor: ['#bf956d', '#d9b38b'],
    roof: ['#d97554', '#e68b5d', '#b35e48', '#c06847', '#c16545'],
    door: ['#bf956d', '#df9c65'],
    stairs: ['#bf956d', '#dfbf91'],
    sofa: ['#d99929', '#e9b840', '#edbe48', '#f2c95c'],
    table: ['#cfa06c'],
    chair: ['#6caa95', '#79b8a5'],
    bed: ['#83b8c5'],
    plant: ['#cd845d', '#e5a278'],
    lamp: ['#f5d993'],
    toilet: ['#d9e6e3', '#f3f7ee', '#f5f8f1', '#e4ede5'],
    fridge: ['#8ec8bb', '#a8ddd0'],
    washer: ['#e9efe8'],
    clock: ['#a57348'],
    duck: ['#ffd04f', '#ffe073'],
    workbench: ['#be9463'],
    barrow: ['#e8b644'],
    cone: ['#ee8c4d'],
    pallet: ['#c69560'],
    bricks: ['#c58460', '#d99770'],
    bone: ['#f6ecd3', '#fff4df'],
  };
  if (paint)
    g.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        o.material instanceof T.MeshStandardMaterial &&
        surfaces[kind]?.includes('#' + o.material.color.getHexString())
      )
        o.material = mat(paint);
    });
  return g;
}

export function disposePiece(group: T.Object3D, clonedMaterials = false) {
  group.traverse((object) => {
    if (object instanceof T.Mesh || object instanceof T.Line) {
      if (!object.geometry.userData.shared) object.geometry.dispose();
      if (
        clonedMaterials ||
        object.userData.ownedMaterial ||
        object instanceof T.Line
      )
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => material.dispose());
    }
  });
}

function tree(g: T.Group, x: number, z: number, scale = 1) {
  const t = new T.Group();
  t.position.set(x, 0, z);
  t.scale.setScalar(scale);
  g.add(t);
  cylinder(t, 0.14, 0.22, 1.6, '#a38561', 0, 0.7, 0, 7);
  sphere(t, 1.18, '#6e9c79', 0, 2.25, 0);
  sphere(t, 0.95, '#80ad83', -0.4, 2.85, 0.1);
  sphere(t, 0.91, '#8bb18a', 0.62, 2.48, 0.16);
}
function cone(g: T.Group, x: number, z: number) {
  box(g, 0.55, 0.08, 0.55, '#384f4a', x, 0.08, z, true);
  cylinder(g, 0.045, 0.22, 0.65, '#ee8c4d', x, 0.43, z, 8);
  cylinder(g, 0.102, 0.15, 0.17, '#fff1d0', x, 0.45, z, 8);
}
export function environment(map: MapId = 'small') {
  const { scale } = mapConfig(map);
  const g = new T.Group();
  box(g, 29, 1.1, 24, '#90ac94', 0, -0.64, 0, true);
  box(g, 28.9, 0.15, 23.9, '#aec9a8', 0, -0.05, 0, true);
  box(g, 19.4, 0.13, 16.4, '#c8b69b', 0, 0.06, 0, true);
  box(g, 18.5, 0.08, 15.5, '#d5c4a4', 0, 0.14, 0, true);
  box(g, 9.4, 0.17, 9.4, '#a1a89d', 0, 0.24, -0.5, true);
  box(g, 9, 0.08, 9, '#d9d6ba', 0, 0.365, -0.5);
  for (let i = -4; i <= 4; i++) {
    box(g, 0.018, 0.012, 9, '#bdbaa3', i, 0.412, -0.5);
    box(g, 9, 0.012, 0.018, '#bdbaa3', 0, 0.412, i - 0.5);
  }
  for (const x of [-4.7, 4.7])
    for (const z of [-5.2, 4.2]) {
      box(g, 0.14, 0.72, 0.14, '#edbc43', x, 0.52, z);
      box(g, 0.21, 0.09, 0.21, '#fff0b0', x, 0.9, z);
    }
  box(g, 29, 0.04, 3, '#879b91', 0, 0.03, 10.2);
  for (let x = -13; x < 14; x += 3)
    box(g, 1.5, 0.015, 0.07, '#dce0c9', x, 0.06, 10.2);
  for (let x = -13; x <= 13; x += 1.3) {
    box(g, 0.13, 1.25, 0.14, '#e1d9b7', x, 0.57, -9);
  }
  box(g, 27, 0.12, 0.13, '#e1d9b7', 0, 0.47, -9);
  box(g, 27, 0.12, 0.13, '#e1d9b7', 0, 0.92, -9);
  for (const x of [-12, 12]) {
    for (let z = -8; z < 8; z += 1.3)
      box(g, 0.14, 1.15, 0.13, '#e1d9b7', x, 0.52, z);
    box(g, 0.13, 0.12, 16, '#e1d9b7', x, 0.45, 0);
    box(g, 0.13, 0.12, 16, '#e1d9b7', x, 0.88, 0);
  }
  [
    [-11, -7, 1.2],
    [-10, -10, 1.4],
    [-13, -2, 1.1],
    [11, -8, 1.3],
    [13, 4, 1.2],
    [-12, 7, 1],
    [8, -11, 0.9],
  ].forEach(([x, z, s]) => tree(g, x, z, s));
  // Expand only the terrain, markings and fences. Trees keep their proportions.
  for (const child of g.children) {
    child.position.x *= scale;
    child.position.z *= scale;
    if (child instanceof T.Mesh) {
      child.scale.x *= scale;
      child.scale.z *= scale;
    }
  }
  // Site crane: exposed structure and a gently swaying suspended hook.
  const crane = new T.Group();
  crane.position.set(7 * scale, 0.2, -6 * scale);
  g.add(crane);
  box(crane, 2.2, 0.25, 2.1, '#6c8174', 0, 0.16, 0, true);
  for (let y = 0.3; y < 11.8; y += 1.15) {
    [-0.36, 0.36].forEach((x) =>
      [-0.36, 0.36].forEach((z) =>
        box(crane, 0.13, 1.18, 0.13, '#efba38', x, y + 0.6, z),
      ),
    );
    beam(crane, [-0.36, y, 0.36], [0.36, y + 1.15, 0.36], 0.08, '#fbd063');
    beam(crane, [0.36, y, -0.36], [0.36, y + 1.15, 0.36], 0.08, '#d99e28');
  }
  const rig = new T.Group();
  rig.position.y = 4.6;
  crane.add(rig);
  g.userData.craneRig = rig;
  box(rig, 18.1 * scale, 0.18, 0.75, '#efba38', -7.05 * scale, 7.1, 0);
  box(rig, 18.1 * scale, 0.13, 0.65, '#f8ce58', -7.05 * scale, 7.8, 0);
  for (let x = -16 * scale; x < 2; x += 0.75) {
    beam(rig, [x, 7.15, 0.28], [x + 0.75, 7.77, 0.28], 0.065, '#e0a02c');
    beam(rig, [x, 7.15, -0.28], [x + 0.75, 7.77, -0.28], 0.065, '#e0a02c');
  }
  box(rig, 1.45, 0.65, 1.2, '#526d65', 1.3, 7.5, 0, true);
  box(rig, 1.1, 1.15, 1.2, '#eaba3e', -0.65, 6.4, 0, true);
  box(rig, 1.13, 0.62, 0.03, '#8ac6cd', -0.65, 6.6, 0.62);
  const hook = new T.Group();
  hook.position.set(-3.2, 7.1, 0);
  rig.add(hook);
  box(hook, 0.5, 0.18, 0.8, '#52655f', 0, -0.03, 0, true);
  hook.userData.cable = cylinder(
    hook,
    0.022,
    0.022,
    1,
    '#566964',
    0,
    -1.7,
    0,
    6,
  );
  const block = new T.Group();
  hook.add(block);
  hook.userData.block = block;
  box(block, 0.27, 0.35, 0.25, '#e8af2e', 0, 0, 0, true);
  const hookCurve = new T.Mesh(
    new T.TorusGeometry(0.2, 0.055, 5, 10, Math.PI * 1.4),
    mat('#52655f'),
  );
  hookCurve.position.set(0.04, -0.22, 0);
  hookCurve.rotation.z = -0.3;
  block.add(hookCurve);
  g.userData.hook = hook;
  // Low delivery cradles make the roof modules obvious and keep them clear of supplies.
  for (const [x, z] of [
    [7.6, -3.3],
    [3.8, -6.3],
  ]) {
    for (const offset of [-0.8, 0.8])
      box(g, 2.15, 0.12, 0.22, '#b58c5e', x * scale, 0.22, z * scale + offset);
    const sign = label('ROOF · CRANE', '#293c3b', '#ffe6a0', 2.15);
    sign.position.set(x * scale, 1.65, z * scale);
    g.add(sign);
  }
  // A little site office.
  const office = new T.Group();
  office.position.set(-7.7 * scale, 0.18, -6.6 * scale);
  g.add(office);
  box(office, 3.3, 2.2, 2.3, '#e9e3c9', 0, 1.25, 0, true);
  box(office, 3.5, 0.22, 2.5, '#617f73', 0, 2.48, 0, true);
  box(office, 1.18, 1.83, 0.06, '#dfb443', 0.73, 1.16, 1.19, true);
  box(office, 0.72, 0.75, 0.08, '#85bfc7', 0.74, 1.56, 1.24);
  box(office, 0.9, 0.8, 0.06, '#83b9c0', -0.89, 1.63, 1.19);
  box(office, 0.07, 0.85, 0.07, '#f7f0d6', -0.89, 1.63, 1.23);
  box(office, 1.5, 0.22, 0.6, '#9eaa97', 0.65, 0.12, 1.45);
  // Movable supplies are shared world pieces, with matching physics and interaction targets.
  // A rounded tradesman's van with readable panels, glazing and roof-rack equipment.
  const van = new T.Group();
  van.position.set(-7.7 * scale, 0.1, 8.4 * scale);
  van.rotation.y = Math.PI / 2;
  g.add(van);
  box(van, 1.85, 0.25, 3.75, '#40544d', 0, 0.53, 0, true);
  box(van, 1.82, 1.58, 2.35, '#f2bf3f', 0, 1.36, -0.57, true);
  box(van, 1.78, 1.22, 1.2, '#f7ce56', 0, 1.14, 1.17, true);
  box(van, 1.66, 0.4, 0.55, '#f2bf3f', 0, 0.94, 1.63, true);
  box(van, 1.68, 0.67, 0.1, '#40544d', 0, 1.5, 1.6, true);
  box(van, 1.51, 0.52, 0.11, '#82b3b4', 0, 1.52, 1.62, true);
  for (const x of [-0.4, 0.4])
    beam(van, [x - 0.22, 1.3, 1.69], [x + 0.15, 1.39, 1.69], 0.028, '#40544d');
  box(van, 0.9, 0.23, 0.08, '#40544d', 0, 0.82, 1.93, true);
  for (const y of [0.77, 0.84, 0.91])
    box(van, 0.76, 0.022, 0.02, '#9ba99d', 0, y, 1.978);
  for (const side of [-1, 1]) {
    box(van, 0.07, 0.6, 0.79, '#40544d', side * 0.91, 1.5, 1.12, true);
    box(van, 0.08, 0.46, 0.63, '#8fc3c5', side * 0.918, 1.53, 1.12, true);
    box(van, 0.025, 0.04, 3.1, '#d5a135', side * 0.921, 0.8, -0.12);
    box(van, 0.035, 1.2, 0.024, '#c09332', side * 0.924, 1.2, 0.58);
    box(van, 0.035, 0.97, 0.025, '#c09332', side * 0.924, 1.29, -1.34);
    box(van, 0.06, 0.055, 0.23, '#40544d', side * 0.948, 1.22, 0.76, true);
    box(van, 0.06, 0.055, 0.28, '#40544d', side * 0.948, 1.26, -0.1, true);
    box(van, 0.045, 0.07, 1.62, '#dfae37', side * 0.929, 1.35, -0.58);
    box(van, 0.08, 0.23, 1.15, '#617f73', side * 0.936, 1.69, -0.65, true);
    beam(
      van,
      [side * 0.9, 1.42, 1.48],
      [side * 1.14, 1.42, 1.58],
      0.065,
      '#40544d',
    );
    box(van, 0.14, 0.27, 0.25, '#40544d', side * 1.17, 1.51, 1.57, true);
    box(van, 0.022, 0.19, 0.17, '#bad8d2', side * 1.25, 1.53, 1.57, true);
    box(van, 0.32, 0.23, 0.09, '#fff1ba', side * 0.64, 0.98, 1.91, true);
    box(van, 0.12, 0.12, 0.1, '#ed9546', side * 0.82, 0.93, 1.91, true);
    box(van, 0.15, 0.4, 0.1, '#c65c46', side * 0.78, 0.95, -1.78, true);
    box(van, 0.16, 0.08, 0.11, '#f5ebbf', side * 0.78, 1.02, -1.78);
    for (const z of [-1.05, 1.08]) {
      const arch = new T.Mesh(
        new T.TorusGeometry(0.42, 0.075, 6, 16, Math.PI),
        mat('#536b61'),
      );
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * 0.94, 0.46, z);
      van.add(arch);
      const tire = cylinder(
        van,
        0.37,
        0.37,
        0.25,
        '#34413d',
        side * 0.96,
        0.4,
        z,
        16,
      );
      tire.rotation.z = Math.PI / 2;
      const rim = cylinder(
        van,
        0.23,
        0.23,
        0.27,
        '#aab8aa',
        side * 0.97,
        0.4,
        z,
        12,
      );
      rim.rotation.z = Math.PI / 2;
      const hub = cylinder(
        van,
        0.11,
        0.11,
        0.28,
        '#536b61',
        side * 0.98,
        0.4,
        z,
        10,
      );
      hub.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++)
        sphere(
          van,
          0.026,
          '#e4e6d2',
          side * 1.115,
          0.4 + Math.sin((i * Math.PI * 2) / 5) * 0.16,
          z + Math.cos((i * Math.PI * 2) / 5) * 0.16,
          0,
        );
      box(van, 0.07, 0.26, 0.2, '#40544d', side * 0.85, 0.27, z - 0.35);
    }
    box(van, 0.07, 0.12, 2.05, '#617f73', side * 0.64, 2.22, -0.6);
  }
  for (const z of [-1.38, 0.18]) box(van, 1.7, 0.09, 0.1, '#617f73', 0, 2.2, z);
  for (const x of [-0.28, 0.28])
    box(van, 0.06, 0.07, 2.4, '#cdd4c3', x, 2.35, -0.54);
  for (let z = -1.65; z < 0.65; z += 0.28)
    box(van, 0.59, 0.055, 0.06, '#dfe1cf', 0, 2.35, z);
  box(van, 1.86, 0.16, 0.18, '#536b61', 0, 0.6, 1.92, true);
  box(van, 1.86, 0.16, 0.18, '#536b61', 0, 0.6, -1.86, true);
  box(van, 0.43, 0.12, 0.024, '#f3ecd6', 0, 0.65, 2.02, true);
  box(van, 0.025, 1.24, 0.03, '#c09332', 0, 1.36, -1.755);
  for (const x of [-0.12, 0.12])
    box(van, 0.055, 0.16, 0.04, '#40544d', x, 1.3, -1.79, true);
  // Hand-built plants make the edges feel alive without distracting from the plot.
  for (let i = 0; i < 33; i++) {
    const x = Math.sin(i * 7.13) * 13.1,
      z = Math.cos(i * 9.21) * 10.8;
    if (Math.abs(x) < 10 && Math.abs(z) < 8.4) continue;
    sphere(g, 0.18 + (i % 3) * 0.06, '#90b087', x * scale, 0.18, z * scale, 0);
    if (i % 3 === 0) sphere(g, 0.065, '#f5e7ac', x * scale, 0.41, z * scale, 0);
  }
  batchScenery(g, rig);
  return g;
}
