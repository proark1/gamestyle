import * as T from 'three';
import { box, ball, taper, beam } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { TEAM, CLOTH } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { CAGE_RADIUS, type Fighter, type Grapple } from './types';
import { cageVertices } from './physics';
import { MOVES } from './combat';
import { label } from './signage';
import { createRingside } from './ringside';

export function createCage() {
  const root = new T.Group();
  box(root, [35, 0.3, 30], [0, -0.8, 0], '#9aab95', true);
  const base = new T.Mesh(
    new T.CylinderGeometry(CAGE_RADIUS + 0.35, CAGE_RADIUS + 0.5, 0.6, 8),
    new T.MeshStandardMaterial({ color: '#355a55', roughness: 0.85 }),
  );
  base.rotation.y = Math.PI / 8;
  base.position.y = -0.27;
  base.receiveShadow = true;
  root.add(base);
  const mat = new T.Mesh(
    new T.CylinderGeometry(CAGE_RADIUS, CAGE_RADIUS, 0.06, 8),
    new T.MeshStandardMaterial({ color: '#8cae9c', roughness: 0.9 }),
  );
  mat.rotation.y = Math.PI / 8;
  mat.position.y = 0.05;
  mat.receiveShadow = true;
  root.add(mat);
  const center = label('CAGE CLASH', '#f6e5bd', '#527c69', 4.2, 0.9);
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.09, 0);
  root.add(center);
  const sub = label('JUMBLEYARD FIGHT CLUB', '#f6e5bd', '#527c69', 3.4, 0.35);
  sub.rotation.x = -Math.PI / 2;
  sub.position.set(0, 0.095, 0.72);
  root.add(sub);
  const vertices = cageVertices();
  const fences: { material: T.LineBasicMaterial; x: number; z: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % 8];
    taper(root, 0.11, 0.14, 2.15, [a.x, 1.05, a.z], '#355a55', 10);
    ball(root, [0.15, 0.15, 0.15], [a.x, 2.16, a.z], '#e0bd70');
    beam(root, [a.x, 2.1, a.z], [b.x, 2.1, b.z], 0.1, '#355a55');
    beam(root, [a.x, 0.15, a.z], [b.x, 0.15, b.z], 0.1, '#355a55');
    const points: number[] = [];
    for (let j = -18; j <= 18; j++)
      for (const slope of [-1, 1]) {
        const u0 = j / 18,
          u1 = u0 + slope * 0.45;
        const start = Math.max(
          0,
          Math.min((0 - u0) / (u1 - u0), (1 - u0) / (u1 - u0)),
        );
        const end = Math.min(
          1,
          Math.max((0 - u0) / (u1 - u0), (1 - u0) / (u1 - u0)),
        );
        if (end <= start) continue;
        for (const t of [start, end]) {
          const u = u0 + (u1 - u0) * t;
          points.push(
            a.x + (b.x - a.x) * u,
            0.2 + 1.85 * t,
            a.z + (b.z - a.z) * u,
          );
        }
      }
    const material = new T.LineBasicMaterial({
      color: '#355a55',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    root.add(
      new T.LineSegments(
        new T.BufferGeometry().setAttribute(
          'position',
          new T.Float32BufferAttribute(points, 3),
        ),
        material,
      ),
    );
    fences.push({ material, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  }
  for (const [x, color] of [
    [-4.5, TEAM.red],
    [4.5, TEAM.blue],
  ] as const) {
    const corner = new T.Mesh(
      new T.CircleGeometry(0.42, 24),
      new T.MeshBasicMaterial({ color }),
    );
    corner.rotation.x = -Math.PI / 2;
    corner.position.set(x, 0.095, 0);
    root.add(corner);
  }
  const ringside = createRingside();
  root.add(ringside.root);
  return { root, fences, crowd: ringside.crowd };
}

export function createFighter(p: Fighter, look?: Look) {
  const root = new T.Group();
  const { model } = dressedGameAvatar(
    p.color,
    {
      shirt: TEAM[p.team],
      overalls: TEAM[p.team],
      boots: CLOTH.cream,
      trousers: false,
    },
    look,
  );
  root.add(model);
  const rig = model.userData as Record<string, T.Group>;
  for (const side of ['L', 'R']) {
    ball(
      rig[`sleeve${side}`],
      [0.14, 0.15, 0.16],
      [0, -0.39, 0.07],
      TEAM[p.team],
      16,
    );
    box(
      rig[`sleeve${side}`],
      [0.18, 0.1, 0.19],
      [0, -0.25, 0.04],
      CLOTH.cream,
      true,
    );
  }
  const ring = new T.Mesh(
    new T.RingGeometry(0.43, 0.51, 32),
    new T.MeshBasicMaterial({
      color: TEAM[p.team],
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.13;
  root.add(ring);
  const marker = new T.Mesh(
    new T.ConeGeometry(0.12, 0.26, 4),
    new T.MeshBasicMaterial({ color: '#f3ca6b' }),
  );
  marker.rotation.z = Math.PI;
  marker.position.y = 2.4;
  root.add(marker);
  return { root, model, rig, marker, ring, team: p.team };
}
export function poseFighter(
  visual: ReturnType<typeof createFighter>,
  p: Fighter,
  time: number,
  reduced: boolean,
  g: Grapple | null = null,
) {
  const { rig, model } = visual;
  const stride = Math.sin(time * 12) * Math.min(1, Math.hypot(p.vx, p.vz) / 3);
  model.position.y = p.down
    ? 0.35
    : reduced
      ? 0
      : Math.abs(Math.sin(time * 6)) * 0.025;
  model.rotation.set(
    p.down ? -Math.PI / 2 : p.dodge ? 0.35 : 0,
    p.heading,
    p.down ? 0.2 : 0,
  );
  rig.body.rotation.set(p.stagger ? -0.2 : 0.06, 0, 0);
  rig.legL.rotation.set(stride * 0.5, 0, -0.06);
  rig.legR.rotation.set(-stride * 0.5, 0, 0.06);
  rig.armL.rotation.set(p.guarding ? -2.3 : -1.2, 0.1, -0.25);
  rig.armR.rotation.set(p.guarding ? -2.3 : -1.2, -0.1, 0.25);
  if (p.charge > 0) {
    rig.armR.rotation.x = -0.6;
    rig.armR.rotation.z = 0.6;
    rig.body.rotation.y = -0.25;
  }
  if (p.attack > 0) {
    const profile = MOVES[p.move],
      elapsed = profile.duration - p.attack;
    const swing =
      elapsed < profile.windup
        ? (elapsed / profile.windup) ** 2
        : Math.max(
            0,
            1 -
              (elapsed - profile.windup) / (profile.duration - profile.windup),
          );
    if (p.move === 'kick') {
      rig.legR.rotation.x = -swing * 1.65;
      rig.legR.rotation.z = swing * 0.25;
      rig.body.rotation.x = -swing * 0.2;
    } else if (p.move === 'clinch') {
      rig.armL.rotation.x = rig.armR.rotation.x = -1.2 - swing * 0.6;
      rig.body.rotation.x = swing * 0.3;
    } else {
      const arm = p.move === 'jab' ? rig.armL : rig.armR;
      arm.rotation.x = -1.1 - swing;
      arm.rotation.y = p.move === 'hook' ? -swing * 0.8 : 0;
      rig.body.rotation.y = swing * 0.2;
    }
  }
  if (g?.mode === 'clinch') {
    rig.armL.rotation.x = rig.armR.rotation.x = -1.6;
    rig.body.rotation.x = 0.2;
  } else if (g) {
    const top = g.top === p.id;
    model.position.y = top ? 0.14 : 0.3;
    model.rotation.set(top ? 0.6 : -Math.PI / 2, top ? 0 : Math.PI, 0);
    rig.legL.rotation.x = rig.legR.rotation.x = top ? -1.6 : -0.55;
    rig.legL.rotation.z = top ? -0.48 : -0.25;
    rig.legR.rotation.z = top ? 0.48 : 0.25;
    rig.armL.rotation.x = rig.armR.rotation.x = top ? -1.25 : -1.9;
    if (p.attack > 0) rig.armR.rotation.x -= Math.sin(p.attack * 10) * 0.6;
    if (g.submissionBy === p.id)
      rig.armL.rotation.x = rig.armR.rotation.x = -1.9;
  }
}
