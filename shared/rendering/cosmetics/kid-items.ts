import * as T from 'three';
import {
  DEPTH,
  HIP,
  TROUSER_HEM,
  jerseyRadius,
  onFace,
  trouserRadius,
} from '../avatars/hoop-kid';
import {
  custom,
  rounded,
  shoeSole,
  soft,
  surface,
} from '../avatars/soft-parts';
import { CLOTH } from '../palette';
import { PLAYFUL_KID_ITEMS } from './playful-items';

/**
 * Wardrobe items modelled for the clay kid. The worker's items are blocks made
 * for its blocky body; fitting them to the kid gets a hat or a pair of glasses
 * right, but a shirt ends up a hoop and a boot a band. The items here are
 * built from the kid's own shapes instead — garments that follow his body,
 * boots that climb his leg — so they read as clothes rather than as parts
 * stuck on. Colours come from the same item, so the shop's picture still
 * matches what he wears.
 */
type Point = [number, number, number];

/** The groups an item is built into, and the colour a player's own items take. */
export type KidDress = {
  /** The look group on the body, in the kid's own coordinates. */
  body: T.Object3D;
  /** The look group on each leg and arm, measured from its joint. */
  legs: T.Object3D[];
  sleeves: T.Object3D[];
  /** The look group on the head, measured from the neck. */
  head: T.Object3D;
  /** The player's colour: the kit. */
  player: string;
  /** The fitted brim height in head coordinates, shared with the hair. */
  hatSeat?: number;
};

/** The shoulder line, the waist and the hem of the jersey. */
const SHOULDER = 0.93;
const WAIST = 0.72;
const HEM = 0.55;
/** The front of the neck, where a collar or a bow sits. */
const NECK = 0.985;
/** How far a garment stands off the body, and how thick its cloth is. */
const OVER = 0.012;
const CLOTH_THICK = 0.014;

/** The kid's half-width at `y`, wearing nothing over it. */
function torsoRadius(y: number) {
  return Math.max(0.08, jerseyRadius(Math.max(0, y - HIP[1])));
}

/**
 * A garment over the torso: the kid's own shape, `out` further out, from `low`
 * to `high`. `arc` leaves it open, centred on the back, and `flare` widens the
 * hem, for a skirt or a cape.
 */
