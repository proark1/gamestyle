import * as T from 'three';
import { DEPTH, HEAD_Y, HIP, jerseyRadius, onFace } from '../avatars/hoop-kid';
import { custom, lathe, rounded, shoeSole, soft } from '../avatars/soft-parts';
import type { KidDress } from './kid-items';

type Point = [number, number, number];
const CREAM = '#fff0ce',
  INK = '#263b30';
const MINT = '#9bd5ad',
  LEAF = '#476647',
  BERRY = '#c63860';
const PINK = '#ffd4b7',
  LILAC = '#d9c8f5',
  BLUE = '#c0eaff';

function hat({ head, hatSeat }: KidDress) {
  const group = new T.Group();
  group.name = 'playful-hat';
  group.position.set(0, Math.max(hatSeat ?? 0.55, 0.53), -0.025);
  head.add(group);
  return group;
}

function crown(
  parent: T.Object3D,
  key: string,
  radius: number,
  height: number,
  colour: string,
) {
  return lathe(
    parent,
    `playful-crown:${key}`,
    () => {
      const profile: [number, number][] = [
        [0, 0],
        [radius, 0],
        [radius, 0.025],
      ];
      for (let i = 1; i <= 16; i++) {
        const a = ((i / 16) * Math.PI) / 2;
        profile.push([Math.cos(a) * radius, 0.025 + Math.sin(a) * height]);
      }
      return profile;
    },
    [0, 0, 0],
    colour,
  );
}

function stroke(
  parent: T.Object3D,
  key: string,
  points: Point[],
  radius: number,
  colour: string,
) {
  return custom(
    parent,
    key,
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        20,
        radius,
        8,
        false,
      ),
    [0, 0, 0],
    colour,
  );
}

/** Soft filled silhouettes with bevelled edges: leaves, stars and crescents. */
function silhouette(
  parent: T.Object3D,
  key: string,
  shape: () => T.Shape,
  at: Point,
  colour: string,
) {
  return custom(
    parent,
    `playful:${key}`,
    () =>
      new T.ExtrudeGeometry(shape(), {
        depth: 0.01,
        bevelEnabled: true,
        bevelSize: 0.006,
        bevelThickness: 0.005,
        bevelSegments: 3,
        curveSegments: 20,
      }).translate(0, 0, -0.005),
    at,
    colour,
  );
}

function leafShape() {
  const shape = new T.Shape();
  shape.moveTo(0, -0.055);
  shape.bezierCurveTo(-0.075, -0.005, -0.055, 0.055, 0.035, 0.085);
  shape.bezierCurveTo(0.065, 0.025, 0.045, -0.035, 0, -0.055);
  return shape;
}

function starShape() {
  const shape = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.024 : 0.052;
    if (i) shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  return shape;
}

function cuff(
  parent: T.Object3D,
  key: string,
  y: number,
  radius: number,
  height: number,
  colour: string,
) {
  return lathe(
    parent,
    `playful-cuff:${key}:${radius}:${height}`,
    () => [
      [radius - 0.014, -height / 2],
      [radius, -height / 2],
      [radius + 0.005, 0],
      [radius, height / 2],
      [radius - 0.014, height / 2],
      [radius - 0.014, -height / 2],
    ],
    [0, y, 0],
    colour,
  );
}

function footwear(leg: T.Object3D, colour: string, sole: string, high = 0.18) {
  leg.parent?.getObjectByName('shoe-sole')?.removeFromParent();
  leg.parent?.getObjectByName('shoe-collar')?.removeFromParent();
  const floor = -HIP[1];
  shoeSole(leg, [0.215, 0.045, 0.365], [0, floor + 0.0225, 0.06], sole);
  soft(leg, [0.108, 0.095, 0.17], [0, floor + 0.1, 0.06], colour);
  soft(leg, [0.108, 0.065, 0.095], [0, floor + 0.095, 0.155], colour);
  cuff(leg, `shoe:${high}`, floor + high - 0.025, 0.096, 0.075, colour);
}

