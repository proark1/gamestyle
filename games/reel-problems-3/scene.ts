import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { worker as gameAvatar } from '../../shared/rendering/worker';
import {
  BELL_STATION,
  ISLAND_BOAT_Z,
  ISLAND_CENTER_Z,
  ISLAND_GANGWAY_LENGTH,
  ISLAND_GANGWAY_Z,
  islandScenery,
} from './physics-layout';
import type { AdventureSnapshot, AdventureWorld } from './types';

const PALETTE = {
  ink: '#173e46',
  sea: '#4d928d',
  amber: '#f0ad55',
  rain: '#55778b',
  coral: '#d96f56',
  foam: '#f4eedb',
  glow: '#79edcf',
  grass: '#6f956e',
  darkGrass: '#416d62',
  wood: '#8b6048',
  stone: '#718680',
} as const;

type Interactive = T.Object3D & { userData: { target?: string } };

function clay(
  color: string,
  extra: Partial<T.MeshStandardMaterialParameters> = {},
) {
  return new T.MeshStandardMaterial({
    color,
    roughness: 0.84,
    metalness: 0,
    flatShading: true,
    ...extra,
  });
}

function box(
  parent: T.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size, 2, 2, 2), clay(color));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(
  parent: T.Object3D,
  scale: [number, number, number],
  position: [number, number, number],
  color: string,
  emissive?: string,
) {
  const mesh = new T.Mesh(
    new T.SphereGeometry(1, 18, 12),
    clay(color, emissive ? { emissive, emissiveIntensity: 1.6 } : {}),
  );
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: T.Object3D,
  top: number,
  bottom: number,
  height: number,
  position: [number, number, number],
  color: string,
  sides = 10,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(top, bottom, height, sides),
    clay(color),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function beam(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  width: number,
  color: string,
) {
  const mesh = box(parent, [width, a.distanceTo(b), width], [0, 0, 0], color);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  return mesh;
}

function makeLabel(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#173e46dd';
  context.beginPath();
  context.roundRect(8, 8, 496, 112, 34);
  context.fill();
  context.strokeStyle = '#f0ad55';
  context.lineWidth = 6;
  context.stroke();
  context.fillStyle = '#f4eedb';
  context.font = '700 45px DM Sans, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66, 455);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, transparent: true }),
  );
  sprite.scale.set(2.8, 0.7, 1);
  return sprite;
}

