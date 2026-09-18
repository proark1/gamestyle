import * as T from 'three';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { worker, WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { CLOTH } from '../../shared/rendering/palette';
import { COURT, HOOP, BALL_RADIUS, TEAM_COLORS, type TeamId } from './types';

/**
 * A team colour's deep shade, 14 points darker in sRGB lightness: the same
 * shade as the HUD's `--team-red-deep` and `--team-blue-deep`.
 */
function deepShade(hex: string): string {
  const hsl = new T.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, T.SRGBColorSpace);
  const deep = new T.Color().setHSL(
    hsl.h,
    hsl.s,
    hsl.l - 0.14,
    T.SRGBColorSpace,
  );
  return `#${deep.getHexString()}`;
}

/**
 * Creates a basketball player using the shared worker avatar.
 * Dressed in a matching team kit (jersey and shorts) and cream sneakers.
 */
export function basketballPlayer(team: TeamId, look?: Look) {
  const kit = TEAM_COLORS[team];
  const { model: g, worn } = dressedWorker(
    0,
    {
      shirt: kit,
      overalls: kit,
      boots: CLOTH.cream,
      cap: false,
    },
    look,
  );

  const body = g.userData.body as T.Group;

  // Add headband if player is not wearing a wardrobe hat
  if (!worn.hat) {
    // Hair
    box(
      body,
      [0.55, 0.12, 0.53],
      [0, WORKER_HEAD_TOP + 0.04, 0],
      '#4a3728',
      true,
    );
    // Cream sweatband
    box(body, [0.56, 0.08, 0.54], [0, WORKER_HEAD_TOP - 0.04, 0], CLOTH.cream);
  }

  // Jersey front trim & number badge in the team colour
  box(body, [0.28, 0.22, 0.02], [0, 0.88, 0.23], CLOTH.white);
  box(body, [0.16, 0.14, 0.025], [0, 0.88, 0.23], kit);

  return g;
}

/**
 * Creates a basketball with seams.
 */
export function basketballBall(): T.Group {
  const g = new T.Group();
  const sphereGeo = new T.SphereGeometry(BALL_RADIUS, 18, 14);
  const ballMat = material('#e5732f');
  const sphere = new T.Mesh(sphereGeo, ballMat);
  sphere.castShadow = true;
  g.add(sphere);

  // Black rib seams
  const ringMat = material('#261911');
  const seam1 = new T.Mesh(
    new T.TorusGeometry(BALL_RADIUS + 0.002, 0.012, 8, 24),
    ringMat,
  );
  const seam2 = new T.Mesh(
    new T.TorusGeometry(BALL_RADIUS + 0.002, 0.012, 8, 24),
    ringMat,
  );
  seam2.rotation.x = Math.PI / 2;
  const seam3 = new T.Mesh(
    new T.TorusGeometry(BALL_RADIUS + 0.002, 0.012, 8, 24),
    ringMat,
  );
  seam3.rotation.y = Math.PI / 2;

  g.add(seam1, seam2, seam3);
  return g;
}

/**
 * Ground drop shadow mesh placed underneath the basketball.
 */
