import * as T from 'three';
import { box, ball } from '../../shared/rendering/primitives';
import {
  CRADLE_WIDTH,
  CRADLE_DEPTH,
  RAILING_HEIGHT,
  ROOF_ALTITUDE,
} from './types';

export type TrafficCar = {
  mesh: T.Group;
  speed: number;
  dir: number;
  minX: number;
  maxX: number;
};

export type SkyscraperAssembly = {
  root: T.Group;
  windsock: T.Group;
  cars: TrafficCar[];
};

/**
 * Creates the suspended window-cleaning cradle (scaffold) with
 * rotating winch drums, hand crank handles, and strobe warning beacon.
 */
export function createCradleMesh(): T.Group {
  const root = new T.Group();

  // Floor platform (perforated metal / steel mesh deck)
  box(root, [CRADLE_WIDTH, 0.12, CRADLE_DEPTH], [0, 0, 0], '#525a61', false);

  // Safety toeboards / kickplates along perimeter (safety yellow)
  box(
    root,
    [CRADLE_WIDTH, 0.28, 0.06],
    [0, 0.14, CRADLE_DEPTH / 2],
    '#f59e0b',
    false,
  );
  box(
    root,
    [CRADLE_WIDTH, 0.28, 0.06],
    [0, 0.14, -CRADLE_DEPTH / 2],
    '#f59e0b',
    false,
  );
  box(
    root,
    [0.06, 0.28, CRADLE_DEPTH],
    [-CRADLE_WIDTH / 2, 0.14, 0],
    '#f59e0b',
    false,
  );
  box(
    root,
    [0.06, 0.28, CRADLE_DEPTH],
    [CRADLE_WIDTH / 2, 0.14, 0],
    '#f59e0b',
    false,
  );

  // Guard rails (steel tubes)
  const railColor = '#e2e8f0';
  const postColor = '#f59e0b';

  // Corner & intermediate upright posts
  const postX = [
    -CRADLE_WIDTH / 2,
    -CRADLE_WIDTH / 4,
    0,
    CRADLE_WIDTH / 4,
    CRADLE_WIDTH / 2,
  ];
  for (const x of postX) {
    box(
      root,
      [0.08, RAILING_HEIGHT, 0.08],
      [x, RAILING_HEIGHT / 2, CRADLE_DEPTH / 2],
      postColor,
    );
    box(
      root,
      [0.08, RAILING_HEIGHT, 0.08],
      [x, RAILING_HEIGHT / 2, -CRADLE_DEPTH / 2],
      postColor,
    );
  }

  // Horizontal top handrails
  box(
    root,
    [CRADLE_WIDTH, 0.07, 0.07],
    [0, RAILING_HEIGHT, CRADLE_DEPTH / 2],
    railColor,
  );
  box(
    root,
    [CRADLE_WIDTH, 0.07, 0.07],
    [0, RAILING_HEIGHT, -CRADLE_DEPTH / 2],
    railColor,
  );
  box(
    root,
    [0.07, 0.07, CRADLE_DEPTH],
    [-CRADLE_WIDTH / 2, RAILING_HEIGHT, 0],
    railColor,
  );
  box(
    root,
    [0.07, 0.07, CRADLE_DEPTH],
    [CRADLE_WIDTH / 2, RAILING_HEIGHT, 0],
    railColor,
  );

  // Mid-rails
  box(
    root,
    [CRADLE_WIDTH, 0.05, 0.05],
    [0, RAILING_HEIGHT * 0.55, CRADLE_DEPTH / 2],
    railColor,
  );
  box(
    root,
    [CRADLE_WIDTH, 0.05, 0.05],
    [0, RAILING_HEIGHT * 0.55, -CRADLE_DEPTH / 2],
    railColor,
  );

  // Overhead safety lifeline rail (where harnesses anchor)
  box(
    root,
    [CRADLE_WIDTH - 0.4, 0.06, 0.06],
    [0, RAILING_HEIGHT + 0.9, -CRADLE_DEPTH / 2 + 0.1],
    '#ef4444',
  );

  // Winch towers at Left and Right ends
  for (const side of [-1, 1]) {
    const wx = side * (CRADLE_WIDTH / 2 - 0.55);
    const winchTower = new T.Group();
    winchTower.position.set(wx, 0, 0);

    // Motor housing
    box(winchTower, [0.7, 0.85, 0.7], [0, 0.45, 0], '#2563eb', true);

    // Cable drum spool
    const drumGeo = new T.CylinderGeometry(0.22, 0.22, 0.48, 12);
    drumGeo.rotateZ(Math.PI / 2);
    const drumMat = new T.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.8,
      roughness: 0.3,
    });
    const drum = new T.Mesh(drumGeo, drumMat);
    drum.name = side === -1 ? 'drumLeft' : 'drumRight';
    drum.position.set(0, 0.5, 0);
    winchTower.add(drum);

    // Hand crank arm and handle
    const crankArm = new T.Group();
    crankArm.name = side === -1 ? 'crankArmLeft' : 'crankArmRight';
    crankArm.position.set(side * 0.38, 0.5, 0);
    box(crankArm, [0.04, 0.38, 0.06], [0, 0.15, 0], '#d97706');
    ball(crankArm, [0.12, 0.12, 0.12], [0, 0.32, 0.08], '#dc2626');
    winchTower.add(crankArm);

    // Pulley bracket leading up to suspension cable
    box(winchTower, [0.12, 1.2, 0.12], [0, 1.1, 0], '#1e293b');
    ball(winchTower, [0.18, 0.18, 0.18], [0, 1.7, 0], '#e2e8f0');

    root.add(winchTower);
  }

  // Industrial Strobe Warning Beacon on Top Railing
  const beaconGroup = new T.Group();
  beaconGroup.name = 'cradleBeacon';
  beaconGroup.position.set(0, RAILING_HEIGHT + 0.04, CRADLE_DEPTH / 2);
  box(beaconGroup, [0.22, 0.08, 0.22], [0, 0.04, 0], '#1e293b');
  const beaconBulbMat = new T.MeshStandardMaterial({
    color: '#eab308',
    emissive: '#eab308',
    emissiveIntensity: 0.3,
    roughness: 0.1,
  });
  const beaconBulb = new T.Mesh(
    new T.CylinderGeometry(0.09, 0.1, 0.18, 12),
    beaconBulbMat,
  );
  beaconBulb.name = 'beaconBulb';
  beaconBulb.position.set(0, 0.15, 0);
  beaconGroup.add(beaconBulb);
  root.add(beaconGroup);

  return root;
}