/** A padded open vest that follows the torso at every row, including its back. */
function puffer(body: T.Object3D, key: string, base: string, puff: string) {
  const mesh = custom(
    body,
    `playful-vest:${key}`,
    () => {
      const profile: T.Vector2[] = [];
      for (let i = 0; i <= 16; i++) {
        const y = 0.59 + (i / 16) * 0.33;
        profile.push(new T.Vector2(jerseyRadius(y - HIP[1]) + 0.023, y));
      }
      for (let i = 16; i >= 0; i--) {
        const y = 0.59 + (i / 16) * 0.33;
        profile.push(new T.Vector2(jerseyRadius(y - HIP[1]) + 0.01, y));
      }
      profile.push(profile[0].clone());
      return new T.LatheGeometry(profile, 48, 0.3, Math.PI * 2 - 0.6);
    },
    [0, 0, 0],
    base,
  );
  mesh.scale.z = DEPTH;
  for (const y of [0.64, 0.755, 0.87]) {
    const r = jerseyRadius(y - HIP[1]) + 0.027;
    for (let i = 0; i < 10; i++) {
      const a = 0.48 + (i / 9) * (Math.PI * 2 - 0.96);
      const at: Point = [r * Math.sin(a), y, r * DEPTH * Math.cos(a)];
      const lump =
        key === 'toast'
          ? rounded(body, [0.15, 0.109, 0.063], at, puff, 0.026)
          : soft(body, [0.075, 0.068, 0.035], at, puff);
      lump.rotation.y = a;
    }
  }
}

const lensMaterial = new T.MeshBasicMaterial({
  color: BLUE,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
});
lensMaterial.userData.shared = true;

