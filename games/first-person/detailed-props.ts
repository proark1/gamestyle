import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './world-view';
import type { Inventory, Tool } from './model';
import { HAND_GRIP, makeWorkerHand } from './worker-hand';
export { makeWorkerHand } from './worker-hand';
import {
  bakeModel,
  cyl,
  ellipsoid,
  mesh,
  panel,
  ring,
  rod,
  rounded,
  tube,
  type XYZ,
} from './detail-geometry';

export function makePallet(m: Materials, width = 1.4, depth = 1.25) {
  const g = new T.Group();
  for (const x of [-width * 0.39, 0, width * 0.39])
    for (const z of [-depth * 0.35, depth * 0.35])
      rounded(g, [0.18, 0.12, 0.2], [x, 0.08, z], m.wood, 0.01);
  for (let i = 0; i < 5; i++) {
    const z = (i / 4 - 0.5) * (depth - 0.17);
    rounded(g, [width, 0.055, 0.17], [0, 0.167, z], m.wood, 0.007);
    for (const x of [-width * 0.39, width * 0.39])
      cyl(g, 0.012, 0.012, 0.003, [x, 0.196, z], m.metal, 8);
  }
  return bakeModel(g);
}

export function makeCementSack(m: Materials) {
  const g = new T.Group(),
    geo = new RoundedBoxGeometry(0.61, 0.235, 0.8, 3, 0.072),
    p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const edge = Math.pow(Math.abs(z) / 0.4, 5),
      crease = Math.sin(x * 71 + z * 19) * edge;
    p.setXYZ(
      i,
      x + crease * 0.006,
      y * (1 - edge * 0.18) + Math.sin(x * 19) * Math.sin(z * 12) * 0.006,
      z,
    );
  }
  geo.computeVertexNormals();
  mesh(g, geo, m.sack);
  for (const z of [-0.375, 0.375]) {
    rounded(g, [0.51, 0.035, 0.027], [0, 0.006, z], m.sack, 0.012);
    for (let i = 0; i < 12; i++)
      rod(
        g,
        [-0.235 + i * 0.042, 0.019, z - 0.009],
        [-0.22 + i * 0.042, 0.02, z + 0.009],
        0.0018,
        m.stitches,
      );
  }
  const top = mesh(
    g,
    new T.PlaneGeometry(0.48, 0.55),
    m.sackInk,
    [0, 0.127, 0],
  );
  top.rotation.x = -Math.PI / 2;
  const front = mesh(
    g,
    new T.PlaneGeometry(0.43, 0.12),
    m.sackInk,
    [0, 0.006, 0.401],
  );
  front.rotation.x = -0.06;
  return bakeModel(g);
}

