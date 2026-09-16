import * as T from 'three';
import { ball, beam, box, taper } from '../../shared/rendering/primitives';
import {
  ITEM_CONFIGS,
  SIZER_MAX_D,
  SIZER_MAX_H,
  SIZER_MAX_W,
  SUITCASE_BASE_D,
  SUITCASE_BASE_H,
  SUITCASE_BASE_W,
  type LuggageItem,
  type Suitcase,
} from './types';

const PALETTE = {
  floorTileA: '#e5e7eb',
  floorTileB: '#d1d5db',
  wall: '#374151',
  metalChrome: '#9ca3af',
  metalDark: '#1f2937',
  glass: '#a5f3fc',
  warningYellow: '#eab308',
  warningBlack: '#111827',
  neonGreen: '#22c55e',
  neonRed: '#ef4444',
  tarmac: '#4b5563',
  benchWood: '#b45309',
  counterNavy: '#1e3a8a',
};

export const SUITCASE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6'];

/** Create the complete airport terminal scene geometry */
export function createAirportTerminal(): T.Group {
  const root = new T.Group();
  root.name = 'terminal-environment';

  // 1. Floor checkerboard tiles
  const floorW = 24;
  const floorD = 12;
  box(root, [floorW, 0.4, floorD], [1, -0.2, 0], PALETTE.floorTileA);

  // Decorative border lines / yellow hazard paths
  box(root, [floorW, 0.02, 0.2], [1, 0.01, 3.8], PALETTE.warningYellow);
  box(root, [floorW, 0.02, 0.2], [1, 0.01, -3.8], PALETTE.warningYellow);

  // 2. Back panoramic airport windows & runway view
  const windowY = 3.2;
  // Glass panes
  const glass = box(
    root,
    [floorW, 4.8, 0.2],
    [1, windowY, -5.8],
    PALETTE.glass,
  );
  (glass.material as T.MeshStandardMaterial).transparent = true;
  (glass.material as T.MeshStandardMaterial).opacity = 0.55;

  // Window frame mullions
  for (let x = -10; x <= 12; x += 3.5) {
    box(root, [0.18, 5.2, 0.25], [x, windowY, -5.75], PALETTE.metalDark);
  }
  box(root, [floorW, 0.25, 0.3], [1, 5.6, -5.75], PALETTE.metalDark);
  box(root, [floorW, 0.35, 0.4], [1, 0.8, -5.75], PALETTE.metalDark);

  // Outside tarmac & runway lights
  box(root, [floorW + 10, 0.1, 14], [1, -0.1, -12], PALETTE.tarmac);
  // Runway lights
  for (let x = -10; x <= 12; x += 4) {
    taper(root, 0.08, 0.08, 0.3, [x, 0.15, -10], PALETTE.warningYellow);
  }

  // Simplified airliner tail visible through window
  const airplane = new T.Group();
  airplane.position.set(-2, 1.5, -13);
  box(airplane, [9, 2.4, 2.4], [0, 1.2, 0], '#ffffff', true);
  // Cockpit nose
  taper(airplane, 1.0, 0.2, 2.5, [5.5, 1.1, 0], '#ffffff');
  // Jet engine
  taper(airplane, 0.6, 0.6, 1.8, [1, 0.6, -2.2], '#e5e7eb');
  // Fin / Tail with budget airline stripe
  box(airplane, [1.8, 3.2, 0.3], [-3.8, 3.2, 0], '#ef4444');
  root.add(airplane);

  // 3. Waiting lounge benches (left side, where players can sit or stomp)
  for (const z of [-2.4, 2.4]) {
    const bench = new T.Group();
    bench.position.set(-6.5, 0, z);
    // Wooden slats
    box(bench, [3.2, 0.12, 0.8], [0, 0.55, 0], PALETTE.benchWood);
    box(bench, [3.2, 0.7, 0.12], [0, 0.95, -0.34], PALETTE.benchWood);
    // Metal legs
    for (const bx of [-1.3, 1.3]) {
      box(bench, [0.08, 0.55, 0.7], [bx, 0.275, 0], PALETTE.metalChrome);
    }
    root.add(bench);
  }

  // Luggage scale in packing area
  const scale = new T.Group();
  scale.position.set(-2.8, 0, -2.8);
  box(scale, [1.4, 0.1, 1.4], [0, 0.05, 0], PALETTE.metalDark);
  box(scale, [0.15, 1.1, 0.15], [-0.6, 0.55, -0.6], PALETTE.metalDark);
  box(scale, [0.45, 0.3, 0.15], [-0.6, 1.15, -0.6], PALETTE.metalDark);
  // Scale digital display (green LED)
  box(scale, [0.35, 0.18, 0.02], [-0.6, 1.15, -0.52], PALETTE.neonGreen);
  root.add(scale);

  // 4. TSA Checkpoint (center at x = 3.5)
  const tsa = new T.Group();
  tsa.position.set(3.5, 0, 0);

  // Metal detector portal arch
  box(tsa, [0.25, 2.6, 0.5], [-0.9, 1.3, 0], PALETTE.metalDark);
  box(tsa, [0.25, 2.6, 0.5], [0.9, 1.3, 0], PALETTE.metalDark);
  box(tsa, [2.05, 0.3, 0.5], [0, 2.5, 0], PALETTE.metalDark);
  // Status indicator lights on arch
  box(tsa, [0.1, 0.1, 0.05], [-0.8, 2.1, 0.26], PALETTE.neonGreen);
  box(tsa, [0.1, 0.1, 0.05], [-0.8, 1.9, 0.26], PALETTE.neonRed);

  // X-Ray baggage conveyor scanner box
  const xray = new T.Group();
  xray.position.set(0, 0, -2.2);
  box(xray, [1.6, 1.4, 1.2], [0, 1.1, 0], PALETTE.metalChrome);
  // Entrance rubber curtain flaps
  box(xray, [1.4, 0.8, 0.05], [0, 1.0, 0.62], PALETTE.metalDark);
  box(xray, [1.4, 0.8, 0.05], [0, 1.0, -0.62], PALETTE.metalDark);
  // Conveyor rollers
  box(xray, [1.4, 0.7, 3.2], [0, 0.35, 0], PALETTE.metalDark);
  tsa.add(xray);

  // TSA Guard counter
  box(tsa, [0.9, 1.1, 0.8], [0, 0.55, 2.2], PALETTE.counterNavy);
  box(tsa, [0.4, 0.35, 0.05], [0, 1.25, 2.2], PALETTE.metalDark); // Computer screen
  root.add(tsa);

  // 5. Boarding Gate B12 & Counter (right side, x = 8.5)
  const gate = new T.Group();
  gate.position.set(8.5, 0, 0);

  // Gate Agent counter desk
  box(gate, [1.2, 1.15, 2.4], [0, 0.575, -2.2], PALETTE.counterNavy);
  box(gate, [1.3, 0.08, 2.5], [0, 1.18, -2.2], PALETTE.metalChrome);
  // Boarding scanner & monitor
  box(gate, [0.45, 0.35, 0.05], [0, 1.42, -2.0], PALETTE.metalDark);

  // Overhead Gate Sign & FIDS Flight Information Display
  const sign = new T.Group();
  sign.position.set(0, 3.4, 0);
  box(sign, [0.4, 1.2, 4.8], [0, 0, 0], PALETTE.metalDark);
  // Glowing yellow text panel
  box(sign, [0.42, 0.4, 4.4], [0, 0.25, 0], PALETTE.warningYellow);
  box(sign, [0.42, 0.3, 4.4], [0, -0.25, 0], PALETTE.neonRed);
  gate.add(sign);

  // Boarding Jetway doorway
  box(gate, [0.3, 2.8, 0.3], [1.8, 1.4, -1.3], PALETTE.metalDark);
  box(gate, [0.3, 2.8, 0.3], [1.8, 1.4, 1.3], PALETTE.metalDark);
  box(gate, [0.3, 0.3, 2.9], [1.8, 2.8, 0], PALETTE.metalDark);
  // "TO AIRCRAFT" arrow sign
  box(gate, [0.05, 0.4, 1.6], [1.8, 2.4, 0], PALETTE.neonGreen);

  root.add(gate);

  return root;
}

