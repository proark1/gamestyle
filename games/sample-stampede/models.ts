import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ItemKind, TeamId } from './types';

// Palette matching wholesale warehouse club aesthetic
export const WAREHOUSE_COLORS = {
  concrete: 0x8a9299,
  concreteDark: 0x5a6066,
  safetyYellow: 0xf1c40f,
  rackBlue: 0x244f76,
  rackOrange: 0xdf5a22,
  wireDeck: 0xbdc3c7,
  cartSteel: 0xd6dbdf,
  cartGrip: 0x2c3e50,
  redTeam: 0xe74c3c,
  blueTeam: 0x2980b9,
  yellowTeam: 0xf39c12,
  greenTeam: 0x27ae60,
  woodPallet: 0xc49a6c,
  kioskBody: 0x34495e,
  kioskSneezeGuard: 0xecf0f1,
};

export const TEAM_HEX: Record<TeamId, number> = {
  red: WAREHOUSE_COLORS.redTeam,
  blue: WAREHOUSE_COLORS.blueTeam,
  yellow: WAREHOUSE_COLORS.yellowTeam,
  green: WAREHOUSE_COLORS.greenTeam,
};

export function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  pos: [number, number, number],
  color: number,
  castShadow = true,
  roughness = 0.75,
  metalness = 0.1,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(...size);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  pos: [number, number, number],
  color: number,
  castShadow = true,
  roughness = 0.6,
  metalness = 0.2,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
  );
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function roundedBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  pos: [number, number, number],
  color: number,
  radius = 0.05,
  castShadow = true,
  roughness = 0.7,
): THREE.Mesh {
  const geo = new RoundedBoxGeometry(...size, 2, radius);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Creates the high industrial pallet shelving unit
 */
export function createPalletRack(
  width: number,
  height: number,
  depth: number,
): THREE.Group {
  const rack = new THREE.Group();

  // Vertical corner uprights (Blue steel perforated posts)
  const postThickness = 0.12;
  const halfW = width / 2;
  const halfD = depth / 2;
  const postCorners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];

  for (const [cx, cz] of postCorners) {
    box(
      rack,
      [postThickness, height, postThickness],
      [cx, height / 2, cz],
      WAREHOUSE_COLORS.rackBlue,
      true,
      0.5,
      0.4,
    );
  }

  // Cross beams (Safety Orange) at 3 shelf levels
  const shelfHeights = [height * 0.2, height * 0.55, height * 0.9];
  for (const sy of shelfHeights) {
    // Front & back orange beams
    box(
      rack,
      [width + 0.05, 0.14, 0.08],
      [0, sy, halfD],
      WAREHOUSE_COLORS.rackOrange,
      true,
      0.4,
      0.3,
    );
    box(
      rack,
      [width + 0.05, 0.14, 0.08],
      [0, sy, -halfD],
      WAREHOUSE_COLORS.rackOrange,
      true,
      0.4,
      0.3,
    );

    // Side cross braces
    box(
      rack,
      [0.08, 0.14, depth],
      [halfW, sy, 0],
      WAREHOUSE_COLORS.rackOrange,
      true,
    );
    box(
      rack,
      [0.08, 0.14, depth],
      [-halfW, sy, 0],
      WAREHOUSE_COLORS.rackOrange,
      true,
    );

    // Wire mesh decking / wood pallet surface
    box(
      rack,
      [width - 0.05, 0.04, depth - 0.05],
      [0, sy - 0.04, 0],
      WAREHOUSE_COLORS.woodPallet,
      true,
      0.9,
    );
  }

  return rack;
}

/**
 * Hanging Aisle Number Sign
 */
export function createAisleSign(
  aisleNumber: number,
  title: string,
): THREE.Group {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Blue background with red chevron striping
  ctx.fillStyle = '#1e3799';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#e55039';
  ctx.fillRect(0, 0, 512, 40);
  ctx.fillRect(0, 220, 512, 36);

  // Big Aisle Number
  ctx.fillStyle = '#f8c291';
  ctx.font = 'bold 110px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`AISLE ${aisleNumber}`, 256, 115);

  // Category Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Fredoka, sans-serif';
  ctx.fillText(title.toUpperCase(), 256, 185);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), mat);
  plane.castShadow = true;
  group.add(plane);

  // Hanging chain rods
  for (const cx of [-1.2, 1.2]) {
    cylinder(group, 0.02, 0.02, 2.5, 6, [cx, 2.0, 0], 0x7f8c8d, false);
  }

  return group;
}

