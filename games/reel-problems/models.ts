import { batchScenery } from '../../shared/rendering/batch-scenery';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import * as THREE from 'three';
import {
  BUCKET,
  CATCHES,
  HULL_HALF,
  WELL_SURFACE,
  type CatchKind,
} from './types';

export function material(color: string, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
export function box(
  parent: THREE.Object3D,
  size: number[],
  pos: number[],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    mat,
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function ball(
  parent: THREE.Object3D,
  size: number[],
  pos: number[],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  pos: number[],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    mat,
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function createBoat() {
  const group = new THREE.Group(),
    hull = material('#dd7154'),
    wood = material('#dcb885'),
    dark = material('#985c3f'),
    cream = material('#fff0cd');
  box(group, [HULL_HALF.x * 2, 0.65, HULL_HALF.z * 2], [0, 0, 0], hull);
  for (let i = 0; i < 8; i++)
    box(group, [4.9, 0.18, 0.86], [0, 0.42, -3.2 + i * 0.91], wood);
  for (const x of [-2.65, 2.65]) {
    box(group, [0.3, 0.95, 8], [x, 0.45, 0], hull);
    box(group, [0.39, 0.14, 8.1], [x, 0.96, 0], cream);
  }
  for (const z of [-3.9, 3.9]) {
    box(group, [5.35, 0.9, 0.28], [0, 0.45, z], hull);
    box(group, [5.4, 0.14, 0.35], [0, 0.96, z], cream);
  }
  // Live well, open at the top so a landed catch is visibly dropped inside.
  const well = material('#739e98');
  for (const x of [-1.14, 1.14])
    box(group, [0.12, 0.8, 0.9], [x, 0.9, 0], well);
  for (const z of [-0.39, 0.39])
    box(group, [2.4, 0.8, 0.12], [0, 0.9, z], well);
  box(group, [2.4, 0.1, 0.9], [0, 0.55, 0], well);
  const brine = box(
    group,
    [2.16, 0.02, 0.66],
    [0, WELL_SURFACE, 0],
    material('#3f9aa2', 0.25),
  );
  brine.name = 'brine';
  for (const x of [-1.19, 1.19])
    box(group, [0.12, 0.12, 1], [x, 1.35, 0], cream);
  for (const z of [-0.44, 0.44])
    box(group, [2.5, 0.12, 0.12], [0, 1.35, z], cream);
  box(group, [0.16, 0.16, 8.5], [-2.9, 1.1, 0], dark).rotation.y = 0.14;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 16), cream);
  ring.position.set(0.3, 0.6, 2.65);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const gear = new THREE.Group();
  gear.name = 'tire';
  for (const x of [-3, 3]) {
    const tyre = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.26, 8, 16),
      material('#465557'),
    );
    tyre.rotation.y = Math.PI / 2;
    tyre.position.set(x, 0, 0);
    gear.add(tyre);
  }
  gear.visible = false;
  group.add(gear);
  // A pointed bow at -z, so a paddler can tell which way is forward.
  box(group, [0.9, 0.62, 0.9], [0, 0, -HULL_HALF.z], hull).rotation.y =
    Math.PI / 4;
  // One paddle along each rail, blade to the bow; hidden while someone holds it.
  for (const side of [-1, 1]) {
    const paddle = createPaddle();
    paddle.name = side < 0 ? 'paddle-port' : 'paddle-starboard';
    paddle.rotation.x = -Math.PI / 2;
    paddle.position.set(side * 2.2, 0.62, 0.9);
    group.add(paddle);
  }
  const bucket = createBucket();
  bucket.name = 'bucket';
  bucket.position.set(BUCKET.x, 0.51, BUCKET.z);
  group.add(bucket);
  // Water in the bottom of the boat, raised by the renderer as it floods.
  const bilge = new THREE.Mesh(
    new THREE.PlaneGeometry(HULL_HALF.x * 2 - 0.5, HULL_HALF.z * 2 - 0.5),
    new THREE.MeshStandardMaterial({
      color: '#3f9aa2',
      transparent: true,
      opacity: 0.72,
      roughness: 0.2,
    }),
  );
  bilge.name = 'bilge';
  bilge.rotation.x = -Math.PI / 2;
  bilge.visible = false;
  group.add(bilge);
  // A spout of spray over a warning ring, placed on the cracked plank by the renderer.
  const leak = new THREE.Group();
  leak.name = 'leak';
  leak.visible = false;
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.9, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#dff6f7',
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  jet.name = 'jet';
  jet.rotation.x = Math.PI;
  jet.position.y = 0.45;
  leak.add(jet);
  const warning = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.5, 24),
    new THREE.MeshBasicMaterial({
      color: '#ff6b4a',
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  warning.name = 'leak-ring';
  warning.rotation.x = -Math.PI / 2;
  warning.position.y = 0.03;
  leak.add(warning);
  group.add(leak);
  return group;
}
/** How far forward the rod hand is raised. */
const ROD_ARM = -0.9;
const ROD_TILT = 0.85;
const ROD_LENGTH = 2.25;

/**
 * An angler: the collection's shared worker in the player's colour, with
 * waders, a life vest, a bucket hat and a rod held out in the right hand. A
 * player's own hat and top replace the bucket hat and vest; the rod stays.
 * `userData.rodTip` is where the line leaves the rod, in the angler's space.
 */
export function createAngler(color: string, look?: Look) {
  const { model: g, worn } = dressedWorker(
    0,
    { shirt: color, overalls: '#344d4d', boots: '#2b3b3b', cap: false },
    look,
  );
  const body = g.userData.body as THREE.Group;
  if (!worn.top)
    box(body, [0.56, 0.42, 0.07], [0, 0.98, 0.255], material('#ffb75f'));
  if (!worn.hat) {
    const hat = material(color);
    cylinder(body, 0.46, 0.06, [0, WORKER_HEAD_TOP + 0.02, 0], hat);
    cylinder(body, 0.3, 0.24, [0, WORKER_HEAD_TOP + 0.16, 0], hat);
  }
  // The rod leaves the right hand, raised to hold it out over the water.
  const arm = g.userData.armR as THREE.Group;
  arm.rotation.x = ROD_ARM;
  g.updateMatrixWorld(true);
  const grip = arm
    .getObjectByName('worker-hand')!
    .getWorldPosition(new THREE.Vector3());
  const along = new THREE.Vector3(0, Math.cos(ROD_TILT), Math.sin(ROD_TILT));
  const middle = grip.clone().addScaledVector(along, ROD_LENGTH / 2);
  const rod = cylinder(
    g,
    0.028,
    ROD_LENGTH,
    middle.toArray(),
    material('#d2ab73'),
  );
  rod.rotation.x = ROD_TILT;
  rod.name = 'rod';
  g.userData.rodTip = grip.addScaledVector(along, ROD_LENGTH);
  return g;
}
/**
 * Steps an angler across the deck, tucks them up in a jump, or animates them
 * swimming, clinging to the hull, or treading water; `now` is in milliseconds.
 */
export function poseAngler(
  model: THREE.Object3D,
  now: number,
  moving: boolean,
  airborne = false,
  swimming = false,
  clinging = false,
  climbing = false,
  downed = false,
) {
  const body = model.userData.body as THREE.Group | undefined;
  const legL = model.userData.legL as THREE.Group | undefined;
  const legR = model.userData.legR as THREE.Group | undefined;
  const armL = model.userData.armL as THREE.Group | undefined;
  const armR = model.userData.armR as THREE.Group | undefined;
  if (!legL || !legR || !armL || !armR) return;

  if (downed) {
    if (body) body.rotation.set(0, 0, 0);
    legL.rotation.set(0.2, 0, 0.1);
    legR.rotation.set(0.15, 0, -0.1);
    armL.rotation.set(0.4, 0, 0.3);
    armR.rotation.set(0.4, 0, -0.3);
    return;
  }

  if (clinging) {
    if (body) body.rotation.set(0, 0, 0);
    if (climbing) {
      const cycle = now / 110;
      armL.rotation.set(-2.1 + Math.sin(cycle) * 0.45, 0, -0.2);
      armR.rotation.set(-2.1 - Math.sin(cycle) * 0.45, 0, 0.2);
      legL.rotation.set(Math.sin(cycle) * 0.4, 0, 0.1);
      legR.rotation.set(-Math.sin(cycle) * 0.4, 0, -0.1);
    } else {
      armL.rotation.set(-2.2, 0, -0.2);
      armR.rotation.set(-2.2, 0, 0.2);
      legL.rotation.set(Math.sin(now / 300) * 0.15, 0, 0.1);
      legR.rotation.set(-Math.sin(now / 300) * 0.15, 0, -0.1);
    }
    return;
  }

  if (swimming) {
    if (moving) {
      // Head lifted slightly forward to breathe while body is prone
      if (body) body.rotation.set(-0.35, 0, 0);
      const stroke = now / 160;
      armL.rotation.set(
        -Math.sin(stroke) * 1.5 - 0.7,
        Math.cos(stroke) * 0.25,
        Math.cos(stroke) * 0.4 + 0.3,
      );
      armR.rotation.set(
        -Math.sin(stroke + Math.PI) * 1.5 - 0.7,
        -Math.cos(stroke + Math.PI) * 0.25,
        -Math.cos(stroke + Math.PI) * 0.4 - 0.3,
      );
      const kick = now / 80;
      legL.rotation.set(Math.sin(kick) * 0.45, 0, 0.08);
      legR.rotation.set(-Math.sin(kick) * 0.45, 0, -0.08);
    } else {
      // Treading water: gentle circular sculling and scissor kick
      if (body) body.rotation.set(-0.15, 0, 0);
      const scull = now / 230;
      armL.rotation.set(
        -0.7 + Math.sin(scull) * 0.3,
        Math.sin(scull) * 0.25,
        0.65 + Math.cos(scull) * 0.25,
      );
      armR.rotation.set(
        -0.7 + Math.sin(scull) * 0.3,
        -Math.sin(scull) * 0.25,
        -0.65 - Math.cos(scull) * 0.25,
      );
      legL.rotation.set(Math.sin(scull) * 0.35, 0, 0.15);
      legR.rotation.set(-Math.sin(scull) * 0.35, 0, -0.15);
    }
    return;
  }

  if (body) body.rotation.set(0, 0, 0);
  const stride = moving && !airborne ? Math.sin(now / 95) * 0.45 : 0;
  // In the air: knees up and the free arm thrown out for balance.
  legL.rotation.set(airborne ? -0.6 : stride, 0, 0);
  legR.rotation.set(airborne ? -0.35 : -stride, 0, 0);
  armL.rotation.set(airborne ? -1.8 : -stride * 0.7, 0, 0);
  armR.rotation.set(ROD_ARM, 0, 0);
}
/** How far an angler rocks on deck; `now` is in milliseconds. */
export function deckSway(
  now: number,
  input: { x: number; z: number; brace: boolean },
) {
  return input.brace
    ? -0.12
    : Math.sin(now / 110) * Math.min(0.06, Math.hypot(input.x, input.z) * 0.06);
}
export function createCatch(kind: CatchKind) {
  const g = new THREE.Group(),
    spec = CATCHES[kind],
    body = material(spec.color),
    dark = material('#274e50'),
    white = material('#fff2d9');
  if (kind === 'tire') {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.22, 8, 16), body);
    m.rotation.x = Math.PI / 2;
    g.add(m);
    return g;
  }
  if (kind === 'magnet') {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.13, 8, 12, Math.PI),
      body,
    );
    m.rotation.x = Math.PI / 2;
    g.add(m);
    return g;
  }
  if (kind === 'boot') {
    box(g, [0.55, 0.6, 0.45], [0, 0.2, 0], body);
    box(g, [0.55, 0.3, 0.7], [0, 0, 0.18], body);
    return g;
  }
  ball(g, [0.55, 0.38, 1], [0, 0, 0], body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 3), body);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1;
  g.add(tail);
  for (const x of [-0.43, 0.43]) {
    ball(g, [0.13, 0.13, 0.13], [x, 0.18, 0.55], white);
    ball(g, [0.055, 0.065, 0.055], [x * 1.17, 0.19, 0.6], dark);
  }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.65, 3), body);
  fin.position.y = 0.45;
  g.add(fin);
  g.scale.setScalar(spec.size);
  return g;
}
export function createShark() {
  const g = new THREE.Group(),
    body = material('#587b91'),
    pale = material('#d3e4dc');
  ball(g, [0.65, 0.45, 1.9], [0, -0.12, 0], body);
  ball(g, [0.55, 0.2, 1.45], [0, -0.3, 0.25], pale);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.3, 3), body);
  fin.position.set(0, 0.6, -0.1);
  fin.scale.x = 0.24;
  g.add(fin);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.9, 3), body);
  tail.position.z = -1.8;
  tail.rotation.x = -Math.PI / 2;
  tail.rotation.z = Math.PI / 2;
  g.add(tail);
  for (const x of [-0.57, 0.57]) {
    ball(g, [0.11, 0.11, 0.12], [x, 0.06, 1], material('#172f44'));
    const side = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 3), body);
    side.position.set(x * 1.35, -0.02, 0.1);
    side.rotation.z = Math.sign(x) * -1.1;
    g.add(side);
  }
  return g;
}