/**
 * Creates low-poly puffy cloud cluster for high-altitude depth & parallax
 */
export function createCloudMesh(): T.Group {
  const root = new T.Group();
  const puffMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0.02,
    transparent: true,
    opacity: 0.85,
  });
  const puffGeo = new T.SphereGeometry(1, 8, 6);
  const cluster = [
    { s: [3.2, 1.6, 2.4], p: [0, 0, 0] },
    { s: [2.2, 1.3, 1.9], p: [-2.0, -0.1, 0.3] },
    { s: [2.4, 1.4, 2.0], p: [1.9, -0.1, -0.2] },
    { s: [1.7, 1.1, 1.5], p: [-0.6, 0.6, 0.4] },
    { s: [1.9, 1.2, 1.7], p: [0.8, 0.5, -0.3] },
  ];
  for (const c of cluster) {
    const m = new T.Mesh(puffGeo, puffMat);
    m.scale.set(c.s[0], c.s[1], c.s[2]);
    m.position.set(c.p[0], c.p[1], c.p[2]);
    m.castShadow = true;
    root.add(m);
  }
  return root;
}

/**
 * Creates animated fabric windsock on roof helipad
 */
export function createWindsockMesh(): { root: T.Group; sock: T.Group } {
  const root = new T.Group();
  // Support pole
  box(root, [0.08, 2.4, 0.08], [0, 1.2, 0], '#64748b');
  // Swivel hinge
  ball(root, [0.14, 0.14, 0.14], [0, 2.38, 0], '#e2e8f0');

  // Swivel arm and sock assembly
  const sock = new T.Group();
  sock.position.set(0, 2.38, 0);

  // Horizontal bracket
  box(sock, [0.35, 0.06, 0.06], [0.18, 0, 0], '#94a3b8');

  // 5 Tapered fabric cone segments (alternating international orange & white)
  const colors = ['#ea580c', '#ffffff', '#ea580c', '#ffffff', '#ea580c'];
  for (let i = 0; i < colors.length; i++) {
    const rTop = 0.22 - i * 0.028;
    const rBot = 0.19 - i * 0.028;
    const len = 0.28;
    const segGeo = new T.CylinderGeometry(rTop, rBot, len, 8, 1, true);
    segGeo.rotateZ(-Math.PI / 2);
    const segMat = new T.MeshStandardMaterial({
      color: colors[i],
      roughness: 0.8,
      side: T.DoubleSide,
    });
    const seg = new T.Mesh(segGeo, segMat);
    seg.position.set(0.35 + i * len + len / 2, 0, 0);
    sock.add(seg);
  }
  root.add(sock);
  return { root, sock };
}