export function makeBucket(
  m: Materials,
  content: 'water' | 'sand' | 'mortar' | null,
  fill = 0,
) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  const profile = [
    [0.127, 0.014],
    [0.13, 0.025],
    [0.16, 0.253],
    [0.16, 0.266],
    [0.149, 0.266],
    [0.148, 0.25],
    [0.119, 0.025],
    [0.119, 0.018],
  ].map(([x, y]) => new T.Vector2(x, y));
  mesh(body, new T.LatheGeometry(profile, 40), m.bucket);
  cyl(body, 0.121, 0.121, 0.014, [0, 0.017, 0], m.bucketInside, 40);
  for (const [radius, y] of [
    [0.155, 0.263],
    [0.128, 0.018],
  ])
    ring(body, radius, 0.006, [0, y, 0], m.steel).rotation.x = Math.PI / 2;
  for (const x of [-0.155, 0.155])
    cyl(body, 0.013, 0.013, 0.019, [x, 0.22, 0], m.steel, 12).rotation.z =
      Math.PI / 2;
  const arc: XYZ[] = Array.from({ length: 17 }, (_, i) => {
    const a = (i / 16) * Math.PI;
    return [Math.cos(a) * 0.166, 0.22 + Math.sin(a) * 0.17, 0];
  });
  tube(body, arc, 0.0045, m.steel);
  rod(body, [-0.05, 0.388, 0], [0.05, 0.388, 0], 0.011, m.rubber);
  const label = mesh(
    body,
    new T.PlaneGeometry(0.15, 0.072),
    m.bucketInk,
    [0, 0.145, 0.149],
  );
  label.rotation.x = 0.12;
  for (let i = 0; i < 4; i++)
    rounded(
      body,
      [0.016 + i * 0.003, 0.027, 0.002],
      [-0.084 + i * 0.04, 0.055 + (i % 2) * 0.038, 0.141],
      m.mortar,
      0.002,
    );
  bakeModel(body);
  if (content && fill > 0) {
    const level = 0.033 + Math.min(1, fill) * 0.198,
      radius = 0.119 + ((level - 0.025) / 0.24) * 0.03;
    const surface = mesh(
      g,
      new T.CircleGeometry(radius, 40),
      content === 'water' ? m.liquid : content === 'sand' ? m.sand : m.mortar,
      [0, level, 0],
    );
    surface.rotation.x = -Math.PI / 2;
    surface.userData.waterSurface = content === 'water';
    surface.userData.level = level;
    if (content === 'water')
      for (const r of [0.048, 0.09]) {
        const ripple = ring(g, r, 0.0009, [0, level + 0.0007, 0], m.foam);
        ripple.rotation.x = -Math.PI / 2;
      }
    else {
      const lumps = new T.Group();
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        ellipsoid(
          lumps,
          [0.022, 0.004, 0.017],
          [Math.cos(a) * 0.073, level, Math.sin(a) * 0.071],
          content === 'sand' ? m.sand : m.mortar,
        );
      }
      g.add(bakeModel(lumps));
    }
  }
  return g;
}

export function makeWaterBarrel(m: Materials) {
  const g = new T.Group(),
    shell = new T.Group();
  g.add(shell);
  const profile = [
    [0.455, 0.025],
    [0.487, 0.04],
    [0.496, 0.11],
    [0.495, 0.22],
    [0.507, 0.24],
    [0.507, 0.27],
    [0.497, 0.29],
    [0.497, 0.77],
    [0.507, 0.79],
    [0.507, 0.82],
    [0.496, 0.84],
    [0.49, 1.02],
    [0.486, 1.055],
    [0.467, 1.055],
    [0.468, 0.075],
  ].map(([x, y]) => new T.Vector2(x, y));
  mesh(shell, new T.LatheGeometry(profile, 48), m.barrel);
  for (const y of [0.052, 1.052])
    ring(shell, 0.48, 0.012, [0, y, 0], m.steel).rotation.x = Math.PI / 2;
  cyl(shell, 0.466, 0.466, 0.018, [0, 0.061, 0], m.bucketInside, 40);
  tube(
    shell,
    [
      [0, 0.29, 0.48],
      [0, 0.29, 0.6],
      [0, 0.26, 0.65],
      [0, 0.19, 0.65],
    ],
    0.032,
    m.steel,
  );
  cyl(shell, 0.052, 0.052, 0.08, [0, 0.32, 0.557], m.steel, 16);
  rounded(shell, [0.19, 0.022, 0.041], [0, 0.37, 0.557], m.red, 0.01);
  for (let i = 0; i < 7; i++)
    rounded(
      shell,
      [0.038, 0.01, 0.004],
      [0.27, 0.31 + i * 0.075, 0.42],
      m.pale,
      0.002,
    ).rotation.y = 0.55;
  const mark = mesh(
    shell,
    new T.PlaneGeometry(0.33, 0.17),
    m.waterInk,
    [-0.07, 0.65, 0.503],
  );
  mark.rotation.y = -0.05;
  bakeModel(shell);
  const surface = mesh(
    g,
    new T.CircleGeometry(0.463, 48),
    m.liquid,
    [0, 0.936, 0],
  );
  surface.rotation.x = -Math.PI / 2;
  surface.userData.waterSurface = true;
  surface.userData.level = 0.936;
  for (const radius of [0.12, 0.25, 0.37]) {
    const ripple = ring(g, radius, 0.0013, [0, 0.938, 0], m.foam);
    ripple.rotation.x = Math.PI / 2;
    ripple.scale.y = 0.78;
  }
  return g;
}

