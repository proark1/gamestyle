import * as T from 'three';
import { box, label, material } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { COLORS } from './types';

function ball(
  parent: T.Object3D,
  size: number[],
  position: number[],
  color: string,
) {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 12, 8), material(color));
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function guest(color: number, monster = false) {
  if (!monster) return hotelGuest(color);
  const g = new T.Group(),
    coat = '#182532';
  box(g, [0.64, 0.7, 0.4], [0, 0.9, 0], coat, true);
  const head = new T.Group();
  head.position.set(0, 1.55, 0);
  ball(head, [0.23, 0.38, 0.21], [0, 0, 0], '#b8bbaa');
  for (const x of [-0.12, 0.12])
    ball(head, [0.06, 0.08, 0.025], [x, 0.08, 0.2], '#10181b');
  ball(head, [0.09, 0.16, 0.035], [0, -0.16, 0.19], '#111419');
  head.rotation.z = -0.22;
  g.add(head);
  g.userData.head = head;
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.18, 0.52, 0);
    box(leg, [0.23, 0.42, 0.27], [0, -0.17, 0], '#333d4b', true);
    box(leg, [0.29, 0.2, 0.4], [0, -0.41, 0.07], '#2d303b', true);
    g.add(leg);
    g.userData[side === 1 ? 'legR' : 'legL'] = leg;
    const arm = new T.Group();
    arm.position.set(side * 0.43, 1.17, 0);
    box(arm, [0.18, 0.68, 0.23], [0, -0.27, 0], coat, true);
    box(arm, [0.14, 0.27, 0.18], [0, -0.72, 0], '#b8bbaa', true);
    g.add(arm);
    g.userData[side === 1 ? 'armR' : 'armL'] = arm;
  }
  g.scale.set(1.15, 1.8, 0.85);
  return g;
}

function hotelGuest(color: number) {
  const g = new T.Group(),
    coat = COLORS[color % COLORS.length],
    skin = '#f2d1a1',
    trousers = '#35585b';
  // Same round, faceted heads and pear-shaped bodies as the fishing/game-show crew.
  ball(g, [0.43, 0.56, 0.32], [0, 1, 0], coat);
  ball(g, [0.36, 0.36, 0.34], [0, 1.75, 0], skin);
  ball(g, [0.37, 0.16, 0.34], [0, 2, -0.025], '#73543d');
  for (const side of [-1, 1]) {
    ball(g, [0.075, 0.1, 0.085], [side * 0.35, 1.73, 0], skin);
    ball(g, [0.034, 0.05, 0.027], [side * 0.12, 1.8, 0.315], '#29474b');
    ball(g, [0.065, 0.038, 0.022], [side * 0.2, 1.68, 0.29], '#da9478');
    const leg = new T.Group();
    leg.position.set(side * 0.21, 0.52, 0);
    box(leg, [0.25, 0.43, 0.28], [0, -0.16, 0], trousers, true);
    ball(leg, [0.19, 0.12, 0.28], [0, -0.39, 0.075], '#665445');
    g.add(leg);
    g.userData[side === 1 ? 'legR' : 'legL'] = leg;
    const arm = new T.Group();
    arm.position.set(side * 0.43, 1.24, 0);
    ball(arm, [0.16, 0.32, 0.16], [side * 0.03, -0.17, 0], coat);
    ball(arm, [0.13, 0.14, 0.13], [side * 0.04, -0.43, 0.02], skin);
    g.add(arm);
    g.userData[side === 1 ? 'armR' : 'armL'] = arm;
  }
  ball(g, [0.065, 0.065, 0.07], [0, 1.7, 0.345], skin);
  box(g, [0.13, 0.035, 0.025], [0, 1.58, 0.305], '#805e4c', true);
  box(g, [0.07, 0.77, 0.04], [0, 1, 0.315], '#f4d8a1', true);
  box(g, [0.21, 0.23, 0.06], [0.2, 0.88, 0.29], coat, true);
  box(g, [0.2, 0.13, 0.055], [0.19, 1.22, 0.29], '#fff0cd', true);
  const pack = ball(g, [0.29, 0.34, 0.15], [0, 1.06, -0.36], '#aa8058');
  box(pack, [0.6, 0.2, 0.35], [0, 0, -0.65], '#7a6048', true);
  return g;
}

/** Swings a guest's arms and legs to a stride clock `now`, in milliseconds. */
export function animateGuest(model: T.Object3D, now: number, moving: boolean) {
  const step = moving ? Math.sin(now / 95) * 0.5 : 0;
  model.userData.legR.rotation.x = step;
  model.userData.legL.rotation.x = -step;
  model.userData.armR.rotation.x = -step;
  model.userData.armL.rotation.x = step;
}

