import * as T from 'three';
import { ball, beam, box, taper } from '../../shared/rendering/primitives';
import {
  HOUSE_RINGS,
  RINK_LENGTH,
  RINK_WIDTH,
  STONE_CONFIGS,
  TEAM_COLORS,
  TEE_Z,
  type GadgetId,
  type StoneKind,
  type TeamId,
} from './types';

/** Builds the 3D model for a curling stone projectile. */
export function createStoneMesh(kind: StoneKind, team: TeamId): T.Group {
  const g = new T.Group();
  const cfg = STONE_CONFIGS[kind];
  const teamColor = TEAM_COLORS[team];

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
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.12], [0, -0.07, 6.0], TEAM_COLORS.red);
  // Far Hog line (z = 22)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.12], [0, -0.07, 22.0], TEAM_COLORS.red);
  // Tee line (crosswise through center of house, z = 31)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.06], [0, -0.07, TEE_Z], '#1b3a4b');
  // Back line (z = 35.5)
  box(g, [RINK_WIDTH - 0.4, 0.02, 0.06], [0, -0.07, 35.5], TEAM_COLORS.blue);

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
    [-halfW - 3.4, -2.0],
    [-halfW - 3.8, 8.0],
    [-halfW - 3.2, 19.0],
    [-halfW - 3.6, 30.0],
    [halfW + 3.4, 0.0],
    [halfW + 3.6, 12.0],
    [halfW + 3.3, 24.0],
    [halfW + 3.8, 33.0],
    [-halfW - 5.2, 4.0],
    [-halfW - 5.0, 16.0],
    [halfW + 5.2, 6.0],
    [halfW + 5.0, 20.0],
  ];

  for (const [tx, tz] of treeSpots) {
    createPineTree(g, tx, tz);
  }

  // 7. Alpine Clubhouse behind the starting hack
  createClubhouse(g);

  // 8. Spectator Grandstands with cheering fans and snowmen
  createSpectatorBleachers(g, halfW);

  // 9. Overhead rustic timber arches with glowing festoon fairy lights
  createFestoonArches(g, halfW);

  // 10. Alpine Mountain Range Silhouette
  createMountainBackdrop(g);

  // 11. Humorous Dasher Board Placards along the sides
  createDasherBoardPlacards(g, halfW);

  return g;
}

/** Cozy timber curling clubhouse behind the delivery hacks. */
function createClubhouse(g: T.Group) {
  const cz = -9.0;
  // Main timber walls
  box(g, [8.4, 3.2, 5.0], [0, 1.6, cz], '#422818', true);
  // Log corner pillars
  for (const cx of [-4.1, 4.1]) {
    for (const zOff of [-2.4, 2.4]) {
      box(g, [0.4, 3.4, 0.4], [cx, 1.7, cz + zOff], '#2c180a', true);
    }
  }

  // Front porch overhang & pillars
  box(g, [5.8, 0.25, 1.8], [0, 2.8, cz + 2.9], '#2c180a');
  box(g, [6.0, 0.2, 1.9], [0, 3.0, cz + 2.9], '#f0f8ff', true); // Snow on porch
  for (const px of [-2.6, 2.6]) {
    box(g, [0.25, 2.8, 0.25], [px, 1.4, cz + 3.6], '#533722');
  }

  // Cozy glowing warm windows
  for (const wx of [-2.4, -0.9, 0.9, 2.4]) {
    // Window frame
    box(g, [0.95, 1.1, 0.08], [wx, 1.8, cz + 2.54], '#2c180a');
    // Glowing warm glass
    box(g, [0.8, 0.95, 0.04], [wx, 1.8, cz + 2.56], '#ffeb99');
    // Muntin cross bars
    box(g, [0.8, 0.06, 0.06], [wx, 1.8, cz + 2.57], '#2c180a');
    box(g, [0.06, 0.95, 0.06], [wx, 1.8, cz + 2.57], '#2c180a');
  }

  // Double doors
  box(g, [1.4, 2.2, 0.08], [0, 1.1, cz + 2.53], '#5c3820');
  box(g, [0.08, 0.2, 0.12], [-0.15, 1.1, cz + 2.58], '#f1c40f');
  box(g, [0.08, 0.2, 0.12], [0.15, 1.1, cz + 2.58], '#f1c40f');

  // Gabled timber roof
  box(g, [9.0, 0.35, 5.8], [0, 3.5, cz], '#331f13');
  // Thick fluffy snow on roof
  box(g, [9.4, 0.45, 6.2], [0, 3.85, cz], '#f0f8ff', true);

  // Stone chimney
  box(g, [0.85, 2.8, 0.85], [3.0, 4.2, cz - 0.8], '#546e7a', true);
  box(g, [1.05, 0.2, 1.05], [3.0, 5.6, cz - 0.8], '#37474f');
  // Smoke puffs
  ball(g, [0.28, 0.28, 0.28], [3.0, 6.0, cz - 0.8], '#e2edf2');
  ball(g, [0.38, 0.38, 0.38], [3.1, 6.5, cz - 0.7], '#edf4f8');
  ball(g, [0.48, 0.48, 0.48], [3.25, 7.1, cz - 0.6], '#f4f9fc');

  // Carved wooden club sign
  box(g, [4.8, 0.6, 0.1], [0, 3.3, cz + 3.82], '#2c180a', true);
  box(g, [4.5, 0.4, 0.08], [0, 3.3, cz + 3.84], TEAM_COLORS.red); // Red banner strip
}