/**
 * Creates the 80-story skyscraper facade with floor spandrels, stamped floor plates,
 * helipad safety perimeter, animated windsock, and ground street traffic with moving cars.
 */
export function createSkyscraperMesh(): SkyscraperAssembly {
  const root = new T.Group();

  // Skyscraper main tower body
  const towerGeo = new T.BoxGeometry(38, 125, 45);
  const towerMat = new T.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.15,
    metalness: 0.85,
  });
  const tower = new T.Mesh(towerGeo, towerMat);
  tower.position.set(0, 55, -23);
  root.add(tower);

  // Structural Corner Columns (Architectural definition)
  for (const cx of [-18.5, 18.5]) {
    box(root, [1.2, 125, 1.6], [cx, 55, -0.6], '#1e293b');
  }

  // Floor Spandrel bands across the glass facade every 4 meters
  for (let r = 0; r < 20; r++) {
    const fy = 18 + r * 4.0;
    box(root, [36, 0.45, 0.2], [0, fy, -0.4], '#334155');
  }

  // Floor Marker Plates along the left and right columns
  const floorLevels = [
    { floor: 'FL 80', y: 82 },
    { floor: 'FL 70', y: 70 },
    { floor: 'FL 60', y: 58 },
    { floor: 'FL 50', y: 46 },
    { floor: 'FL 40', y: 34 },
    { floor: 'FL 30', y: 22 },
  ];

  for (const fl of floorLevels) {
    for (const side of [-1, 1]) {
      const px = side * (CRADLE_WIDTH / 2 + 2.2);
      // Backing plate
      box(root, [1.4, 0.75, 0.15], [px, fl.y, -0.2], '#f59e0b');
      // Dark border trim
      box(root, [1.46, 0.82, 0.08], [px, fl.y, -0.25], '#0f172a');
    }
  }

  // Roof structure & Helipad
  const roof = new T.Group();
  roof.position.set(0, ROOF_ALTITUDE, -10);

  // Helipad deck
  box(roof, [22, 0.6, 22], [0, 0, 0], '#334155', false);
  // Yellow landing circle
  const ringGeo = new T.RingGeometry(6.5, 7.5, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const yellowMat = new T.MeshBasicMaterial({
    color: '#facc15',
    side: T.DoubleSide,
  });
  const ring = new T.Mesh(ringGeo, yellowMat);
  ring.position.set(0, 0.35, 0);
  roof.add(ring);

  // "H" letter on helipad
  const hBar1 = box(roof, [0.8, 0.05, 5.5], [-2.2, 0.35, 0], '#facc15');
  const hBar2 = box(roof, [0.8, 0.05, 5.5], [2.2, 0.35, 0], '#facc15');
  const hCross = box(roof, [4.4, 0.05, 0.8], [0, 0.35, 0], '#facc15');
  hBar1.receiveShadow = true;
  hBar2.receiveShadow = true;
  hCross.receiveShadow = true;

  // Helipad safety perimeter nets (slanted outward 45 degrees)
  const netMat = new T.MeshStandardMaterial({
    color: '#475569',
    wireframe: true,
  });
  const netSides = [
    { p: [0, 0.1, 11.4], r: [-0.6, 0, 0], s: [22, 1.6, 0.1] },
    { p: [0, 0.1, -11.4], r: [0.6, 0, 0], s: [22, 1.6, 0.1] },
    { p: [11.4, 0.1, 0], r: [0, 0, -0.6], s: [0.1, 1.6, 22] },
    { p: [-11.4, 0.1, 0], r: [0, 0, 0.6], s: [0.1, 1.6, 22] },
  ];
  for (const n of netSides) {
    const netMesh = new T.Mesh(
      new T.BoxGeometry(n.s[0], n.s[1], n.s[2]),
      netMat,
    );
    netMesh.position.set(n.p[0], n.p[1], n.p[2]);
    netMesh.rotation.set(n.r[0], n.r[1], n.r[2]);
    roof.add(netMesh);
  }

  // Helipad green perimeter beacon lights
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lx = Math.cos(angle) * 10.2;
    const lz = Math.sin(angle) * 10.2;
    box(roof, [0.15, 0.25, 0.15], [lx, 0.45, lz], '#22c55e');
  }

  // Helipad Windsock
  const windsockData = createWindsockMesh();
  windsockData.root.position.set(9.2, 0.35, -9.2);
  roof.add(windsockData.root);

  // Roof suspension davit arms (where cables hang down)
  box(roof, [0.4, 3.5, 0.4], [-CRADLE_WIDTH / 2, 1.8, 9.8], '#f59e0b');
  box(roof, [0.4, 0.4, 3.2], [-CRADLE_WIDTH / 2, 3.4, 11.2], '#f59e0b');
  ball(roof, [0.35, 0.35, 0.35], [-CRADLE_WIDTH / 2, 3.4, 12.8], '#e2e8f0');

  box(roof, [0.4, 3.5, 0.4], [CRADLE_WIDTH / 2, 1.8, 9.8], '#f59e0b');
  box(roof, [0.4, 0.4, 3.2], [CRADLE_WIDTH / 2, 3.4, 11.2], '#f59e0b');
  ball(roof, [0.35, 0.35, 0.35], [CRADLE_WIDTH / 2, 3.4, 12.8], '#e2e8f0');

  root.add(roof);

  // Ground level street vertigo props far below (Y = 0)
  const street = new T.Group();
  street.position.set(0, 0, 10);
  box(street, [90, 0.2, 70], [0, 0, 0], '#1e293b');

  // Sidewalks & curbs
  box(street, [90, 0.35, 5], [0, 0.1, 0], '#64748b');
  box(street, [90, 0.35, 5], [0, 0.1, 20], '#64748b');

  // Miniature roadside trees
  for (let i = -6; i <= 6; i++) {
    box(street, [0.18, 0.8, 0.18], [i * 6.5, 0.5, 0], '#78350f');
    ball(street, [0.65, 0.75, 0.65], [i * 6.5, 1.1, 0], '#15803d');
  }

  // Adjacent lower building rooftops in the distance with AC chillers & water towers
  const neighbors = [
    { x: -35, z: -15, w: 22, h: 22, d: 24, c: '#334155' },
    { x: 35, z: -15, w: 22, h: 26, d: 24, c: '#1e293b' },
    { x: -32, z: 25, w: 18, h: 14, d: 18, c: '#475569' },
    { x: 32, z: 25, w: 18, h: 16, d: 18, c: '#334155' },
  ];
  for (const b of neighbors) {
    box(street, [b.w, b.h, b.d], [b.x, b.h / 2, b.z], b.c);
    // Rooftop AC chiller
    box(street, [3, 1.2, 2.5], [b.x - 2, b.h + 0.6, b.z], '#94a3b8');
    // Rooftop wooden water tower
    box(street, [0.4, 2.0, 0.4], [b.x + 3, b.h + 1.0, b.z + 2], '#78350f');
    ball(street, [1.1, 1.3, 1.1], [b.x + 3, b.h + 2.4, b.z + 2], '#a16207');
  }

  // Low-altitude ground depth haze layer
  const hazeGeo = new T.PlaneGeometry(100, 80);
  hazeGeo.rotateX(-Math.PI / 2);
  const hazeMat = new T.MeshBasicMaterial({
    color: '#94a3b8',
    transparent: true,
    opacity: 0.35,
  });
  const haze = new T.Mesh(hazeGeo, hazeMat);
  haze.position.set(0, 3.5, 10);
  street.add(haze);

  // Moving miniature toy cars on street lanes
  const cars: TrafficCar[] = [];
  const carColors = [
    '#ef4444',
    '#3b82f6',
    '#eab308',
    '#ffffff',
    '#10b981',
    '#f97316',
  ];
  const lanes = [6, 9, 12, 15];

  for (let i = 0; i < 16; i++) {
    const carGroup = new T.Group();
    const laneIndex = i % lanes.length;
    const laneZ = lanes[laneIndex];
    const dir = laneIndex % 2 === 0 ? 1 : -1;
    const speed = 4.5 + (i % 4) * 1.5;
    const initialX = -38 + ((i * 5.2) % 76);

    // Car chassis
    box(
      carGroup,
      [1.8, 0.65, 0.95],
      [0, 0.38, 0],
      carColors[i % carColors.length],
      true,
    );
    // Cabin
    box(carGroup, [1.0, 0.45, 0.85], [-0.1 * dir, 0.8, 0], '#0f172a', true);

    // Headlights (yellow)
    const hlMat = new T.MeshBasicMaterial({ color: '#fef08a' });
    const hl = new T.Mesh(new T.BoxGeometry(0.08, 0.12, 0.18), hlMat);
    hl.position.set(0.95 * dir, 0.38, 0.28);
    carGroup.add(hl);
    const hl2 = hl.clone();
    hl2.position.z = -0.28;
    carGroup.add(hl2);

    // Taillights (red)
    const tlMat = new T.MeshBasicMaterial({ color: '#ef4444' });
    const tl = new T.Mesh(new T.BoxGeometry(0.08, 0.12, 0.18), tlMat);
    tl.position.set(-0.95 * dir, 0.38, 0.28);
    carGroup.add(tl);
    const tl2 = tl.clone();
    tl2.position.z = -0.28;
    carGroup.add(tl2);

    carGroup.position.set(initialX, 0.35, laneZ);
    street.add(carGroup);

    cars.push({
      mesh: carGroup,
      speed,
      dir,
      minX: -42,
      maxX: 42,
    });
  }

  root.add(street);

  return { root, windsock: windsockData.sock, cars };
}

