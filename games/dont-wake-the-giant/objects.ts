import * as T from 'three';
import { beam, box, label, material } from '../../shared/rendering/primitives';
import { worker } from '../../shared/rendering/worker';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { CHANDELIER, EXIT, SLIPPER, STATIC } from './level';
import type { ItemKind } from './types';

export function orb(
  g: T.Object3D,
  size: number[],
  pos: number[],
  color: string,
) {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 10), material(color));
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function cottage() {
  const group = new T.Group();
  for (const p of STATIC) {
    if (p.id === 'chandelier') continue;
    box(group, [p.w, p.h, p.d], [p.x, p.y - p.h / 2, p.z], p.color, true);
    if (['stool', 'nightstand', 'bed'].includes(p.id)) {
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          box(
            group,
            [0.27, p.y - p.h, 0.27],
            [
              p.x + x * (p.w / 2 - 0.3),
              (p.y - p.h) / 2,
              p.z + z * (p.d / 2 - 0.3),
            ],
            '#735538',
            true,
          );
    }
  }
  for (let z = -11.6; z < 12; z += 1.3)
    box(group, [27.8, 0.012, 0.025], [0, 0.015, z], '#987b57');
  for (let x = -12; x < 14; x += 4)
    for (let z = -11.6; z < 12; z += 2.6)
      box(group, [0.025, 0.014, 1.27], [x, 0.017, z], '#987b57');
  box(group, [28, 8, 0.4], [0, 3.3, -12], '#c3b69a');
  box(group, [0.4, 8, 24], [-14, 3.3, 0], '#b5b99b');
  for (const x of [-13.5, -5, 4, 13.5])
    box(group, [0.32, 8.4, 0.4], [x, 3.6, -11.7], '#765c43', true);
  for (const y of [0.4, 7.4])
    box(group, [28, 0.32, 0.5], [0, y, -11.7], '#765c43', true);
  for (const z of [-11.5, -4, 4, 11.5])
    box(group, [0.5, 8, 0.32], [-13.7, 3.4, z], '#765c43', true);
  // A cool moonlit window contrasts with the lamplit bed.
  box(group, [4.4, 4.4, 0.18], [8, 4.1, -11.68], '#766246', true);
  box(group, [3.8, 3.8, 0.1], [8, 4.1, -11.55], '#49686c', true);
  box(group, [0.16, 3.8, 0.13], [8, 4.1, -11.45], '#ceb284');
  box(group, [3.8, 0.16, 0.13], [8, 4.1, -11.45], '#ceb284');
  orb(group, [0.42, 0.42, 0.08], [8.9, 4.9, -11.43], '#f6e7b7');
  for (const x of [-2.9, 6.9])
    box(group, [0.3, 4, 0.3], [x, 2, -9.2], '#755735', true);
  box(group, [10, 2.1, 0.4], [2, 3, -9.3], '#9b7849', true);
  box(group, [5.5, 0.45, 2.9], [2, 2.9, -7.4], '#f5d388', true);
  // Huge slippers remain open from above so hiding thieves stay visible.
  box(
    group,
    [SLIPPER.w, 0.2, SLIPPER.d],
    [SLIPPER.x, 0.1, SLIPPER.z],
    '#718c7c',
    true,
  );
  for (const z of [-1, 1])
    box(
      group,
      [3, 0.7, 0.2],
      [SLIPPER.x, 0.45, SLIPPER.z + z],
      '#819a87',
      true,
    );
  box(
    group,
    [1, 0.8, 2.1],
    [SLIPPER.x - 1.05, 0.5, SLIPPER.z],
    '#819a87',
    true,
  );
  box(group, [4.4, 0.03, 3.9], [EXIT.x, 0.03, EXIT.z], '#718f73', true);
  for (const x of [-1.7, 1.7])
    box(group, [0.22, 3.1, 0.25], [EXIT.x + x, 1.55, 10.4], '#c9ad79', true);
  box(group, [3.8, 0.27, 0.28], [EXIT.x, 3.1, 10.4], '#c9ad79', true);
  const portal = new T.Mesh(
    new T.PlaneGeometry(3.1, 2.8),
    new T.MeshBasicMaterial({
      color: '#f9da85',
      transparent: true,
      opacity: 0.24,
      side: T.DoubleSide,
    }),
  );
  portal.position.set(EXIT.x, 1.5, 10.45);
  group.add(portal);
  const door = label('WAY OUT', '#f4d080', '#514b34', 2.8);
  door.position.set(EXIT.x, 3.65, 10.3);
  group.add(door);
  const stash = label('BANK YOUR LOOT', '#f4ead0', '#54634c', 2.8);
  stash.position.set(-10.2, 1.5, 9.7);
  group.add(stash);
  // Oversized lamp on the bedside table.
  box(group, [1.2, 0.22, 1.1], [-6.5, 3.55, -3.35], '#ad8746', true);
  beam(group, [-6.5, 3.6, -3.35], [-6.5, 5.1, -3.35], 0.14, '#9e7f43');
  const shade = new T.Mesh(
    new T.CylinderGeometry(0.65, 1, 1.2, 12, 1, true),
    material('#e6bf72'),
  );
  shade.position.set(-6.5, 5.2, -3.35);
  shade.castShadow = true;
  group.add(shade);
  // Rugs, a giant mug and scattered books give scale without hiding routes.
  box(group, [5, 0.018, 3], [8.8, 0.026, 5.2], '#a96749');
  for (let n = 0; n < 5; n++)
    box(group, [4.8, 0.02, 0.08], [8.8, 0.04, 4.1 + n * 0.55], '#d4ac74');
  orb(group, [0.75, 1, 0.75], [10, 0.9, -7.5], '#819b91');
  const chandelier = new T.Group();
  for (const z of [-1.15, 0, 1.15])
    box(chandelier, [4, 0.22, 0.2], [0, -0.11, z], '#bd9147', true);
  for (const x of [-1.9, 0, 1.9])
    box(chandelier, [0.2, 0.22, 2.5], [x, -0.11, 0], '#bd9147', true);
  for (const x of [-1.7, 1.7])
    for (const z of [-1, 1]) {
      box(chandelier, [0.22, 0.55, 0.22], [x, 0.275, z], '#ffe5a1', true);
      orb(chandelier, [0.07, 0.18, 0.07], [x, 0.7, z], '#ffcf62');
    }
  beam(chandelier, [0, 0, 0], [0, 2.2, 0], 0.075, '#9c824d');
  chandelier.position.copy(CHANDELIER);
  group.add(chandelier);
  batchScenery(group);
  return group;
}
export function thief(color: number) {
  const g = worker(color);
  g.scale.setScalar(0.52);
  const body = g.userData.body as T.Group;
  box(body, [0.53, 0.18, 0.03], [0, 1.46, 0.27], '#334743', true);
  for (const x of [-0.12, 0.12])
    box(body, [0.07, 0.065, 0.025], [x, 1.46, 0.29], '#f8edd0');
  return g;
}
/** Walks a thief, hunched when crouching; `now` is in milliseconds. */
export function poseThief(
  model: T.Object3D,
  now: number,
  pose: { walking: boolean; crouch: boolean; carrying: boolean; down: boolean },
) {
  const stride = pose.walking
    ? Math.sin(now / (pose.crouch ? 150 : 95)) * 0.5
    : 0;
  model.userData.legL.rotation.x = stride;
  model.userData.legR.rotation.x = -stride;
  model.userData.armL.rotation.x = pose.carrying ? -1.2 : -stride * 0.6;
  model.userData.armR.rotation.x = pose.carrying ? -1.2 : stride * 0.6;
  model.userData.body.rotation.x = pose.down ? 1.15 : pose.crouch ? 0.22 : 0;
  model.userData.body.scale.y = pose.crouch ? 0.83 : 1;
}
export function itemModel(kind: ItemKind) {
  const g = new T.Group();
  if (kind === 'pillow')
    box(g, [1.7, 0.35, 1.4], [0, 0.105, 0], '#f1d38f', true);
  else if (kind === 'spoon') {
    box(g, [3.8, 0.16, 0.75], [-0.4, 0, 0], '#b3c4bd', true);
    orb(g, [0.65, 0.1, 0.42], [1.75, 0, 0], '#c9d5cd');
  } else if (kind === 'cup') {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(0.22, 0.16, 0.43, 12),
      material('#c6d1bc'),
    );
    mesh.position.y = 0.1;
    g.add(mesh);
    const handle = new T.Mesh(
      new T.TorusGeometry(0.14, 0.04, 6, 12),
      material('#c6d1bc'),
    );
    handle.position.set(0.24, 0.16, 0);
    g.add(handle);
  } else if (kind === 'necklace') {
    const loop = new T.Mesh(
      new T.TorusGeometry(0.37, 0.055, 6, 18),
      material('#d9a740'),
    );
    loop.rotation.x = Math.PI / 2;
    g.add(loop);
    const gem = new T.Mesh(new T.OctahedronGeometry(0.22), material('#df9860'));
    gem.position.set(0, 0.13, 0.33);
    g.add(gem);
  } else if (kind === 'gem') {
    const gem = new T.Mesh(new T.OctahedronGeometry(0.34), material('#73c4b4'));
    gem.scale.y = 0.85;
    gem.position.y = 0.16;
    g.add(gem);
    const base = new T.Mesh(
      new T.CylinderGeometry(0.25, 0.3, 0.09, 8),
      material('#d9ac4f'),
    );
    g.add(base);
  } else if (kind === 'pouch') {
    orb(g, [0.33, 0.34, 0.28], [0, 0.15, 0], '#b6834e');
    orb(g, [0.18, 0.09, 0.16], [0, 0.45, 0], '#e1b15c');
    box(g, [0.38, 0.05, 0.05], [0, 0.38, 0.1], '#eee0a3', true);
    for (const x of [-0.1, 0.1])
      orb(g, [0.1, 0.025, 0.1], [x, 0.52, 0], '#f3c967');
  } else if (kind === 'crown') {
    const band = new T.Mesh(
      new T.TorusGeometry(0.43, 0.095, 8, 20),
      material('#e6b84e'),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.12;
    g.add(band);
    for (let n = 0; n < 5; n++) {
      const angle = (n * Math.PI * 2) / 5;
      const spike = new T.Mesh(
        new T.ConeGeometry(0.14, 0.42, 4),
        material('#e6b84e'),
      );
      spike.position.set(Math.sin(angle) * 0.41, 0.27, Math.cos(angle) * 0.41);
      g.add(spike);
      orb(
        g,
        [0.07, 0.07, 0.07],
        [Math.sin(angle) * 0.41, 0.5, Math.cos(angle) * 0.41],
        '#b97c61',
      );
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const coin = new T.Mesh(
        new T.CylinderGeometry(0.23, 0.23, 0.09, 12),
        material('#e4b64f'),
      );
      coin.position.set((i - 1) * 0.12, i * 0.07, (i % 2) * 0.12);
      g.add(coin);
    }
  }
  g.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
