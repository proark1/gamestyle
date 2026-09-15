import * as T from 'three';
import { ball, beam, box, taper } from '../../shared/rendering/primitives';
import {
  HOUSE_RINGS,
  RINK_LENGTH,
  RINK_WIDTH,
  STONE_CONFIGS,
  TEE_Z,
  type GadgetId,
  type StoneKind,
  type TeamId,
} from './types';

/** Builds the 3D model for a curling stone projectile. */
export function createStoneMesh(kind: StoneKind, team: TeamId): T.Group {
  const g = new T.Group();
  const cfg = STONE_CONFIGS[kind];
  const teamColor = team === 'red' ? '#d94b38' : '#3277b3';

  if (kind === 'granite') {
    // Polished stone body
    box(
      g,
      [cfg.radius * 2, cfg.height * 0.7, cfg.radius * 2],
      [0, cfg.height * 0.35, 0],
      '#42484d',
      true,
    );
    // Polished metal perimeter band
    box(
      g,
      [cfg.radius * 2.05, cfg.height * 0.25, cfg.radius * 2.05],
      [0, cfg.height * 0.45, 0],
      '#cfd8dc',
    );
    // Stone top dish
    box(
      g,
      [cfg.radius * 1.5, 0.04, cfg.radius * 1.5],
      [0, cfg.height * 0.72, 0],
      '#525960',
      true,
    );
    // Team-colored handle mount
    box(g, [0.08, 0.12, 0.08], [0, cfg.height * 0.78, 0], '#2c3135');
    // Curved grip handle
    box(g, [0.06, 0.05, 0.32], [0, cfg.height + 0.05, 0.06], teamColor, true);
    box(g, [0.06, 0.12, 0.06], [0, cfg.height - 0.01, -0.08], teamColor);
    box(g, [0.06, 0.12, 0.06], [0, cfg.height - 0.01, 0.2], teamColor);
  } else if (kind === 'anvil') {
    // Chunky cast iron anvil base
    box(g, [0.45, 0.14, 0.65], [0, 0.07, 0], '#22252a');
    // Anvil waist
    box(g, [0.26, 0.18, 0.42], [0, 0.23, 0], '#2d3137');
    // Anvil flat face
    box(g, [0.38, 0.14, 0.72], [0, 0.39, -0.05], '#3b4047', true);
    // Anvil horn (pointed front)
    taper(g, 0.04, 0.14, 0.32, [0, 0.38, 0.45], '#424850', 6);
    // Frosty edges on top
    box(g, [0.4, 0.02, 0.74], [0, 0.47, -0.05], '#cbe5f2');
    // Team colored stripe
    box(g, [0.39, 0.06, 0.1], [0, 0.4, -0.1], teamColor);
  } else if (kind === 'basket') {
    // Plastic laundry basket
    box(g, [0.65, 0.38, 0.65], [0, 0.19, 0], teamColor, true);
    box(g, [0.55, 0.36, 0.55], [0, 0.21, 0], '#ffffff');
    box(g, [0.72, 0.05, 0.1], [0, 0.36, -0.34], '#ffffff');
    box(g, [0.72, 0.05, 0.1], [0, 0.36, 0.34], '#ffffff');

    // Teammate sitting inside: Head popping out
    box(g, [0.35, 0.35, 0.35], [0, 0.52, 0], '#e6b58b', true);
    // Bobble hat
    box(g, [0.42, 0.14, 0.42], [0, 0.68, 0], teamColor, true);
    ball(g, [0.12, 0.12, 0.12], [0, 0.8, 0], '#ffffff');
    // Teammate eyes (surprised wide eyes)
    box(g, [0.06, 0.08, 0.03], [-0.08, 0.54, 0.18], '#222222');
    box(g, [0.06, 0.08, 0.03], [0.08, 0.54, 0.18], '#222222');
    // Scared / screaming open mouth
    box(g, [0.1, 0.08, 0.03], [0, 0.44, 0.18], '#551a1a');
    // Arms gripping the edges of the basket
    box(g, [0.12, 0.22, 0.12], [-0.34, 0.36, 0.1], '#e6b58b', true);
    box(g, [0.12, 0.22, 0.12], [0.34, 0.36, 0.1], '#e6b58b', true);
  }

  return g;
}

