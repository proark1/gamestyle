import * as T from 'three';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { box, material, label } from '../../shared/rendering/primitives';
import type { Hazard } from './types';

function ball(g: T.Object3D, size: number[], pos: number[], color: string) {
  const m = new T.Mesh(new T.SphereGeometry(1, 10, 7), material(color));
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  g.add(m);
  return m;
}
function cylinder(
  g: T.Object3D,
  radius: number,
  height: number,
  y: number,
  color: string,
) {
  const m = new T.Mesh(
    new T.CylinderGeometry(radius, radius, height, 24),
    material(color),
  );
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
export function contestant(color: string) {
  const g = new T.Group();
  ball(g, [0.43, 0.57, 0.3], [0, 1.03, 0], color);
  ball(g, [0.36, 0.37, 0.33], [0, 1.81, 0], '#f2d1a1');
  ball(g, [0.37, 0.15, 0.33], [0, 2.08, -0.03], '#73543d');
  for (const x of [-0.12, 0.12])
    ball(g, [0.035, 0.055, 0.025], [x, 1.84, 0.315], '#29474b');
  box(g, [0.25, 0.12, 0.035], [0, 1.66, 0.318], '#fff4dd', true);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const leg = box(
      g,
      [0.25, 0.56, 0.27],
      [side * 0.22, 0.34, 0],
      '#35585b',
      true,
    );
    leg.name = `leg${i}`;
    box(leg, [0.29, 0.16, 0.42], [0, -0.22, 0.08], '#fff0d0', true);
    const arm = box(g, [0.23, 0.62, 0.23], [side * 0.49, 1.06, 0], color, true);
    arm.name = `arm${i}`;
    ball(arm, [0.13, 0.14, 0.13], [0, -0.29, 0], '#f2d1a1');
  }
  box(g, [0.28, 0.23, 0.06], [0.13, 1.16, 0.3], '#fff3ce', true);
  return g;
}
/** Walks a contestant, arms up while airborne; `now` is in milliseconds. */
export function animateContestant(
  model: T.Object3D,
  p: { vx: number; vz: number; y: number },
  now: number,
) {
  const walk = Math.hypot(p.vx, p.vz) > 0.5 ? Math.sin(now * 0.014) * 0.5 : 0;
  for (let i = 0; i < 2; i++) {
    model.getObjectByName(`leg${i}`)!.rotation.x = walk * (i ? 1 : -1);
    model.getObjectByName(`arm${i}`)!.rotation.x =
      p.y > 0.5 ? -2.4 : walk * (i ? -1 : 1);
  }
}
export function stage() {
  const g = new T.Group();
  box(g, [25, 1.5, 21], [0, -0.8, 0], '#355d60', true);
  for (let x = -11; x <= 11; x += 2)
    for (let z = -9; z <= 9; z += 2)
      box(
        g,
        [1.98, 0.14, 1.98],
        [x, -0.05, z],
        (x + z) % 4 ? '#87bcb3' : '#bfdbca',
      );
  box(g, [25, 4, 0.6], [0, 2, -10.4], '#38787b');
  for (const x of [-12.3, 12.3]) {
    box(g, [0.35, 1.2, 20], [x, 0.6, 0], '#e4b14d');
    for (const z of [-9, -5, -1, 3, 7, 9])
      box(g, [0.5, 1.6, 0.5], [x, 0.8, z], '#e8bc65', true);
  }
  box(g, [24.7, 0.5, 0.45], [0, 0.4, 10.2], '#e4b14d');
  for (const x of [-8.8, 8.8]) {
    box(g, [5, 2.3, 0.15], [x, 2.4, -10], '#235358', true);
    const sign = label(
      x < 0 ? 'ONE MORE' : 'BAD IDEA?',
      '#235358',
      '#f5d885',
      4.4,
    );
    sign.position.set(x, 2.8, -9.8);
    g.add(sign);
    for (const dx of [-2.2, 2.2])
      for (const y of [1.6, 2.4, 3.2])
        ball(g, [0.13, 0.13, 0.13], [x + dx, y, -9.85], '#fff1b5');
  }
  box(g, [4.6, 0.15, 3], [0, 0.04, -8.5], '#ebc15d');
  for (const x of [-2.1, 2.1])
    box(g, [0.3, 3.7, 0.6], [x, 1.85, -9.8], '#ffe4a0', true);
  box(g, [4.5, 0.4, 0.6], [0, 3.5, -9.8], '#ffe4a0', true);
  const exitSign = label('EXIT →', '#236d62', '#fff3d2', 3.2);
  exitSign.position.set(0, 4.3, -9.8);
  g.add(exitSign);
  const door = box(g, [3.8, 2.9, 0.15], [0, 1.5, -9.75], '#e4ad50', true);
  door.name = 'door';
  const button = new T.Group();
  button.name = 'button';
  cylinder(button, 1.6, 0.25, 0.13, '#f4c35c');
  cylinder(button, 1.25, 0.9, 0.7, '#315c63');
  cylinder(button, 1.32, 0.15, 1.2, '#fff0bd');
  const cap = cylinder(button, 1.1, 0.48, 1.5, '#e75e47');
  cap.name = 'cap';
  const press = label('E · PRESS', '#fff2ce', '#ab4737', 2.4);
  press.position.set(0, 2.7, 0);
  button.add(press);
  g.add(button);
  // Stage lighting and a suspended game-show arch frame the playable room.
  for (const x of [-13.5, 13.5])
    box(g, [0.45, 7.5, 0.45], [x, 3, -8], '#294b52');
  box(g, [27, 0.45, 0.45], [0, 6.7, -8], '#294b52');
  for (const x of [-10, -5, 0, 5, 10]) {
    const lamp = box(g, [0.8, 0.6, 1.1], [x, 6.2, -8], '#3a5558', true);
    lamp.rotation.x = -0.35;
    box(lamp, [0.68, 0.07, 0.72], [0, -0.32, 0.05], '#fff0b1');
  }
  // Keep animated parts independent while batching the static show set by material.
  g.remove(button, door);
  batchScenery(g);
  g.add(button, door);
  return g;
}
export function hazardModel(h: Hazard) {
  const g = new T.Group();
  g.position.set(h.x, 0, h.z);
  if (h.kind === 'conveyor') {
    box(g, [4.4, 0.14, 12], [0, 0.1, 0], '#405e62');
    for (let i = 0; i < 20; i++) {
      const slat = box(
        g,
        [4.1, 0.07, 0.35],
        [0, 0.21, -5.7 + i * 0.6],
        i % 3 ? '#739692' : '#e8bb59',
      );
      slat.name = `slat${i}`;
    }
  } else if (h.kind === 'soap') {
    const puddle = cylinder(g, 2.8, 0.06, 0.13, '#b7d8dc');
    puddle.scale.z = 0.93;
    const soap = box(g, [1.3, 0.45, 0.8], [0.4, 0.38, -0.4], '#f0b9b3', true);
    soap.rotation.y = 0.45;
    for (let i = 0; i < 12; i++)
      ball(
        g,
        [0.17, 0.17, 0.17],
        [Math.sin(i * 4.2) * 2.3, 0.23 + (i % 3) * 0.08, Math.cos(i * 2.1) * 2],
        '#eaf4df',
      );
  } else if (h.kind === 'spinner') {
    cylinder(g, 0.75, 0.6, 0.3, '#d5a54c');
    const sofa = new T.Group();
    sofa.name = 'sofa';
    box(sofa, [5.9, 0.7, 1.5], [0, 0.65, 0], '#a17baf', true);
    box(sofa, [5.9, 0.9, 0.35], [0, 1.2, -0.7], '#8b649b', true);
    for (const x of [-2.8, 2.8])
      box(sofa, [0.4, 0.6, 1.5], [x, 1.15, 0], '#8b649b', true);
    for (const x of [-1.8, 0, 1.8])
      box(sofa, [1.65, 0.18, 1.2], [x, 1.08, 0.04], '#bea0c6', true);
    g.add(sofa);
  } else {
    box(g, [1, 2, 4.7], [0, 1, 0], '#e3b44f', true);
    const glove = new T.Group();
    glove.name = 'glove';
    ball(glove, [1.45, 1.1, 1.7], [0, 1.8, 0], '#e2614c');
    ball(glove, [0.72, 0.7, 0.63], [h.direction * -0.5, 1.2, 1.35], '#d75042');
    box(glove, [0.8, 1.6, 2.5], [-h.direction * 1.2, 1.75, 0], '#fff0cd', true);
    g.add(glove);
    const warning = box(
      g,
      [23, 0.03, 4.6],
      [h.direction * 11.5, 0.3, 0],
      '#eaaa48',
    );
    warning.name = 'warning';
    warning.visible = false;
    const spring = box(g, [1, 0.5, 0.5], [0, 1.8, 0], '#546b6e');
    spring.name = 'spring';
  }
  return g;
}