/**
 * Free Sample Kiosk Station with sneeze guard, heat lamps & sign
 */
export function createSampleKiosk(
  aisleName: string,
  sampleName: string,
): THREE.Group {
  const group = new THREE.Group();

  // Base counter
  box(group, [2.2, 0.95, 1.2], [0, 0.475, 0], WAREHOUSE_COLORS.kioskBody, true);
  // Countertop (Stainless steel)
  box(group, [2.35, 0.08, 1.35], [0, 0.98, 0], 0xdfe6e9, true, 0.3, 0.7);

  // Clear sneeze guard glass
  const glassGeo = new THREE.BoxGeometry(2.1, 0.55, 0.03);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.1,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(0, 1.3, 0.55);
  group.add(glassMesh);

  // Side glass brackets
  box(group, [0.04, 0.6, 0.04], [-1.02, 1.3, 0.55], 0x7f8c8d);
  box(group, [0.04, 0.6, 0.04], [1.02, 1.3, 0.55], 0x7f8c8d);

  // Red warmer heat lamp above
  cylinder(
    group,
    0.2,
    0.28,
    0.25,
    12,
    [0, 1.65, 0],
    WAREHOUSE_COLORS.redTeam,
    true,
  );
  box(group, [0.05, 0.65, 0.05], [0, 1.35, -0.4], 0x7f8c8d);
  box(group, [0.05, 0.05, 0.45], [0, 1.65, -0.2], 0x7f8c8d);

  // Red glow bulb
  const bulbGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0, 1.55, 0);
  group.add(bulb);

  // Cutting board & serving tray
  box(group, [0.75, 0.04, 0.5], [0, 1.04, 0.05], 0xf5cd79, true);

  // Kiosk banner sign
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e84118';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fbc531';
  ctx.font = 'bold 44px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FREE SAMPLE STATION', 256, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Fredoka, sans-serif';
  ctx.fillText(sampleName.toUpperCase(), 256, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshBasicMaterial({ map: tex });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), bannerMat);
  banner.position.set(0, 0.5, 0.61);
  group.add(banner);

  return group;
}

/**
 * Detailed Shopping Cart model with squeaky wobbly wheel rig
 */
export type CartMeshRig = {
  root: THREE.Group;
  basket: THREE.Group;
  wobblyWheel: THREE.Mesh;
  rightFrontWheel: THREE.Mesh;
  rearWheels: THREE.Mesh[];
  grabberAssembly: THREE.Group;
  grabberClaws: THREE.Object3D;
  grabberJawLeft: THREE.Group;
  grabberJawRight: THREE.Group;
  bumperMesh: THREE.Mesh;
  flagMesh: THREE.Mesh;
  driverAnchor: THREE.Object3D;
  riderAnchor: THREE.Object3D;
};