function garment(
  parent: T.Object3D,
  key: string,
  low: number,
  high: number,
  out: number,
  hex: string,
  options: { arc?: number; flare?: number; steps?: number } = {},
) {
  const { arc = Math.PI * 2, flare = 0, steps = 10 } = options;
  const outline: T.Vector2[] = [];
  const radius = (y: number) => {
    const along = (high - y) / (high - low);
    return torsoRadius(y) + out + flare * along * along;
  };
  for (let i = 0; i <= steps; i++) {
    const y = low + ((high - low) * i) / steps;
    outline.push(new T.Vector2(radius(y), y));
  }
  for (let i = steps; i >= 0; i--) {
    const y = low + ((high - low) * i) / steps;
    outline.push(new T.Vector2(radius(y) - CLOTH_THICK, y));
  }
  outline.push(outline[0].clone());
  const whole = arc >= Math.PI * 2;
  const mesh = new T.Mesh(
    new T.LatheGeometry(
      outline,
      whole ? 40 : 28,
      whole ? 0 : Math.PI - arc / 2,
      arc,
    ),
    surface(hex),
  );
  mesh.scale.z = DEPTH;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** A band round the torso, such as a stripe, a belt or a reflective strip. */
function belt(
  parent: T.Object3D,
  y: number,
  height: number,
  out: number,
  hex: string,
  arc = Math.PI * 2,
) {
  return garment(
    parent,
    `belt:${y}`,
    y - height / 2,
    y + height / 2,
    out,
    hex,
    {
      arc,
      steps: 2,
    },
  );
}

/** A round tube along Y, for a sleeve, a boot leg or a trouser cuff. */
function tube(
  parent: T.Object3D,
  key: string,
  low: number,
  high: number,
  bottom: number,
  top: number,
  hex: string,
  at: Point = [0, 0, 0],
) {
  const mesh = custom(
    parent,
    `tube:${key}:${low}:${high}:${bottom}:${top}`,
    () =>
      new T.CylinderGeometry(top, bottom, high - low, 24, 1, false).translate(
        0,
        (high - low) / 2,
        0,
      ),
    [at[0], at[1] + low, at[2]],
    hex,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A panel that follows the body, centred `turn` radians round from the front:
 * an apron, a jacket front or a lapel.
 */
function panel(
  parent: T.Object3D,
  key: string,
  low: number,
  high: number,
  half: number,
  out: number,
  hex: string,
  turn = 0,
) {
  const width = Math.max(0.1, half * 2);
  const mesh = custom(
    parent,
    `panel:${key}:${low}:${high}:${half}:${out}:${turn}`,
    () => {
      const shape = new T.Shape();
      shape.moveTo(-width / 2, low);
      shape.lineTo(width / 2, low);
      shape.lineTo(width / 2, high);
      shape.lineTo(-width / 2, high);
      shape.closePath();
      const geometry = new T.ExtrudeGeometry(shape, {
        depth: CLOTH_THICK,
        bevelEnabled: false,
        curveSegments: 1,
      });
      // Curve it round the body, so it lies on the chest rather than across it.
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        const reach = torsoRadius(y) + out + z;
        const around = turn + x / Math.max(0.08, torsoRadius(y) + out);
        position.setXYZ(
          i,
          Math.sin(around) * reach,
          y,
          Math.cos(around) * reach * DEPTH,
        );
      }
      geometry.computeVertexNormals();
      return geometry;
    },
    [0, 0, 0],
    hex,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A strap over one shoulder, from the chest to the back. */
function strap(
  parent: T.Object3D,
  side: number,
  hex: string,
  width = 0.045,
  out = OVER,
) {
  const mesh = custom(
    parent,
    `strap:${width}:${out}`,
    () => {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(0.1, WAIST + 0.1, torsoRadius(0.82) * DEPTH + out),
        new T.Vector3(0.13, 0.88, torsoRadius(0.88) * DEPTH * 0.8 + out),
        new T.Vector3(0.14, SHOULDER + 0.01, 0),
        new T.Vector3(0.12, 0.88, -torsoRadius(0.88) * DEPTH * 0.8 - out),
        new T.Vector3(0.1, WAIST + 0.06, -torsoRadius(0.8) * DEPTH - out),
      ]);
      return new T.TubeGeometry(curve, 24, width / 2, 8, false);
    },
    [0, 0, 0],
    hex,
  );
  mesh.scale.x = side;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A curved plate round a limb, such as a greave: solid, so it needs no
 * double-sided material. `arc` is how far round the limb it wraps.
 */
function plate(
  parent: T.Object3D,
  key: string,
  low: number,
  high: number,
  radius: number,
  thickness: number,
  arc: number,
  hex: string,
) {
  const mesh = custom(
    parent,
    `plate:${key}:${low}:${high}:${radius}:${thickness}:${arc}`,
    () =>
      new T.LatheGeometry(
        [
          [radius, low],
          [radius + thickness, low],
          [radius + thickness, high],
          [radius, high],
          [radius, low],
        ].map(([x, y]) => new T.Vector2(x, y)),
        20,
        -arc / 2,
        arc,
      ),
    [0, 0, 0],
    hex,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A short sleeve on an arm, from the shoulder down. */
function sleeve(parent: T.Object3D, hex: string, drop = 0.14) {
  return tube(parent, `sleeve:${drop}`, -0.04 - drop, -0.02, 0.076, 0.085, hex);
}

/** The height of a leg's sole, and how far its toe reaches forward. */
const SOLE = -HIP[1];

/** A boot: a tube up the leg with a sole and a toe, over the kid's sneaker. */
function boot(
  parent: T.Object3D,
  hex: string,
  top: number,
  options: { cuff?: string; toe?: string } = {},
) {
  parent.parent?.getObjectByName('shoe-sole')?.removeFromParent();
  parent.parent?.getObjectByName('shoe-collar')?.removeFromParent();
  tube(parent, `boot:${top}`, SOLE + 0.08, top, 0.105, 0.095, hex);
  soft(parent, [0.098, 0.09, 0.16], [0, SOLE + 0.095, 0.04], hex);
  soft(parent, [0.09, 0.06, 0.08], [0, SOLE + 0.07, 0.135], options.toe ?? hex);
  shoeSole(parent, [0.19, 0.05, 0.33], [0, SOLE + 0.025, 0.045], CLOTH.ink);
  if (options.cuff)
    tube(
      parent,
      `cuff:${top}`,
      top - 0.045,
      top + 0.01,
      0.112,
      0.112,
      options.cuff,
    );
}

/** Every item the kid has his own model for, by catalog id. */
export const KID_ITEMS: Record<string, (dress: KidDress) => void> = {
  ...PLAYFUL_KID_ITEMS,
  'neon-visor'({ head, hatSeat = 0.2 }) {
    soft(head, [0.29, 0.07, 0.27], [0, hatSeat + 0.1, 0], '#182d40');
    soft(head, [0.26, 0.12, 0.24], [0, hatSeat + 0.16, 0], '#30445d');
    soft(head, [0.27, 0.035, 0.22], [0, hatSeat + 0.08, 0.19], '#5effdf');
  },
  'confetti-shades'({ head }) {
    for (const side of [-1, 1]) {
      const frame = rounded(
        head,
        [0.2, 0.12, 0.04],
        [side * 0.12, 0.31, 0.29],
        '#9c50e5',
        0.025,
      );
      frame.rotation.y = side * 0.12;
      soft(head, [0.075, 0.035, 0.014], [side * 0.12, 0.31, 0.32], '#ffdc57');
    }
    soft(head, [0.05, 0.025, 0.025], [0, 0.32, 0.31], '#9c50e5');
  },
  'comet-cape'({ body }) {
    garment(body, 'comet-cape', 0.25, SHOULDER + 0.03, OVER + 0.02, '#5b4ec4', {
      arc: Math.PI * 1.2,
      flare: 0.15,
      steps: 14,
    });
    soft(
      body,
      [0.05, 0.05, 0.025],
      [0, NECK - 0.06, torsoRadius(0.94) * DEPTH + 0.03],
      '#ffcc61',
    );
  },
  'disco-boots'({ legs }) {
    for (const leg of legs) {
      boot(leg, '#5c38ae', -0.28, { cuff: '#f95f9b', toe: '#f95f9b' });
      shoeSole(leg, [0.21, 0.06, 0.34], [0, SOLE + 0.025, 0.06], '#1d2430');
    }
  },
  'stack-rank-safety-helmet'({ head, hatSeat = 0.2 }) {
    soft(head, [0.31, 0.06, 0.29], [0, hatSeat + 0.02, 0.02], '#126c78');
    soft(head, [0.25, 0.14, 0.24], [0, hatSeat + 0.14, 0], '#1b9aa4');
    soft(head, [0.045, 0.15, 0.23], [0, hatSeat + 0.16, 0], '#fff4cb');
  },
  'stack-rank-crown'({ head, hatSeat = 0.2 }) {
    soft(head, [0.26, 0.07, 0.25], [0, hatSeat + 0.12, 0], '#f0bb42');
    for (const side of [-1, 0, 1])
      custom(
        head,
        'skyline-point',
        () => new T.ConeGeometry(0.08, 0.21, 12),
        [side * 0.2, hatSeat + 0.28 + (side === 0 ? 0.04 : 0), 0],
        '#ffe49b',
      );
  },
  // ---- Tops ----------------------------------------------------------------
  'striped-tee'({ body, sleeves, player }) {
    const shirt = '#f6efdf';
    garment(body, 'tee', HEM - 0.01, SHOULDER, OVER, shirt);
    for (const y of [0.63, 0.73, 0.83])
      belt(body, y, 0.035, OVER + 0.004, player);
    for (const arm of sleeves) sleeve(arm, shirt, 0.13);
  },

  'bow-tie'({ body }) {
    const collar = '#f6efdf';
    belt(body, NECK - 0.02, 0.05, OVER, collar);
    const bow = new T.Group();
    bow.position.set(0, NECK - 0.035, torsoRadius(0.96) * DEPTH + 0.03);
    body.add(bow);
    for (const side of [-1, 1]) {
      const wing = soft(
        bow,
        [0.058, 0.04, 0.024],
        [side * 0.055, 0, 0],
        '#c23b4a',
      );
      wing.rotation.z = side * 0.35;
    }
    soft(bow, [0.022, 0.024, 0.022], [0, 0, 0.012], '#8f2433');
  },

  'hero-cape'({ body, player }) {
    // A cape hangs from the shoulders and flares out behind the legs.
    garment(body, 'cape', 0.3, SHOULDER + 0.02, OVER + 0.01, player, {
      arc: Math.PI * 1.15,
      flare: 0.1,
      steps: 14,
    });
    belt(body, SHOULDER - 0.01, 0.05, OVER + 0.014, player, Math.PI * 1.3);
    soft(
      body,
      [0.032, 0.032, 0.02],
      [0, NECK - 0.06, torsoRadius(0.94) * DEPTH + 0.02],
      '#e7c04f',
    );
  },

  'bellhop-jacket'({ body, sleeves }) {
    const cloth = '#681c26';
    const trim = CLOTH.gold;
    garment(body, 'bellhop', HEM + 0.02, SHOULDER, OVER, cloth);
    belt(body, NECK - 0.03, 0.045, OVER + 0.004, trim);
    belt(body, HEM + 0.035, 0.03, OVER + 0.004, trim);
    for (const y of [0.78, 0.86]) {
      for (const side of [-1, 1]) {
        const at: Point = [
          side * 0.055,
          y,
          torsoRadius(y) * DEPTH + OVER + 0.012,
        ];
        soft(body, [0.016, 0.016, 0.01], at, trim);
      }
    }
    for (const [i, arm] of sleeves.entries()) {
      sleeve(arm, cloth, 0.16);
      tube(arm, 'bellhop-cuff', -0.19, -0.155, 0.083, 0.083, trim);
      void i;
    }
  },

  'safety-vest'({ body }) {
    const hivis = '#c8e028';
    const tape = '#dfe5e8';
    // An open vest: two front panels and a back, with reflective bands.
    garment(body, 'vest-back', HEM + 0.04, SHOULDER - 0.02, OVER, hivis, {
      arc: Math.PI * 1.35,
      steps: 8,
    });
    for (const side of [-1, 1])
      panel(
        body,
        'vest-front',
        HEM + 0.04,
        SHOULDER - 0.02,
        0.058,
        OVER,
        hivis,
        side * 0.5,
      );
    for (const y of [0.68, 0.79]) belt(body, y, 0.026, OVER + 0.01, tape);
  },

  'game-show-blazer'({ body, sleeves }) {
    const cloth = '#8e3a89';
    garment(body, 'blazer', HEM + 0.02, SHOULDER - 0.01, OVER, cloth, {
      arc: Math.PI * 1.5,
      steps: 10,
    });
    for (const side of [-1, 1])
      panel(
        body,
        'lapel',
        0.76,
        SHOULDER - 0.01,
        0.042,
        OVER + 0.012,
        cloth,
        side * 0.34,
      );
    soft(
      body,
      [0.022, 0.022, 0.014],
      [-0.075, 0.855, torsoRadius(0.855) * DEPTH + OVER + 0.02],
      CLOTH.gold,
    );
    for (const arm of sleeves) sleeve(arm, cloth, 0.2);
  },

  'canvas-apron'({ body }) {
    const canvas = '#c4a678';
    const tie = '#4a3319';
    // A bib up the chest, a wider skirt below the waist, and a pocket.
    panel(body, 'apron-bib', WAIST, 0.9, 0.09, OVER, canvas);
    panel(body, 'apron-skirt', 0.44, WAIST + 0.01, 0.135, OVER, canvas);
    panel(body, 'apron-pocket', 0.54, 0.64, 0.075, OVER + 0.014, '#9e7d50');
    // Straps over the shoulders and a tie round the waist.
    for (const side of [-1, 1]) strap(body, side, tie, 0.028);
    belt(body, WAIST - 0.01, 0.03, OVER + 0.008, tie);
  },

  'badge-sash'({ body }) {
    const sash = '#3f6fb5';
    const slant = new T.Group();
    slant.position.set(0, 0.8, 0);
    slant.rotation.z = 0.72 + Math.PI / 2;
    body.add(slant);
    const band = garment(slant, 'sash', -0.055, 0.055, OVER + 0.004, sash, {
      steps: 2,
    });
    band.scale.set(1, 1, DEPTH);
    soft(
      body,
      [0.032, 0.032, 0.012],
      [-0.075, 0.72, torsoRadius(0.72) * DEPTH + OVER + 0.02],
      '#f2c14e',
    );
  },

  // ---- Legs ----------------------------------------------------------------
  'denim-overalls'({ body, legs }) {
    const denim = '#34507e';
    const stitch = '#f1ead6';
    panel(body, 'bib', WAIST - 0.02, 0.88, 0.1, OVER, denim);
    for (const side of [-1, 1]) strap(body, side, denim, 0.05);
    soft(
      body,
      [0.028, 0.02, 0.012],
      [0, 0.84, torsoRadius(0.84) * DEPTH + OVER + 0.016],
      stitch,
    );
    for (const leg of legs)
      tube(
        leg,
        'overall-cuff',
        TROUSER_HEM,
        TROUSER_HEM + 0.045,
        0.112,
        0.112,
        '#2b4063',
      );
  },

  'fisherman-waders'({ body, legs }) {
    const rubber = '#2b3b2e';
    panel(body, 'wader-bib', WAIST - 0.02, 0.9, 0.105, OVER, rubber);
    for (const side of [-1, 1]) {
      strap(body, side, rubber, 0.05);
      soft(
        body,
        [0.022, 0.018, 0.012],
        [side * 0.085, 0.855, torsoRadius(0.855) * DEPTH + OVER + 0.016],
        CLOTH.gold,
      );
    }
    for (const leg of legs) {
      tube(
        leg,
        'wader-cuff',
        TROUSER_HEM,
        TROUSER_HEM + 0.05,
        0.115,
        0.115,
        '#1d291f',
      );
      rounded(leg, [0.13, 0.09, 0.03], [0, -0.16, 0.115], '#1d291f', 0.012);
    }
  },

  'cargo-trousers'({ legs }) {
    for (const [i, leg] of legs.entries()) {
      const side = i === 0 ? -1 : 1;
      const pocket = rounded(
        leg,
        [0.055, 0.1, 0.11],
        [side * 0.115, -0.17, 0.02],
        '#6d6441',
        0.02,
      );
      pocket.rotation.z = side * 0.08;
    }
  },

  'plaid-trousers'({ legs }) {
    const line = '#2f2626';
    for (const leg of legs) {
      for (const y of [-0.08, -0.22])
        tube(
          leg,
          `plaid:${y}`,
          y,
          y + 0.022,
          trouserRadius(y) + 0.004,
          trouserRadius(y) + 0.004,
          line,
        );
      for (const turn of [0.5, Math.PI - 0.5, Math.PI + 0.5, -0.5]) {
        const stripe = custom(
          leg,
          'plaid-stripe',
          () => new T.BoxGeometry(0.016, 0.3, 0.016),
          [0, -0.16, 0],
          line,
        );
        stripe.position.set(
          Math.sin(turn) * (trouserRadius(-0.16) + 0.004),
          -0.16,
          Math.cos(turn) * (trouserRadius(-0.16) + 0.004),
        );
      }
    }
  },

  'knight-greaves'({ legs }) {
    const steel = '#a3b0bf';
    const dark = '#505a66';
    for (const leg of legs) {
      // A knee cop over a shin plate, both wrapping the front of the leg.
      plate(
        leg,
        'greave',
        -0.34,
        -0.14,
        trouserRadius(-0.24) + 0.004,
        0.022,
        2.2,
        dark,
      );
      const knee = soft(leg, [0.075, 0.062, 0.05], [0, -0.115, 0.075], steel);
      knee.rotation.x = 0.15;
      plate(
        leg,
        'knee-band',
        -0.14,
        -0.1,
        trouserRadius(-0.12) + 0.004,
        0.026,
        2.4,
        steel,
      );
    }
  },

  // ---- Shoes ---------------------------------------------------------------
  'rain-boots'({ legs }) {
    for (const leg of legs) boot(leg, '#3f8c4e', -0.16, { cuff: '#2d6a3a' });
  },

  'golden-kicks'({ legs }) {
    for (const leg of legs) {
      boot(leg, CLOTH.gold, -0.33, { cuff: '#fff1b8' });
      tube(leg, 'kick-lace', -0.38, -0.36, 0.111, 0.111, '#fff1b8');
    }
  },

  'high-tops'({ legs }) {
    for (const leg of legs) {
      boot(leg, '#f2eee4', -0.3, { cuff: '#c8483a' });
      for (const y of [-0.42, -0.38, -0.34])
        rounded(leg, [0.08, 0.012, 0.02], [0, y, 0.095], '#c8483a', 0.005);
    }
  },

  'clown-shoes'({ legs }) {
    for (const leg of legs) {
      tube(leg, 'clown-ankle', SOLE + 0.07, SOLE + 0.17, 0.1, 0.092, '#d7433a');
      soft(
        legs.length ? leg : leg,
        [0.11, 0.075, 0.3],
        [0, SOLE + 0.07, 0.15],
        '#d7433a',
      );
      soft(leg, [0.12, 0.085, 0.1], [0, SOLE + 0.075, 0.33], '#d7433a');
      leg.parent?.getObjectByName('shoe-sole')?.removeFromParent();
      shoeSole(leg, [0.23, 0.04, 0.5], [0, SOLE + 0.02, 0.14], '#2a2a2a');
    }
  },

  'roller-skates'({ legs }) {
    for (const leg of legs) {
      // The skate stands on its wheels, so they reach the floor and no lower.
      boot(leg, '#f4f0e6', -0.3, { cuff: '#d73b32' });
      rounded(leg, [0.17, 0.03, 0.3], [0, SOLE + 0.07, 0.05], '#d73b32', 0.012);
      for (const z of [-0.05, 0.16])
        for (const side of [-1, 1]) {
          const wheel = custom(
            leg,
            'skate-wheel',
            () =>
              new T.CylinderGeometry(0.042, 0.042, 0.032, 16).rotateZ(
                Math.PI / 2,
              ),
            [side * 0.072, SOLE + 0.042, z],
            '#2b2b2b',
          );
          wheel.castShadow = true;
        }
    }
  },

  'bunny-slippers'({ legs }) {
    const fur = '#ffffff';
    for (const leg of legs) {
      soft(leg, [0.105, 0.095, 0.19], [0, SOLE + 0.085, 0.05], fur);
      const head = soft(
        leg,
        [0.095, 0.085, 0.09],
        [0, SOLE + 0.105, 0.19],
        fur,
      );
      head.rotation.x = -0.2;
      for (const side of [-1, 1]) {
        const ear = soft(
          leg,
          [0.028, 0.085, 0.022],
          [side * 0.05, SOLE + 0.24, 0.16],
          fur,
        );
        ear.rotation.z = side * 0.25;
        ear.rotation.x = -0.25;
        soft(
          leg,
          [0.016, 0.055, 0.012],
          [side * 0.052, SOLE + 0.245, 0.175],
          '#fcedf2',
        );
        soft(
          leg,
          [0.014, 0.016, 0.01],
          [side * 0.035, SOLE + 0.12, 0.27],
          '#2b2b2b',
        );
      }
      soft(leg, [0.02, 0.016, 0.014], [0, SOLE + 0.095, 0.285], '#f2a0b6');
    }
  },

  'scuba-flippers'({ legs }) {
    const rubber = '#1f242b';
    for (const leg of legs) {
      tube(leg, 'flipper-ankle', SOLE + 0.06, SOLE + 0.16, 0.098, 0.09, rubber);
      soft(leg, [0.1, 0.07, 0.17], [0, SOLE + 0.07, 0.05], rubber);
      const fin = custom(
        leg,
        'fin',
        () => {
          const shape = new T.Shape();
          shape.moveTo(-0.1, 0);
          shape.lineTo(0.1, 0);
          shape.lineTo(0.14, 0.42);
          shape.lineTo(-0.14, 0.42);
          shape.closePath();
          return (
            new T.ExtrudeGeometry(shape, {
              depth: 0.022,
              bevelEnabled: false,
            })
              // Shape +Y becomes avatar-forward +Z; lift the extrusion above
              // the sole because its thickness now extends downwards.
              .rotateX(Math.PI / 2)
              .translate(0, 0.022, 0)
          );
        },
        [0, SOLE + 0.01, 0.1],
        CLOTH.gold,
      );
      fin.rotation.x = -0.12;
      fin.castShadow = true;
    }
  },

  'rocket-boots'({ legs }) {
    for (const leg of legs) {
      boot(leg, '#c3c9cf', -0.28, { cuff: '#8f989f' });
      for (const side of [-1, 1]) {
        // The thrusters point back off the heel, so nothing digs into the floor.
        const thruster = custom(
          leg,
          'thruster',
          () => new T.CylinderGeometry(0.038, 0.048, 0.13, 16),
          [side * 0.07, SOLE + 0.075, -0.075],
          '#d7433a',
        );
        thruster.rotation.x = 0.9;
        thruster.castShadow = true;
        const flame = custom(
          leg,
          'thruster-flame',
          () => new T.ConeGeometry(0.04, 0.13, 12).rotateX(-Math.PI / 2),
          [side * 0.07, SOLE + 0.045, -0.17],
          '#ff6a2a',
        );
        flame.rotation.x = -0.35;
      }
    }
  },

  // ---- Beards --------------------------------------------------------------
  'trimmed-beard'({ head }) {
    beardOnJaw(head, '#2b231d', true);
  },

  'wizard-beard'({ head }) {
    const white = '#e8edf2';
    beardOnJaw(head, white);
    // It hangs from the chin, narrowing to a point on his chest.
    const hang: [number, number, number, number][] = [
      [0.01, 0.205, 0.145, 0.095],
      [-0.09, 0.2, 0.13, 0.09],
      [-0.19, 0.185, 0.105, 0.08],
      [-0.28, 0.165, 0.075, 0.068],
      [-0.36, 0.145, 0.045, 0.05],
    ];
    for (const [y, z, wide, deep] of hang)
      soft(head, [wide, deep, deep], [0, y, z], white);
  },
};

/**
 * A beard round the jaw: lumps laid on the kid's own face, from the chin up
 * each cheek, with a moustache over the lip. `lip` leaves it off.
 */
function beardOnJaw(head: T.Object3D, hex: string, lip = true) {
  // The chin, then up the jaw to the ears, each lump sitting on the face.
  const along: [number, number, [number, number, number]][] = [
    [0, 0.055, [0.1, 0.06, 0.055]],
    [0.075, 0.075, [0.07, 0.055, 0.05]],
    [0.135, 0.115, [0.06, 0.06, 0.05]],
    [0.18, 0.15, [0.055, 0.055, 0.05]],
    [0.205, 0.195, [0.05, 0.045, 0.048]],
  ];
  for (const [x, y, radii] of along)
    for (const side of x ? [-1, 1] : [1])
      onFace(soft(head, radii, [0, 0, 0], hex), side * x, y, -0.01);
  if (!lip) return;
  for (const side of [-1, 1]) {
    const moustache = soft(head, [0.06, 0.025, 0.03], [0, 0, 0], hex);
    onFace(moustache, side * 0.045, 0.215, -0.005);
    moustache.rotateZ(side * 0.25);
  }
}