export function makeSandCrate(m: Materials) {
  const g = new T.Group();
  g.add(makePallet(m, 1.5, 1.3));
  for (const x of [-0.71, 0.71])
    rounded(g, [0.06, 0.32, 1.3], [x, 0.29, 0], m.wood, 0.006);
  for (const z of [-0.62, 0.62])
    for (const y of [0.225, 0.4])
      rounded(g, [1.5, 0.14, 0.055], [0, y, z], m.wood, 0.006);
  for (const x of [-0.7, 0.7])
    for (const z of [-0.615, 0.615]) {
      rounded(g, [0.075, 0.33, 0.014], [x, 0.3, z * 1.04], m.metal, 0.002);
      for (const y of [0.2, 0.41])
        cyl(g, 0.012, 0.012, 0.01, [x, y, z * 1.052], m.steel, 8).rotation.x =
          Math.PI / 2;
    }
  const geo = new T.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      rough =
        Math.sin(x * 31 + z * 19) * 0.014 + Math.cos(x * 53 - z * 23) * 0.008;
    p.setXYZ(
      i,
      x * 0.68,
      y * (0.28 + Math.sin(x * 3 + z) * 0.055) + rough,
      z * 0.56,
    );
  }
  geo.computeVertexNormals();
  mesh(g, geo, m.sand, [0, 0.36, 0]);
  for (let i = 0; i < 36; i++) {
    const a = i * 2.399,
      r = 0.46 + (i % 4) * 0.08;
    const grain = mesh(
      g,
      new T.IcosahedronGeometry(1, 0),
      i % 5 ? m.sand : m.pale,
      [
        Math.cos(a) * r,
        0.365 + Math.sqrt(Math.max(0, 1 - (r * r) / 0.48)) * 0.14,
        Math.sin(a) * r * 0.7,
      ],
    );
    grain.scale.set(0.009, 0.006, 0.006);
  }
  const shovel = new T.Group();
  shovel.position.set(0.31, 0.39, 0.08);
  shovel.rotation.z = -0.24;
  g.add(shovel);
  rounded(shovel, [0.21, 0.27, 0.025], [0, 0.04, 0], m.steel, 0.045);
  rod(shovel, [0, 0.1, 0.006], [0, 0.9, 0.006], 0.023, m.wood);
  tube(
    shovel,
    [
      [-0.085, 1.05, 0.006],
      [-0.075, 0.92, 0.006],
      [0, 0.875, 0.006],
      [0.075, 0.92, 0.006],
      [0.085, 1.05, 0.006],
    ],
    0.013,
    m.metal,
  );
  rod(shovel, [-0.085, 1.05, 0.006], [0.085, 1.05, 0.006], 0.023, m.rubber);
  return bakeModel(g);
}

export function makeTrowel(m: Materials) {
  const g = new T.Group();
  const shape = new T.Shape();
  shape.moveTo(-0.087, 0);
  shape.lineTo(0.087, 0);
  shape.quadraticCurveTo(0.08, 0.08, 0.012, 0.28);
  shape.quadraticCurveTo(0, 0.302, -0.012, 0.28);
  shape.quadraticCurveTo(-0.08, 0.08, -0.087, 0);
  const blade = new T.ExtrudeGeometry(shape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.001,
    bevelThickness: 0.001,
  });
  blade.rotateX(-Math.PI / 2);
  mesh(g, blade, m.steel, [0, -0.025, -0.095]);
  tube(
    g,
    [
      [0, 0, 0.06],
      [0, 0, -0.04],
      [0, -0.024, -0.08],
      [0, -0.024, -0.16],
    ],
    0.009,
    m.steel,
  );
  rod(g, [0, 0.015, -0.005], [0, 0.015, 0.15], 0.023, m.wood, 0.019);
  for (const z of [0.005, 0.139])
    cyl(g, 0.024, 0.024, 0.013, [0, 0.015, z], m.steel, 16).rotation.x =
      Math.PI / 2;
  return bakeModel(g);
}