/** Stepped wooden spectator bleachers populated by toy workers and cute snowmen. */
function createSpectatorBleachers(g: T.Group, halfW: number) {
  for (const side of [-1, 1]) {
    const bx = side * (halfW + 2.2);
    const zStart = 2.0;
    const zEnd = 30.0;
    const len = zEnd - zStart;

    // Tier 1 bench
    box(g, [0.8, 0.4, len], [bx, 0.2, 16.0], '#5d4037', true);
    // Tier 2 bench (higher and farther back)
    box(g, [0.8, 0.75, len], [bx + side * 0.75, 0.38, 16.0], '#4e342e', true);

    // Populate with spectators along the benches
    for (let z = 4.0; z <= 28.0; z += 3.2) {
      const isSnowman = Math.abs(z % 6.4) < 1.0;
      if (isSnowman) {
        // Snowman fan on Tier 1
        createSnowmanSpectator(
          g,
          bx,
          0.4,
          z,
          side === -1 ? TEAM_COLORS.red : TEAM_COLORS.blue,
        );
      } else {
        // Toy worker fan on Tier 2
        createFanSpectator(
          g,
          bx + side * 0.75,
          0.75,
          z,
          z % 2 === 0 ? TEAM_COLORS.red : TEAM_COLORS.blue,
          z % 3 === 0 ? '#f39c12' : '#2ecc71',
        );
      }
    }
  }
}

/** Cute low-poly snowman spectator sitting on bleachers. */
function createSnowmanSpectator(
  g: T.Group,
  x: number,
  y: number,
  z: number,
  scarfColor: string,
) {
  // Lower body
  ball(g, [0.32, 0.32, 0.32], [x, y + 0.28, z], '#ffffff');
  // Head
  ball(g, [0.24, 0.24, 0.24], [x, y + 0.65, z], '#ffffff');
  // Warm scarf
  box(g, [0.38, 0.08, 0.38], [x, y + 0.5, z], scarfColor, true);
  // Trailing scarf tail
  box(g, [0.1, 0.25, 0.06], [x + 0.12, y + 0.36, z - 0.16], scarfColor);
  // Carrot nose
  taper(g, 0.01, 0.04, 0.16, [x, y + 0.65, z - 0.28], '#e67e22', 5);
  // Coal eyes
  ball(g, [0.03, 0.03, 0.03], [x - 0.07, y + 0.7, z - 0.22], '#111111');
  ball(g, [0.03, 0.03, 0.03], [x + 0.07, y + 0.7, z - 0.22], '#111111');
  // Bobble winter hat
  box(g, [0.28, 0.14, 0.28], [x, y + 0.82, z], scarfColor, true);
  ball(g, [0.08, 0.08, 0.08], [x, y + 0.94, z], '#ffffff');
}