/** Create the Dreaded Metal Sizer Box model */
export function createSizerBoxMesh(): T.Group {
  const root = new T.Group();
  root.name = 'sizer-box-cage';

  const w = SIZER_MAX_W;
  const h = SIZER_MAX_H;
  const d = SIZER_MAX_D;
  const barR = 0.025;
  const cageCol = '#e5e7eb'; // Steel cage bars
  const baseCol = PALETTE.metalDark;

  // Solid base plate with hazard stripes
  box(root, [w + 0.1, 0.08, d + 0.1], [0, 0.04, 0], baseCol);
  box(root, [w + 0.08, 0.01, d + 0.08], [0, 0.085, 0], PALETTE.warningYellow);

  // 4 vertical corner steel bars
  for (const bx of [-w / 2, w / 2]) {
    for (const bz of [-d / 2, d / 2]) {
      beam(root, [bx, 0.08, bz], [bx, h + 0.08, bz], barR, cageCol);
    }
  }

  // Top perimeter boundary frame
  beam(
    root,
    [-w / 2, h + 0.08, -d / 2],
    [w / 2, h + 0.08, -d / 2],
    barR,
    cageCol,
  );
  beam(
    root,
    [-w / 2, h + 0.08, d / 2],
    [w / 2, h + 0.08, d / 2],
    barR,
    cageCol,
  );
  beam(
    root,
    [-w / 2, h + 0.08, -d / 2],
    [-w / 2, h + 0.08, d / 2],
    barR,
    cageCol,
  );
  beam(
    root,
    [w / 2, h + 0.08, -d / 2],
    [w / 2, h + 0.08, d / 2],
    barR,
    cageCol,
  );

  // Intermediate vertical grid slats (back and sides)
  beam(root, [-w / 4, 0.08, -d / 2], [-w / 4, h + 0.08, -d / 2], barR, cageCol);
  beam(root, [w / 4, 0.08, -d / 2], [w / 4, h + 0.08, -d / 2], barR, cageCol);
  beam(root, [-w / 2, 0.08, 0], [-w / 2, h + 0.08, 0], barR, cageCol);
  beam(root, [w / 2, 0.08, 0], [w / 2, h + 0.08, 0], barR, cageCol);

  // Rigid test lid bracket
  beam(
    root,
    [-w / 2, h + 0.08, 0],
    [w / 2, h + 0.08, 0],
    barR * 1.3,
    PALETTE.neonRed,
  );

  // Siren / Beacon on top post
  const sirenPost = new T.Group();
  sirenPost.position.set(0, h + 0.12, -d / 2);
  beam(sirenPost, [0, 0, 0], [0, 0.35, 0], 0.03, PALETTE.metalDark);
  // Dome light
  const sirenDome = ball(
    sirenPost,
    [0.1, 0.12, 0.1],
    [0, 0.45, 0],
    PALETTE.neonRed,
  );
  sirenDome.name = 'siren-light';
  root.add(sirenPost);

  // "55 x 40 x 20 CM" dimension plate
  box(root, [0.45, 0.18, 0.04], [0, h * 0.5, d / 2 + 0.02], PALETTE.metalDark);
  box(
    root,
    [0.4, 0.12, 0.01],
    [0, h * 0.5, d / 2 + 0.045],
    PALETTE.warningYellow,
  );

  return root;
}