/** Builds the full frozen curling rink environment with painted House rings and scenery. */
export function createCurlingRinkMesh(): T.Group {
  const g = new T.Group();

  // 1. Deep lake bed under ice
  box(g, [RINK_WIDTH + 8, 1.0, RINK_LENGTH + 12], [0, -0.6, 16], '#1b3b48');

  // 2. Primary translucent ice sheet
  const iceMat = new T.MeshStandardMaterial({
    color: '#d6ecf5',
    roughness: 0.12,
    metalness: 0.1,
    flatShading: false,
  });
  const iceGeo = new T.BoxGeometry(RINK_WIDTH, 0.2, RINK_LENGTH + 6);
  const iceMesh = new T.Mesh(iceGeo, iceMat);
  iceMesh.position.set(0, -0.1, 16);
  iceMesh.receiveShadow = true;
  g.add(iceMesh);

  // 3. Painted curling House rings at the tee line (z = 31)
  const rings = [
    {
      r: HOUSE_RINGS.twelveFoot.radius,
      color: HOUSE_RINGS.twelveFoot.color,
      y: -0.09,
    },
    {
      r: HOUSE_RINGS.eightFoot.radius,
      color: HOUSE_RINGS.eightFoot.color,
      y: -0.085,
    },
    {
      r: HOUSE_RINGS.fourFoot.radius,
      color: HOUSE_RINGS.fourFoot.color,
      y: -0.08,
    },
    {
      r: HOUSE_RINGS.button.radius,
      color: HOUSE_RINGS.button.color,
      y: -0.075,
    },
  ];

  for (const ring of rings) {
    const ringGeo = new T.CylinderGeometry(ring.r, ring.r, 0.02, 48);
    const ringMat = new T.MeshBasicMaterial({ color: ring.color });
    const m = new T.Mesh(ringGeo, ringMat);
    m.position.set(0, ring.y, TEE_Z);
    g.add(m);
  }

  // 4. Painted lines on the ice
  // Center line (lengthwise down the sheet)
  box(g, [0.05, 0.02, RINK_LENGTH + 4], [0, -0.07, 16], '#1b3a4b');
  // Hack line (z = -2)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.06], [0, -0.07, -2.0], '#1b3a4b');
  // Near Hog line (z = 6)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.12], [0, -0.07, 6.0], '#d94b38');
  // Far Hog line (z = 22)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.12], [0, -0.07, 22.0], '#d94b38');
  // Tee line (crosswise through center of house, z = 31)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.06], [0, -0.07, TEE_Z], '#1b3a4b');
  // Back line (z = 35.5)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.06], [0, -0.07, 35.5], '#3277b3');

  // Hack footrests at the starting end
  for (const x of [-0.4, 0.4]) {
    box(g, [0.22, 0.08, 0.38], [x, 0.04, -2.8], '#c2362b', true);
  }

  // 5. Perimeter snowbanks and frozen wooden kickboards
  const halfW = RINK_WIDTH / 2;
  // Side boards
  box(g, [0.18, 0.35, RINK_LENGTH + 6], [-halfW - 0.09, 0.15, 16], '#534537');
  box(g, [0.18, 0.35, RINK_LENGTH + 6], [halfW + 0.09, 0.15, 16], '#534537');
  // Snowdrifts along sides
  box(
    g,
    [2.2, 0.45, RINK_LENGTH + 8],
    [-halfW - 1.2, 0.18, 16],
    '#eaf3f7',
    true,
  );
  box(
    g,
    [2.2, 0.45, RINK_LENGTH + 8],
    [halfW + 1.2, 0.18, 16],
    '#eaf3f7',
    true,
  );
  // Back snowbank
  box(g, [RINK_WIDTH + 4, 0.6, 3.0], [0, 0.25, 38.5], '#eaf3f7', true);

  // 6. Charming low-poly snowy pine trees along the perimeter
  const treeSpots = [
    [-halfW - 2.8, -1.0],
    [-halfW - 3.2, 10.0],
    [-halfW - 2.6, 21.0],
    [-halfW - 3.0, 32.0],
    [halfW + 2.8, 2.0],
    [halfW + 3.1, 14.0],
    [halfW + 2.7, 26.0],
    [halfW + 3.3, 35.0],
  ];

  for (const [tx, tz] of treeSpots) {
    createPineTree(g, tx, tz);
  }

  return g;
}