/** How far a stride turns over `distance` metres covered in `dt` seconds. */
export function strideAdvance(distance: number, dt: number) {
  const running = distance / Math.max(dt, 0.001) > 4.6;
  return (distance * Math.PI) / (running ? 1.65 : 1.45);
}

export function buildHotel() {
  const root = new T.Group(),
    staticGroup = new T.Group();
  const lamps: T.Mesh<T.CylinderGeometry, T.MeshStandardMaterial>[] = [];
  const roomDoor = new T.Group();
  roomDoor.position.set(4.67, 0, -16);
  root.add(roomDoor);
  root.add(staticGroup);
  // An interior needs a ceiling when guests look up; no outside dollhouse backdrop.
  box(staticGroup, [10.3, 0.24, 26], [0, 4.6, -12], '#364b48');
  box(staticGroup, [3.9, 0.2, 4], [0, 3.68, 2.9], '#ba9561');
  box(staticGroup, [10.4, 0.35, 31], [0, -0.21, -10], '#514c53');
  box(staticGroup, [5.3, 0.035, 25.7], [0, 0, -12], '#723f52');
  for (const x of [-2.55, 2.55])
    box(staticGroup, [0.065, 0.045, 25.7], [x, 0.02, -12], '#c19d68');
  for (let z = 0; z > -24; z -= 1.6) {
    const diamond = box(
      staticGroup,
      [0.19, 0.02, 0.19],
      [0, 0.025, z],
      '#ad745d',
    );
    diamond.rotation.y = Math.PI / 4;
  }
  for (const side of [-1, 1]) {
    box(staticGroup, [0.25, 4.6, 26], [side * 5, 2.3, -12], '#285053');
    for (const y of [0.16, 1.3, 4.1])
      box(staticGroup, [0.1, 0.09, 26], [side * 4.83, y, -12], '#b89961');
    for (let z = 0; z > -25; z -= 3) {
      box(staticGroup, [0.1, 3.8, 0.05], [side * 4.83, 2.2, z], '#54736c');
      box(
        staticGroup,
        [0.18, 0.4, 0.22],
        [side * 4.7, 2.8, z - 1.5],
        '#b99359',
        true,
      );
      const lamp = new T.Mesh(
        new T.CylinderGeometry(0.15, 0.26, 0.4, 8),
        new T.MeshStandardMaterial({
          color: '#ffe7ac',
          emissive: '#fbc66e',
          emissiveIntensity: 1.1,
        }),
      );
      lamp.position.set(side * 4.48, 3.02, z - 1.5);
      lamps.push(lamp);
      root.add(lamp);
    }
    for (const z of [-4, -9, -16, -21]) {
      box(staticGroup, [0.16, 2.9, 1.8], [side * 4.8, 1.45, z], '#bc9761');
      const privateDoor = side === 1 && z === -16;
      if (privateDoor) {
        box(roomDoor, [0.2, 2.68, 1.55], [0, 1.35, 0], '#403a47');
        box(roomDoor, [0.22, 1.5, 1.2], [-0.11, 1.48, 0], '#4b4550');
        continue;
      }
      box(staticGroup, [0.2, 2.68, 1.55], [side * 4.67, 1.35, z], '#403a47');
      box(
        staticGroup,
        [0.3, 0.13, 0.13],
        [side * 4.5, 1.2, z + 0.55],
        '#dab66d',
        true,
      );
      box(staticGroup, [0.22, 1.5, 1.2], [side * 4.56, 1.48, z], '#4b4550');
    }
  }
  box(staticGroup, [10, 4.6, 0.25], [0, 2.3, -25], '#285053');
  for (const x of [-3.35, 3.35])
    box(staticGroup, [3.2, 4.6, 0.25], [x, 2.3, 1.1], '#285053');
  for (const x of [-1.8, 1.8])
    box(staticGroup, [0.18, 3.65, 0.4], [x, 1.83, 1], '#dfb866');
  box(staticGroup, [3.8, 0.25, 0.4], [0, 3.55, 1], '#dfb866');
  box(staticGroup, [3.7, 0.06, 3.6], [0, 0.035, 2.8], '#c29e64');
  box(staticGroup, [3.8, 3.6, 0.2], [0, 1.8, 4.7], '#805b4b');
  for (const x of [-1.9, 1.9])
    box(staticGroup, [0.15, 3.6, 3.6], [x, 1.8, 2.9], '#805b4b');
  // Voting panel is at the opposite end; inspecting and deciding require a journey.
  box(staticGroup, [1.7, 1.4, 0.22], [0, 1.25, -24.7], '#ba965d', true);
  for (const x of [-0.42, 0.42]) {
    const button = new T.Mesh(
      new T.CylinderGeometry(0.17, 0.17, 0.08, 16),
      material(x < 0 ? '#66b8b1' : '#eb9279'),
    );
    button.rotation.x = Math.PI / 2;
    button.position.set(x, 1.4, -24.52);
    staticGroup.add(button);
  }
  for (const [x, z] of [
    [-3.9, -1.5],
    [3.9, -23.1],
  ]) {
    const pot = new T.Mesh(
      new T.CylinderGeometry(0.34, 0.22, 0.55, 8),
      material('#b37b5a'),
    );
    pot.position.set(x, 0.28, z);
    staticGroup.add(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = new T.Mesh(
        new T.ConeGeometry(0.2, 1.3, 5),
        material(i % 2 ? '#497d6a' : '#5d9276'),
      );
      leaf.position.set(
        x + Math.sin(i * 2) * 0.2,
        1,
        z + Math.cos(i * 2) * 0.2,
      );
      leaf.rotation.z = Math.sin(i) * 0.4;
      staticGroup.add(leaf);
    }
  }
  batchScenery(staticGroup);
  const exit = label('ELEVATOR / EXIT', '#e6bb70', '#303841', 2.8);
  exit.position.set(0, 3.94, 1);
  root.add(exit);
  const vote = label('ADVANCE     RETREAT', '#e6bb70', '#303841', 2.7);
  vote.position.set(0, 2.4, -24.5);
  root.add(vote);
  const room = label('309', '#c3a36a', '#303841', 0.8);
  room.position.set(4.3, 2.5, -16);
  root.add(room);
  const portrait = new T.Group();
  portrait.position.set(-4.65, 2.3, -11);
  portrait.rotation.y = Math.PI / 2;
  box(portrait, [1.4, 1.85, 0.14], [0, 0, 0], '#ccac69');
  box(portrait, [1.17, 1.61, 0.1], [0, 0, 0.1], '#684857');
  box(portrait, [0.73, 0.6, 0.04], [0, -0.45, 0.18], '#263d49', true);
  box(portrait, [0.51, 0.66, 0.06], [0, 0.18, 0.18], '#dca875', true);
  const eyes = [-0.13, 0.13].map((x) =>
    box(portrait, [0.06, 0.07, 0.02], [x, 0.25, 0.23], '#252d34'),
  );
  const mouth = box(portrait, [0.25, 0.04, 0.02], [0, 0, 0.23], '#392c38');
  const smile = new T.Mesh(
    new T.TorusGeometry(0.18, 0.027, 4, 12, Math.PI),
    material('#392c38'),
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.07, 0.24);
  smile.visible = false;
  portrait.add(smile);
  root.add(portrait);
  const clock = new T.Group();
  clock.position.set(0, 3.6, -24.7);
  const face = new T.Mesh(
    new T.CylinderGeometry(0.65, 0.65, 0.1, 32),
    material('#f2ddb1'),
  );
  face.rotation.x = Math.PI / 2;
  clock.add(face);
  const rim = new T.Mesh(
    new T.TorusGeometry(0.65, 0.065, 6, 32),
    material('#caa45c'),
  );
  clock.add(rim);
  const hands = new T.Group();
  hands.position.z = 0.1;
  box(hands, [0.04, 0.5, 0.04], [0, 0.2, 0], '#303841');
  box(hands, [0.075, 0.32, 0.04], [0, 0.12, 0.02], '#303841');
  clock.add(hands);
  root.add(clock);
  const prints = new T.Group();
  for (let i = 0; i < 10; i++) {
    const foot = new T.Mesh(
      new T.CircleGeometry(0.14, 9),
      new T.MeshStandardMaterial({
        color: '#a1d0ce',
        transparent: true,
        opacity: 0.65,
        roughness: 0.08,
      }),
    );
    foot.rotation.x = -Math.PI / 2;
    foot.scale.y = 1.7;
    foot.position.set(-2.3 + (i % 2 ? 0.17 : -0.17), 0.06, -2.5 - i * 0.52);
    prints.add(foot);
  }
  prints.visible = false;
  root.add(prints);
  const handle = box(
    roomDoor,
    [0.35, 0.1, 0.13],
    [-0.24, 1.2, 0.55],
    '#f2c76c',
    true,
  );
  const doors = [-1, 1].map((side) =>
    box(root, [1.68, 3.4, 0.12], [side * 2.6, 1.7, 1.02], '#b79968'),
  );
  return {
    root,
    mouth,
    smile,
    eyes,
    hands,
    prints,
    handle,
    doors,
    lamps,
    roomDoor,
    portrait,
  };
}