/** Build an interactive suitcase 3D model with dynamic bulging lid */
export function createSuitcaseMesh(sc: Suitcase): T.Group {
  const root = new T.Group();
  root.name = `suitcase-${sc.id}`;

  const w = SUITCASE_BASE_W;
  const h = SUITCASE_BASE_H;
  const d = SUITCASE_BASE_D;
  const col = SUITCASE_COLORS[sc.color % SUITCASE_COLORS.length];

  // Lower shell body
  box(root, [w, h * 0.55, d], [0, h * 0.275, 0], col, true);

  // Corner guards (black reinforced plastic)
  for (const cx of [-w / 2 + 0.04, w / 2 - 0.04]) {
    for (const cz of [-d / 2 + 0.04, d / 2 - 0.04]) {
      box(root, [0.1, 0.12, 0.1], [cx, 0.08, cz], PALETTE.metalDark, true);
    }
  }

  // 4 Spinner wheels
  for (const wx of [-w / 2 + 0.1, w / 2 - 0.1]) {
    for (const wz of [-d / 2 + 0.08, d / 2 - 0.08]) {
      taper(root, 0.05, 0.05, 0.06, [wx, 0.03, wz], PALETTE.metalDark);
    }
  }

  // Telescopic handle on the top/side
  box(
    root,
    [0.04, 0.4, 0.04],
    [-0.18, h * 0.55 + 0.2, -d / 2 + 0.05],
    '#cccccc',
  );
  box(
    root,
    [0.04, 0.4, 0.04],
    [0.18, h * 0.55 + 0.2, -d / 2 + 0.05],
    '#cccccc',
  );
  box(
    root,
    [0.44, 0.06, 0.06],
    [0, h * 0.55 + 0.4, -d / 2 + 0.05],
    PALETTE.metalDark,
    true,
  );

  // Bulging Upper Lid assembly (dynamically scaled on render)
  const lid = new T.Group();
  lid.name = 'suitcase-lid';
  lid.position.set(0, h * 0.55, 0);

  // Upper hard shell
  const upperMesh = box(lid, [w, h * 0.45, d], [0, h * 0.225, 0], col, true);
  upperMesh.name = 'lid-shell';

  // Bulging elastic fabric belly in middle
  const bulgeMesh = ball(
    lid,
    [w * 0.48, 0.1, d * 0.48],
    [0, 0.02, 0],
    '#2563eb',
  );
  bulgeMesh.name = 'bulge-belly';

  // Zipper seam track around perimeter
  box(lid, [w + 0.03, 0.03, d + 0.03], [0, 0, 0], PALETTE.metalDark);

  // Zipper pull tab
  const zipperTab = box(
    lid,
    [0.05, 0.08, 0.03],
    [w * 0.4, 0, d * 0.5 + 0.02],
    '#fbbf24',
    true,
  );
  zipperTab.name = 'zipper-tab';

  root.add(lid);

  // Approved green sticker tag or rejected red tag
  const tag = box(
    root,
    [0.18, 0.12, 0.02],
    [0, h * 0.4, d / 2 + 0.015],
    sc.approved ? PALETTE.neonGreen : sc.rejected ? PALETTE.neonRed : '#ffffff',
  );
  tag.name = 'status-tag';

  return root;
}