export const PLAYFUL_KID_ITEMS: Record<string, (dress: KidDress) => void> = {
  'frog-bucket-hat'(dress) {
    const group = hat(dress);
    lathe(
      group,
      'frog-brim',
      () => [
        [0, -0.015],
        [0.37, -0.015],
        [0.38, 0],
        [0.33, 0.05],
        [0, 0.05],
      ],
      [0, 0, 0],
      MINT,
    ).scale.z = 0.93;
    crown(group, 'frog', 0.315, 0.19, MINT).scale.z = 0.94;
    for (const x of [-0.14, 0.14]) {
      soft(group, [0.083, 0.082, 0.065], [x, 0.215, 0.17], MINT);
      soft(group, [0.052, 0.052, 0.019], [x, 0.22, 0.224], CREAM);
      soft(group, [0.023, 0.032, 0.012], [x, 0.22, 0.242], INK);
      soft(group, [0.008, 0.009, 0.006], [x - 0.007, 0.232, 0.253], '#ffffff');
    }
    stroke(
      group,
      'frog-smile',
      [
        [-0.05, 0.08, 0.293],
        [0, 0.067, 0.302],
        [0.05, 0.08, 0.293],
      ],
      0.007,
      LEAF,
    );
  },
  'mushroom-cap'(dress) {
    const group = hat(dress);
    crown(group, 'mushroom-cream', 0.365, 0.025, CREAM).scale.z = 0.93;
    const cap = crown(group, 'mushroom-red', 0.375, 0.25, '#bd344c');
    cap.position.y = 0.025;
    cap.scale.z = 0.93;
    for (const [angle, polar, size] of [
      [0.2, 0.72, 0.067],
      [1.5, 1.1, 0.052],
      [2.8, 0.8, 0.068],
      [4.1, 1.05, 0.055],
      [5.4, 0.7, 0.06],
      [0, 0.12, 0.054],
      [0.55, 1.25, 0.043],
      [-0.55, 1.25, 0.046],
    ]) {
      const normal = new T.Vector3(
        (Math.sin(polar) * Math.sin(angle)) / 0.375,
        Math.cos(polar) / 0.25,
        (Math.sin(polar) * Math.cos(angle)) / 0.349,
      ).normalize();
      const spot = soft(
        group,
        [size, size * 0.8, 0.012],
        [
          0.375 * Math.sin(polar) * Math.sin(angle),
          0.052 + 0.25 * Math.cos(polar),
          0.349 * Math.sin(polar) * Math.cos(angle),
        ],
        CREAM,
      );
      spot.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    }
  },
  'strawberry-beret'(dress) {
    const group = hat(dress);
    crown(group, 'berry-band', 0.31, 0.04, '#972844').scale.z = 0.94;
    const beret = crown(group, 'berry', 0.345, 0.16, BERRY);
    beret.position.set(0.025, 0.025, 0);
    beret.scale.z = 0.93;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const y = i % 2 ? 0.1 : 0.15;
      const r = 0.345 * Math.sqrt(1 - ((y - 0.05) / 0.16) ** 2);
      const seed = soft(
        group,
        [0.008, 0.017, 0.008],
        [0.025 + r * Math.sin(a), y, r * 0.93 * Math.cos(a)],
        CREAM,
      );
      seed.rotation.y = a;
      seed.rotation.z = 0.25;
    }
    for (let i = 0; i < 5; i++) {
      const petal = new T.Group();
      petal.position.set(0.025, 0.25, 0);
      petal.rotation.y = (i / 5) * Math.PI * 2;
      group.add(petal);
      const leaf = silhouette(
        petal,
        'berry-leaf',
        leafShape,
        [0, 0, 0],
        '#477247',
      );
      leaf.rotation.x = -Math.PI / 2 - 0.45;
      leaf.scale.setScalar(1.25);
    }
    stroke(
      group,
      'berry-stem',
      [
        [0.025, 0.21, 0],
        [0.035, 0.255, 0],
        [0.055, 0.275, 0],
      ],
      0.016,
      LEAF,
    );
  },
  'saturn-hat'(dress) {
    const group = hat(dress);
    crown(group, 'saturn', 0.315, 0.27, '#c8b3e9').scale.z = 0.94;
    const ring = custom(
      group,
      'saturn-ring',
      () => new T.TorusGeometry(0.355, 0.021, 10, 64).rotateX(Math.PI / 2),
      [0, 0.11, 0],
      PINK,
    );
    ring.scale.set(1.23, 1, 0.95);
    ring.rotation.z = 0.19;
    for (const x of [-0.1, 0.06]) {
      const star = silhouette(
        group,
        'saturn-star',
        starShape,
        [x, 0.18 + x * 0.3, 0.267],
        CREAM,
      );
      star.scale.setScalar(0.45);
    }
  },
  'bear-paw-shoes'({ legs }) {
    for (const leg of legs) {
      footwear(leg, '#73513c', '#4d3428');
      for (const x of [-0.064, 0, 0.064]) {
        soft(leg, [0.037, 0.049, 0.049], [x, -HIP[1] + 0.11, 0.219], '#8d654c');
        soft(leg, [0.016, 0.019, 0.027], [x, -HIP[1] + 0.095, 0.26], CREAM);
      }
      soft(leg, [0.052, 0.021, 0.06], [0, -HIP[1] + 0.184, 0.09], '#bc9274');
    }
  },
  'ducky-boots'({ legs }) {
    for (const leg of legs) {
      footwear(leg, '#fff08a', '#d5ae48', 0.22);
      cuff(leg, 'duck-top', -HIP[1] + 0.215, 0.102, 0.035, '#fff08a');
      soft(leg, [0.075, 0.024, 0.06], [0, -HIP[1] + 0.085, 0.255], '#e47d33');
      for (const x of [-0.055, 0.055])
        soft(leg, [0.014, 0.018, 0.008], [x, -HIP[1] + 0.14, 0.231], INK);
    }
  },
  'comet-sneakers'({ legs }) {
    for (const [i, leg] of legs.entries()) {
      const side = i ? 1 : -1;
      footwear(leg, LILAC, BLUE);
      for (const y of [0.16, 0.185])
        rounded(
          leg,
          [0.065, 0.012, 0.021],
          [0, -HIP[1] + y, 0.11],
          CREAM,
          0.005,
        );
      const star = silhouette(
        leg,
        'comet-star',
        starShape,
        [side * 0.115, -HIP[1] + 0.11, -0.07],
        CREAM,
      );
      star.rotation.y = (side * Math.PI) / 2;
      for (const [j, colour] of [PINK, BLUE].entries()) {
        const trail = soft(
          leg,
          [0.018, 0.021, 0.07],
          [side * 0.1, -HIP[1] + 0.09 + j * 0.045, -0.14],
          colour,
        );
        trail.rotation.x = -0.18;
      }
    }
  },
  'leaf-dungarees'({ body, legs }) {
    rounded(body, [0.235, 0.32, 0.04], [0, 0.75, 0.186], LEAF, 0.055);
    for (const side of [-1, 1]) {
      stroke(
        body,
        `leaf-strap:${side}`,
        [
          [side * 0.1, 0.78, 0.208],
          [side * 0.13, 0.9, 0.17],
          [side * 0.135, 0.954, 0],
          [side * 0.13, 0.9, -0.17],
          [side * 0.1, 0.75, -0.207],
          [side * 0.1, 0.61, -0.19],
        ],
        0.022,
        LEAF,
      );
      soft(body, [0.016, 0.016, 0.009], [side * 0.087, 0.87, 0.215], CREAM);
    }
    const leaf = silhouette(
      body,
      'leaf-pocket',
      leafShape,
      [0, 0.78, 0.222],
      '#bbdf8d',
    );
    leaf.rotation.z = -0.28;
    stroke(
      body,
      'leaf-vein',
      [
        [-0.012, 0.741, 0.24],
        [0, 0.783, 0.24],
        [0.025, 0.835, 0.24],
      ],
      0.004,
      LEAF,
    );
    for (const leg of legs)
      cuff(leg, 'leaf-hem', -0.345, 0.117, 0.04, '#bbdf8d');
  },
  'watermelon-shorts'({ legs }) {
    for (const leg of legs) {
      cuff(leg, 'melon-white', -0.142, 0.149, 0.026, CREAM);
      cuff(leg, 'melon-green', -0.17, 0.153, 0.037, '#315e3b');
      for (const a of [-0.55, 0.5, 2.6, 3.7]) {
        const y = a > 2 ? -0.07 : -0.08;
        const seed = soft(
          leg,
          [0.009, 0.02, 0.006],
          [Math.sin(a) * 0.137, y, Math.cos(a) * 0.137],
          INK,
        );
        seed.rotation.y = a;
        seed.rotation.z = 0.2;
      }
    }
  },
  'toast-puffer'({ body }) {
    puffer(body, 'toast', '#9d6837', '#e9c48e');
    rounded(
      body,
      [0.075, 0.061, 0.033],
      [0.11, 0.72, 0.218],
      '#fff08a',
      0.014,
    ).rotation.z = -0.12;
  },
  'cloud-jacket'({ body, sleeves }) {
    puffer(body, 'cloud', '#dbe9f1', '#f7f4ff');
    for (const sleeve of sleeves) {
      soft(sleeve, [0.081, 0.085, 0.081], [0, -0.08, 0], '#f7f4ff');
      cuff(sleeve, 'cloud-cuff', -0.15, 0.084, 0.04, '#b9e0f5');
    }
    const star = silhouette(
      body,
      'cloud-button',
      starShape,
      [0.09, 0.855, 0.213],
      '#b9e0f5',
    );
    star.scale.setScalar(0.36);
  },
  'moon-glasses'({ head }) {
    for (const side of [-1, 1]) {
      const x = side * 0.132;
      const frame = silhouette(
        head,
        'moon-frame',
        () => {
          const s = new T.Shape();
          s.moveTo(0.04, 0.083);
          s.bezierCurveTo(-0.115, 0.11, -0.115, -0.11, 0.04, -0.083);
          s.bezierCurveTo(-0.032, -0.055, -0.032, 0.055, 0.04, 0.083);
          return s;
        },
        [0, 0, 0],
        CREAM,
      );
      onFace(frame, x, 0.31, 0.068);
      if (side > 0) frame.rotateZ(Math.PI);
      const rim = custom(
        head,
        'moon-rim',
        () => new T.TorusGeometry(0.073, 0.005, 8, 40),
        [0, 0, 0],
        BLUE,
      );
      onFace(rim, x, 0.31, 0.061);
      rim.scale.y = 1.13;
      const lens = custom(
        head,
        'moon-lens',
        () => new T.CircleGeometry(0.07, 32),
        [0, 0, 0],
        BLUE,
      );
      lens.material = lensMaterial;
      onFace(lens, x, 0.31, 0.061);
      lens.scale.y = 1.13;
      stroke(
        head,
        `moon-temple:${side}`,
        [
          [side * 0.2, 0.32, 0.3],
          [side * 0.285, 0.34, 0.14],
          [side * 0.285, 0.33, 0],
        ],
        0.008,
        CREAM,
      );
    }
    stroke(
      head,
      'moon-bridge',
      [
        [-0.06, 0.315, 0.319],
        [0, 0.335, 0.337],
        [0.06, 0.315, 0.319],
      ],
      0.009,
      CREAM,
    );
  },
};

