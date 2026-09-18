import * as T from 'three';
import { ball, box } from '../../shared/rendering/primitives';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { CLOTH, TEAM } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { GRILL_BOUNDS, SPEAKER_POLE_POS, WINDOW_SILL_POS } from './physics';
import type { BurgerLayer, RoleId } from './types';

const COLORS = {
  asphalt: '#2b2d31',
  curbConcrete: '#d1d5db',
  curbYellow: '#f59e0b',
  buildingBrick: '#991b1b',
  buildingWhite: '#f3f4f6',
  roofTrim: '#dc2626',
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
  box(root, [11, 5.5, 26], [8.3, 2.75, 4], COLORS.buildingBrick);
  // White stucco upper band
  box(root, [11.2, 1.2, 26.2], [8.3, 5.2, 4], COLORS.buildingWhite);
  // Retro red roof overhang
  box(root, [12.0, 0.6, 27.0], [8.3, 5.8, 4], COLORS.roofTrim);

  // Big Retro Drive-Thru Sign on roof
  const signGroup = new T.Group();
  signGroup.position.set(3.5, 6.6, 2);
  box(signGroup, [0.4, 1.4, 8.0], [0, 0, 0], COLORS.roofTrim);
  box(signGroup, [0.45, 1.1, 7.6], [0, 0, 0], COLORS.signYellow);
  root.add(signGroup);

  // 4. Service Pickup Window & Sill
  box(
    root,
    [0.3, 2.2, 3.2],
    [WINDOW_SILL_POS.x + 0.5, 2.3, WINDOW_SILL_POS.z],
    COLORS.buildingWhite,
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

  return root;
}

/**
 * Creates the beat-up 80s sedan with passenger opening, working wipers, and wheels.
 */
export function createSedanModel(): T.Group {
  const car = new T.Group();
  car.name = 'sedan';

  const bodyGroup = new T.Group();
  bodyGroup.name = 'car-body';

  // Lower chassis
  box(bodyGroup, [2.0, 0.65, 4.4], [0, 0.65, 0], COLORS.carBody, true);
  // Cabin roof
  box(bodyGroup, [1.8, 0.65, 2.3], [0, 1.25, 0.1], COLORS.carBody, true);

  // Bumpers
  box(bodyGroup, [2.05, 0.25, 0.35], [0, 0.45, 2.25], COLORS.carTrim); // Rear
  box(bodyGroup, [2.05, 0.25, 0.35], [0, 0.45, -2.25], COLORS.carTrim); // Front

  // Headlights
  box(bodyGroup, [0.4, 0.2, 0.1], [-0.7, 0.65, -2.22], '#fef08a');
  box(bodyGroup, [0.4, 0.2, 0.1], [0.7, 0.65, -2.22], '#fef08a');

  // Taillights
  box(bodyGroup, [0.45, 0.2, 0.1], [-0.7, 0.65, 2.22], '#ef4444');
  box(bodyGroup, [0.45, 0.2, 0.1], [0.7, 0.65, 2.22], '#ef4444');

  // Windshield
  const windshield = box(
    bodyGroup,
    [1.65, 0.55, 0.1],
    [0, 1.2, -1.05],
    COLORS.carGlass,
  );
  windshield.rotation.x = 0.35;
  windshield.name = 'windshield';

  // Windshield Splat Mesh (Goo overlay)
  const splatMesh = box(
    bodyGroup,
    [1.4, 0.45, 0.05],
    [0, 1.2, -1.03],
    COLORS.milkshakePink,
  );
  splatMesh.rotation.x = 0.35;
  splatMesh.name = 'windshield-splat';
  splatMesh.visible = false;

  // Wipers
  const wiperL = box(
    bodyGroup,
    [0.65, 0.04, 0.04],
    [-0.35, 1.0, -1.15],
    '#000000',
  );
  const wiperR = box(
    bodyGroup,
    [0.65, 0.04, 0.04],
    [0.35, 1.0, -1.15],
    '#000000',
  );
  wiperL.name = 'wiper-l';
  wiperR.name = 'wiper-r';

  // Side windows (Right passenger window is OPEN for leaning!)
  box(bodyGroup, [0.05, 0.5, 1.0], [-0.91, 1.25, 0.2], COLORS.carGlass); // Driver side closed

  // 4 Wheels
  const wheelPositions = [
    [-1.0, 0.38, -1.35],
    [1.0, 0.38, -1.35],
    [-1.0, 0.38, 1.35],
    [1.0, 0.38, 1.35],
  ];

  for (let i = 0; i < wheelPositions.length; i++) {
    const [wx, wy, wz] = wheelPositions[i];
    const wheel = new T.Group();
    wheel.position.set(wx, wy, wz);
    box(wheel, [0.28, 0.72, 0.72], [0, 0, 0], COLORS.tireRubber, true);
    box(wheel, [0.3, 0.35, 0.35], [0, 0, 0], COLORS.hubcap);
    wheel.name = `wheel-${i}`;
    car.add(wheel);
  }

  car.add(bodyGroup);
  return car;
}

/**
 * Creates an interactive burger patty with visual sizzle/char states
 */
export function createPattyMesh(): T.Group {
  const g = new T.Group();
  box(g, [0.55, 0.12, 0.55], [0, 0.06, 0], COLORS.pattyRaw, true);
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
      box(body, [0.55, 0.22, 0.32], [0, 1.78, 0], CLOTH.white);
      box(body, [0.56, 0.05, 0.33], [0, 1.72, 0], TEAM.red); // Red accent stripe
    }
  }

  // Headset mic for drive-thru barista / order taker
  if (role === 'barista' && !worn.face) {
    const body = model.userData.body as T.Group;
    if (body) {
      box(body, [0.56, 0.04, 0.04], [0, 1.62, 0], CLOTH.ink);
      box(body, [0.05, 0.08, 0.28], [0.26, 1.45, 0.2], CLOTH.ink);
      ball(body, [0.05, 0.05, 0.05], [0.26, 1.45, 0.34], CLOTH.ink); // Foam mic
    }
  }

  return model;
}