export function createShoppingCart(team: TeamId): CartMeshRig {
  const root = new THREE.Group();
  const teamColor = TEAM_HEX[team];

  // Lower tubular steel chassis frame
  const chassis = new THREE.Group();
  root.add(chassis);

  // Main chassis bars
  box(
    chassis,
    [1.1, 0.06, 0.06],
    [0, 0.22, 0.42],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    chassis,
    [1.1, 0.06, 0.06],
    [0, 0.22, -0.42],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    chassis,
    [0.06, 0.06, 0.88],
    [0.52, 0.22, 0],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    chassis,
    [0.06, 0.06, 0.88],
    [-0.52, 0.22, 0],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );

  // Bottom wire tray
  box(
    chassis,
    [0.96, 0.02, 0.76],
    [0, 0.24, 0],
    WAREHOUSE_COLORS.wireDeck,
    true,
    0.8,
  );

  // Team colored bumper guard along perimeter
  const bumperMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.35,
  });
  const bumperGeo = new RoundedBoxGeometry(1.26, 0.1, 1.02, 2, 0.04);
  const bumperMesh = new THREE.Mesh(bumperGeo, bumperMat);
  bumperMesh.position.set(0, 0.28, 0);
  bumperMesh.castShadow = true;
  root.add(bumperMesh);

  // Upper Basket wire cage
  const basket = new THREE.Group();
  basket.position.set(0, 0.35, 0);
  root.add(basket);

  // Basket bottom
  box(
    basket,
    [1.14, 0.03, 0.9],
    [0, 0, 0],
    WAREHOUSE_COLORS.wireDeck,
    true,
    0.8,
  );

  // Wire basket sides (semi-transparent metallic wire netting)
  const wireMat = new THREE.MeshStandardMaterial({
    color: WAREHOUSE_COLORS.cartSteel,
    roughness: 0.4,
    metalness: 0.7,
    wireframe: true,
  });

  const frontWire = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.65, 0.9),
    wireMat,
  );
  frontWire.position.set(0.57, 0.32, 0);
  basket.add(frontWire);

  const backWire = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.65, 0.9),
    wireMat,
  );
  backWire.position.set(-0.57, 0.32, 0);
  basket.add(backWire);

  const leftWire = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.65, 0.02),
    wireMat,
  );
  leftWire.position.set(0, 0.32, 0.45);
  basket.add(leftWire);

  const rightWire = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.65, 0.02),
    wireMat,
  );
  rightWire.position.set(0, 0.32, -0.45);
  basket.add(rightWire);

  // Top rim tubular lip
  box(
    basket,
    [1.16, 0.05, 0.05],
    [0, 0.65, 0.45],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    basket,
    [1.16, 0.05, 0.05],
    [0, 0.65, -0.45],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    basket,
    [0.05, 0.05, 0.92],
    [0.57, 0.65, 0],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    basket,
    [0.05, 0.05, 0.92],
    [-0.57, 0.65, 0],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );

  // Push handle at the back
  box(
    root,
    [0.05, 0.55, 0.05],
    [-0.65, 0.9, 0.4],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  box(
    root,
    [0.05, 0.55, 0.05],
    [-0.65, 0.9, -0.4],
    WAREHOUSE_COLORS.cartSteel,
    true,
    0.3,
    0.8,
  );
  // Red/Team plastic grip bar
  const grip = roundedBox(
    root,
    [0.08, 0.08, 0.88],
    [-0.72, 1.15, 0],
    teamColor,
    0.03,
  );
  grip.name = 'cart-handle';

  // 4 Wheels:
  // Rear fixed wheels (sturdy, black rubber with chrome hub)
  const rearWheels: THREE.Mesh[] = [];
  for (const zSide of [-0.38, 0.38]) {
    const w = cylinder(
      root,
      0.11,
      0.11,
      0.08,
      16,
      [-0.46, 0.11, zSide],
      0x2d3436,
      true,
    );
    w.rotation.x = Math.PI / 2;
    rearWheels.push(w);
  }

  // Front-right caster wheel (smooth rotating)
  const rightFrontWheel = cylinder(
    root,
    0.09,
    0.09,
    0.07,
    16,
    [0.46, 0.09, -0.38],
    0x2d3436,
    true,
  );
  rightFrontWheel.rotation.x = Math.PI / 2;

  // Front-left wobbly squeaky wheel (crooked pivot, off-center, red taped hubcap)
  const wobblyWheel = cylinder(
    root,
    0.09,
    0.09,
    0.07,
    16,
    [0.46, 0.09, 0.38],
    0x718093,
    true,
  );
  wobblyWheel.rotation.x = Math.PI / 2;
  wobblyWheel.rotation.y = 0.25; // Pre-crooked!

  // Oversized Trash-Grabber Pole held by basket rider
  const grabberAssembly = new THREE.Group();
  grabberAssembly.position.set(0.1, 0.85, 0);
  root.add(grabberAssembly);

  // Extendable scissor/rod shaft
  box(
    grabberAssembly,
    [1.4, 0.06, 0.06],
    [0.7, 0, 0],
    WAREHOUSE_COLORS.safetyYellow,
    true,
    0.5,
  );
  // Articulated mechanical grabber claw head
  const grabberClaws = new THREE.Group();
  grabberClaws.position.set(1.4, 0, 0);
  grabberAssembly.add(grabberClaws);

  // Central hinge bracket
  box(grabberClaws, [0.12, 0.12, 0.14], [0, 0, 0], 0x2c3e50, true);

  // Left pincer jaw
  const grabberJawLeft = new THREE.Group();
  grabberJawLeft.position.set(0.06, 0, 0.07);
  box(grabberJawLeft, [0.18, 0.06, 0.04], [0.09, 0, 0], 0xd63031, true);
  cylinder(
    grabberJawLeft,
    0.035,
    0.035,
    0.04,
    8,
    [0.18, 0, -0.02],
    0x1e272e,
    true,
  );
  grabberClaws.add(grabberJawLeft);

  // Right pincer jaw
  const grabberJawRight = new THREE.Group();
  grabberJawRight.position.set(0.06, 0, -0.07);
  box(grabberJawRight, [0.18, 0.06, 0.04], [0.09, 0, 0], 0xd63031, true);
  cylinder(
    grabberJawRight,
    0.035,
    0.035,
    0.04,
    8,
    [0.18, 0, 0.02],
    0x1e272e,
    true,
  );
  grabberClaws.add(grabberJawRight);

  // Team Flag
  cylinder(root, 0.02, 0.02, 1.6, 8, [-0.56, 1.6, 0.42], 0x718093, true);
  const flagMesh = box(
    root,
    [0.45, 0.3, 0.02],
    [-0.34, 2.25, 0.42],
    teamColor,
    true,
  );

  // Avatar anchors
  const driverAnchor = new THREE.Object3D();
  driverAnchor.position.set(-1.05, 0, 0); // Behind the cart pushing
  root.add(driverAnchor);

  const riderAnchor = new THREE.Object3D();
  riderAnchor.position.set(0, 0.4, 0); // Sitting inside the basket
  root.add(riderAnchor);

  return {
    root,
    basket,
    wobblyWheel,
    rightFrontWheel,
    rearWheels,
    grabberAssembly,
    grabberClaws,
    grabberJawLeft,
    grabberJawRight,
    bumperMesh,
    flagMesh,
    driverAnchor,
    riderAnchor,
  };
}