/**
 * Creates procedural meshes for individual window panes with
 * detailed mullion frame, cozy office interior vignette, spotless glass,
 * rich soap foam clumps, and 4-point sparkle stars.
 */
export function createWindowMesh(): {
  group: T.Group;
  dirtyMesh: T.Mesh;
  foamMesh: T.Mesh;
  spotlessMesh: T.Mesh;
  sparkleMesh: T.Group;
} {
  const group = new T.Group();
  const width = 1.6;
  const height = 3.2;

  // Window frame / mullion
  box(group, [width + 0.12, height + 0.12, 0.08], [0, 0, 0], '#1e293b');

  // Interior Office Vignette behind glass (visible depth)
  const interior = new T.Group();
  interior.position.set(0, 0, -0.22);
  // Back office wall
  box(interior, [width - 0.06, height - 0.06, 0.05], [0, 0, -0.1], '#1e293b');
  // Desk
  box(interior, [0.75, 0.06, 0.32], [0, -0.65, 0.05], '#b45309');
  // Computer monitor with bright glowing screen
  const screenMat = new T.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.55,
  });
  const screen = new T.Mesh(new T.BoxGeometry(0.3, 0.2, 0.03), screenMat);
  screen.position.set(0, -0.46, 0.08);
  interior.add(screen);
  // Potted indoor succulent
  box(interior, [0.1, 0.12, 0.1], [-0.38, -0.56, 0.08], '#ea580c');
  ball(interior, [0.12, 0.14, 0.12], [-0.38, -0.42, 0.08], '#16a34a');
  group.add(interior);

  // Spotless glass (clear, reflective, cyan-tinted)
  const glassGeo = new T.PlaneGeometry(width, height);
  const spotlessMat = new T.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.04,
    metalness: 0.92,
    transparent: true,
    opacity: 0.82,
  });
  const spotlessMesh = new T.Mesh(glassGeo, spotlessMat);
  spotlessMesh.position.set(0, 0, 0.045);
  group.add(spotlessMesh);

  // Dirty overlay (brown/grey grime layer)
  const dirtyMat = new T.MeshStandardMaterial({
    color: '#6b4f2c',
    roughness: 0.95,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  const dirtyMesh = new T.Mesh(glassGeo, dirtyMat);
  dirtyMesh.position.set(0, 0, 0.047);
  group.add(dirtyMesh);

  // Soapy foam overlay (rich white suds with 3D bubble clumps)
  const foamMesh = new T.Group() as unknown as T.Mesh;
  const foamMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.65,
    transparent: true,
    opacity: 0.94,
  });
  const foamBase = new T.Mesh(glassGeo, foamMat);
  foamBase.position.set(0, 0, 0.049);
  (foamMesh as unknown as T.Group).add(foamBase);

  // Fluffy soap bubble mounds
  for (let i = 0; i < 5; i++) {
    const clump = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), foamMat);
    clump.scale.set(1.1, 0.8, 0.4);
    clump.position.set(Math.sin(i * 2.3) * 0.45, Math.cos(i * 1.8) * 0.9, 0.08);
    (foamMesh as unknown as T.Group).add(clump);
  }
  foamMesh.visible = false;
  group.add(foamMesh as unknown as T.Object3D);

  // Sparkle stars group: 4-pointed sparkle stars
  const sparkleMesh = new T.Group();
  sparkleMesh.position.set(0, 0, 0.12);
  for (let i = 0; i < 4; i++) {
    const star = new T.Group();
    const starMat = new T.MeshBasicMaterial({ color: '#facc15' });
    const starH = new T.Mesh(new T.BoxGeometry(0.36, 0.06, 0.02), starMat);
    const starV = new T.Mesh(new T.BoxGeometry(0.06, 0.36, 0.02), starMat);
    star.add(starH);
    star.add(starV);
    star.position.set(
      (i % 2 === 0 ? -0.45 : 0.45) + (i > 1 ? 0.1 : -0.1),
      i < 2 ? 0.75 : -0.75,
      0,
    );
    star.scale.set(0.65, 0.65, 0.65);
    sparkleMesh.add(star);
  }
  sparkleMesh.visible = false;
  group.add(sparkleMesh);

  return {
    group,
    dirtyMesh,
    foamMesh: foamMesh as unknown as T.Mesh,
    spotlessMesh,
    sparkleMesh,
  };
}