export function ballDropShadow(): T.Mesh {
  const shadowGeo = new T.RingGeometry(0, BALL_RADIUS * 1.35, 24);
  const shadowMat = new T.MeshBasicMaterial({
    color: '#152520',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadow = new T.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.024;
  return shadow;
}

/**
 * Ground contact shadow placed underneath each player.
 */
export function playerContactShadow(): T.Mesh {
  const shadowGeo = new T.RingGeometry(0, 0.55, 20);
  const shadowMat = new T.MeshBasicMaterial({
    color: '#152520',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadow = new T.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.022;
  return shadow;
}

/**
 * Creates the basketball hoop, post, padding, backboard, rim, and net.
 */
export function basketballHoop(): T.Group {
  const g = new T.Group();

  // 1. Base Post & Padding
  // Heavy ground foundation
  box(g, [1.5, 0.3, 1.5], [HOOP.x, 0.15, HOOP.backboardZ - 1.2], '#2c3935');
  // Sturdy vertical post
  box(g, [0.32, 3.8, 0.32], [HOOP.x, 1.9, HOOP.backboardZ - 1.2], '#3d4f49');
  // Protective safety padding around bottom of post
  box(g, [0.58, 1.8, 0.58], [HOOP.x, 0.9, HOOP.backboardZ - 1.2], '#355d60');

  // Angled boom arm extending forward towards backboard
  beam(
    g,
    [HOOP.x, 3.6, HOOP.backboardZ - 1.2],
    [HOOP.x, HOOP.backboardY, HOOP.backboardZ - 0.1],
    0.2,
    '#3d4f49',
  );
  // Lower support strut
  beam(
    g,
    [HOOP.x, 2.7, HOOP.backboardZ - 1.2],
    [HOOP.x, HOOP.backboardY - 0.4, HOOP.backboardZ - 0.1],
    0.14,
    '#3d4f49',
  );

  // 2. Backboard
  // Acrylic translucent board plate
  const boardMat = new T.MeshStandardMaterial({
    color: '#e4f2f0',
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const boardGeo = new T.BoxGeometry(
    HOOP.backboardWidth,
    HOOP.backboardHeight,
    0.05,
  );
  const board = new T.Mesh(boardGeo, boardMat);
  board.position.set(HOOP.x, HOOP.backboardY, HOOP.backboardZ);
  board.castShadow = true;
  board.receiveShadow = true;
  g.add(board);

  // White outer frame
  box(
    g,
    [HOOP.backboardWidth + 0.06, 0.05, 0.07],
    [HOOP.x, HOOP.backboardY + HOOP.backboardHeight / 2, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [HOOP.backboardWidth + 0.06, 0.05, 0.07],
    [HOOP.x, HOOP.backboardY - HOOP.backboardHeight / 2, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [0.05, HOOP.backboardHeight, 0.07],
    [HOOP.x - HOOP.backboardWidth / 2, HOOP.backboardY, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [0.05, HOOP.backboardHeight, 0.07],
    [HOOP.x + HOOP.backboardWidth / 2, HOOP.backboardY, HOOP.backboardZ],
    '#ffffff',
  );

  // Inner red target rectangle
  const innerW = 0.59;
  const innerH = 0.45;
  const innerY = HOOP.y + innerH / 2 + 0.05;
  box(
    g,
    [innerW, 0.04, 0.065],
    [HOOP.x, innerY + innerH / 2, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [innerW, 0.04, 0.065],
    [HOOP.x, innerY - innerH / 2, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [0.04, innerH, 0.065],
    [HOOP.x - innerW / 2, innerY, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [0.04, innerH, 0.065],
    [HOOP.x + innerW / 2, innerY, HOOP.backboardZ],
    '#d94c38',
  );

  // 3. Rim Mounting Bracket & Breakaway Spring Assembly
  box(
    g,
    [0.22, 0.14, 0.28],
    [HOOP.x, HOOP.y, HOOP.backboardZ + 0.16],
    '#d94c38',
  );

  // Breakaway Spring Rim Assembly (hinged at bracket front)
  const hingeZ = HOOP.backboardZ + 0.3;
  const rimAssembly = new T.Group();
  rimAssembly.position.set(HOOP.x, HOOP.y, hingeZ);

  // Rim Torus
  const rimOffsetZ = HOOP.z - hingeZ;
  const rimMesh = new T.Mesh(
    new T.TorusGeometry(HOOP.rimRadius, 0.034, 12, 32),
    material('#e5732f'),
  );
  rimMesh.position.set(0, 0, rimOffsetZ);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.castShadow = true;
  rimAssembly.add(rimMesh);

  // Net (Attached under the rim with dynamic swish capability)
  const netGeo = new T.CylinderGeometry(
    HOOP.rimRadius * 0.96,
    HOOP.rimRadius * 0.54,
    0.68,
    16,
    5,
    true,
  );
  const netMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    wireframe: true,
    roughness: 0.6,
  });
  const netMesh = new T.Mesh(netGeo, netMat);
  netMesh.position.set(0, -0.34, rimOffsetZ);
  rimAssembly.add(netMesh);

  g.add(rimAssembly);
  g.userData.rimAssembly = rimAssembly;
  g.userData.netMesh = netMesh;

  return g;
}

/**
 * Creates a stylized low-poly tree in the Jumbleyard/Stack or Sink aesthetic.
 */
function lowPolyTree(x: number, z: number, scale = 1.0): T.Group {
  const tree = new T.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  // Trunk
  box(tree, [0.4, 1.4, 0.4], [0, 0.7, 0], '#5c412b');

  // Tiered conical/cylindrical foliage crowns
  const crownMat1 = material('#3d6653');
  const crownMat2 = material('#4d826a');
  const crownMat3 = material('#5fa385');

  const cone1 = new T.Mesh(new T.ConeGeometry(1.5, 1.6, 7), crownMat1);
  cone1.position.y = 1.8;
  cone1.castShadow = true;
  cone1.receiveShadow = true;
  tree.add(cone1);

  const cone2 = new T.Mesh(new T.ConeGeometry(1.2, 1.4, 7), crownMat2);
  cone2.position.y = 2.6;
  cone2.castShadow = true;
  cone2.receiveShadow = true;
  tree.add(cone2);

  const cone3 = new T.Mesh(new T.ConeGeometry(0.8, 1.2, 7), crownMat3);
  cone3.position.y = 3.3;
  cone3.castShadow = true;
  cone3.receiveShadow = true;
  tree.add(cone3);

  return tree;
}

/**
 * Creates spectator bleachers with animated worker avatars.
 */
function spectatorBleachers(): { bleachers: T.Group; spectators: T.Group[] } {
  const bleachers = new T.Group();
  const spectators: T.Group[] = [];

  const bleacherX = COURT.maxX + 2.0;
  const centerZ = -3.5;

  // Frame and benches
  // Tier 1 (Front bench)
  box(bleachers, [1.0, 0.45, 7.5], [bleacherX, 0.225, centerZ], '#d3b07b');
  // Tier 2 (Back bench, higher)
  box(bleachers, [1.0, 0.9, 7.5], [bleacherX + 1.0, 0.45, centerZ], '#86643f');
  box(
    bleachers,
    [1.0, 0.45, 7.5],
    [bleacherX + 1.0, 1.125, centerZ],
    '#d3b07b',
  );

  // Spectator worker characters seated or cheering
  const spectatorConfigs = [
    { z: centerZ - 2.4, tier: 1, color: 1, shirt: '#4b7bec', cap: true },
    { z: centerZ - 0.8, tier: 1, color: 3, shirt: '#eb4d4b', cap: false },
    { z: centerZ + 1.0, tier: 1, color: 0, shirt: '#f0932b', cap: true },
    { z: centerZ + 2.4, tier: 1, color: 2, shirt: '#6ab04c', cap: false },
    { z: centerZ - 1.6, tier: 2, color: 2, shirt: '#22a6b3', cap: true },
    { z: centerZ + 0.2, tier: 2, color: 1, shirt: '#be2edd', cap: false },
    { z: centerZ + 1.8, tier: 2, color: 0, shirt: '#f9ca24', cap: true },
  ];

  for (let i = 0; i < spectatorConfigs.length; i++) {
    const cfg = spectatorConfigs[i];
    const spec = worker(cfg.color, {
      shirt: cfg.shirt,
      cap: cfg.cap,
      overalls: '#303952',
      boots: '#f5f6fa',
    });

    const posX = cfg.tier === 1 ? bleacherX : bleacherX + 1.0;
    const posY = cfg.tier === 1 ? 0.45 : 1.35;
    spec.position.set(posX, posY, cfg.z);
    spec.rotation.y = -Math.PI / 2 + (Math.random() - 0.5) * 0.3; // facing the court
    spec.scale.setScalar(0.75);

    // Initial seated pose: bend hips & knees
    const rig = spec.userData as Record<string, T.Group>;
    if (rig?.legL && rig?.legR) {
      rig.legL.rotation.x = -1.2;
      rig.legR.rotation.x = -1.2;
    }

    bleachers.add(spec);
    spectators.push(spec);
  }

  return { bleachers, spectators };
}

/**
 * Creates the streetball court, surrounding perimeter, fence, team benches and lighting.
 */
export function basketballCourt(): T.Group {
  const g = new T.Group();

  // 1. Expansive Park Ground (eliminates floating slab void)
  const parkLawn = new T.Mesh(
    new T.PlaneGeometry(80, 70),
    new T.MeshStandardMaterial({
      color: '#8faea1',
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  parkLawn.rotation.x = -Math.PI / 2;
  parkLawn.position.set(0, -0.01, -3.5);
  parkLawn.receiveShadow = true;
  g.add(parkLawn);

  // 2. Concrete Walkway / Perimeter Curb around the court
  box(
    g,
    [COURT.width + 3.2, 0.28, COURT.length + 5.2],
    [0, 0.0, -3.5],
    '#4c665d',
    true,
  );
  // Raised outer curb edge
  box(
    g,
    [COURT.width + 3.5, 0.1, 0.2],
    [0, 0.15, COURT.baselineZ - 2.5],
    '#394f48',
  );
  box(
    g,
    [COURT.width + 3.5, 0.1, 0.2],
    [0, 0.15, COURT.halfCourtZ + 2.5],
    '#394f48',
  );
  box(
    g,
    [0.2, 0.1, COURT.length + 5.2],
    [COURT.minX - 1.7, 0.15, -3.5],
    '#394f48',
  );
  box(
    g,
    [0.2, 0.1, COURT.length + 5.2],
    [COURT.maxX + 1.7, 0.15, -3.5],
    '#394f48',
  );

  // 3. Premium Dual-Tone Streetball Court Surface
  // Main court base (Emerald / Deep Teal)
  box(g, [COURT.width, 0.02, COURT.length], [0, 0.01, -3.5], '#355a50');

  // The Key (Paint area): from baseline z = -11.5 to free throw line z = -5.7
  const keyWidth = 4.2;
  const keyLength = 5.8;
  const keyCenterZ = -11.5 + keyLength / 2;
  box(g, [keyWidth, 0.025, keyLength], [0, 0.015, keyCenterZ], '#b86a3e');

  // Center Court Jump Circle Area
  const centerCircle = new T.Mesh(
    new T.RingGeometry(1.68, 1.8, 48),
    material('#f4ede2'),
  );
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.set(0, 0.026, COURT.halfCourtZ);
  g.add(centerCircle);

  // Center court inner logo (Stylized basketball emblem)
  const centerDisc = new T.Mesh(
    new T.CircleGeometry(1.66, 32),
    material('#3f685d'),
  );
  centerDisc.rotation.x = -Math.PI / 2;
  centerDisc.position.set(0, 0.024, COURT.halfCourtZ);
  g.add(centerDisc);

  const starDecal = new T.Mesh(
    new T.RingGeometry(0.3, 0.7, 5),
    material(CLOTH.hivis),
  );
  starDecal.rotation.x = -Math.PI / 2;
  starDecal.position.set(0, 0.026, COURT.halfCourtZ);
  g.add(starDecal);

  // Free Throw Circle (Smooth continuous ring)
  const ftCircle = new T.Mesh(
    new T.RingGeometry(1.68, 1.8, 48),
    material('#f4ede2'),
  );
  ftCircle.rotation.x = -Math.PI / 2;
  ftCircle.position.set(0, 0.028, -5.7);
  g.add(ftCircle);

  // Restricted Area Semi-Circle under the basket (radius 1.25m)
  const restrictedArea = new T.Mesh(
    new T.RingGeometry(1.2, 1.28, 36, 1, 0, Math.PI),
    material('#f4ede2'),
  );
  restrictedArea.rotation.x = -Math.PI / 2;
  restrictedArea.position.set(HOOP.x, 0.028, HOOP.z);
  g.add(restrictedArea);

  // 4. Smooth Continuous 3-Point Arc
  // Arc centered at (HOOP.x, 0, HOOP.z) = (0, 0, -9.8), radius 6.75m
  const threePtArc = new T.Mesh(
    new T.RingGeometry(
      COURT.threePointRadius - 0.05,
      COURT.threePointRadius + 0.05,
      64,
      1,
      0,
      Math.PI,
    ),
    material('#f4ede2'),
  );
  threePtArc.rotation.x = -Math.PI / 2;
  threePtArc.position.set(HOOP.x, 0.028, HOOP.z);
  g.add(threePtArc);

  // Straight corner 3-point lines connecting the arc ends to the baseline
  const cornerX = COURT.threePointRadius;
  box(
    g,
    [0.1, 0.028, Math.abs(COURT.baselineZ - HOOP.z)],
    [cornerX, 0.028, (COURT.baselineZ + HOOP.z) / 2],
    '#f4ede2',
  );
  box(
    g,
    [0.1, 0.028, Math.abs(COURT.baselineZ - HOOP.z)],
    [-cornerX, 0.028, (COURT.baselineZ + HOOP.z) / 2],
    '#f4ede2',
  );

  // Court Markings (White lines)
  // Baseline
  box(g, [COURT.width, 0.028, 0.1], [0, 0.02, COURT.baselineZ], '#f4ede2');
  // Half-court line
  box(g, [COURT.width, 0.028, 0.1], [0, 0.02, COURT.halfCourtZ], '#f4ede2');
  // Sidelines
  box(g, [0.1, 0.028, COURT.length], [COURT.minX, 0.02, -3.5], '#f4ede2');
  box(g, [0.1, 0.028, COURT.length], [COURT.maxX, 0.02, -3.5], '#f4ede2');

  // Key border lines
  box(g, [keyWidth, 0.028, 0.08], [0, 0.025, -5.7], '#f4ede2'); // Free throw line
  box(
    g,
    [0.08, 0.028, keyLength],
    [-keyWidth / 2, 0.025, keyCenterZ],
    '#f4ede2',
  );
  box(
    g,
    [0.08, 0.028, keyLength],
    [keyWidth / 2, 0.025, keyCenterZ],
    '#f4ede2',
  );

  // Key lane hash marks / rebound blocks along both sides of paint
  for (const z of [-9.8, -8.4, -7.0]) {
    box(g, [0.25, 0.028, 0.08], [-keyWidth / 2 - 0.125, 0.026, z], '#f4ede2');
    box(g, [0.25, 0.028, 0.08], [keyWidth / 2 + 0.125, 0.026, z], '#f4ede2');
  }

  // 5. Basketball Hoop
  const hoop = basketballHoop();
  g.add(hoop);
  g.userData.rimAssembly = hoop.userData.rimAssembly;
  g.userData.netMesh = hoop.userData.netMesh;

  // 6. Chain-Link Cage & Posts
  // Top rails and posts
  box(
    g,
    [COURT.width + 4, 0.1, 0.1],
    [0, 2.8, COURT.baselineZ - 2.2],
    '#344942',
  );
  box(
    g,
    [COURT.width + 4, 0.1, 0.1],
    [0, 0.1, COURT.baselineZ - 2.2],
    '#344942',
  );
  for (let x = -COURT.width / 2 - 1.8; x <= COURT.width / 2 + 1.8; x += 3.6) {
    box(g, [0.12, 2.8, 0.12], [x, 1.4, COURT.baselineZ - 2.2], '#344942');
  }
  // Semi-transparent wire grid panel
  const wireMat = new T.MeshStandardMaterial({
    color: '#557268',
    wireframe: true,
    roughness: 0.8,
  });
  const backFenceMesh = new T.Mesh(
    new T.PlaneGeometry(COURT.width + 3.8, 2.6, 24, 16),
    wireMat,
  );
  backFenceMesh.position.set(0, 1.45, COURT.baselineZ - 2.2);
  g.add(backFenceMesh);

  // Left Fence
  box(
    g,
    [0.1, 0.1, COURT.length + 2.4],
    [COURT.minX - 1.5, 2.0, -3.5],
    '#344942',
  );
  for (let z = COURT.baselineZ - 2.2; z <= COURT.halfCourtZ + 0.5; z += 3.2) {
    box(g, [0.12, 2.0, 0.12], [COURT.minX - 1.5, 1.0, z], '#344942');
  }
  const leftFenceMesh = new T.Mesh(
    new T.PlaneGeometry(COURT.length + 2.2, 1.9, 20, 12),
    wireMat,
  );
  leftFenceMesh.rotation.y = Math.PI / 2;
  leftFenceMesh.position.set(COURT.minX - 1.5, 1.05, -3.5);
  g.add(leftFenceMesh);

  // 7. Bleachers with Spectator Crowd
  const { bleachers, spectators } = spectatorBleachers();
  g.add(bleachers);
  g.userData.spectators = spectators;

  // 8. Team benches beside court: red on the left, blue on the right.
  // Each seat is the team colour, its backrest the team's deep shade.
  for (const [team, x] of [
    ['red', COURT.minX - 0.7],
    ['blue', COURT.maxX + 0.7],
  ] as const) {
    box(g, [0.9, 0.45, 2.2], [x, 0.225, 1.0], TEAM_COLORS[team]);
    box(g, [0.9, 0.65, 0.12], [x, 0.65, -0.1], deepShade(TEAM_COLORS[team]));
  }

  // Ball rack on sideline
  box(g, [0.6, 0.9, 1.6], [COURT.minX - 0.7, 0.45, -3.0], '#d3b07b');
  const rackBall = new T.Mesh(
    new T.SphereGeometry(BALL_RADIUS * 0.92, 12, 10),
    material('#e5732f'),
  );
  rackBall.position.set(COURT.minX - 0.7, 0.9 + BALL_RADIUS, -3.0);
  rackBall.castShadow = true;
  g.add(rackBall);

  // Water cooler dispenser
  box(g, [0.45, 0.7, 0.45], [COURT.minX - 0.7, 0.35, -1.5], '#38534c');
  const coolerJug = new T.Mesh(
    new T.CylinderGeometry(0.18, 0.18, 0.45, 12),
    material('#81ecec'),
  );
  coolerJug.position.set(COURT.minX - 0.7, 0.9, -1.5);
  g.add(coolerJug);

  // 9. Low-Poly Trees in Park Surroundings
  g.add(lowPolyTree(-11.5, -14.0, 1.25));
  g.add(lowPolyTree(-14.5, -9.0, 1.1));
  g.add(lowPolyTree(-12.0, -2.0, 1.3));
  g.add(lowPolyTree(-13.5, 4.5, 1.15));
  g.add(lowPolyTree(13.0, -13.5, 1.2));
  g.add(lowPolyTree(15.5, -7.0, 1.35));
  g.add(lowPolyTree(14.0, 3.5, 1.1));

  // 10. Stadium / Court Floodlight Posts
  for (const x of [COURT.minX - 1.2, COURT.maxX + 1.2]) {
    box(g, [0.22, 6.2, 0.22], [x, 3.1, COURT.baselineZ], '#32403b');
    // Angled light bracket
    box(g, [0.8, 0.3, 0.5], [x, 6.2, COURT.baselineZ], '#ffeaa7');
  }

  // 11. Signboard: "COURT CLASH"
  const sign = label('COURT CLASH', '#f4ede2', '#2a413a', 3);
  sign.position.set(0, 3.5, COURT.baselineZ - 2.15);
  g.add(sign);

  return g;
}