/** The shop uses exactly the same accessories, mounted in the same coordinates. */
export function playfulDisplay(id: string, player: string) {
  const build = PLAYFUL_KID_ITEMS[id];
  if (!build) return undefined;
  const group = new T.Group();
  const body = new T.Group(),
    head = new T.Group();
  head.position.y = HEAD_Y;
  group.add(body, head);
  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * HIP[0], HIP[1], 0);
    group.add(leg);
    return leg;
  });
  const sleeves = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.245, 0.885, 0);
    arm.rotation.z = side * 0.17;
    group.add(arm);
    return arm;
  });
  if (id === 'leaf-dungarees' || id === 'watermelon-shorts') {
    const short = id === 'watermelon-shorts';
    const colour = short ? BERRY : LEAF;
    soft(body, [0.232, 0.12, 0.172], [0, 0.545, 0], colour);
    for (const leg of legs)
      lathe(
        leg,
        `playful-display-legs:${id}`,
        () => [
          [0, short ? -0.17 : -0.37],
          [short ? 0.142 : 0.104, short ? -0.17 : -0.37],
          [0.13, -0.04],
          [0.118, 0.06],
          [0, 0.07],
        ],
        [0, 0, 0],
        colour,
      );
  }
  build({ body, head, legs, sleeves, player, hatSeat: 0.55 });
  return group;
}