/**
 * 3D Models for all Bulk Items and Samples
 */
export function createItemMesh(kind: ItemKind): THREE.Group {
  const group = new THREE.Group();

  switch (kind) {
    case 'paper_towels': {
      // 100-pack toilet paper / towels: wrapped bundle of white rolls
      const bundle = roundedBox(
        group,
        [0.85, 0.65, 0.58],
        [0, 0.325, 0],
        0xf5f6fa,
        0.06,
      );
      // Plastic wrap sheen
      (bundle.material as THREE.MeshStandardMaterial).roughness = 0.25;
      (bundle.material as THREE.MeshStandardMaterial).metalness = 0.05;
      // Blue label band
      box(group, [0.86, 0.22, 0.59], [0, 0.325, 0], 0x0984e3);
      break;
    }

    case 'kibble_50lb': {
      // 50lb Big Dog Kibble: Heavy tapered sack
      const sack = roundedBox(
        group,
        [0.65, 0.42, 0.75],
        [0, 0.21, 0],
        0xd35400,
        0.08,
      );
      (sack.material as THREE.MeshStandardMaterial).roughness = 0.9;
      // Printed dog paw / bone badge
      cylinder(group, 0.14, 0.14, 0.03, 12, [0, 0.43, 0], 0xf5cd79);
      break;
    }

    case 'mega_soda': {
      // 80-pack mega soda crate
      roundedBox(group, [0.72, 0.46, 0.62], [0, 0.23, 0], 0xd63031, 0.04);
      // Rows of shiny aluminum can tops
      for (let x = -0.25; x <= 0.25; x += 0.17) {
        for (let z = -0.2; z <= 0.2; z += 0.14) {
          cylinder(
            group,
            0.055,
            0.055,
            0.02,
            10,
            [x, 0.47, z],
            0xdfe6e9,
            false,
            0.2,
            0.8,
          );
        }
      }
      break;
    }

    case 'cereal_box': {
      // Jumbo Sugar Loops box
      roundedBox(group, [0.42, 0.58, 0.28], [0, 0.29, 0], 0xf39c12, 0.02);
      // Colorful cereal bowl graphic on front
      cylinder(group, 0.12, 0.08, 0.02, 12, [0, 0.25, 0.145], 0x9b59b6);
      break;
    }

    case 'giant_teddy': {
      // 10-Foot Giant Teddy Bear (Sabotage contraband item!)
      // Huge chubby body
      cylinder(group, 0.35, 0.45, 0.7, 12, [0, 0.45, 0], 0x8b5a2b);
      // Giant round head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }),
      );
      head.position.set(0, 0.95, 0);
      head.castShadow = true;
      group.add(head);

      // Bear Ears
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x6e451f, roughness: 0.9 }),
        );
        ear.position.set(side * 0.26, 1.2, 0);
        group.add(ear);
      }

      // Snout
      const snout = cylinder(
        group,
        0.12,
        0.12,
        0.1,
        10,
        [0, 0.9, 0.25],
        0xdfb180,
      );
      snout.rotation.x = Math.PI / 2;

      // Floppy arms
      for (const side of [-1, 1]) {
        const arm = cylinder(
          group,
          0.12,
          0.1,
          0.55,
          8,
          [side * 0.45, 0.55, 0.1],
          0x8b5a2b,
        );
        arm.rotation.z = side * 0.4;
      }
      break;
    }

    case 'sample_taquito': {
      // Crispy fried taquito on small paper boat
      box(group, [0.36, 0.04, 0.22], [0, 0.02, 0], 0xffffff); // paper boat
      const roll = cylinder(
        group,
        0.045,
        0.045,
        0.3,
        10,
        [0, 0.07, 0],
        0xd35400,
      );
      roll.rotation.z = Math.PI / 2;
      break;
    }

    case 'sample_pizza_bagel': {
      // Mini pizza bagel
      box(group, [0.32, 0.03, 0.32], [0, 0.015, 0], 0xffffff);
      cylinder(group, 0.12, 0.12, 0.05, 12, [0, 0.05, 0], 0xf5cd79);
      // Sauce & cheese topping
      cylinder(group, 0.09, 0.09, 0.02, 12, [0, 0.08, 0], 0xe74c3c);
      break;
    }

    case 'sample_churro': {
      // Golden cinnamon churro loop
      box(group, [0.35, 0.03, 0.22], [0, 0.015, 0], 0xffffff);
      const churro = cylinder(
        group,
        0.04,
        0.04,
        0.28,
        8,
        [0, 0.06, 0],
        0xe67e22,
      );
      churro.rotation.z = Math.PI / 2;
      break;
    }

    case 'sample_cheese': {
      // Cheese cube on paper plate with toothpick
      box(group, [0.26, 0.02, 0.26], [0, 0.01, 0], 0xffffff);
      box(group, [0.12, 0.12, 0.12], [0, 0.08, 0], 0xf1c40f);
      cylinder(group, 0.008, 0.008, 0.16, 6, [0, 0.2, 0], 0xdfe6e9);
      break;
    }
  }

  return group;
}