/**
 * Creates CEO's helicopter mesh with spinning rotor blades
 */
export function createHelicopterMesh(): {
  root: T.Group;
  mainRotor: T.Group;
  tailRotor: T.Group;
} {
  const root = new T.Group();

  // Fuselage (Executive navy blue & gold)
  box(root, [2.4, 2.2, 5.6], [0, 0, 0], '#091e3a', true);
  // Nose cone
  box(root, [2.0, 1.6, 1.8], [0, -0.2, 2.8], '#091e3a', true);

  // Cockpit windshield (tinted gold/smoke glass)
  const glassMat = new T.MeshStandardMaterial({
    color: '#fef08a',
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
  });
  const windshield = new T.Mesh(new T.BoxGeometry(2.02, 1.2, 1.6), glassMat);
  windshield.position.set(0, 0.25, 2.4);
  root.add(windshield);

  // Gold accent stripe
  box(root, [2.44, 0.18, 5.0], [0, 0, 0.2], '#eab308');

  // Tail boom
  box(root, [0.65, 0.7, 4.5], [0, 0.35, -4.5], '#091e3a');
  // Vertical tail fin
  box(root, [0.12, 1.6, 1.2], [0, 0.95, -6.6], '#eab308');

  // Landing skids
  for (const side of [-1, 1]) {
    const sx = side * 1.35;
    box(root, [0.08, 0.08, 6.2], [sx, -1.4, 0.2], '#475569');
    // Skid struts
    box(root, [0.08, 0.8, 0.08], [sx, -1.0, 1.8], '#475569');
    box(root, [0.08, 0.8, 0.08], [sx, -1.0, -1.5], '#475569');
  }

  // Main rotor assembly
  const mainRotor = new T.Group();
  mainRotor.position.set(0, 1.4, 0.5);
  // Rotor mast
  box(mainRotor, [0.2, 0.5, 0.2], [0, -0.15, 0], '#334155');
  ball(mainRotor, [0.35, 0.35, 0.35], [0, 0.1, 0], '#64748b');

  // 4 rotor blades
  const bladeMat = new T.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const blade = new T.Mesh(new T.BoxGeometry(0.32, 0.04, 5.8), bladeMat);
    blade.position.set(Math.sin(angle) * 2.8, 0.1, Math.cos(angle) * 2.8);
    blade.rotation.y = angle;
    mainRotor.add(blade);
  }
  root.add(mainRotor);

  // Tail rotor assembly
  const tailRotor = new T.Group();
  tailRotor.position.set(0.18, 1.4, -6.6);
  for (let i = 0; i < 2; i++) {
    const angle = (i * Math.PI) / 2;
    const tBlade = new T.Mesh(new T.BoxGeometry(0.04, 1.6, 0.16), bladeMat);
    tBlade.rotation.x = angle;
    tailRotor.add(tBlade);
  }
  root.add(tailRotor);

  return { root, mainRotor, tailRotor };
}

