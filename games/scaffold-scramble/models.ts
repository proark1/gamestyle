import * as T from 'three';
import { box, ball } from '../../shared/rendering/primitives';
import {
  CRADLE_WIDTH,
  CRADLE_DEPTH,
  RAILING_HEIGHT,
  ROOF_ALTITUDE,
} from './types';

/**
 * Creates the suspended window-cleaning cradle (scaffold)
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
    const drumGeo = new T.CylinderGeometry(0.22, 0.22, 0.5, 12);
    drumGeo.rotateZ(Math.PI / 2);
    const drumMat = new T.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.8,
      roughness: 0.3,
    });
    const drum = new T.Mesh(drumGeo, drumMat);
    drum.position.set(0, 0.5, 0);
    winchTower.add(drum);

    // Hand crank arm and handle
    const crankArm = new T.Group();
    crankArm.name = side === -1 ? 'crankArmLeft' : 'crankArmRight';
    crankArm.position.set(side * 0.35, 0.5, 0);
    box(crankArm, [0.04, 0.38, 0.06], [0, 0.15, 0], '#d97706');
    ball(crankArm, [0.12, 0.12, 0.12], [0, 0.32, 0.08], '#dc2626');
    winchTower.add(crankArm);

    // Pulley bracket leading up to suspension cable
    box(winchTower, [0.12, 1.2, 0.12], [0, 1.1, 0], '#1e293b');
    ball(winchTower, [0.18, 0.18, 0.18], [0, 1.7, 0], '#e2e8f0');

    root.add(winchTower);
  }

  return root;
}

/**
 * Creates the 80-story skyscraper facade with glass grid
 */
export function createSkyscraperMesh(): T.Group {
  const root = new T.Group();

  // Skyscraper main tower body
  const towerGeo = new T.BoxGeometry(38, 125, 45);
  const towerMat = new T.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.1,
    metalness: 0.85,
  });
  const tower = new T.Mesh(towerGeo, towerMat);
  tower.position.set(0, 55, -23);
  root.add(tower);

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
  box(street, [60, 0.2, 60], [0, 0, 0], '#1e293b');
  // Tiny toy cars on street
  const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#10b981'];
  for (let i = 0; i < 18; i++) {
    const cx = -22 + (i % 6) * 8.5 + Math.random() * 2;
    const cz = -10 + Math.floor(i / 6) * 10;
    box(
      street,
      [1.6, 0.8, 3.2],
      [cx, 0.45, cz],
      carColors[i % carColors.length],
    );
  }
  root.add(street);

  return root;
}

/**
 * Creates procedural meshes for individual window panes
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
  box(group, [width + 0.12, height + 0.12, 0.08], [0, 0, 0], '#334155');

  // Spotless glass (clear, reflective, cyan-tinted)
  const glassGeo = new T.PlaneGeometry(width, height);
  const spotlessMat = new T.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.05,
    metalness: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  const spotlessMesh = new T.Mesh(glassGeo, spotlessMat);
  spotlessMesh.position.set(0, 0, 0.045);
  group.add(spotlessMesh);

  // Dirty overlay (brown/grey grime layer)
  const dirtyMat = new T.MeshStandardMaterial({
    color: '#785b3b',
    roughness: 0.95,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  const dirtyMesh = new T.Mesh(glassGeo, dirtyMat);
  dirtyMesh.position.set(0, 0, 0.047);
  group.add(dirtyMesh);

  // Soapy foam overlay (rich white suds and bubbles)
  const foamMat = new T.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.8,
    transparent: true,
    opacity: 0.92,
  });
  const foamMesh = new T.Mesh(glassGeo, foamMat);
  foamMesh.position.set(0, 0, 0.049);
  foamMesh.visible = false;
  group.add(foamMesh);

  // Sparkle stars group
  const sparkleMesh = new T.Group();
  sparkleMesh.position.set(0, 0, 0.1);
  for (let i = 0; i < 3; i++) {
    const star = ball(
      sparkleMesh,
      [0.12, 0.12, 0.04],
      [(i - 1) * 0.45, i % 2 === 0 ? 0.4 : -0.4, 0],
      '#ffffff',
    );
    star.castShadow = false;
  }
  sparkleMesh.visible = false;
  group.add(sparkleMesh);

  return { group, dirtyMesh, foamMesh, spotlessMesh, sparkleMesh };
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