export function makeHeldRig(
  tool: Tool,
  inv: Inventory,
  m: Materials,
  aspect = 16 / 9,
) {
  const g = new T.Group(),
    right = new T.Group();
  const bucketMode =
    (!!inv.carrying && inv.carrying !== 'cement') ||
    (tool === 'mortar' && inv.carrying !== 'cement');
  const support =
    inv.carrying === 'cement' ||
    (!bucketMode && ['brick', 'beam', 'roof'].includes(tool));
  right.position.set(0.3, -0.245, -0.64);
  right.rotation.set(0.05, -0.25, 0.1);
  g.add(right);
  right.add(makeWorkerHand(m, false, support ? 'support' : 'handle'));
  if (inv.carrying === 'cement') {
    const sack = makeCementSack(m);
    sack.scale.setScalar(0.48);
    sack.position.set(-0.09, 0.065, -0.071);
    right.add(sack);
  } else if (bucketMode) {
    const content =
      inv.carrying === 'water'
        ? 'water'
        : inv.carrying === 'sand'
          ? 'sand'
          : 'mortar';
    const left = new T.Group();
    left.position.set(-0.32, -0.19, -0.73);
    left.rotation.set(0.05, 0.1, -0.1);
    g.add(left);
    left.add(makeWorkerHand(m, true, 'bucket'));
    const bucket = makeBucket(m, content, inv.carrying ? 0.8 : inv.mortar / 24);
    bucket.position.set(HAND_GRIP[0], HAND_GRIP[1] - 0.388, HAND_GRIP[2]);
    left.add(bucket);
    const trowel = makeTrowel(m);
    trowel.rotation.y = Math.PI / 2;
    trowel.position.set(-0.0725, HAND_GRIP[1] - 0.015, HAND_GRIP[2]);
    right.add(trowel);
  } else if (tool === 'brick') {
    rounded(right, [0.32, 0.15, 0.19], [-0.065, 0.09, -0.063], m.brick, 0.007);
  } else if (tool === 'beam') {
    rounded(right, [0.105, 0.105, 1.0], [-0.006, 0.07, -0.32], m.wood, 0.005);
  } else if (tool === 'roof') {
    rounded(right, [0.48, 0.023, 0.36], [-0.105, 0.048, -0.13], m.roof, 0.006);
    for (let i = 0; i < 5; i++)
      rounded(
        right,
        [0.019, 0.012, 0.35],
        [-0.3 + i * 0.095, 0.063, -0.13],
        m.roof,
        0.006,
      );
  } else {
    // Rotate the whole grip so the hammer shaft passes through the curled fingers.
    right.rotation.z = -0.95;
    rod(
      right,
      [-0.12, HAND_GRIP[1], HAND_GRIP[2]],
      [0.2, HAND_GRIP[1], HAND_GRIP[2]],
      0.022,
      m.wood,
      0.019,
    );
    rounded(
      right,
      [0.083, 0.19, 0.085],
      [-0.15, HAND_GRIP[1], HAND_GRIP[2]],
      m.steel,
      0.015,
    );
    rounded(
      right,
      [0.065, 0.06, 0.091],
      [-0.15, 0.095, HAND_GRIP[2]],
      m.metal,
      0.008,
    );
  }
  // Move complete grip assemblies: resizing must never separate a hand from its handle.
  for (const object of g.children)
    object.position.x *= Math.min(1.5, aspect / (aspect < 0.8 ? 1.6 : 1.5));
  if (aspect < 0.8) {
    g.position.z = -0.18;
    g.position.y = 0.055;
    right.position.y += 0.065;
  }
  g.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return g;
}

