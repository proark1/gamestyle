import * as T from 'three';
import { ball, box, taper, label } from '../../shared/rendering/primitives';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { CLOTH, TEAM } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { GRILL_BOUNDS, SPEAKER_POLE_POS, WINDOW_SILL_POS } from './physics';
import type { BurgerLayer, RoleId } from './types';

const COLORS = {
  asphalt: '#59686b',
  curbConcrete: '#d1d5db',
  curbYellow: '#f59e0b',
  buildingBrick: '#be4d3c',
  buildingWhite: '#fff1cf',
  roofTrim: '#377f7b',
  signYellow: '#fbbf24',
  counterSteel: '#94a3b8',
  grillIron: '#1e293b',
  fryerOil: '#d97706',
  speakerSteel: '#475569',
  menuGlow: '#fef08a',
  carBody: '#78716c', // Beat up dusty stone color
  carTrim: '#44403c',
  carGlass: '#93c5fd',
  tireRubber: '#1c1917',
  hubcap: '#a8a29e',
  bunBread: '#d97706',
  pattyBrown: '#451a03',
  pattyRaw: '#f87171',
  cheeseYellow: '#fbbf24',
  lettuceGreen: '#4ade80',
  cupRed: '#ef4444',
  trayPlastic: '#991b1b',
  milkshakePink: '#f472b6',
};

/**
 * Creates the entire drive-thru exterior environment:
 * Road, concrete island, ordering speaker post, fast-food restaurant exterior & kitchen counters.
 */