function createPineTree(g: T.Group, x: number, z: number) {
  // Trunk
  box(g, [0.35, 1.2, 0.35], [x, 0.6, z], '#4a3322');
  // Green needle layers with snowy tips
  taper(g, 0.1, 1.5, 1.4, [x, 1.8, z], '#285437', 7);
  box(g, [1.3, 0.12, 1.3], [x, 1.8, z], '#edf6fa', true);

  taper(g, 0.05, 1.1, 1.3, [x, 2.7, z], '#22472e', 7);
  box(g, [0.95, 0.1, 0.95], [x, 2.7, z], '#edf6fa', true);

  taper(g, 0.0, 0.7, 1.2, [x, 3.5, z], '#1c3d26', 7);
  ball(g, [0.25, 0.25, 0.25], [x, 4.15, z], '#edf6fa');
}

/** Builds the mesh for sweeper gadgets (broom, hairdryer, blowtorch). */
export function createGadgetMesh(gadget: GadgetId): T.Group {
  const g = new T.Group();

  if (gadget === 'broom') {
    // Aluminum handle
    beam(g, [0, 0, 0], [0, 1.3, 0], 0.045, '#cfd8dc');
    // Swivel head bracket
    box(g, [0.08, 0.08, 0.08], [0, 0.04, 0], '#222222');
    // Broom sweeping pad
    box(g, [0.55, 0.07, 0.16], [0, 0.02, 0], '#e74c3c', true);
  } else if (gadget === 'hairdryer') {
    // Handle
    box(g, [0.06, 0.25, 0.06], [0, 0.12, 0], '#2c3e50');
    // Body barrel
    box(g, [0.12, 0.14, 0.35], [0, 0.24, 0.08], '#16a085', true);
    // Nozzle
    box(g, [0.09, 0.11, 0.1], [0, 0.24, 0.28], '#34495e');
    // Red heat coil glow inside
    box(g, [0.05, 0.05, 0.02], [0, 0.24, 0.33], '#ff4422');
  } else if (gadget === 'blowtorch') {
    // Propane tank
    box(g, [0.18, 0.36, 0.18], [0, 0.18, 0], '#3498db', true);
    // Neck & valve
    box(g, [0.07, 0.15, 0.07], [0, 0.42, 0], '#f39c12');
    // Burner tube
    box(g, [0.06, 0.06, 0.28], [0, 0.48, 0.14], '#7f8c8d');
    // Flame tip
    taper(g, 0.0, 0.05, 0.18, [0, 0.48, 0.36], '#ffeb3b', 5);
  }

  return g;
}

/** Builds a cartoon banana peel hazard model. */
export function createBananaMesh(): T.Group {
  const g = new T.Group();
  // Center nub
  box(g, [0.08, 0.06, 0.08], [0, 0.03, 0], '#4a3818');
  // 3 peeled strips spreading out on ice
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const strip = box(g, [0.07, 0.02, 0.28], [0, 0.01, 0.14], '#f1c40f', true);
    strip.rotation.y = angle;
  }
  return g;
}