/**
 * Slippery Paper Plate Hazard model
 */
export function createPaperPlateHazard(kind: 'plate' | 'spill'): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'plate') {
    // Round white paper plate
    cylinder(group, 0.36, 0.32, 0.02, 16, [0, 0.01, 0], 0xf8f9fa);
    // Ketchup / mustard grease stain
    cylinder(group, 0.14, 0.14, 0.01, 10, [0.06, 0.025, 0.04], 0xd63031);
  } else {
    // Salsa / drink spill puddle
    const spillGeo = new THREE.CircleGeometry(0.55, 14);
    const spillMat = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      roughness: 0.1,
      metalness: 0.2,
    });
    const puddle = new THREE.Mesh(spillGeo, spillMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.01;
    puddle.receiveShadow = true;
    group.add(puddle);
  }

  return group;
}

/**
 * Exit Receipt Gauntlet Checkout Counter & Gate with overhead LED gantry
 */
export function createExitGauntlet(): THREE.Group {
  const group = new THREE.Group();

  // Polished barrier railings
  cylinder(group, 0.06, 0.06, 1.2, 8, [-4.5, 0.6, 0], 0xbdc3c7);
  cylinder(group, 0.06, 0.06, 1.2, 8, [4.5, 0.6, 0], 0xbdc3c7);
  cylinder(group, 0.06, 0.06, 1.2, 8, [0, 0.6, 0], 0xbdc3c7);

  // Inspector Desk
  box(group, [1.4, 1.05, 0.8], [0, 0.525, 0], 0x2c3e50, true);
  // Clipboard
  box(group, [0.35, 0.03, 0.45], [0, 1.08, 0], 0xd35400);
  // Big Red Marker
  cylinder(group, 0.02, 0.02, 0.16, 8, [0.22, 1.1, 0], 0xe74c3c);

  // Overhead Steel Gantry Columns & Truss Beam
  box(
    group,
    [0.22, 4.4, 0.22],
    [-4.5, 2.2, 0],
    WAREHOUSE_COLORS.rackBlue,
    true,
  );
  box(group, [0.22, 4.4, 0.22], [4.5, 2.2, 0], WAREHOUSE_COLORS.rackBlue, true);
  box(group, [9.2, 0.25, 0.25], [0, 4.3, 0], WAREHOUSE_COLORS.rackOrange, true);

  // Flashing Status Beacon Lights (Green checkout ready, Red alarm)
  const beaconGreenGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12);
  const beaconGreenMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
  const beaconG1 = new THREE.Mesh(beaconGreenGeo, beaconGreenMat);
  beaconG1.position.set(-2.2, 4.5, 0);
  group.add(beaconG1);

  const beaconG2 = new THREE.Mesh(beaconGreenGeo, beaconGreenMat);
  beaconG2.position.set(2.2, 4.5, 0);
  group.add(beaconG2);

  const beaconRedGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12);
  const beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
  const beaconR = new THREE.Mesh(beaconRedGeo, beaconRedMat);
  beaconR.position.set(0, 4.5, 0);
  group.add(beaconR);

  // Red barcode scanner laser line projector across the floor
  const laserGeo = new THREE.PlaneGeometry(8.0, 0.04);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xff3838,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const laser = new THREE.Mesh(laserGeo, laserMat);
  laser.rotation.x = -Math.PI / 2;
  laser.position.set(0, 0.02, 0);
  group.add(laser);

  // Hanging Illuminated Sign
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 50px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT RECEIPT CHECK', 256, 46);
  ctx.font = 'bold 30px Fredoka, sans-serif';
  ctx.fillText('HAVE CART READY FOR INSPECTION', 256, 95);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 0.95),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  signMesh.position.set(0, 3.4, 0);
  group.add(signMesh);

  return group;
}

/**
 * High-bay industrial warehouse pendant lamp
 */
export function createWarehouseLightFixture(): THREE.Group {
  const group = new THREE.Group();

  // Suspension rod / cable
  cylinder(group, 0.02, 0.02, 3.0, 6, [0, 1.5, 0], 0x34495e, false);

  // Aluminum bell reflector shade
  const shadeGeo = new THREE.CylinderGeometry(0.18, 0.65, 0.45, 16, 1, true);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x95a5a6,
    metalness: 0.6,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.set(0, 0, 0);
  shade.castShadow = true;
  group.add(shade);

  // Glowing bulb inside
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0, 0.08, 0);
  group.add(bulb);

  // Soft translucent downlight disc on the lamp rim
  const diskGeo = new THREE.CircleGeometry(0.62, 16);
  const diskMat = new THREE.MeshBasicMaterial({
    color: 0xfffae6,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2;
  disk.position.set(0, -0.22, 0);
  group.add(disk);

  return group;
}