export function createDriveThruEnvironment(): T.Group {
  const root = new T.Group();
  root.name = 'drive-thru-environment';

  // 1. Asphalt Ground
  box(root, [28, 0.4, 48], [-4, -0.2, 8], COLORS.asphalt);

  // Painted lane arrows and guide lines
  for (let z = -8; z <= 24; z += 8) {
    box(root, [0.3, 0.02, 3.5], [-3.8, 0.02, z], COLORS.curbYellow);
  }

  // 2. Concrete Curb Island dividing Drive-Thru lane and kitchen building
  box(root, [1.4, 0.35, 36], [2.1, 0.175, 4], COLORS.curbConcrete);
  // Yellow curb edge paint
  box(root, [0.15, 0.36, 36], [1.45, 0.18, 4], COLORS.curbYellow);

  // 3. Fast Food Restaurant Building (X: [2.8, 14], Z: [-12, 16], Y: [0, 6])
  // Cutaway service bay: walls surround the playable kitchen instead of burying it.
  box(root, [0.25, 3.6, 26], [9, 1.8, 4], COLORS.buildingBrick);
  box(root, [6, 3.6, 0.25], [6, 1.8, -9], COLORS.buildingBrick);
  box(root, [0.25, 3.6, 10], [2.9, 1.8, 10], COLORS.buildingBrick);
  box(root, [0.25, 3.6, 4], [2.9, 1.8, -7], COLORS.buildingBrick);
  for (const z of [7, 10.2, 13.4]) {
    box(root, [0.12, 1.65, 2.3], [2.73, 2, z], COLORS.buildingWhite, true);
    box(root, [0.13, 1.4, 2.05], [2.65, 2, z], '#427d80', true);
    box(root, [0.16, 1.5, 0.06], [2.57, 2, z], COLORS.buildingWhite);
    box(root, [0.35, 0.12, 2.45], [2.62, 1.16, z], COLORS.buildingWhite, true);
    box(root, [0.25, 0.12, 2.5], [2.64, 2.89, z], COLORS.roofTrim, true);
  }
  for (let x = 3; x < 9; x++)
    for (let z = -8; z < 15; z++)
      box(
        root,
        [0.98, 0.04, 0.98],
        [x + 0.5, 0.025, z + 0.5],
        (x + z) % 2 ? '#eee1bd' : '#91b8aa',
      );
  // White stucco upper band
  box(root, [6.6, 0.45, 26.2], [6, 3.75, 4], COLORS.buildingWhite);
  // Retro red roof overhang
  box(root, [6.9, 0.24, 26.6], [6, 4.05, 4], COLORS.roofTrim);

  // Big Retro Drive-Thru Sign on roof
  const signGroup = new T.Group();
  signGroup.position.set(3.3, 4.7, 2);
  box(signGroup, [0.4, 1.4, 8.0], [0, 0, 0], COLORS.roofTrim);
  box(signGroup, [0.45, 1.1, 7.6], [0, 0, 0], COLORS.signYellow);
  root.add(signGroup);

  // Open service window, framed by a striped awning.
  for (const z of [-1.7, 1.7])
    box(root, [0.18, 2.8, 0.16], [2.7, 1.6, z], COLORS.buildingWhite, true);
  for (let i = 0; i < 10; i++)
    box(
      root,
      [1.1, 0.12, 0.35],
      [2.45, 3.0, -1.58 + i * 0.35],
      i % 2 ? COLORS.buildingWhite : COLORS.buildingBrick,
    );
  // Window sill ledge where trays are served
  box(
    root,
    [0.9, 0.12, 2.2],
    [WINDOW_SILL_POS.x, WINDOW_SILL_POS.y, WINDOW_SILL_POS.z],
    COLORS.counterSteel,
  );

  // 5. Kitchen Interior Counters (visible through window)
  // Prep counter
  box(root, [2.5, 0.9, 6.0], [4.5, 0.45, 0], COLORS.counterSteel);
  // Flat-top commercial grill
  box(
    root,
    [
      GRILL_BOUNDS.maxX - GRILL_BOUNDS.minX,
      0.15,
      GRILL_BOUNDS.maxZ - GRILL_BOUNDS.minZ,
    ],
    [
      (GRILL_BOUNDS.minX + GRILL_BOUNDS.maxX) / 2,
      GRILL_BOUNDS.y - 0.075,
      (GRILL_BOUNDS.minZ + GRILL_BOUNDS.maxZ) / 2,
    ],
    COLORS.grillIron,
  );
  // Deep Fryer station
  box(root, [1.2, 0.85, 1.6], [4.2, 0.425, 2.5], COLORS.counterSteel);
  // Bubbling oil vat
  box(root, [0.9, 0.1, 1.3], [4.2, 0.8, 2.5], COLORS.fryerOil);

  // Milkshake Machine on counter
  const shakeMachine = new T.Group();
  shakeMachine.position.set(3.6, 1.4, -2.2);
  box(shakeMachine, [0.7, 1.0, 0.7], [0, 0, 0], COLORS.counterSteel);
  box(shakeMachine, [0.2, 0.4, 0.2], [0, -0.2, 0.38], COLORS.milkshakePink); // Dispenser spout
  root.add(shakeMachine);

  // 6. The Intercom Speaker Box Pole
  const speakerPost = new T.Group();
  speakerPost.name = 'speaker-pole';
  speakerPost.position.set(SPEAKER_POLE_POS.x, 0, SPEAKER_POLE_POS.z);
  // Metal pole
  box(speakerPost, [0.25, 2.1, 0.25], [0, 1.05, 0], COLORS.speakerSteel);
  // Intercom box with speaker grille
  box(speakerPost, [0.65, 0.85, 0.55], [0, 1.8, 0], COLORS.buildingBrick);
  box(speakerPost, [0.55, 0.35, 0.58], [0, 1.95, 0], COLORS.speakerSteel);
  // Menu board
  box(speakerPost, [0.15, 1.6, 2.2], [-0.35, 1.5, 0.9], COLORS.speakerSteel);
  box(speakerPost, [0.18, 1.4, 2.0], [-0.35, 1.5, 0.9], COLORS.menuGlow);
  root.add(speakerPost);

  const pickup = label('PICK UP', '#377f7b', '#fff1cf', 2.5);
  pickup.position.set(2.55, 2.6, 0);
  pickup.material.toneMapped = false;
  root.add(pickup);
  const diner = label('JUMBLE DINER', '#fff1cf', '#377f7b', 5);
  diner.position.set(3.1, 4.7, 2);
  diner.material.toneMapped = false;
  root.add(diner);
  const menu = label('BURGERS  /  SHAKES', '#fff1cf', '#be4d3c', 2.2);
  menu.position.set(-4.2, 2.7, 11);
  menu.material.toneMapped = false;
  root.add(menu);
  // Parking outline and a stop line make the pickup target visible from the car.
  for (const x of [-2.25, 1.15])
    box(root, [0.07, 0.015, 5.6], [x, 0.025, 0], '#fff1cf');
  box(root, [3.45, 0.015, 0.14], [-0.55, 0.025, -2.8], '#efbd58');
  for (let z = -8; z < 24; z += 6) {
    box(root, [1, 0.015, 0.12], [-1.5, 0.025, z], '#fff1cf');
    for (const x of [-0.28, 0.28]) {
      const arrow = box(
        root,
        [0.08, 0.015, 0.65],
        [-1.5 + x, 0.025, z - 0.18],
        '#fff1cf',
      );
      arrow.rotation.y = x < 0 ? -0.65 : 0.65;
    }
  }
  box(root, [5, 0.18, 48], [-10.5, -0.04, 8], '#8ea77b', true);
  for (let z = -7; z < 28; z += 7) {
    taper(root, 0.15, 0.22, 2, [-9, 0.95, z], '#91724c', 8);
    ball(root, [1.3, 1.5, 1.3], [-9, 2.7, z], '#719565', 16);
    ball(root, [0.9, 1, 1], [-9.6, 2.5, z + 0.3], '#88a971', 16);
  }
  return root;
}

export { createSedanModel } from './sedan';

/**
 * Creates an interactive burger patty with visual sizzle/char states
 */