/** Toy worker spectator with winter coat and pom-pom beanie. */
function createFanSpectator(
  g: T.Group,
  x: number,
  y: number,
  z: number,
  coatColor: string,
  hatColor: string,
) {
  // Torso / Parka
  box(g, [0.38, 0.44, 0.34], [x, y + 0.32, z], coatColor, true);
  // Fur collar
  box(g, [0.36, 0.08, 0.32], [x, y + 0.52, z], '#edf6fa', true);
  // Head
  box(g, [0.28, 0.28, 0.28], [x, y + 0.7, z], '#f5cba7', true);
  // Eyes
  box(g, [0.04, 0.06, 0.02], [x - 0.07, y + 0.72, z - 0.15], '#222222');
  box(g, [0.04, 0.06, 0.02], [x + 0.07, y + 0.72, z - 0.15], '#222222');
  // Winter beanie
  box(g, [0.32, 0.12, 0.32], [x, y + 0.86, z], hatColor, true);
  ball(g, [0.09, 0.09, 0.09], [x, y + 0.97, z], '#ffffff');
}

/** Overhead rustic timber arches with festoon Edison fairy string lights. */
function createFestoonArches(g: T.Group, halfW: number) {
  const archZList = [-1.0, 11.0, 23.0, 34.0];
  const postX = halfW + 1.2;

  for (const az of archZList) {
    // Left & right rustic timber posts
    box(g, [0.25, 4.2, 0.25], [-postX, 2.1, az], '#4a3322');
    box(g, [0.25, 4.2, 0.25], [postX, 2.1, az], '#4a3322');
    // Top cross-beam
    box(g, [postX * 2 + 0.5, 0.25, 0.25], [0, 4.15, az], '#4a3322');
    // Snow on beam
    box(g, [postX * 2 + 0.6, 0.12, 0.3], [0, 4.3, az], '#f0f8ff', true);

    // Draped festoon Edison bulbs across the beam
    const bulbCount = 6;
    for (let b = 0; b < bulbCount; b++) {
      const bx = -postX + 0.6 + (b * (postX * 2 - 1.2)) / (bulbCount - 1);
      const sag = Math.sin((b / (bulbCount - 1)) * Math.PI) * 0.35;
      const by = 4.0 - sag;
      // Cord dropper
      beam(g, [bx, 4.15, az], [bx, by + 0.1, az], 0.02, '#222222');
      // Glowing warm bulb
      ball(g, [0.12, 0.15, 0.12], [bx, by, az], '#ffe082');
    }
  }
}

/** Majestic alpine mountain silhouette in the background. */
function createMountainBackdrop(g: T.Group) {
  const peaks = [
    { x: -28, z: 62, r: 18, h: 26, color: '#688295' },
    { x: -12, z: 58, r: 15, h: 22, color: '#597488' },
    { x: 8, z: 65, r: 20, h: 30, color: '#4a6579' },
    { x: 26, z: 60, r: 16, h: 24, color: '#5e798d' },
    { x: -35, z: 52, r: 12, h: 18, color: '#738e9f' },
    { x: 38, z: 54, r: 14, h: 19, color: '#738e9f' },
  ];

  for (const p of peaks) {
    // Rocky mountain base
    taper(g, 0.1, p.r, p.h, [p.x, p.h / 2 - 2.0, p.z], p.color, 7);
    // Pure snow cap on peak
    taper(
      g,
      0.0,
      p.r * 0.42,
      p.h * 0.42,
      [p.x, p.h - p.h * 0.21 - 2.0, p.z],
      '#f0f8ff',
      7,
    );
  }
}

/** Humorous illustrated wooden sponsor placards along perimeter boards. */
function createDasherBoardPlacards(g: T.Group, halfW: number) {
  const ads = [
    { z: 4.0, textBg: '#c0392b', rim: '#ffffff' }, // ACME Brooms
    { z: 12.0, textBg: '#2980b9', rim: '#ffffff' }, // Craggy Granite
    { z: 20.0, textBg: '#e67e22', rim: '#ffffff' }, // Hot-Shot Torches
    { z: 28.0, textBg: '#27ae60', rim: '#ffffff' }, // Slippery Peels
  ];

  for (const ad of ads) {
    for (const side of [-1, 1]) {
      const px = side * (halfW + 0.11);
      // Board placard plate
      box(g, [0.04, 0.26, 2.2], [px, 0.18, ad.z], ad.textBg);
      // Top & bottom border trim
      box(g, [0.06, 0.04, 2.24], [px, 0.31, ad.z], ad.rim);
      box(g, [0.06, 0.04, 2.24], [px, 0.05, ad.z], ad.rim);
    }
  }
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