function makeBell(scale = 1) {
  const bell = new T.Group();
  bell.scale.setScalar(scale);
  const profile = [
    new T.Vector2(0.13, 0.53),
    new T.Vector2(0.22, 0.48),
    new T.Vector2(0.29, 0.32),
    new T.Vector2(0.33, 0.04),
    new T.Vector2(0.42, -0.25),
    new T.Vector2(0.56, -0.39),
    new T.Vector2(0.62, -0.44),
  ];
  const shell = new T.Mesh(
    new T.LatheGeometry(profile, 18),
    clay('#c98b43', { metalness: 0.18, roughness: 0.58 }),
  );
  shell.name = 'bell-shell';
  shell.castShadow = true;
  bell.add(shell);
  const mouth = new T.Mesh(
    new T.CylinderGeometry(0.51, 0.58, 0.07, 18),
    clay('#513d38', { roughness: 0.68 }),
  );
  mouth.position.y = -0.42;
  bell.add(mouth);
  cylinder(bell, 0.045, 0.055, 0.42, [0, -0.43, 0], '#604238', 10);
  sphere(bell, [0.1, 0.11, 0.1], [0, -0.67, 0], '#76503a');
  const crown = new T.Mesh(
    new T.TorusGeometry(0.12, 0.045, 7, 14),
    clay('#a96735', { metalness: 0.14, roughness: 0.62 }),
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.58;
  bell.add(crown);
  return bell;
}

function addInteractionVolume(
  root: T.Object3D,
  target: string,
  size: [number, number, number],
  position: [number, number, number],
) {
  const volume = new T.Mesh(
    new T.BoxGeometry(...size),
    new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  volume.position.set(...position);
  volume.userData.target = target;
  root.add(volume);
  return volume;
}

function addMarker(
  parent: T.Object3D,
  target: string,
  label: string,
  position: [number, number, number],
  shape: 'box' | 'wheel' | 'bell' = 'box',
) {
  const root = new T.Group() as Interactive;
  root.position.set(...position);
  root.userData.target = target;
  parent.add(root);
  let hit: T.Mesh;
  if (shape === 'wheel') {
    hit = new T.Mesh(
      new T.TorusGeometry(0.62, 0.09, 8, 18),
      clay(PALETTE.wood),
    );
    hit.rotation.y = Math.PI / 2;
    root.add(hit);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      beam(
        root,
        new T.Vector3(0, 0, 0),
        new T.Vector3(0, Math.cos(angle) * 0.75, Math.sin(angle) * 0.75),
        0.07,
        PALETTE.wood,
      );
    }
  } else if (shape === 'bell') {
    const bell = makeBell(0.74);
    root.add(bell);
    hit = bell.getObjectByName('bell-shell') as T.Mesh;
  } else {
    hit = new T.Mesh(new T.BoxGeometry(0.95, 0.65, 0.75), clay(PALETTE.amber));
    root.add(hit);
  }
  root.traverse((object) => {
    object.userData.target = target;
  });
  hit.castShadow = true;
  const ring = new T.Mesh(
    new T.TorusGeometry(0.74, 0.045, 8, 32),
    new T.MeshBasicMaterial({
      color: PALETTE.amber,
      transparent: true,
      opacity: 0.72,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.47;
  ring.userData.target = target;
  ring.userData.markerRing = true;
  root.add(ring);
  const sign = makeLabel(label);
  sign.position.y = 1.2;
  sign.userData.target = target;
  root.add(sign);
  addInteractionVolume(root, target, [1.5, 2.25, 1.3], [0, 0.48, 0]);
  return root;
}

function addBellStation(parent: T.Object3D) {
  const root = new T.Group() as Interactive;
  root.position.set(BELL_STATION.x, 0, BELL_STATION.z);
  root.userData.target = 'beacon-bell';
  parent.add(root);
  box(root, [0.28, 2.9, 0.5], [-0.82, 1.45, 0], PALETTE.wood);
  box(root, [0.28, 2.9, 0.5], [0.82, 1.45, 0], PALETTE.wood);
  box(root, [2.05, 0.3, 0.58], [0, 2.83, 0], '#704b38');
  box(root, [0.82, 0.24, 0.44], [0, 2.52, 0], '#5d4437');
  const bell = makeBell(0.9);
  bell.position.y = 1.95;
  root.add(bell);
  const rope = cylinder(
    root,
    0.035,
    0.035,
    1.45,
    [0.38, 0.94, 0],
    '#d7bd82',
    8,
  );
  rope.rotation.z = -0.035;
  sphere(root, [0.085, 0.12, 0.085], [0.38, 0.18, 0], '#d7bd82');
  const ring = new T.Mesh(
    new T.TorusGeometry(1.18, 0.045, 8, 32),
    new T.MeshBasicMaterial({
      color: PALETTE.amber,
      transparent: true,
      opacity: 0.72,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  ring.userData.markerRing = true;
  root.add(ring);
  const sign = makeLabel('RING BEACON');
  sign.position.y = 3.72;
  root.add(sign);
  addInteractionVolume(root, 'beacon-bell', [2.25, 3.45, 1.35], [0, 1.58, 0]);
  root.traverse((object) => {
    object.userData.target = 'beacon-bell';
  });
  return root;
}

function addBoat(
  parent: T.Object3D,
  position: [number, number, number] = [0, 0, 6],
  shoreOpening = false,
) {
  const boat = new T.Group();
  boat.position.set(...position);
  parent.add(boat);
  box(boat, [6.3, 0.38, 7.4], [0, -0.12, 0], '#bd805c');
  if (shoreOpening) {
    box(boat, [1.85, 1.2, 0.28], [-2.45, 0.25, -3.45], PALETTE.coral);
    box(boat, [1.85, 1.2, 0.28], [2.45, 0.25, -3.45], PALETTE.coral);
  } else box(boat, [6.8, 1.2, 0.28], [0, 0.25, -3.45], PALETTE.coral);
  box(boat, [6.8, 1.2, 0.28], [0, 0.25, 3.45], PALETTE.coral);
  box(boat, [0.28, 1.1, 6.65], [-3.2, 0.24, 0], PALETTE.coral);
  box(boat, [0.28, 1.1, 6.65], [3.2, 0.24, 0], PALETTE.coral);
  box(boat, [1.15, 0.7, 0.9], [-1.72, 0.42, -1.95], PALETTE.ink);
  cylinder(boat, 0.11, 0.14, 5.6, [0, 2.55, 0.55], PALETTE.wood, 10);
  const sail = new T.Mesh(
    new T.PlaneGeometry(3.2, 2.9),
    clay(PALETTE.foam, { side: T.DoubleSide }),
  );
  sail.position.set(1.65, 3, 0.58);
  sail.rotation.y = -0.05;
  boat.add(sail);
  return boat;
}

function addIslandGangway(parent: T.Object3D) {
  const start = ISLAND_GANGWAY_Z - ISLAND_GANGWAY_LENGTH / 2;
  const plankCount = 8;
  for (let index = 0; index < plankCount; index++) {
    const progress = index / (plankCount - 1);
    box(
      parent,
      [2.74, 0.14, 0.36],
      [0, 0.5 - progress * 0.66, start + progress * ISLAND_GANGWAY_LENGTH],
      index % 2 ? '#9b6b4b' : '#aa7652',
      [0, ((index % 3) - 1) * 0.015, 0],
    );
  }
  for (const side of [-1, 1]) {
    for (const progress of [0.08, 0.5, 0.92]) {
      const z = start + progress * ISLAND_GANGWAY_LENGTH;
      const y = 0.5 - progress * 0.66;
      cylinder(
        parent,
        0.07,
        0.09,
        1.3,
        [side * 1.42, y + 0.54, z],
        PALETTE.wood,
        8,
      );
    }
    beam(
      parent,
      new T.Vector3(side * 1.42, 1.2, start),
      new T.Vector3(side * 1.42, 0.5, start + ISLAND_GANGWAY_LENGTH),
      0.045,
      '#d7bd82',
    );
  }
}

function addHarbor(parent: T.Object3D, loaded: string[]) {
  const dock = box(parent, [17, 0.45, 13], [0, -0.2, 1], '#987154');
  dock.receiveShadow = true;
  for (let x = -7; x <= 7; x += 2) {
    box(parent, [0.12, 0.03, 12.2], [x, 0.04, 1], '#684a3b');
  }
  for (let i = 0; i < 5; i++) {
    const x = -12 + i * 6;
    const house = new T.Group();
    house.position.set(x, 0, -8 - (i % 2) * 1.7);
    parent.add(house);
    box(house, [4.4, 4 + (i % 2), 4], [0, 2, 0], i % 2 ? '#d5a06f' : '#d88368');
    const roof = new T.Mesh(
      new T.ConeGeometry(3.5, 2.2, 4),
      clay(i % 2 ? '#315b5b' : '#663f42'),
    );
    roof.position.y = 5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    box(house, [0.9, 1.8, 0.16], [0, 1.4, 2.06], '#355c60');
    for (const windowX of [-1.25, 1.25])
      box(house, [0.78, 0.8, 0.12], [windowX, 2.7, 2.08], PALETTE.amber);
  }
  addBoat(parent, [0, -0.35, 10.5], true);
  const stations: [string, string, [number, number, number]][] = [
    ['rope', 'ROPE', [-5.1, 0.62, 0.2]],
    ['lanterns', 'LANTERNS', [-1.7, 0.62, -0.6]],
    ['timber', 'TIMBER', [1.7, 0.62, -0.6]],
    ['chart', 'CHART', [5.1, 0.62, 0.2]],
  ];
  for (const [id, label, position] of stations)
    if (!loaded.includes(id))
      addMarker(parent, `supply-${id}`, label, position);
  for (const [index, x] of [-8, -6, -4, 4, 6, 8].entries()) {
    const post = cylinder(
      parent,
      0.13,
      0.16,
      2.2,
      [x, 0.75, 7],
      PALETTE.wood,
      9,
    );
    post.rotation.z = (index % 2 ? 1 : -1) * 0.025;
  }
}

function addIsland(parent: T.Object3D, index: number, active: boolean) {
  const variants = [
    { ground: '#738d6f', rock: '#657875', accent: '#d8bd78' },
    { ground: '#5f8575', rock: '#536b6c', accent: '#8bc7b5' },
    { ground: '#68865e', rock: '#5e7169', accent: '#d5896d' },
  ][index] ?? {
    ground: PALETTE.grass,
    rock: PALETTE.stone,
    accent: PALETTE.amber,
  };
  cylinder(parent, 13, 15, 1.6, [0, -0.8, ISLAND_CENTER_Z], variants.rock, 16);
  cylinder(
    parent,
    12.5,
    13,
    0.5,
    [0, 0.15, ISLAND_CENTER_Z],
    variants.ground,
    18,
  );
  addBoat(parent, [0, -0.35, ISLAND_BOAT_Z], true);
  addIslandGangway(parent);
  const tower = new T.Group();
  tower.position.set(0, 0, -4.2);
  parent.add(tower);
  cylinder(tower, 1.65, 2.35, 6, [0, 3, 0], '#9a9b85', 12);
  cylinder(tower, 2.1, 2.1, 0.45, [0, 6.2, 0], variants.accent, 12);
  const lens = sphere(
    tower,
    [0.68, 0.68, 0.68],
    [0, 6.75, 0],
    active ? PALETTE.glow : '#73948c',
    active ? PALETTE.glow : undefined,
  );
  if (active) {
    const light = new T.PointLight(PALETTE.glow, 12, 24, 1.6);
    light.position.copy(lens.position);
    tower.add(light);
  }
  for (const item of islandScenery()) {
    const rock = sphere(
      parent,
      item.rockScale,
      [item.x, 0.55, item.z],
      variants.rock,
    );
    const itemNumber = Number(item.id.slice('island-rock-'.length));
    rock.rotation.set(itemNumber * 0.11, item.angle, itemNumber * 0.07);
    if (item.tree) {
      const trunk = cylinder(
        parent,
        0.13,
        0.18,
        1.3,
        [item.tree.x, 1.2, item.tree.z],
        PALETTE.wood,
        8,
      );
      sphere(
        parent,
        [0.75, 1, 0.75],
        [item.tree.x, 2.1, item.tree.z],
        index === 1 ? '#4b746c' : '#668858',
      );
      trunk.rotation.z = Math.sin(item.angle) * 0.08;
    }
  }
  if (!active) {
    addMarker(parent, 'beacon-crank', 'ALIGN LENS', [-2.2, 1.2, -2.6], 'wheel');
    addBellStation(parent);
  } else
    addMarker(
      parent,
      'helm',
      'NEXT ISLAND',
      [-1.72, 1.05, ISLAND_BOAT_Z - 1.95],
      'wheel',
    );
}

function addStorm(parent: T.Object3D, world: AdventureWorld) {
  addBoat(parent, [0, -0.35, 1.5]);
  addMarker(parent, 'helm', 'HOLD COURSE', [0, 1.2, -0.9], 'wheel');
  addMarker(parent, 'repair', 'PATCH + BAIL', [-2.25, 0.74, 3.2]);
  if (world.players.some((player) => player.overboard))
    addMarker(parent, 'rescue-rope', 'RESCUE LINE', [2.25, 0.86, 3.2]);
  for (let i = 0; i < 20; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -40 + i * 5.5;
    sphere(
      parent,
      [2 + (i % 3), 2.5 + (i % 4), 2.4],
      [side * (10 + (i % 4) * 3), 0.3, z],
      '#405d62',
    );
  }
}

function addSanctuary(parent: T.Object3D, world: AdventureWorld) {
  addBoat(parent, [0, -0.35, 2.5]);
  for (let i = 0; i < 44; i++) {
    const angle = (i / 44) * Math.PI * 2;
    const radius = 17 + (i % 5) * 0.8;
    const height = 2 + (i % 7) * 0.8;
    const rock = sphere(
      parent,
      [2.2, height, 2.1],
      [Math.cos(angle) * radius, height - 1, Math.sin(angle) * radius],
      i % 3 ? '#456d68' : '#5b7770',
    );
    rock.rotation.y = angle;
  }
  const lanterns: [string, [number, number, number]][] = [
    ['port', [-2.3, 1.05, 1.2]],
    ['bow', [0, 1.05, -0.5]],
    ['starboard', [2.3, 1.05, 1.2]],
  ];
  for (const [socket, position] of lanterns) {
    if (!world.lanterns.includes(socket))
      addMarker(parent, `lantern-${socket}`, 'PLACE LIGHT', position);
    else {
      sphere(
        parent,
        [0.25, 0.38, 0.25],
        position,
        PALETTE.amber,
        PALETTE.amber,
      );
      const light = new T.PointLight(PALETTE.amber, 4, 10, 2);
      light.position.set(...position);
      parent.add(light);
    }
  }
  if (world.lanterns.length === 3) {
    for (let i = 0; i < 3; i++)
      addMarker(
        parent,
        `tone-${i}`,
        ['LOW', 'CLEAR', 'HIGH'][i],
        [-2.4 + i * 2.4, 1.2, 4.7],
        'bell',
      );
  }
  for (let i = 0; i < 30; i++) {
    const angle = i * 1.83;
    sphere(
      parent,
      [0.08, 0.08, 0.08],
      [
        Math.cos(angle) * (4 + (i % 9)),
        1 + (i % 6) * 0.7,
        Math.sin(angle) * (4 + (i % 9)),
      ],
      PALETTE.glow,
      PALETTE.glow,
    );
  }
}

function addHomecoming(parent: T.Object3D) {
  addHarbor(parent, ['rope', 'lanterns', 'timber', 'chart']);
  for (let i = 0; i < 10; i++)
    sphere(
      parent,
      [0.12, 0.12, 0.12],
      [-8 + i * 1.8, 3 + (i % 3), -5],
      PALETTE.amber,
      PALETTE.amber,
    );
}

function makeWater() {
  const geometry = new T.PlaneGeometry(120, 120, 52, 52);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new T.Mesh(
    geometry,
    new T.MeshPhysicalMaterial({
      color: PALETTE.sea,
      roughness: 0.28,
      metalness: 0.04,
      transmission: 0.08,
      transparent: true,
      opacity: 0.96,
    }),
  );
  mesh.position.y = -0.72;
  mesh.receiveShadow = true;
  mesh.userData.basePositions = Float32Array.from(
    geometry.attributes.position.array as Iterable<number>,
  );
  return mesh;
}

function makeFish() {
  const fish = new T.Group();
  sphere(fish, [2.8, 0.9, 0.9], [0, 0, 0], PALETTE.glow, PALETTE.glow);
  sphere(fish, [0.8, 0.55, 0.55], [-2.6, 0, 0], '#9af5dc', PALETTE.glow);
  const tail = new T.Mesh(
    new T.ConeGeometry(1.15, 2.2, 4),
    clay(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 1.25 }),
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -3.65;
  fish.add(tail);
  sphere(fish, [0.12, 0.12, 0.08], [2.15, 0.25, -0.72], PALETTE.ink);
  const light = new T.PointLight(PALETTE.glow, 14, 35, 1.5);
  fish.add(light);
  fish.userData.tail = tail;
  return fish;
}

function makeHands() {
  const hands = new T.Group();
  for (const side of [-1, 1]) {
    const limb = new T.Group();
    limb.name = side < 0 ? 'view-arm-left' : 'view-arm-right';
    limb.position.set(side * 0.45, -0.4, -0.7);
    limb.rotation.set(-1.02, -side * 0.07, side * 0.11);
    limb.userData.baseRotationX = limb.rotation.x;
    limb.userData.baseRotationZ = limb.rotation.z;
    hands.add(limb);
    const forearm = new T.Mesh(
      new T.CapsuleGeometry(0.115, 0.38, 6, 10),
      clay('#365d5a', { roughness: 0.78 }),
    );
    forearm.scale.set(1.12, 1, 0.94);
    forearm.castShadow = false;
    limb.add(forearm);
    const cuff = new T.Mesh(
      new T.CylinderGeometry(0.135, 0.12, 0.13, 10),
      clay('#284d50', { roughness: 0.8 }),
    );
    cuff.position.y = 0.26;
    limb.add(cuff);
    const palm = new T.Mesh(
      new T.SphereGeometry(0.15, 14, 10),
      clay('#dc9570', { roughness: 0.72 }),
    );
    palm.scale.set(0.9, 1.18, 0.62);
    palm.position.y = 0.42;
    limb.add(palm);
    const thumb = new T.Mesh(
      new T.CapsuleGeometry(0.038, 0.09, 4, 7),
      clay('#d58b68', { roughness: 0.72 }),
    );
    thumb.position.set(-side * 0.12, 0.42, 0.01);
    thumb.rotation.z = side * 0.74;
    limb.add(thumb);
    for (let finger = 0; finger < 4; finger++) {
      const knuckle = new T.Mesh(
        new T.SphereGeometry(0.037, 8, 6),
        clay(finger % 2 ? '#dc9570' : '#d9906c', { roughness: 0.72 }),
      );
      knuckle.scale.set(0.85, 1.2, 0.72);
      knuckle.position.set((finger - 1.5) * 0.054, 0.545, -0.006);
      limb.add(knuckle);
    }
  }
  return hands;
}

export class ReelProblems3Scene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(72, 1, 0.04, 180);
  private renderer: T.WebGLRenderer;
  private quality;
  private worldRoot = new T.Group();
  private water = makeWater();
  private fish = makeFish();
  private hands = makeHands();
  private rain = new T.Points();
  private interactables: Interactive[] = [];
  private avatars = new Map<string, T.Object3D>();
  private snapshot: AdventureSnapshot | null = null;
  private localId = 'local';
  private raycaster = new T.Raycaster();
  private yaw = 0;
  private pitch = 0;
  private currentTarget: string | null = null;
  private key = '';
  private frame = 0;
  private disposed = false;
  private reducedMotion = false;
  private resize: ResizeObserver;
  private onPointerMove: (event: PointerEvent) => void;
  private onPointerLock: () => void;
  private onCanvasClick: () => void;

  constructor(
    private host: HTMLElement,
    private onTarget: (target: string | null) => void,
  ) {
    const built = createRenderer(host, {
      label:
        'First-person cooperative sailing adventure. Use WASD to move, mouse to look, and E to interact.',
      shadows: 'soft',
      exposure: 1.08,
      weight: 'heavy',
    });
    this.renderer = built.renderer;
    this.quality = built.quality;
    this.scene.background = new T.Color('#9bc6c0');
    this.scene.fog = new T.FogExp2('#8ebbb6', 0.012);
    this.scene.add(this.worldRoot, this.water, this.fish);
    this.fish.visible = false;
    this.camera.add(this.hands);
    this.hands.scale.setScalar(0.76);
    this.scene.add(this.camera);

    const hemi = new T.HemisphereLight('#dff6ee', '#284d51', 2.1);
    this.scene.add(hemi);
    const sun = new T.DirectionalLight('#ffe4b1', 4.4);
    sun.position.set(-12, 22, 10);
    sun.castShadow = !this.quality.touch;
    sun.shadow.mapSize.set(
      this.quality.shadowMapSize,
      this.quality.shadowMapSize,
    );
    sun.shadow.camera.left = sun.shadow.camera.bottom = -28;
    sun.shadow.camera.right = sun.shadow.camera.top = 28;
    this.scene.add(sun);

    this.onPointerMove = (event) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.look(event.movementX, event.movementY);
    };
    this.onPointerLock = () =>
      this.host.classList.toggle(
        'is-looking',
        document.pointerLockElement === this.renderer.domElement,
      );
    this.onCanvasClick = () => {
      if (document.pointerLockElement !== this.renderer.domElement)
        void this.renderer.domElement.requestPointerLock?.();
    };
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.animate();
  }

  private fit() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setLocalPlayer(id: string) {
    this.localId = id;
  }

  setReducedMotion(value: boolean) {
    this.reducedMotion = value;
  }

  getYaw() {
    return this.yaw;
  }

  look(deltaX: number, deltaY: number) {
    const scale = 0.00225;
    this.yaw -= deltaX * scale;
    this.pitch = T.MathUtils.clamp(this.pitch - deltaY * scale, -1.18, 1.22);
  }

  target() {
    return this.currentTarget;
  }

  render(snapshot: AdventureSnapshot) {
    this.snapshot = snapshot;
    const { world } = snapshot;
    const rebuildKey = `${world.phase}:${world.beaconIndex}:${world.beacons[world.beaconIndex]?.active}:${world.loaded.join(',')}:${world.lanterns.join(',')}:${world.players.some((player) => player.overboard)}`;
    if (rebuildKey !== this.key) {
      this.key = rebuildKey;
      this.rebuild(world);
    }
    this.syncAvatars(world);
  }

  private rebuild(world: AdventureWorld) {
    this.scene.remove(this.worldRoot);
    disposeObject(this.worldRoot);
    this.worldRoot = new T.Group();
    this.scene.add(this.worldRoot);
    if (world.phase === 'harbor' || world.phase === 'lobby')
      addHarbor(this.worldRoot, world.loaded);
    else if (world.phase === 'search')
      addIsland(
        this.worldRoot,
        world.beaconIndex,
        !!world.beacons[world.beaconIndex]?.active,
      );
    else if (world.phase === 'storm') addStorm(this.worldRoot, world);
    else if (world.phase === 'sanctuary') addSanctuary(this.worldRoot, world);
    else addHomecoming(this.worldRoot);
    this.interactables = [];
    this.worldRoot.traverse((object) => {
      if (object.userData.target)
        this.interactables.push(object as Interactive);
    });
    this.fish.visible = [
      'storm',
      'sanctuary',
      'homecoming',
      'finished',
    ].includes(world.phase);
    this.configureMood(world.phase);
    this.makeRain(world.phase === 'storm');
  }

  private configureMood(phase: AdventureWorld['phase']) {
    const color =
      phase === 'storm'
        ? '#3f5966'
        : phase === 'sanctuary'
          ? '#173e46'
          : phase === 'homecoming' || phase === 'finished'
            ? '#efb77e'
            : '#9bc6c0';
    this.scene.background = new T.Color(color);
    this.scene.fog = new T.FogExp2(
      color,
      phase === 'storm' ? 0.026 : phase === 'sanctuary' ? 0.021 : 0.012,
    );
  }

  private makeRain(enabled: boolean) {
    this.scene.remove(this.rain);
    if (this.rain.geometry) this.rain.geometry.dispose();
    if (this.rain.material instanceof T.Material) this.rain.material.dispose();
    if (!enabled || this.reducedMotion) {
      this.rain = new T.Points();
      return;
    }
    const count = this.quality.touch ? 420 : 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = Math.random() * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 42;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    this.rain = new T.Points(
      geometry,
      new T.PointsMaterial({
        color: '#cbe3e6',
        size: 0.045,
        transparent: true,
        opacity: 0.68,
      }),
    );
    this.scene.add(this.rain);
  }

  private syncAvatars(world: AdventureWorld) {
    const keep = new Set<string>();
    for (const player of world.players) {
      if (player.id === this.localId) continue;
      keep.add(player.id);
      let avatar = this.avatars.get(player.id);
      if (!avatar) {
        avatar = gameAvatar(player.color, {
          shirt: ['#d96f56', '#f0ad55', '#4d928d', '#6576a8'][player.color % 4],
        });
        avatar.scale.setScalar(0.94);
        this.scene.add(avatar);
        this.avatars.set(player.id, avatar);
      }
      avatar.position.set(player.x, player.overboard ? -0.58 : 0, player.z);
      avatar.rotation.y = player.yaw + Math.PI;
      avatar.visible = world.phase !== 'lobby';
    }
    for (const [id, avatar] of this.avatars)
      if (!keep.has(id)) {
        this.scene.remove(avatar);
        disposeObject(avatar);
        this.avatars.delete(id);
      }
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const seconds = performance.now() / 1000;
    const world = this.snapshot?.world;
    const me = world?.players.find((player) => player.id === this.localId);
    if (me) {
      const walking = Math.hypot(me.input.x, me.input.z);
      const bob = this.reducedMotion
        ? 0
        : Math.sin(seconds * 9) * Math.min(0.025, walking * 0.025);
      this.camera.position.lerp(
        new T.Vector3(me.x, (me.overboard ? 0.18 : 1.58) + bob, me.z),
        0.32,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      this.hands.position.y = -0.085 + bob * 0.55;
      const sway = this.reducedMotion
        ? 0
        : Math.sin(seconds * 8.5) * Math.min(1, walking) * 0.022;
      for (const [name, direction] of [
        ['view-arm-left', 1],
        ['view-arm-right', -1],
      ] as const) {
        const limb = this.hands.getObjectByName(name);
        if (!limb) continue;
        limb.rotation.z =
          Number(limb.userData.baseRotationZ) + sway * direction;
        limb.rotation.x =
          Number(limb.userData.baseRotationX) +
          (this.reducedMotion ? 0 : Math.cos(seconds * 8.5) * walking * 0.01);
      }
    }
    const position = this.water.geometry.attributes
      .position as T.BufferAttribute;
    const base = this.water.userData.basePositions as Float32Array;
    if (!this.reducedMotion && position?.array && base) {
      const array = position.array as Float32Array;
      for (let i = 0; i < position.count; i++)
        array[i * 3 + 1] =
          base[i * 3 + 1] +
          Math.sin(base[i * 3] * 0.18 + seconds * 1.4) * 0.16 +
          Math.cos(base[i * 3 + 2] * 0.15 + seconds) * 0.1;
      position.needsUpdate = true;
      this.water.geometry.computeVertexNormals();
    }
    if (this.fish.visible && world) {
      const storm = world.phase === 'storm';
      const radius = storm ? 8 : 5.5;
      const angle =
        seconds * (storm ? 0.42 : 0.19) + world.stormProgress * 0.14;
      this.fish.position.set(
        Math.cos(angle) * radius,
        storm ? -0.2 + Math.sin(seconds * 1.4) * 0.8 : -0.15,
        Math.sin(angle) * radius - 3,
      );
      this.fish.rotation.y = -angle + Math.PI / 2;
      const tail = this.fish.userData.tail as T.Object3D;
      tail.rotation.x = Math.sin(seconds * 7) * 0.4;
      this.fish.scale.setScalar(world.phase === 'sanctuary' ? 1.08 : 1);
    }
    if (this.rain.geometry) {
      const rainPositions = this.rain.geometry.attributes
        .position as T.BufferAttribute;
      if (rainPositions) {
        const array = rainPositions.array as Float32Array;
        for (let i = 0; i < rainPositions.count; i++) {
          array[i * 3 + 1] -= 0.24;
          array[i * 3] -= 0.055;
          if (array[i * 3 + 1] < -1) array[i * 3 + 1] = 20;
        }
        rainPositions.needsUpdate = true;
      }
    }
    this.updateTarget(seconds);
    this.renderer.render(this.scene, this.camera);
  };

  private updateTarget(seconds: number) {
    for (const object of this.interactables)
      if (object.userData.markerRing) object.rotation.z = seconds * 0.45;
    this.raycaster.setFromCamera(new T.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    const hit = hits.find((candidate) => candidate.distance <= 5.2);
    let object: T.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.target) object = object.parent;
    const target = object?.userData.target ?? null;
    if (target !== this.currentTarget) {
      this.currentTarget = target;
      this.onTarget(target);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock?.();
    for (const avatar of this.avatars.values()) disposeObject(avatar);
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