/**
 * Creates soap water bucket with bubbles
 */
export function createSoapBucketMesh(): { root: T.Group; suds: T.Mesh } {
  const root = new T.Group();

  // Bucket plastic cylinder
  const bucketGeo = new T.CylinderGeometry(0.32, 0.25, 0.6, 16);
  const bucketMat = new T.MeshStandardMaterial({
    color: '#0284c7',
    roughness: 0.3,
  });
  const bucketMesh = new T.Mesh(bucketGeo, bucketMat);
  bucketMesh.position.y = 0.3;
  bucketMesh.castShadow = true;
  root.add(bucketMesh);

  // Metal handle
  const handleGeo = new T.TorusGeometry(0.33, 0.025, 8, 24, Math.PI);
  const handleMat = new T.MeshStandardMaterial({
    color: '#94a3b8',
    metalness: 0.8,
  });
  const handle = new T.Mesh(handleGeo, handleMat);
  handle.position.y = 0.58;
  handle.rotation.z = Math.PI;
  root.add(handle);

  // Soapy water / suds surface
  const sudsGeo = new T.CylinderGeometry(0.3, 0.3, 0.05, 16);
  const sudsMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.8,
    transparent: true,
    opacity: 0.95,
  });
  const suds = new T.Mesh(sudsGeo, sudsMat);
  suds.position.y = 0.55;
  root.add(suds);

  return { root, suds };
}

