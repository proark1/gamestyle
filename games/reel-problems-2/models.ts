import { batchScenery } from '../../shared/rendering/batch-scenery';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { CLOTH } from '../../shared/rendering/palette';
import { GAME_HEAD_TOP as WORKER_HEAD_TOP } from '../../shared/rendering/game-avatar';
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
export function createComicBubble(type: 'alert' | 'sweat' | 'dizzy') {
  if (typeof document === 'undefined') {
    const sprite = new THREE.Sprite();
    sprite.scale.set(1.4, 1.4, 1);
    return sprite;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  if (type === 'alert') {
    ctx.fillStyle = '#ff4242';
    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64, 66);
  } else if (type === 'sweat') {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(64, 18);
    ctx.bezierCurveTo(90, 60, 100, 95, 64, 108);
    ctx.bezierCurveTo(28, 95, 38, 60, 64, 18);
    ctx.fill();
  } else if (type === 'dizzy') {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.scale.set(1.4, 1.4, 1);
  return sprite;
}

export function createFloatingScore(text: string, color = '#ffd24a') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 96);
  ctx.fillStyle = '#173639';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 80, 20);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.scale.set(3.2, 1.2, 1);
  return sprite;
}

export function createFloatingHat(color: string) {
  const g = new THREE.Group();
  const hatMat = material(color);
  cylinder(g, 0.44, 0.05, [0, 0.02, 0], hatMat);
  cylinder(g, 0.28, 0.2, [0, 0.12, 0], hatMat);
  return g;
}

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
    { shirt: color, overalls: CLOTH.teal, boots: CLOTH.charcoal, cap: false },
    look,
  );
  const body = g.userData.body as THREE.Group;
  if (!worn.top)
    box(body, [0.43, 0.3, 0.05], [0, 0.78, 0.18], material(CLOTH.hivis));
  if (!worn.hat) {
    const hat = material(color);
    const brim = cylinder(
      body,
      0.46,
      0.06,
      [0, WORKER_HEAD_TOP + 0.02, 0],
      hat,
    );
    brim.name = 'angler-hat';
    const crown = cylinder(
      body,
      0.3,
      0.24,
      [0, WORKER_HEAD_TOP + 0.16, 0],
      hat,
    );
    crown.name = 'angler-hat';
  }
  // The rod leaves the right hand with flexible bending segments.
  const arm = g.userData.armR as THREE.Group;
  arm.rotation.x = ROD_ARM;
  g.updateMatrixWorld(true);
  const grip = arm
    .getObjectByName('worker-hand')!
    .getWorldPosition(new THREE.Vector3());
  const localGrip = g.worldToLocal(grip.clone());

  const rodRoot = new THREE.Group();
  rodRoot.name = 'rod';
  rodRoot.position.copy(localGrip);
  rodRoot.rotation.x = ROD_TILT;
  g.add(rodRoot);

  const woodMat = material('#d2ab73');
  const segLength = ROD_LENGTH / 4;
  let curParent: THREE.Object3D = rodRoot;
  const segments: THREE.Group[] = [];

  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0 : segLength, 0);
    const radius = 0.03 - i * 0.004;
    cylinder(seg, radius, segLength, [0, segLength / 2, 0], woodMat);
    curParent.add(seg);
    segments.push(seg);
    curParent = seg;
  }

  const tipAnchor = new THREE.Object3D();
  tipAnchor.position.set(0, segLength, 0);
  curParent.add(tipAnchor);

  const along = new THREE.Vector3(0, Math.cos(ROD_TILT), Math.sin(ROD_TILT));
  g.userData.rodTip = grip.addScaledVector(along, ROD_LENGTH);

  const tmpTip = new THREE.Vector3();
  g.userData.updateRod = (tension: number, surge: boolean, now: number) => {
    const bend =
      Math.min(1.4, tension * 1.1) +
      (surge ? 0.3 + Math.sin(now / 45) * 0.08 : 0);
    segments[1].rotation.x = bend * 0.22;
    segments[2].rotation.x = bend * 0.38;
    segments[3].rotation.x = bend * 0.52;
    if (surge || tension > 0.8) {
      const shudder = Math.sin(now / 35) * (tension * 0.03);
      segments[2].rotation.z = shudder;
      segments[3].rotation.z = -shudder;
    } else {
      segments[2].rotation.z = 0;
      segments[3].rotation.z = 0;
    }
    tipAnchor.getWorldPosition(tmpTip);
    g.worldToLocal(tmpTip);
    (g.userData.rodTip as THREE.Vector3).copy(tmpTip);
  };

  const trophy = createCatch('salmon');
  trophy.name = 'trophy-fish';
  trophy.scale.setScalar(0.7);
  trophy.position.set(0, 2.7, 0.1);
  trophy.visible = false;
  g.add(trophy);

  const bubbleAlert = createComicBubble('alert');
  bubbleAlert.name = 'bubble-alert';
  bubbleAlert.position.set(0, 3.4, 0);
  bubbleAlert.visible = false;
  g.add(bubbleAlert);

  const bubbleSweat = createComicBubble('sweat');
  bubbleSweat.name = 'bubble-sweat';
  bubbleSweat.position.set(0.65, 3.2, 0);
  bubbleSweat.visible = false;
  g.add(bubbleSweat);

  const bubbleDizzy = createComicBubble('dizzy');
  bubbleDizzy.name = 'bubble-dizzy';
  bubbleDizzy.position.set(0, 3.3, 0);
  bubbleDizzy.visible = false;
  g.add(bubbleDizzy);

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
  tumble = false,
  trophy = false,
  slipping = false,
  hooked = false,
  shocked = false,
) {
  const body = model.userData.body as THREE.Group | undefined;
  const legL = model.userData.legL as THREE.Group | undefined;
  const legR = model.userData.legR as THREE.Group | undefined;
  const armL = model.userData.armL as THREE.Group | undefined;
  const armR = model.userData.armR as THREE.Group | undefined;
  if (!legL || !legR || !armL || !armR) return;

  if (shocked) {
    // Tom & Jerry electric shock gag: frantic rapid jitter and rigid splayed limbs
    const jx = () => (Math.random() - 0.5) * 0.4;
    const jy = () => (Math.random() - 0.5) * 0.4;
    if (body) body.rotation.set(jx() * 0.5, jy() * 0.5, jx() * 0.5);
    legL.rotation.set(0.5 + jx(), 0, 0.4 + jy());
    legR.rotation.set(-0.5 + jx(), 0, -0.4 + jy());
    armL.rotation.set(-1.8 + jx(), 0, 0.9 + jy());
    armR.rotation.set(-1.8 + jx(), 0, -0.9 + jy());
    return;
  }

  if (hooked) {
    // Hooked by teammate: body yanked backward, frantic arm flailing & panicked scissor kicks
    if (body) body.rotation.set(-0.6, 0, Math.sin(now / 45) * 0.2);
    const flail = now / 40;
    armL.rotation.set(-2.3 + Math.sin(flail) * 0.7, 0, 0.4);
    armR.rotation.set(-2.3 - Math.sin(flail) * 0.7, 0, -0.4);
    legL.rotation.set(Math.sin(flail * 0.8) * 0.85, 0, 0.2);
    legR.rotation.set(-Math.sin(flail * 0.8) * 0.85, 0, -0.2);
    return;
  }

  if (downed) {
    if (body) body.rotation.set(0, 0, 0);
    legL.rotation.set(0.2, 0, 0.1);
    legR.rotation.set(0.15, 0, -0.1);
    armL.rotation.set(0.4, 0, 0.3);
    armR.rotation.set(0.4, 0, -0.3);
    return;
  }

  if (tumble) {
    // Comically flat on back with kicking feet and frantic hands
    if (body) body.rotation.set(-0.55, 0, 0);
    legL.rotation.set(-1.1 + Math.sin(now / 90) * 0.18, 0, 0.2);
    legR.rotation.set(-0.95 - Math.sin(now / 90) * 0.18, 0, -0.2);
    armL.rotation.set(-2.4 + Math.sin(now / 60) * 0.3, 0, 0.35);
    armR.rotation.set(-2.4 - Math.sin(now / 60) * 0.3, 0, -0.35);
    return;
  }

  if (trophy) {
    // Triumphant posture holding catch high
    if (body) body.rotation.set(-0.15, 0, 0);
    legL.rotation.set(0, 0, 0.2);
    legR.rotation.set(0, 0, -0.2);
    armL.rotation.set(-2.6, 0, -0.25);
    armR.rotation.set(-2.6, 0, 0.25);
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
      // Alternating crawl: reach, underwater pull, then recovery above water.
      const stroke = (now / 1500) * Math.PI * 2;
      if (body) body.rotation.set(-0.1, 0, Math.sin(stroke) * 0.08);
      armL.rotation.set(
        -stroke,
        Math.sin(stroke) * 0.12,
        0.18 + Math.max(0, Math.sin(stroke)) * 0.4,
      );
      armR.rotation.set(
        -stroke - Math.PI,
        -Math.sin(stroke + Math.PI) * 0.12,
        -0.18 - Math.max(0, Math.sin(stroke + Math.PI)) * 0.4,
      );
      const kick = stroke * 3;
      legL.rotation.set(Math.sin(kick) * 0.22, 0, 0.06);
      legR.rotation.set(-Math.sin(kick) * 0.22, 0, -0.06);
    } else {
      // Treading water: gentle circular sculling and scissor kick
      if (body) body.rotation.set(-0.15, 0, 0);
      const scull = now / 380;
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

  if (slipping && !airborne) {
    // Panicked windmilling arms trying to stay upright
    if (body) body.rotation.set(0.18, 0, Math.sin(now / 70) * 0.2);
    const windmill = now / 55;
    armL.rotation.set(Math.sin(windmill) * 2.8, 0, 0.4);
    armR.rotation.set(Math.sin(windmill + Math.PI) * 2.8, 0, -0.4);
    legL.rotation.set(Math.sin(now / 75) * 0.65, 0, 0.15);
    legR.rotation.set(-Math.sin(now / 75) * 0.65, 0, -0.15);
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

/** Giant underwater shadow silhouette of the legendary "Lake Manager" monster fish. */
export function createLakeManagerShadow() {
  const g = new THREE.Group();
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#07181a',
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Massive silhouette body: elongated ellipsoid
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), shadowMat);
  body.scale.set(1.9, 0.28, 4.6);
  body.name = 'shadow-body';
  g.add(body);

  // Dorsal fin silhouette
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 4), shadowMat);
  fin.rotation.x = Math.PI / 2;
  fin.rotation.z = Math.PI / 2;
  fin.scale.set(0.18, 1, 1.2);
  fin.position.set(0, 0.12, -1.8);
  g.add(fin);

  // Tail flukes
  const fluke = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 3), shadowMat);
  fluke.rotation.x = -Math.PI / 2;
  fluke.scale.set(1.6, 0.1, 0.8);
  fluke.position.set(0, 0, -4.6);
  g.add(fluke);

  // Ominous glowing yellow eyes beneath the deep water
  const eyeMat = new THREE.MeshBasicMaterial({
    color: '#ffd026',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), eyeMat);
  eyeL.position.set(0.75, 0.12, 3.2);
  eyeL.name = 'eye-l';
  g.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), eyeMat);
  eyeR.position.set(-0.75, 0.12, 3.2);
  eyeR.name = 'eye-r';
  g.add(eyeR);

  return g;
}