export function createJellyfish() {
  const g = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({
    color: '#e0adff',
    emissive: '#a154ed',
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.83,
    roughness: 0.3,
  });
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    glow,
  );
  bell.scale.y = 0.7;
  g.add(bell);
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const x = Math.sin(angle) * 0.6,
      z = Math.cos(angle) * 0.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0, z),
      new THREE.Vector3(x * 1.35, -0.24, z * 1.35),
      new THREE.Vector3(x * 2, -0.12, z * 2),
      new THREE.Vector3(x * 2.5, 0.05, z * 2.5),
    ]);
    g.add(
      new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.045, 5, false), glow),
    );
  }
  for (const x of [-0.25, 0.25])
    ball(g, [0.065, 0.085, 0.055], [x, 0.24, 0.69], material('#4c2b76'));
  return g;
}

export function addShore(scene: THREE.Scene) {
  const sand = new THREE.Mesh(
    new THREE.RingGeometry(42, 58, 80),
    material('#d9c99e'),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.12;
  sand.receiveShadow = true;
  scene.add(sand);
  const ground = new THREE.Mesh(
    new THREE.RingGeometry(46, 110, 80),
    material('#91aa84'),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.32, 2, 5),
    material('#92704e'),
    65,
  );
  const canopy = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2, 5.5, 7),
    material('#517f70'),
    65,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 4, 7),
    material('#73937a'),
    65,
  );
  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3(),
    pos = new THREE.Vector3();
  for (let i = 0; i < 65; i++) {
    const a = i * 2.39996,
      r = 47 + (i % 5) * 2.5,
      h = 0.65 + (i % 7) * 0.12;
    scale.setScalar(h);
    pos.set(Math.cos(a) * r, 0.6, Math.sin(a) * r);
    matrix.compose(pos, quaternion, scale);
    trunk.setMatrixAt(i, matrix);
    pos.y = h * 3.3;
    matrix.compose(pos, quaternion, scale);
    canopy.setMatrixAt(i, matrix);
    pos.y += h * 2;
    matrix.compose(pos, quaternion, scale);
    crown.setMatrixAt(i, matrix);
  }
  canopy.castShadow = true;
  scene.add(trunk, canopy, crown);
  const dock = new THREE.Group(),
    wood = material('#b7895b');
  for (let i = 0; i < 10; i++)
    box(dock, [5.5, 0.2, 0.65], [0, 0.5, 38 + i * 0.7], wood);
  for (const x of [-2.4, 2.4])
    for (const z of [38, 43])
      cylinder(dock, 0.19, 2.4, [x, 0, z], material('#947150'));
  // Planks and pilings never move, so they draw as one mesh per material.
  batchScenery(dock);
  scene.add(dock);
}
export function nameLabel(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff8e9';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 55, 24);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(24, 32, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#254b4e';
  ctx.font = 'bold 23px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 14), 139, 32, 194);
  const texture = new THREE.CanvasTexture(canvas),
    sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
  sprite.scale.set(2.7, 0.68, 1);
  sprite.position.y = 2.65;
  return sprite;
}
/** A paddle standing on its grip: shaft up +y, blade at the top. */
export function createPaddle() {
  const g = new THREE.Group(),
    wood = material('#c79a62');
  cylinder(g, 0.035, 1.7, [0, 0.85, 0], wood);
  box(g, [0.22, 0.5, 0.04], [0, 1.85, 0], wood);
  return g;
}
export function createBucket() {
  const g = new THREE.Group(),
    tin = material('#6f8fa3');
  tin.side = THREE.DoubleSide;
  const pail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.15, 0.32, 12, 1, true),
    tin,
  );
  pail.position.y = 0.16;
  pail.castShadow = true;
  g.add(pail);
  cylinder(g, 0.15, 0.02, [0, 0.01, 0], material('#58788a'));
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.012, 4, 12, Math.PI),
    material('#3c4f59'),
  );
  handle.position.y = 0.32;
  g.add(handle);
  return g;
}
export function createCrab() {
  const g = new THREE.Group(),
    shell = material('#e0613f'),
    dark = material('#3a2a24');
  ball(g, [0.22, 0.09, 0.17], [0, 0.1, 0], shell);
  for (const x of [-1, 1]) {
    ball(g, [0.08, 0.05, 0.07], [x * 0.2, 0.12, 0.2], shell).name =
      x < 0 ? 'clawL' : 'clawR';
    for (const z of [-0.08, 0, 0.08])
      box(g, [0.14, 0.02, 0.02], [x * 0.24, 0.05, z], shell);
    ball(g, [0.025, 0.035, 0.025], [x * 0.06, 0.2, 0.13], dark);
  }
  return g;
}
/** Driftwood lying along +z. */
export function createLog() {
  const g = new THREE.Group();
  cylinder(g, 0.28, 2.4, [0, 0, 0], material('#7a5a3a')).rotation.x =
    Math.PI / 2;
  for (const z of [-1.21, 1.21])
    cylinder(g, 0.25, 0.03, [0, 0, z], material('#c9a577')).rotation.x =
      Math.PI / 2;
  return g;
}
/** A gull facing +z, with `wingL` and `wingR` to flap. */
export function createGull() {
  const g = new THREE.Group(),
    white = material('#f4f4ef'),
    grey = material('#9aa5ab');
  ball(g, [0.18, 0.16, 0.42], [0, 0, 0], white);
  ball(g, [0.12, 0.12, 0.12], [0, 0.1, 0.36], white);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.16, 5),
    material('#f0a63a'),
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.08, 0.52);
  g.add(beak);
  for (const x of [-1, 1]) {
    const wing = new THREE.Group();
    wing.name = x < 0 ? 'wingL' : 'wingR';
    box(wing, [0.62, 0.03, 0.22], [x * 0.31, 0, 0], grey);
    wing.position.set(x * 0.12, 0.05, 0);
    g.add(wing);
  }
  return g;
}
