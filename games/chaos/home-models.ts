import * as T from 'three';
import { box, cylinder, sphere, beam } from './objects';
import type { ItemKind } from './model';

/** Furniture uses the same low-poly geometry and shared materials as the building kit. */
export function makeHomeModel(g: T.Group, kind: ItemKind, paint?: string) {
  const wood = '#bf956d',
    dark = '#805d45',
    white = '#f3f2df',
    ink = '#30443f';
  if (kind === 'bookshelf') {
    box(g, 1.5, 2.05, 0.16, paint || dark, 0, 1.06, -0.24);
    [-0.72, 0.72].forEach((x) =>
      box(g, 0.12, 2.15, 0.62, paint || wood, x, 1.08, 0),
    );
    [0.12, 0.77, 1.42, 2.08].forEach((y) =>
      box(g, 1.5, 0.1, 0.65, paint || wood, 0, y, 0),
    );
    [0.2, 0.85, 1.5].forEach((y, row) => {
      for (let i = 0; i < 6; i++) {
        const h = 0.32 + (i % 3) * 0.09;
        box(
          g,
          0.15,
          h,
          0.35,
          ['#e78268', '#548dc5', '#f5c447', '#7bc9b0'][(i + row) % 4],
          -0.5 + i * 0.19,
          y + h / 2,
          0.02,
        );
      }
    });
  } else if (kind === 'wardrobe') {
    box(g, 1.55, 2.1, 0.8, paint || '#79b8a5', 0, 1.1, 0, true);
    [-0.38, 0.38].forEach((x) => {
      box(g, 0.72, 1.88, 0.06, paint || '#97ceba', x, 1.12, 0.42, true);
      sphere(g, 0.055, '#e5b65d', x < 0 ? -0.1 : 0.1, 1.1, 0.49);
    });
    [-0.58, 0.58].forEach((x) => box(g, 0.15, 0.15, 0.62, dark, x, 0.08, 0));
  } else if (kind === 'counter' || kind === 'sink' || kind === 'stove') {
    box(
      g,
      1.3,
      1,
      0.98,
      paint || (kind === 'stove' ? white : '#7bc9b0'),
      0,
      0.53,
      0,
      true,
    );
    box(g, 1.4, 0.12, 1.08, white, 0, 1.08, 0, true);
    if (kind === 'stove') {
      box(g, 1, 0.53, 0.025, ink, 0, 0.53, 0.51, true);
      box(g, 0.8, 0.04, 0.06, '#a5b5ac', 0, 0.88, 0.54);
      [-0.43, -0.14, 0.14, 0.43].forEach((x) =>
        sphere(g, 0.055, ink, x, 0.99, 0.53),
      );
      [-0.34, 0.34].forEach((x) =>
        [-0.25, 0.25].forEach((z) =>
          cylinder(g, 0.19, 0.19, 0.035, ink, x, 1.155, z, 16),
        ),
      );
      const pot = new T.Group();
      pot.position.set(-0.34, 1.17, -0.25);
      g.add(pot);
      g.userData.activity = pot;
      cylinder(pot, 0.19, 0.17, 0.23, '#d9865c', 0, 0.12, 0);
      box(pot, 0.5, 0.05, 0.07, ink, 0, 0.17, 0);
      cylinder(pot, 0.2, 0.2, 0.04, ink, 0, 0.26, 0);
    } else {
      [-0.32, 0.32].forEach((x) => {
        box(g, 0.58, 0.82, 0.03, paint || '#99d7c0', x, 0.55, 0.505, true);
        box(g, 0.22, 0.035, 0.04, dark, x, 0.83, 0.54);
      });
      if (kind === 'sink') {
        box(g, 0.9, 0.025, 0.62, '#92aaa9', 0, 1.15, 0, true);
        box(g, 0.69, 0.03, 0.42, '#548dc5', 0, 1.168, 0, true);
        cylinder(g, 0.04, 0.04, 0.43, '#9bb6b4', 0, 1.34, -0.35);
        beam(g, [0, 1.55, -0.35], [0, 1.55, 0], 0.08, '#9bb6b4');
        const water = cylinder(g, 0.025, 0.025, 0.35, '#95d2d7', 0, 1.35, 0);
        water.visible = false;
        g.userData.activity = water;
      } else {
        box(g, 0.45, 0.04, 0.32, wood, 0.28, 1.17, 0, true);
        sphere(g, 0.1, '#e78268', 0.25, 1.26, 0);
      }
    }
  } else if (kind === 'bathtub') {
    [-0.55, 0.55].forEach((x) =>
      [-0.7, 0.7].forEach((z) => sphere(g, 0.13, dark, x, 0.15, z)),
    );
    box(g, 1.5, 0.54, 2, paint || '#95d2d7', 0, 0.5, 0, true);
    box(g, 1.32, 0.045, 1.82, white, 0, 0.79, 0, true);
    box(g, 1.08, 0.05, 1.51, '#80c7d5', 0, 0.81, 0.04, true);
    beam(g, [0, 0.6, -0.9], [0, 1.12, -0.9], 0.08, '#8aaba8');
    beam(g, [0, 1.12, -0.9], [0, 1.12, -0.61], 0.08, '#8aaba8');
    const bubbles = new T.Group();
    g.add(bubbles);
    g.userData.activity = bubbles;
    for (let i = 0; i < 7; i++)
      sphere(
        bubbles,
        0.08 + (i % 3) * 0.025,
        white,
        Math.sin(i * 2.4) * 0.36,
        0.86 + (i % 2) * 0.1,
        Math.cos(i * 2.4) * 0.5,
      );
  } else if (kind === 'tv') {
    box(g, 1.55, 0.38, 0.62, paint || wood, 0, 0.35, 0, true);
    [-0.58, 0.58].forEach((x) => box(g, 0.1, 0.2, 0.48, dark, x, 0.1, 0));
    box(g, 0.5, 0.07, 0.36, ink, 0, 0.6, 0);
    box(g, 0.1, 0.3, 0.1, ink, 0, 0.74, 0);
    box(g, 1.5, 0.9, 0.18, ink, 0, 1.23, 0, true);
    box(g, 1.32, 0.72, 0.03, '#25424e', 0, 1.24, 0.105);
    const screen = new T.Group();
    screen.position.set(0, 1.24, 0.13);
    g.add(screen);
    g.userData.activity = screen;
    ['#f5c447', '#7bc9b0', '#548dc5', '#e7a4bd', '#e78268'].forEach((c, i) =>
      box(screen, 0.256, 0.65, 0.015, c, -0.512 + i * 0.256, 0, 0),
    );
    screen.visible = false;
  } else if (kind === 'piano') {
    box(g, 1.7, 1.4, 0.58, paint || dark, 0, 0.93, -0.17, true);
    box(g, 1.8, 0.14, 0.72, paint || wood, 0, 1.65, -0.17, true);
    box(g, 1.75, 0.16, 0.66, ink, 0, 0.86, 0.23);
    [-0.72, 0.72].forEach((x) =>
      box(g, 0.12, 0.86, 0.15, paint || dark, x, 0.43, 0.43),
    );
    const keys = new T.Group();
    keys.position.set(0, 0.97, 0.35);
    g.add(keys);
    g.userData.activity = keys;
    for (let i = 0; i < 14; i++) {
      box(keys, 0.105, 0.04, 0.34, white, -0.74 + i * 0.113, 0, 0);
      if (i % 7 !== 2 && i % 7 !== 6)
        box(keys, 0.055, 0.065, 0.19, ink, -0.69 + i * 0.113, 0.035, -0.08);
    }
    box(g, 0.7, 0.08, 0.03, white, 0, 1.32, 0.14);
  } else if (kind === 'bench') {
    [-0.75, 0.75].forEach((x) => {
      box(g, 0.12, 0.7, 0.75, dark, x, 0.35, 0);
      box(g, 0.1, 1.15, 0.1, dark, x, 0.6, -0.32);
    });
    [-0.25, 0, 0.25].forEach((z) =>
      box(g, 1.85, 0.09, 0.22, paint || '#7bc9b0', 0, 0.72, z, true),
    );
    [0.96, 1.2].forEach((y) =>
      box(g, 1.85, 0.2, 0.08, paint || '#7bc9b0', 0, y, -0.32, true),
    );
  } else if (kind === 'aquarium') {
    box(g, 1.4, 0.7, 0.75, paint || dark, 0, 0.4, 0, true);
    box(g, 1.45, 0.08, 0.8, ink, 0, 0.8, 0);
    box(g, 1.34, 0.8, 0.68, '#73b9cb', 0, 1.23, 0, true);
    box(g, 1.4, 0.08, 0.75, ink, 0, 1.67, 0);
    box(g, 1.3, 0.09, 0.07, '#e5ca8e', 0, 0.87, 0.35);
    [-0.5, 0.5].forEach((x) =>
      beam(g, [x, 0.88, 0.37], [x - 0.07, 1.25, 0.37], 0.07, '#527e65'),
    );
    const fish = new T.Group();
    fish.position.set(0, 1.2, 0.37);
    g.add(fish);
    g.userData.activity = fish;
    [-0.25, 0.25].forEach((x, i) => {
      const f = sphere(fish, 0.12, i ? '#f5c447' : '#e78268', x, i * 0.2, 0);
      f.scale.set(1.4, 0.65, 0.35);
      const tail = sphere(fish, 0.08, '#e78268', x - 0.16, i * 0.2, 0, 0);
      tail.scale.set(0.6, 1, 0.4);
      sphere(fish, 0.018, ink, x + 0.07, i * 0.2 + 0.02, 0.04);
    });
  } else if (kind === 'easel') {
    [-0.55, 0.55].forEach((x) =>
      beam(g, [x, 0.05, 0.3], [x * 0.3, 2.1, -0.1], 0.09, wood),
    );
    beam(g, [0, 1.65, -0.1], [0, 0.05, -0.5], 0.1, wood);
    box(g, 1.12, 0.09, 0.35, wood, 0, 0.77, 0);
    box(g, 1, 1.15, 0.09, white, 0, 1.37, -0.08);
    const art = new T.Group();
    art.position.set(0, 1.37, -0.02);
    g.add(art);
    g.userData.activity = art;
    box(art, 0.85, 0.95, 0.02, paint || '#548dc5', 0, 0, 0);
    sphere(art, 0.17, '#f5c447', 0.2, 0.22, 0.04);
    box(art, 0.85, 0.3, 0.025, '#527e65', 0, -0.32, 0.035);
    box(art, 0.35, 0.28, 0.025, '#e78268', -0.12, -0.12, 0.07);
  } else if (kind === 'doghouse') {
    box(g, 1.25, 0.85, 0.95, paint || '#e78268', 0, 0.45, 0, true);
    box(g, 0.53, 0.65, 0.04, ink, 0, 0.34, 0.49, true);
    [-1, 1].forEach((side) => {
      const roof = box(g, 0.86, 0.12, 1.13, dark, side * 0.33, 1.04, 0);
      roof.rotation.z = -side * 0.5;
    });
    box(g, 0.38, 0.1, 0.03, white, 0, 0.78, 0.51);
  } else return false;
  return true;
}

export function animateHomeModel(
  g: T.Group,
  kind: ItemKind,
  age: number,
  duration: number,
) {
  const activity = g.userData.activity as T.Object3D | undefined;
  if (!activity) return;
  const active = age >= 0 && age < duration,
    pulse = active ? Math.sin((Math.PI * age) / duration) : 0;
  if (kind === 'tv' || kind === 'sink') activity.visible = active;
  if (kind === 'piano')
    activity.rotation.z = active ? Math.sin(age / 95) * 0.015 : 0;
  if (kind === 'stove')
    activity.rotation.z = active ? Math.sin(age / 70) * 0.08 * pulse : 0;
  if (kind === 'bathtub') activity.position.y = pulse * 0.24;
  if (kind === 'aquarium')
    activity.position.x = active ? Math.sin(age / 400) * 0.18 : 0;
  if (kind === 'easel')
    activity.rotation.z = active ? Math.sin(age / 260) * 0.03 : 0;
}