/** Build rich 3D mesh for individual vacation junk or contraband item */
export function createItemMesh(item: LuggageItem): T.Group {
  const root = new T.Group();
  root.name = `item-${item.id}`;
  const cfg = ITEM_CONFIGS[item.kind];

  switch (item.kind) {
    case 'clothes': {
      // Stack of vibrant folded shirts & shorts
      box(root, [0.44, 0.08, 0.34], [0, 0.04, 0], '#e76f51', true);
      box(root, [0.42, 0.08, 0.32], [0, 0.12, 0], '#f4a261', true);
      box(root, [0.4, 0.08, 0.3], [0, 0.2, 0], '#2a9d8f', true);
      break;
    }
    case 'duck': {
      // Mega rubber duck
      ball(root, [0.22, 0.18, 0.24], [0, 0.14, 0], cfg.color); // Body
      ball(root, [0.13, 0.13, 0.13], [0, 0.28, 0.12], cfg.color); // Head
      taper(root, 0.03, 0.07, 0.12, [0, 0.27, 0.25], '#ea580c'); // Beak
      // Cute black eyes
      ball(root, [0.02, 0.02, 0.02], [0.06, 0.32, 0.2], '#111827');
      ball(root, [0.02, 0.02, 0.02], [-0.06, 0.32, 0.2], '#111827');
      break;
    }
    case 'flamingo': {
      // Inflatable pool flamingo
      // Torso ring
      ball(root, [0.35, 0.15, 0.35], [0, 0.15, 0], cfg.color);
      // Long graceful neck
      beam(root, [0, 0.15, 0.25], [0, 0.55, 0.28], 0.06, cfg.color);
      // Head and hooked beak
      ball(root, [0.1, 0.09, 0.1], [0, 0.58, 0.28], cfg.color);
      taper(root, 0.02, 0.05, 0.12, [0, 0.56, 0.38], '#111827');
      // Wings
      box(root, [0.04, 0.18, 0.25], [0.32, 0.2, 0], '#ff4d94', true);
      box(root, [0.04, 0.18, 0.25], [-0.32, 0.2, 0], '#ff4d94', true);
      break;
    }
    case 'racket': {
      // Tennis racket with long protruding handle
      // Handle grip
      taper(root, 0.03, 0.035, 0.45, [0, 0.22, 0], '#ffffff');
      // Shaft & throat
      beam(root, [0, 0.44, 0], [-0.08, 0.55, 0], 0.02, cfg.color);
      beam(root, [0, 0.44, 0], [0.08, 0.55, 0], 0.02, cfg.color);
      // Oval frame
      ball(root, [0.22, 0.28, 0.03], [0, 0.72, 0], cfg.color);
      // Strings (semi-translucent white center)
      const strings = ball(root, [0.18, 0.24, 0.01], [0, 0.72, 0], '#f8fafc');
      (strings.material as T.MeshStandardMaterial).transparent = true;
      (strings.material as T.MeshStandardMaterial).opacity = 0.5;
      break;
    }
    case 'shoes': {
      // Tin foil shoes / sneakers
      for (const side of [-1, 1]) {
        const shoe = new T.Group();
        shoe.position.set(side * 0.14, 0, 0);
        box(shoe, [0.16, 0.12, 0.3], [0, 0.08, 0.05], cfg.color, true);
        box(shoe, [0.14, 0.14, 0.14], [0, 0.14, -0.04], cfg.color, true);
        root.add(shoe);
      }
      break;
    }
    case 'lobster': {
      // Live Maine Lobster (contraband!)
      // Carapace body
      ball(root, [0.14, 0.11, 0.28], [0, 0.12, 0], cfg.color);
      // Segmented tail
      ball(root, [0.11, 0.08, 0.2], [0, 0.09, -0.22], cfg.color);
      taper(root, 0.12, 0.04, 0.1, [0, 0.07, -0.34], cfg.color);
      // Pincers / Claws
      for (const side of [-1, 1]) {
        beam(
          root,
          [side * 0.1, 0.1, 0.1],
          [side * 0.22, 0.12, 0.25],
          0.03,
          cfg.color,
        );
        ball(root, [0.08, 0.04, 0.14], [side * 0.24, 0.12, 0.34], '#b91c1c', 8);
      }
      // Feelers / Antennae
      beam(root, [0.03, 0.15, 0.15], [0.1, 0.22, 0.36], 0.015, '#7f1d1d');
      beam(root, [-0.03, 0.15, 0.15], [-0.1, 0.22, 0.36], 0.015, '#7f1d1d');
      break;
    }
    case 'shampoo': {
      // 2-Liter giant translucent shampoo bottle
      box(root, [0.24, 0.38, 0.16], [0, 0.2, 0], cfg.color, true);
      taper(root, 0.06, 0.08, 0.1, [0, 0.44, 0], '#ffffff');
      // Pump dispenser nozzle
      box(root, [0.04, 0.08, 0.1], [0, 0.52, 0.04], '#ffffff');
      break;
    }
    case 'snowglobe': {
      // Oversized glass snow globe
      // Wooden base
      taper(root, 0.18, 0.22, 0.1, [0, 0.05, 0], '#78350f');
      // Glass sphere
      const glass = ball(root, [0.2, 0.2, 0.2], [0, 0.24, 0], cfg.color);
      (glass.material as T.MeshStandardMaterial).transparent = true;
      (glass.material as T.MeshStandardMaterial).opacity = 0.45;
      // Miniature green pine tree inside
      taper(root, 0.01, 0.09, 0.16, [0, 0.18, 0], '#15803d');
      break;
    }
  }

  return root;
}
