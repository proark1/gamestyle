import * as T from 'three';
import { box, material } from '../../shared/rendering/primitives';
import { BALL_RADIUS } from './physics';
import { HALF_D, HALF_W } from './structure';
import type { Part, PartKind } from './types';

export const PART_COLORS: Record<PartKind, string> = {
  column: '#cfc6b8',
  beam: '#c49a63',
  wall: '#b06a4e',
  slab: '#c3bcae',
  roof: '#8e8577',
};
const MORTAR = '#e3d9c8';

/** One mesh per part, sized on demand so the house stays data-driven. */
export function partMesh(part: Part) {
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(part.w, part.h, part.d),
    material(PART_COLORS[part.kind]),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  g.userData.body = body;
  g.userData.partId = part.id;
  // Brick courses and slab lips read as construction rather than plain boxes.
  if (part.kind === 'wall') {
    const courses = Math.max(1, Math.round(part.h / 0.7));
    for (let i = 1; i < courses; i++)
      box(
        g,
        [part.w * 1.005, 0.045, part.d * 1.005],
        [0, -part.h / 2 + (i * part.h) / courses, 0],
        MORTAR,
      );
  }
  if (part.kind === 'slab' || part.kind === 'roof')
    box(g, [part.w * 1.01, 0.07, part.d * 1.01], [0, part.h / 2, 0], MORTAR);
  if (part.kind === 'column')
    for (const y of [-part.h / 2 + 0.12, part.h / 2 - 0.12])
      box(g, [part.w * 1.15, 0.16, part.d * 1.15], [0, y, 0], '#b8ae9e', true);
  const cracks = new T.Mesh(
    new T.BoxGeometry(part.w * 1.02, part.h * 1.02, part.d * 1.02),
    new T.MeshBasicMaterial({
      color: '#3a2c22',
      transparent: true,
      opacity: 0,
      wireframe: true,
    }),
  );
  g.add(cracks);
  g.userData.cracks = cracks;
  const paint = new T.Mesh(
    new T.TorusGeometry(Math.min(part.w, part.d) * 0.34, 0.055, 6, 16),
    new T.MeshBasicMaterial({ color: '#f58b39' }),
  );
  paint.position.z = part.d / 2 + 0.03;
  paint.visible = false;
  g.add(paint);
  g.userData.paint = paint;
  return g;
}

export function piano() {
  const g = new T.Group();
  box(g, [1.5, 0.95, 0.7], [0, 0.05, 0], '#4a3327', true);
  box(g, [1.42, 0.1, 0.34], [0, 0.14, 0.2], '#f4ead6');
  for (let i = 0; i < 9; i++)
    box(g, [0.05, 0.11, 0.2], [-0.6 + i * 0.15, 0.15, 0.24], '#241a14');
  box(g, [1.54, 0.12, 0.76], [0, 0.58, 0], '#3b281e', true);
  for (const x of [-0.62, 0.62])
    for (const z of [-0.24, 0.24]) box(g, [0.12, 0.5, 0.12], [x, -0.68, z], '#3b281e');
  box(g, [0.9, 0.06, 0.3], [0, -0.3, 0.42], '#c9a06a');
  return g;
}

export function crane() {
  const g = new T.Group();
  const mast = new T.Group();
  g.add(mast);
  g.userData.mast = mast;
  box(mast, [1.5, 0.5, 1.5], [0, 0.25, 0], '#5a5148', true);
  for (const x of [-0.45, 0.45])
    for (const z of [-0.45, 0.45]) box(mast, [0.18, 13, 0.18], [x, 6.9, z], '#eaa43c');
  for (let y = 1.4; y < 13; y += 1.5)
    box(mast, [1.05, 0.13, 1.05], [0, y, 0], '#d8912f');
  const jib = new T.Group();
  jib.position.y = 12.6;
  mast.add(jib);
  g.userData.jib = jib;
  box(jib, [0.24, 0.24, 20], [0, 0, -4], '#eaa43c');
  box(jib, [0.9, 0.55, 1.6], [0, 0.42, 4.2], '#4c4840', true);
  return g;
}

export function wreckingBall() {
  const g = new T.Group();
  const ball = new T.Mesh(
    new T.IcosahedronGeometry(BALL_RADIUS, 1),
    material('#4b4f55'),
  );
  ball.castShadow = true;
  g.add(ball);
  box(g, [0.22, 0.3, 0.22], [0, BALL_RADIUS + 0.1, 0], '#8d8478');
  return g;
}

/** Jib height the trolley runs along, so the cable starts somewhere real. */
export const JIB_Y = 12.6;

export function cable() {
  return new T.Line(
    new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(),
      new T.Vector3(),
    ]),
    new T.LineBasicMaterial({ color: '#3c3630' }),
  );
}

export function trolley() {
  const g = new T.Group();
  box(g, [0.8, 0.36, 0.8], [0, 0, 0], '#4c4840', true);
  box(g, [0.95, 0.14, 0.95], [0, 0.22, 0], '#eaa43c');
  return g;
}

/** A beacon the crew can see through the walls, so the piano can be planned around. */
export function pianoBeacon() {
  const g = new T.Group();
  const material = new T.MeshBasicMaterial({
    color: '#f2c14e',
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const pin = new T.Mesh(new T.ConeGeometry(0.34, 0.9, 6), material);
  pin.rotation.x = Math.PI;
  pin.position.y = 1.9;
  g.add(pin);
  const ring = new T.Mesh(new T.TorusGeometry(0.6, 0.07, 6, 20), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.6;
  g.add(ring);
  g.renderOrder = 999;
  return g;
}

/** The plot, hoarding and the parked skip the crew never quite fills. */
export function site() {
  const g = new T.Group();
  const ground = new T.Mesh(new T.PlaneGeometry(60, 60), material('#8f9d7e'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  const pad = new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2 + 3, HALF_D * 2 + 3),
    material('#b3a892'),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  g.add(pad);
  for (let i = -7; i <= 7; i++) {
    box(g, [0.12, 2, 0.12], [i * 2, 1, 12.5], '#7f7568');
    box(g, [2, 1.5, 0.08], [i * 2 + 1, 1.2, 12.5], i % 2 ? '#e0d3b8' : '#f58b39');
  }
  box(g, [3.4, 1.6, 2.2], [-11, 0.8, 7], '#d97863', true);
  box(g, [3.5, 0.12, 2.3], [-11, 1.62, 7], '#b45f4d');
  return g;
}
