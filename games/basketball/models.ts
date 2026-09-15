import * as T from 'three';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { COURT, HOOP, BALL_RADIUS, type TeamId } from './types';

/**
 * Creates a basketball player using the shared worker avatar.
 * Dressed in a team-colored basketball jersey, shorts and white sneakers.
 */
export function basketballPlayer(color: string, team: TeamId, look?: Look) {
  const shortsColor = team === 'orange' ? '#9e461b' : '#1b5a52';
  const { model: g, worn } = dressedWorker(
    0,
    {
      shirt: color,
      overalls: shortsColor,
      boots: '#fff0d0', // White/cream basketball sneakers
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
    // Sweatband in player / team accent
    box(
      body,
      [0.56, 0.08, 0.54],
      [0, WORKER_HEAD_TOP - 0.04, 0],
      team === 'orange' ? '#fff4dd' : '#d2f4ee',
    );
  }

  // Jersey front trim & number badge
  box(body, [0.28, 0.22, 0.02], [0, 0.88, 0.23], '#ffffff');
  box(
    body,
    [0.16, 0.14, 0.025],
    [0, 0.88, 0.23],
    team === 'orange' ? '#e58e38' : '#349387',
  );

  return g;
}

/**
 * Creates a basketball with seams.
 */
export function basketballBall(): T.Group {
  const g = new T.Group();
  const sphereGeo = new T.SphereGeometry(BALL_RADIUS, 16, 12);
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
 * Creates the basketball hoop, post, padding, backboard, rim, and net.
 */
export function basketballHoop(): T.Group {
  const g = new T.Group();

  // 1. Base Post & Padding
  // Heavy ground foundation
  box(g, [1.4, 0.3, 1.4], [HOOP.x, 0.15, HOOP.backboardZ - 1.2], '#2c3935');
  // Sturdy vertical post
  box(g, [0.3, 3.8, 0.3], [HOOP.x, 1.9, HOOP.backboardZ - 1.2], '#3d4f49');
  // Protective safety padding around bottom of post
  box(g, [0.55, 1.8, 0.55], [HOOP.x, 0.9, HOOP.backboardZ - 1.2], '#355d60');

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
  // Acrylic board plate
  const board = box(
    g,
    [HOOP.backboardWidth, HOOP.backboardHeight, 0.06],
    [HOOP.x, HOOP.backboardY, HOOP.backboardZ],
    '#eaf3f2',
    true,
  );
  board.castShadow = true;

  // White outer frame
  box(
    g,
    [HOOP.backboardWidth + 0.06, 0.06, 0.08],
    [HOOP.x, HOOP.backboardY + HOOP.backboardHeight / 2, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [HOOP.backboardWidth + 0.06, 0.06, 0.08],
    [HOOP.x, HOOP.backboardY - HOOP.backboardHeight / 2, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [0.06, HOOP.backboardHeight, 0.08],
    [HOOP.x - HOOP.backboardWidth / 2, HOOP.backboardY, HOOP.backboardZ],
    '#ffffff',
  );
  box(
    g,
    [0.06, HOOP.backboardHeight, 0.08],
    [HOOP.x + HOOP.backboardWidth / 2, HOOP.backboardY, HOOP.backboardZ],
    '#ffffff',
  );

  // Inner red target rectangle
  const innerW = 0.59;
  const innerH = 0.45;
  const innerY = HOOP.y + innerH / 2 + 0.05;
  box(
    g,
    [innerW, 0.04, 0.07],
    [HOOP.x, innerY + innerH / 2, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [innerW, 0.04, 0.07],
    [HOOP.x, innerY - innerH / 2, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [0.04, innerH, 0.07],
    [HOOP.x - innerW / 2, innerY, HOOP.backboardZ],
    '#d94c38',
  );
  box(
    g,
    [0.04, innerH, 0.07],
    [HOOP.x + innerW / 2, innerY, HOOP.backboardZ],
    '#d94c38',
  );

  // 3. Rim Mounting Bracket & Breakaway Spring Assembly
  // Sturdy bracket connecting backboard to rim
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
    new T.TorusGeometry(HOOP.rimRadius, 0.032, 10, 28),
    material('#e5732f'),
  );
  rimMesh.position.set(0, 0, rimOffsetZ);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.castShadow = true;
  rimAssembly.add(rimMesh);

  // 4. Net (Attached under the rim)
  const netGeo = new T.CylinderGeometry(
    HOOP.rimRadius * 0.96,
    HOOP.rimRadius * 0.58,
    0.65,
    14,
    4,
    true,
  );
  const netMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    wireframe: true,
    roughness: 0.8,
  });
  const netMesh = new T.Mesh(netGeo, netMat);
  netMesh.position.set(0, -0.32, rimOffsetZ);
  rimAssembly.add(netMesh);

  g.add(rimAssembly);
  g.userData.rimAssembly = rimAssembly;

  return g;
}

/**
 * Creates the streetball court, surrounding perimeter, fence, team benches and lighting.
 */
export function basketballCourt(): T.Group {
  const g = new T.Group();

  // Main Court Floor (Stack or Sink styled warm teal/sage with terracotta painted key)
  // Base slab
  box(
    g,
    [COURT.width + 2, 0.4, COURT.length + 4],
    [0, -0.2, -3.5],
    '#38534c',
    true,
  );

  // Hardwood / Acrylic Court surface
  box(g, [COURT.width, 0.02, COURT.length], [0, 0.01, -3.5], '#426357');

  // The Key (Paint area): from baseline z = -11.5 to free throw line z = -5.7
  const keyWidth = 4.2;
  const keyLength = 5.8;
  const keyCenterZ = -11.5 + keyLength / 2;
  box(g, [keyWidth, 0.025, keyLength], [0, 0.015, keyCenterZ], '#ba7447');

  // Free Throw Circle
  const ftCircle = new T.Mesh(
    new T.RingGeometry(1.65, 1.75, 32),
    material('#f4ede2'),
  );
  ftCircle.rotation.x = -Math.PI / 2;
  ftCircle.position.set(0, 0.028, -5.7);
  g.add(ftCircle);

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

  // 3-Point Line (Arc of radius 6.75 centered at HOOP: (0, 0, -9.8))
  const arcSegments = 24;
  for (let i = 0; i <= arcSegments; i++) {
    const angle = Math.PI * 0.05 + (Math.PI * 0.9 * i) / arcSegments;
    const px = Math.cos(angle) * COURT.threePointRadius;
    const pz = HOOP.z + Math.sin(angle) * COURT.threePointRadius;
    if (pz <= COURT.halfCourtZ) {
      box(g, [0.18, 0.028, 0.18], [px, 0.022, pz], '#f4ede2');
    }
  }

  // Hoop added to court
  const hoop = basketballHoop();
  g.add(hoop);
  g.userData.rimAssembly = hoop.userData.rimAssembly;

  // Perimeter Fencing & Urban Yard Scenery
  // Back fence
  box(
    g,
    [COURT.width + 4, 2.5, 0.1],
    [0, 1.25, COURT.baselineZ - 2.2],
    '#526c63',
  );
  // Left and Right low fences
  box(
    g,
    [0.1, 1.6, COURT.length + 2],
    [COURT.minX - 1.2, 0.8, -3.5],
    '#526c63',
  );
  box(
    g,
    [0.1, 1.6, COURT.length + 2],
    [COURT.maxX + 1.2, 0.8, -3.5],
    '#526c63',
  );

  // Team benches beside half-court
  // Orange bench (left)
  box(g, [0.8, 0.45, 2.2], [COURT.minX - 0.7, 0.22, 1.0], '#d97438');
  box(g, [0.8, 0.65, 0.1], [COURT.minX - 0.7, 0.65, -0.1], '#a64b18');

  // Teal bench (right)
  box(g, [0.8, 0.45, 2.2], [COURT.maxX + 0.7, 0.22, 1.0], '#349387');
  box(g, [0.8, 0.65, 0.1], [COURT.maxX + 0.7, 0.65, -0.1], '#1a5e55');

  // Ball rack on sideline
  box(g, [0.6, 0.9, 1.6], [COURT.minX - 0.6, 0.45, -3.0], '#d3b07b');
  // Decorative basketball on rack
  const rackBall = new T.Mesh(
    new T.SphereGeometry(BALL_RADIUS * 0.9, 10, 8),
    material('#e5732f'),
  );
  rackBall.position.set(COURT.minX - 0.6, 0.9 + BALL_RADIUS, -3.0);
  g.add(rackBall);

  // Stadium / Court Floodlight Posts
  for (const x of [COURT.minX - 1.0, COURT.maxX + 1.0]) {
    box(g, [0.2, 5.5, 0.2], [x, 2.75, COURT.baselineZ], '#3d4d48');
    box(g, [0.6, 0.4, 0.4], [x, 5.6, COURT.baselineZ], '#ffe181');
  }

  // Signboard: "COURT CLASH"
  const sign = label('COURT CLASH', '#f4ede2', '#2a413a', 3);
  sign.position.set(0, 3.2, COURT.baselineZ - 2.15);
  g.add(sign);

  return g;
}
