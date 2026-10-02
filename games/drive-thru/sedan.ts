import * as T from 'three';
import { box, taper } from '../../shared/rendering/primitives';
import { CAR } from './physics';

/** Open cabin with enough headroom for the seated Jumbleyard cast. */
export function createSedanModel(): T.Group {
  const car = new T.Group();
  car.name = 'sedan';
  const body = new T.Group();
  body.name = 'car-body';
  car.add(body);
  const paint = '#377f7b',
    cream = '#fff1cf',
    rubber = '#263638',
    chrome = '#bfd1cc';
  box(body, [2.1, 0.28, 4.65], [0, 0.54, 0], paint, true);
  box(body, [2.12, 0.42, 1.25], [0, 0.85, -1.67], paint, true);
  box(body, [2.12, 0.42, 1.1], [0, 0.85, 1.72], paint, true);
  box(body, [1.88, 0.1, 2.4], [0, 0.68, 0], rubber, true);
  for (const side of [-1, 1]) {
    box(body, [0.12, 0.46, 2.5], [side * 1.01, 0.93, 0], paint, true);
    box(body, [0.035, 0.08, 4.2], [side * 1.078, 0.78, 0], cream);
    box(body, [0.06, 0.055, 0.27], [side * 1.085, 1.08, 0.5], chrome, true);
    for (const z of [-1.13, 1.12]) {
      const pillar = box(
        body,
        [0.1, 0.88, 0.12],
        [side * 0.94, 1.57, z],
        cream,
        true,
      );
      pillar.rotation.x = z < 0 ? -0.16 : 0.16;
    }
    box(body, [0.09, 0.83, 0.1], [side * 0.98, 1.57, 0.43], paint, true);
    box(body, [0.2, 0.12, 0.28], [side * 1.13, 1.24, -0.85], paint, true);
    box(body, [0.025, 0.08, 0.2], [side * 1.24, 1.25, -0.85], chrome);
    box(body, [0.67, 0.17, 0.65], [side * 0.5, 0.83, -0.05], '#bf8555', true);
    box(body, [0.67, 0.63, 0.15], [side * 0.5, 1.09, 0.28], '#bf8555', true);
    box(body, [0.38, 0.24, 0.16], [side * 0.5, 1.45, 0.3], cream, true);
  }
  box(body, [2.04, 0.15, 2.5], [0, 2.03, 0], cream, true);
  box(body, [1.84, 0.2, 0.34], [0, 1.17, -0.96], rubber, true);
  const glass = new T.MeshStandardMaterial({
    color: '#bce6e3',
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
    depthWrite: false,
    side: T.DoubleSide,
  });
  for (const z of [-1.16, 1.17]) {
    const pane = new T.Mesh(new T.PlaneGeometry(1.78, 0.72), glass);
    pane.position.set(0, 1.58, z);
    pane.rotation.x = z < 0 ? -0.16 : 0.16;
    pane.name = z < 0 ? 'windshield' : 'rear-window';
    body.add(pane);
  }
  const steering = new T.Mesh(
    new T.TorusGeometry(0.21, 0.035, 8, 20),
    new T.MeshStandardMaterial({ color: rubber }),
  );
  steering.position.set(-0.5, 1.19, -0.71);
  steering.rotation.x = -0.5;
  body.add(steering);
  for (const z of [-2.32, 2.32]) {
    box(body, [2.2, 0.17, 0.24], [0, 0.55, z], chrome, true);
    box(body, [0.42, 0.16, 0.04], [0, 0.76, z * 1.03], cream, true);
    for (const x of [-0.73, 0.73]) {
      const lamp = box(
        body,
        [0.45, 0.2, 0.08],
        [x, 0.91, z],
        z < 0 ? '#ffe6a0' : '#b84032',
        true,
      );
      lamp.name = z < 0 ? 'headlight' : 'taillight';
    }
  }
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const pivot = new T.Group();
    pivot.name = `wheel-${i}`;
    pivot.position.set(side * 1.02, CAR.wheelRadius, i < 2 ? -1.45 : 1.45);
    const roll = new T.Group();
    roll.name = `wheel-roll-${i}`;
    const tire = taper(
      roll,
      CAR.wheelRadius,
      CAR.wheelRadius,
      0.22,
      [0, 0, 0],
      rubber,
      24,
    );
    tire.rotation.z = Math.PI / 2;
    const rim = taper(roll, 0.25, 0.25, 0.235, [0, 0, 0], cream, 20);
    rim.rotation.z = Math.PI / 2;
    const hub = taper(roll, 0.09, 0.09, 0.25, [0, 0, 0], chrome, 16);
    hub.rotation.z = Math.PI / 2;
    box(roll, [0.25, 0.055, 0.43], [0, 0, 0], chrome, true);
    pivot.add(roll);
    car.add(pivot);
  }
  const splat = box(
    body,
    [1.6, 0.55, 0.025],
    [0, 1.55, -1.185],
    '#f2a6ad',
    true,
  );
  splat.name = 'windshield-splat';
  splat.visible = false;
  for (const [side, x] of [
    ['l', -0.45],
    ['r', 0.35],
  ] as const) {
    const wiper = box(body, [0.55, 0.035, 0.035], [x, 1.29, -1.23], rubber);
    wiper.name = `wiper-${side}`;
  }
  return car;
}