export function makePickup(m: Materials) {
  const g = new T.Group();
  rounded(g, [1.62, 0.18, 3.42], [0, 0.59, 0], m.metal, 0.045);
  rounded(g, [1.77, 0.36, 3.52], [0, 0.84, -0.025], m.paint, 0.075);
  rounded(g, [1.73, 0.16, 0.88], [0, 1.045, -1.25], m.paint, 0.052);
  rounded(g, [1.59, 0.115, 1.14], [0, 1.852, -0.32], m.paint, 0.055);
  // Glass is a real window with a sparse interior behind it, rather than a solid cab block.
  panel(
    g,
    [
      [-0.735, 1.13, -0.985],
      [0.735, 1.13, -0.985],
      [0.704, 1.796, -0.797],
      [-0.704, 1.796, -0.797],
    ],
    m.glass,
  );
  panel(
    g,
    [
      [-0.71, 1.21, 0.29],
      [0.71, 1.21, 0.29],
      [0.704, 1.796, 0.18],
      [-0.704, 1.796, 0.18],
    ],
    m.glass,
  );
  for (const side of [-1, 1]) {
    const x = side * 0.77;
    panel(
      g,
      [
        [x, 1.15, -0.956],
        [x, 1.15, 0.285],
        [x * 0.94, 1.793, 0.173],
        [x * 0.94, 1.793, -0.783],
      ],
      m.glass,
    );
    rod(g, [x, 1.1, -0.99], [x * 0.94, 1.81, -0.8], 0.033, m.paint);
    rod(g, [x, 1.1, 0.3], [x * 0.94, 1.81, 0.19], 0.039, m.paint);
    rod(g, [x, 1.13, 0.14], [x * 0.94, 1.78, 0.08], 0.018, m.paint);
    rounded(
      g,
      [0.028, 0.38, 1.16],
      [side * 0.884, 1.025, -0.345],
      m.paint,
      0.009,
    );
    rounded(
      g,
      [0.034, 0.037, 0.145],
      [side * 0.908, 1.13, 0.025],
      m.metal,
      0.012,
    );
    rod(
      g,
      [side * 0.77, 1.36, -0.79],
      [side * 0.965, 1.36, -0.76],
      0.012,
      m.metal,
    );
    rounded(
      g,
      [0.1, 0.135, 0.16],
      [side * 0.966, 1.397, -0.75],
      m.paint,
      0.019,
    );
    rounded(g, [0.011, 0.1, 0.12], [side * 1.014, 1.4, -0.747], m.steel, 0.006);
    rounded(
      g,
      [0.31, 0.35, 0.11],
      [side * 0.365, 1.36, -0.06],
      m.rubber,
      0.045,
    );
    rounded(g, [0.34, 0.12, 0.39], [side * 0.365, 1.14, -0.29], m.rubber, 0.04);
    rounded(g, [0.22, 0.16, 0.1], [side * 0.365, 1.62, -0.06], m.rubber, 0.034);
    rounded(
      g,
      [0.085, 0.35, 1.38],
      [side * 0.851, 1.105, 1.04],
      m.paint,
      0.018,
    );
    rounded(g, [0.1, 0.044, 1.42], [side * 0.851, 1.297, 1.04], m.metal, 0.014);
    const branding = mesh(g, new T.PlaneGeometry(0.64, 0.235), m.truckInk, [
      side * 0.902,
      1.005,
      -0.4,
    ]);
    branding.rotation.y = (side * Math.PI) / 2;
  }
  rounded(g, [1.35, 0.15, 0.18], [0, 1.24, -0.815], m.rubber, 0.024);
  const steering = ring(g, 0.123, 0.013, [-0.37, 1.31, -0.68], m.rubber);
  steering.rotation.x = -0.55;
  rounded(g, [1.56, 0.055, 1.4], [0, 0.961, 1.04], m.metal, 0.01);
  for (let i = 0; i < 9; i++)
    rounded(
      g,
      [0.017, 0.01, 1.35],
      [-0.68 + i * 0.17, 0.995, 1.04],
      m.steel,
      0.003,
    );
  rounded(g, [1.71, 0.35, 0.095], [0, 1.105, 1.774], m.paint, 0.021);
  rounded(g, [1.77, 0.045, 0.13], [0, 1.302, 1.77], m.metal, 0.011);
  rounded(g, [0.22, 0.04, 0.023], [0, 1.2, 1.83], m.metal, 0.01);
  for (const x of [-0.3, 0.1, 0.4])
    rounded(g, [0.16, 0.085, 1.16], [x, 1.04, 1.03], m.wood, 0.006).rotation.y =
      x * 0.15;
  for (const z of [-1.86, 1.856])
    rounded(g, [1.88, 0.13, 0.13], [0, 0.66, z], m.steel, 0.025);
  rounded(g, [0.81, 0.19, 0.038], [0, 0.969, -1.792], m.rubber, 0.028);
  for (let i = 0; i < 5; i++)
    rounded(
      g,
      [0.69, 0.011, 0.01],
      [0, 0.909 + i * 0.032, -1.816],
      m.steel,
      0.002,
    );
  for (const side of [-1, 1]) {
    rounded(
      g,
      [0.35, 0.165, 0.046],
      [side * 0.621, 1.023, -1.79],
      m.lamp,
      0.034,
    );
    rounded(g, [0.1, 0.1, 0.049], [side * 0.779, 0.915, -1.79], m.amber, 0.017);
    rounded(g, [0.16, 0.25, 0.029], [side * 0.75, 1.07, 1.829], m.red, 0.021);
    rounded(g, [0.13, 0.061, 0.031], [side * 0.75, 1.018, 1.83], m.lamp, 0.009);
    for (const z of [-1.12, 1.15]) {
      const wheel = new T.Group();
      wheel.position.set(side * 0.864, 0.401, z);
      g.add(wheel);
      ring(wheel, 0.275, 0.102, [0, 0, 0], m.rubber).rotation.y = Math.PI / 2;
      cyl(wheel, 0.22, 0.22, 0.235, [0, 0, 0], m.metal, 32).rotation.z =
        Math.PI / 2;
      cyl(
        wheel,
        0.182,
        0.182,
        0.018,
        [side * 0.122, 0, 0],
        m.steel,
        32,
      ).rotation.z = Math.PI / 2;
      ring(wheel, 0.182, 0.018, [side * 0.137, 0, 0], m.steel).rotation.y =
        Math.PI / 2;
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        rod(
          wheel,
          [side * 0.13, Math.sin(a) * 0.064, Math.cos(a) * 0.064],
          [side * 0.13, Math.sin(a) * 0.161, Math.cos(a) * 0.161],
          0.024,
          m.metal,
        );
        cyl(
          wheel,
          0.014,
          0.014,
          0.018,
          [side * 0.146, Math.sin(a) * 0.062, Math.cos(a) * 0.062],
          m.steel,
          6,
        ).rotation.z = Math.PI / 2;
      }
      cyl(
        wheel,
        0.038,
        0.038,
        0.025,
        [side * 0.145, 0, 0],
        m.steel,
        20,
      ).rotation.z = Math.PI / 2;
      for (let j = 0; j < 26; j++) {
        const a = (j / 26) * Math.PI * 2,
          tread = rounded(
            wheel,
            [0.145, 0.035, 0.012],
            [0, Math.sin(a) * 0.37, Math.cos(a) * 0.37],
            m.rubber,
            0.003,
          );
        tread.rotation.x = -a;
      }
      const fender = ring(
        g,
        0.413,
        0.022,
        [side * 0.899, 0.401, z],
        m.paint,
        Math.PI,
      );
      fender.rotation.y = Math.PI / 2;
    }
  }
  for (const z of [-1.923, 1.923]) {
    const plate = mesh(g, new T.PlaneGeometry(0.38, 0.13), m.plate, [
      0,
      0.705,
      z,
    ]);
    if (z < 0) plate.rotation.y = Math.PI;
  }
  return bakeModel(g);
}