export function createPattyMesh(): T.Group {
  const g = new T.Group();
  const patty = taper(g, 0.28, 0.3, 0.12, [0, 0.06, 0], COLORS.pattyRaw, 20);
  patty.material = patty.material.clone();
  patty.material.userData.shared = false;
  return g;
}

/**
 * Creates the spatula tool
 */
export function createSpatulaMesh(): T.Group {
  const g = new T.Group();
  g.name = 'spatula';
  // Metal blade
  box(g, [0.45, 0.02, 0.55], [0, 0, 0.15], COLORS.counterSteel);
  // Angled neck
  box(g, [0.08, 0.03, 0.3], [0, 0.08, -0.2], COLORS.counterSteel);
  // Wooden handle
  box(g, [0.1, 0.08, 0.45], [0, 0.12, -0.5], '#78350f', true);
  return g;
}

/**
 * Creates the food serving tray and its stacked burger / drinks
 */
export function createOrderTray(stack: BurgerLayer[], sodas: number): T.Group {
  const tray = new T.Group();
  tray.name = 'order-tray';

  // Red plastic fast-food tray
  box(tray, [1.2, 0.06, 0.85], [0, 0.03, 0], COLORS.trayPlastic);
  // Paper tray liner
  box(tray, [1.1, 0.01, 0.75], [0, 0.065, 0], '#ffffff');

  // Burger stack
  let currentY = 0.07;
  for (const layer of stack) {
    switch (layer) {
      case 'bottom_bun':
        box(
          tray,
          [0.55, 0.12, 0.55],
          [-0.25, currentY + 0.06, 0],
          COLORS.bunBread,
          true,
        );
        currentY += 0.12;
        break;
      case 'patty':
        box(
          tray,
          [0.58, 0.1, 0.58],
          [-0.25, currentY + 0.05, 0],
          COLORS.pattyBrown,
          true,
        );
        currentY += 0.1;
        break;
      case 'cheese':
        box(
          tray,
          [0.62, 0.02, 0.62],
          [-0.25, currentY + 0.01, 0],
          COLORS.cheeseYellow,
        );
        currentY += 0.02;
        break;
      case 'lettuce':
        box(
          tray,
          [0.64, 0.04, 0.64],
          [-0.25, currentY + 0.02, 0],
          COLORS.lettuceGreen,
        );
        currentY += 0.04;
        break;
      case 'top_bun':
        box(
          tray,
          [0.55, 0.18, 0.55],
          [-0.25, currentY + 0.09, 0],
          COLORS.bunBread,
          true,
        );
        currentY += 0.18;
        break;
    }
  }

  // 4-Cup Drink carrier
  if (sodas > 0) {
    box(tray, [0.45, 0.15, 0.45], [0.3, 0.14, 0], '#b45309'); // Cardboard carrier
    for (let s = 0; s < sodas; s++) {
      const cx = 0.22 + (s % 2) * 0.16;
      const cz = -0.08 + Math.floor(s / 2) * 0.16;
      box(tray, [0.12, 0.45, 0.12], [cx, 0.35, cz], COLORS.cupRed, true);
      // Straw
      box(tray, [0.02, 0.2, 0.02], [cx, 0.65, cz], '#ffffff');
    }
  }

  return tray;
}

/**
 * Creates custom workers for Drive-Thru Static using dressedWorker
 */
export function createDriveThruWorker(
  role: RoleId,
  color: number,
  look?: Look,
): T.Group {
  const isKitchen = role === 'grill' || role === 'barista';
  const outfit = isKitchen
    ? {
        shirt: CLOTH.white, // Cook shirt
        overalls: TEAM.red, // Kitchen apron
        boots: CLOTH.charcoal,
        cap: false,
      }
    : {
        shirt: TEAM.red, // Driver jacket
        overalls: CLOTH.denim, // Jeans
        boots: CLOTH.ink,
        cap: true,
      };

  const { model, worn } = dressedWorker(color, outfit, look);

  // Fast-food paper diner hat for kitchen staff
  if (isKitchen && !worn.hat) {
    const body = model.userData.body as T.Group;
    if (body) {
      box(body, [0.55, 0.22, 0.32], [0, 1.69, 0], CLOTH.white);
      box(body, [0.56, 0.05, 0.33], [0, 1.6, 0], TEAM.red); // Red accent stripe
    }
  }

  // Headset mic for drive-thru barista / order taker
  if (role === 'barista' && !worn.face) {
    const body = model.userData.body as T.Group;
    if (body) {
      box(body, [0.66, 0.04, 0.04], [0, 1.53, 0], CLOTH.ink);
      box(body, [0.05, 0.08, 0.28], [0.32, 1.34, 0.2], CLOTH.ink);
      ball(body, [0.05, 0.05, 0.05], [0.32, 1.34, 0.34], CLOTH.ink); // Foam mic
    }
  }

  return model;
}