/**
 * Creates animated pigeon mesh
 */
export function createPigeonMesh(): {
  root: T.Group;
  wingL: T.Group;
  wingR: T.Group;
} {
  const root = new T.Group();

  // Pigeon plump body
  ball(root, [0.3, 0.35, 0.45], [0, 0.18, 0], '#64748b');
  // Iridescent neck sheen
  box(root, [0.22, 0.18, 0.22], [0, 0.32, 0.1], '#059669');
  // Head
  ball(root, [0.18, 0.18, 0.2], [0, 0.42, 0.16], '#64748b');
  // Yellow/Orange Beak
  box(root, [0.06, 0.05, 0.12], [0, 0.39, 0.28], '#f97316');
  // Black beady eyes
  ball(root, [0.035, 0.035, 0.035], [-0.08, 0.44, 0.2], '#000000');
  ball(root, [0.035, 0.035, 0.035], [0.08, 0.44, 0.2], '#000000');

  // Orange legs
  box(root, [0.03, 0.16, 0.03], [-0.07, 0.06, 0], '#ea580c');
  box(root, [0.03, 0.16, 0.03], [0.07, 0.06, 0], '#ea580c');

  // Left wing
  const wingL = new T.Group();
  wingL.position.set(-0.16, 0.22, 0);
  box(wingL, [0.04, 0.24, 0.4], [-0.05, 0, 0], '#475569');
  root.add(wingL);

  // Right wing
  const wingR = new T.Group();
  wingR.position.set(0.16, 0.22, 0);
  box(wingR, [0.04, 0.24, 0.4], [0.05, 0, 0], '#475569');
  root.add(wingR);

  return { root, wingL, wingR };
}

/**
 * Creates squeegee tool held by worker
 */
export function createSqueegeeMesh(): T.Group {
  const root = new T.Group();
  // Aluminum handle
  box(root, [0.05, 0.7, 0.05], [0, 0.35, 0], '#facc15');
  // Crosshead T-bar
  box(root, [0.65, 0.05, 0.06], [0, 0.7, 0], '#334155');
  // Rubber wiper blade
  box(root, [0.65, 0.08, 0.02], [0, 0.74, 0], '#000000');
  return root;
}

/**
 * Creates soap foam sponge applicator held by worker
 */
export function createSpongeMesh(): T.Group {
  const root = new T.Group();
  // Handle
  box(root, [0.05, 0.65, 0.05], [0, 0.32, 0], '#0284c7');
  // Fluffy foam sponge head
  ball(root, [0.45, 0.2, 0.25], [0, 0.68, 0], '#fef08a');
  return root;
}
