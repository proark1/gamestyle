import * as T from 'three';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { box, beam, label, material } from '../../shared/rendering/primitives';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { defenderPosts } from './castle';
import {
  AMMO,
  CASTLE,
  COLORS,
  CRANK,
  LEVER,
  PILE,
  TREBUCHET,
  type AmmoKind,
  type Block,
} from './types';

function ball(
  g: T.Object3D,
  size: number[],
  pos: number[],
  color: string,
  segments = 10,
) {
  const m = new T.Mesh(new T.SphereGeometry(1, segments, 7), material(color));
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  g.add(m);
  return m;
}
function cylinder(
  g: T.Object3D,
  radius: number,
  height: number,
  pos: number[],
  color: string,
  sides = 16,
) {
  const m = new T.Mesh(
    new T.CylinderGeometry(radius, radius, height, sides),
    material(color),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function cone(
  g: T.Object3D,
  radius: number,
  height: number,
  pos: number[],
  color: string,
) {
  const m = new T.Mesh(new T.ConeGeometry(radius, height, 12), material(color));
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  g.add(m);
  return m;
}

/** A Kayi siege hand: the collection's shared worker in a felt tunic, boots, and a conical helmet. */
export function crewMember(color: string | number, look?: Look) {
  const shirt =
    typeof color === 'string' ? color : COLORS[Math.abs(color) % COLORS.length];
  const colorIndex = typeof color === 'number' ? color : COLORS.indexOf(color);
  const colorNum = colorIndex >= 0 ? colorIndex : 0;

  const { model: g, worn } = dressedWorker(
    colorNum,
    {
      shirt,
      overalls: '#54473a',
      boots: '#3d2e21',
      cap: false,
    },
    look,
  );

  const body = g.userData.body as T.Group;

  // Leather belt and brass buckle across the tunic waist
  box(body, [0.7, 0.12, 0.46], [0, 0.68, 0], '#5b4a34', true);
  box(body, [0.12, 0.12, 0.04], [0, 0.68, 0.24], '#d8a13d', true);

  // Conical helmet with a nasal bar; replaced if a player wears their own wardrobe hat
  if (!worn.hat) {
    const helmetCone = cone(
      body,
      0.34,
      0.42,
      [0, WORKER_HEAD_TOP + 0.21, 0],
      '#b9a06a',
    );
    helmetCone.name = 'helmet';
    const nasalBar = box(
      body,
      [0.05, 0.24, 0.05],
      [0, WORKER_HEAD_TOP - 0.12, 0.27],
      '#b9a06a',
      true,
    );
    nasalBar.name = 'helmet';
    const finial = ball(
      body,
      [0.06, 0.08, 0.06],
      [0, WORKER_HEAD_TOP + 0.44, 0],
      '#d8c48a',
    );
    finial.name = 'helmet';
    g.userData.hatTop = WORKER_HEAD_TOP + 0.46;
  }

  // Set limb aliases for compatibility with legacy object lookups
  const rig = g.userData as {
    legL: T.Object3D;
    legR: T.Object3D;
    armL: T.Object3D;
    armR: T.Object3D;
  };
  rig.legL.name = 'leg0';
  rig.legR.name = 'leg1';
  rig.armL.name = 'arm0';
  rig.armR.name = 'arm1';

  const carried = new T.Group();
  carried.name = 'carried';
  carried.position.set(0, 1.15, 0.62);
  g.add(carried);

  return g;
}

/** Swings a crew member's arms and legs; `now` is in milliseconds. */
export function poseCrew(
  model: T.Object3D,
  now: number,
  pose: { walking: boolean; winding: boolean; flying: boolean },
) {
  const swing = pose.walking ? Math.sin(now * 0.013) * 0.55 : 0;
  const rig = model.userData as {
    legL?: T.Object3D;
    legR?: T.Object3D;
    armL?: T.Object3D;
    armR?: T.Object3D;
  };
  const legL = rig.legL ?? model.getObjectByName('leg0');
  const legR = rig.legR ?? model.getObjectByName('leg1');
  const armL = rig.armL ?? model.getObjectByName('arm0');
  const armR = rig.armR ?? model.getObjectByName('arm1');

  if (legL && legR && armL && armR) {
    legL.rotation.x = -swing;
    legR.rotation.x = swing;
    const armPose = pose.winding
      ? -1.15 + Math.sin(now * 0.009) * 0.35
      : pose.flying
        ? -2.5
        : null;
    armL.rotation.x = armPose ?? swing;
    armR.rotation.x = armPose ?? -swing;
  }
}

export function ammoModel(kind: AmmoKind) {
  const g = new T.Group();
  const spec = AMMO[kind];
  if (kind === 'boulder') {
    const m = ball(
      g,
      [spec.radius, spec.radius * 0.92, spec.radius],
      [0, 0, 0],
      spec.color,
      7,
    );
    m.rotation.set(0.4, 0.7, 0.2);
  } else if (kind === 'firepot') {
    ball(
      g,
      [spec.radius, spec.radius * 1.1, spec.radius],
      [0, 0, 0],
      spec.color,
      9,
    );
    cylinder(g, 0.12, 0.18, [0, spec.radius, 0], '#7a4a2c', 8);
    const flame = cone(g, 0.16, 0.34, [0, spec.radius + 0.28, 0], '#f2a03c');
    flame.name = 'flame';
  } else if (kind === 'beehive') {
    for (let i = 0; i < 3; i++)
      cylinder(
        g,
        spec.radius - i * 0.11,
        0.24,
        [0, -0.16 + i * 0.24, 0],
        spec.color,
        12,
      );
    ball(g, [0.16, 0.14, 0.16], [0, 0.34, 0], '#a87c2c', 8);
  } else if (kind === 'cow') {
    box(g, [1.5, 0.82, 0.82], [0, 0, 0], spec.color, true);
    for (const s of [-1, 1]) {
      box(g, [0.34, 0.3, 0.3], [s * 0.4, 0.1, 0.36], '#3b3229', true);
      box(g, [0.2, 0.44, 0.2], [s * 0.5, -0.56, 0.24], '#4a4136', true);
      box(g, [0.2, 0.44, 0.2], [s * 0.5, -0.56, -0.24], '#4a4136', true);
    }
    const head = box(g, [0.52, 0.46, 0.5], [0.92, 0.14, 0], spec.color, true);
    for (const s of [-1, 1])
      cone(head, 0.07, 0.2, [0.02, 0.28, s * 0.18], '#cbbfa4');
    ball(head, [0.16, 0.13, 0.18], [0.26, -0.1, 0], '#e0b0ac');
  } else {
    ball(g, [0.34, 0.36, 0.32], [0, 0, 0], spec.color);
  }
  return g;
}

export function potModel() {
  const g = new T.Group();
  ball(g, [0.26, 0.3, 0.26], [0, 0, 0], '#b5643c', 8);
  cylinder(g, 0.1, 0.12, [0, 0.28, 0], '#8d4a2c', 8);
  return g;
}

export function gooseModel() {
  const g = new T.Group();
  ball(g, [0.32, 0.28, 0.42], [0, 0.35, 0], '#f0ede6');
  cylinder(g, 0.09, 0.35, [0, 0.6, 0.22], '#f0ede6');
  ball(g, [0.15, 0.15, 0.2], [0, 0.8, 0.3], '#f0ede6');
  cone(g, 0.08, 0.24, [0, 0.78, 0.48], '#e88228');
  const wL = box(g, [0.08, 0.25, 0.38], [-0.3, 0.38, 0], '#ded8cc');
  wL.name = 'wingL';
  const wR = box(g, [0.08, 0.25, 0.38], [0.3, 0.38, 0], '#ded8cc');
  wR.name = 'wingR';
  return g;
}

export function blockModel(b: Block) {
  const g = new T.Group();
  if (b.part === 'banner' || b.mascotKind === 'banner') {
    const bannerColor = b.team === 'blue' ? '#2f7d74' : '#c2472f';
    box(g, [1.56, 0.6, 1.56], [0, -b.h / 2 + 0.3, 0], '#b0a289', true);
    cylinder(g, 0.09, b.h, [0, 0, 0], '#6b4a2c', 8);
    const cloth = box(
      g,
      [0.06, 1.15, 1.35],
      [0, b.h / 2 - 0.85, 0.72],
      bannerColor,
      false,
    );
    cloth.name = 'cloth';
    box(cloth, [0.07, 0.34, 0.4], [0.01, 0.06, 0], '#e8c46a', false);
    cone(g, 0.11, 0.3, [0, b.h / 2 + 0.15, 0], '#d8b45c');
    return g;
  }
  if (b.part === 'mascot' && b.mascotKind === 'rooster') {
    box(g, [1.1, 0.25, 1.1], [0, -b.h / 2 + 0.12, 0], '#b0a289', true);
    ball(g, [0.42, 0.48, 0.38], [0, 0, 0], '#d8a13d');
    ball(g, [0.22, 0.24, 0.22], [0, 0.42, 0.18], '#e8c46a');
    box(g, [0.06, 0.18, 0.2], [0, 0.6, 0.18], '#c2472f');
    cone(g, 0.07, 0.16, [0, 0.4, 0.4], '#e0882e');
    box(g, [0.08, 0.3, 0.4], [-0.38, 0.04, 0], '#b88628');
    box(g, [0.08, 0.3, 0.4], [0.38, 0.04, 0], '#b88628');
    cone(g, 0.18, 0.5, [0, 0.26, -0.35], '#d8a13d');
    return g;
  }
  if (b.part === 'mascot' && b.mascotKind === 'cheese') {
    box(g, [1.2, 0.2, 1.2], [0, -b.h / 2 + 0.1, 0], '#b0a289', true);
    cylinder(g, 0.7, 0.52, [0, 0, 0], '#e8be48', 20);
    cylinder(g, 0.72, 0.12, [0, 0, 0], '#d89e32', 20);
    ball(g, [0.12, 0.12, 0.12], [0.25, 0.1, 0.25], '#caa030');
    ball(g, [0.09, 0.09, 0.09], [-0.3, -0.08, -0.15], '#caa030');
    return g;
  }
  const mesh = box(g, [b.w, b.h, b.d], [0, 0, 0], b.color, b.part !== 'gate');
  mesh.name = 'stone';
  if (b.part === 'gate') {
    for (const y of [-0.35, 0.35])
      box(g, [b.w * 0.92, 0.12, 0.1], [0, y, b.d / 2], '#4a3524');
    for (const x of [-0.7, 0, 0.7])
      box(g, [0.09, b.h * 0.85, 0.08], [x, 0, b.d / 2], '#4a3524');
  }
  const glow = box(
    g,
    [b.w * 1.02, b.h * 1.02, b.d * 1.02],
    [0, 0, 0],
    '#e07a32',
    false,
  );
  glow.name = 'fire';
  glow.visible = false;
  glow.castShadow = false;
  glow.receiveShadow = false;
  return g;
}

/**
 * The whole engine turns on its bed, so the crew can swing the aim by leaning
 * on the frame. Named parts drive the wind-up and the release sweep.
 */
export function trebuchet(
  pos: { x: number; z: number } = TREBUCHET,
  team: 'red' | 'blue' = 'red',
) {
  const g = new T.Group();
  g.position.set(pos.x, 0, pos.z);
  const bed = new T.Group();
  bed.name = 'bed';
  const accentColor = team === 'blue' ? '#2f7d74' : '#c2472f';
  // Ground bed and A-frames.
  for (const x of [-2.5, 2.5])
    box(bed, [0.55, 0.4, 9], [x, 0.2, 0], '#6b4a2c', true);
  box(bed, [5.6, 0.36, 0.7], [0, 0.18, -3.4], '#5c3f26', true);
  box(bed, [5.6, 0.36, 0.7], [0, 0.18, 2.6], '#5c3f26', true);
  for (const x of [-2.5, 2.5]) {
    beam(bed, [x, 0.4, 1.5], [x, 4.6, 0], 0.42, '#7a5533');
    beam(bed, [x, 0.4, -1.5], [x, 4.6, 0], 0.42, '#7a5533');
    box(bed, [0.34, 0.34, 3.4], [x, 3.1, 0], '#6b4a2c');
  }
  box(bed, [5.6, 0.42, 0.42], [0, 4.6, 0], '#5c3f26');
  const pivot = new T.Group();
  pivot.name = 'pivot';
  pivot.position.set(0, 4.6, 0);
  const arm = new T.Group();
  arm.name = 'arm';
  // Long throwing beam: the weighted end reaches out over the castle side, the
  // sling end back over the crew. Winching the sling end down to the loading
  // spot is what lifts the weight, and the weight falling is what throws.
  const shaft = box(arm, [0.34, 0.34, 8.6], [0, 0, 0.1], '#8a6238', true);
  shaft.name = 'shaft';
  box(arm, [0.5, 0.5, 0.5], [0, 0, -4], '#6b4a2c', true);
  const weight = new T.Group();
  weight.name = 'counterweight';
  weight.position.set(0, 0, -4);
  box(weight, [1.9, 1.7, 1.7], [0, -1.35, 0], '#5c452c', true);
  for (const y of [-0.85, -1.85])
    box(weight, [2.02, 0.16, 1.82], [0, y, 0], '#3f2f1e');
  beam(weight, [0, 0, 0], [-0.7, -0.6, 0], 0.09, '#3f2f1e');
  beam(weight, [0, 0, 0], [0.7, -0.6, 0], 0.09, '#3f2f1e');
  arm.add(weight);
  const sling = new T.Group();
  sling.name = 'sling';
  sling.position.set(0, 0, 4.2);
  const pouch = box(sling, [1.15, 0.16, 1.15], [0, -1.55, 0], '#8d6b45', true);
  pouch.name = 'pouch';
  beam(sling, [0, 0, 0], [-0.5, -1.5, 0], 0.05, '#6b563a');
  beam(sling, [0, 0, 0], [0.5, -1.5, 0], 0.05, '#6b563a');
  const payload = new T.Group();
  payload.name = 'payload';
  payload.position.set(0, -1.05, 0);
  sling.add(payload);
  arm.add(sling);
  pivot.add(arm);
  bed.add(pivot);
  // Winch, rope drum and release lever, each a place a crewmate stands.
  const winch = new T.Group();
  winch.name = 'winch';
  winch.position.set(0, 0, CRANK.z - TREBUCHET.z);
  for (const x of [-1.2, 1.2])
    box(winch, [0.4, 1.5, 0.4], [x, 0.75, 0], '#6b4a2c', true);
  const drum = cylinder(winch, 0.45, 2.2, [0, 1.4, 0], '#8a6238');
  drum.rotation.z = Math.PI / 2;
  drum.name = 'drum';
  for (const x of [-1.5, 1.5]) {
    const handle = box(drum, [0.12, 0.7, 0.12], [0, x, 0.5], '#b98a4a', true);
    handle.name = 'handle';
  }
  bed.add(winch);
  const lever = new T.Group();
  lever.name = 'lever';
  lever.position.set(LEVER.x - TREBUCHET.x, 0, LEVER.z - TREBUCHET.z);
  box(lever, [0.5, 1.1, 0.5], [0, 0.55, 0], '#6b4a2c', true);
  const handle = box(lever, [0.16, 1.3, 0.16], [0, 1.5, 0], accentColor, true);
  handle.name = 'handle';
  ball(lever, [0.16, 0.16, 0.16], [0, 2.15, 0], '#e8c46a');
  bed.add(lever);
  g.add(bed);
  return g;
}

/** The supply pile, the camp behind it, and the ground the crew works on. */
export function siegeField() {
  const g = new T.Group();
  const ground = box(g, [80, 1.2, 88], [0, -0.6, -4], '#7c8455');
  ground.receiveShadow = true;
  // Dry track from the camp to the gate, so the throw line reads at a glance.
  for (let i = 0; i < 18; i++)
    box(
      g,
      [5.6, 0.06, 2.6],
      [Math.sin(i * 0.7) * 1.2, 0.01, 20 - i * 2.6],
      i % 2 ? '#9a8460' : '#947d5b',
    );
  for (const s of [-1, 1])
    for (let i = 0; i < 9; i++)
      box(
        g,
        [1.2, 0.5, 1.2],
        [s * (13 + (i % 3) * 1.4), 0.2, 16 - i * 4.2],
        i % 2 ? '#6d7648' : '#7f8a55',
      );
  // Camp tents behind the engine.
  for (const [x, z, c] of [
    [-13, 23, '#b8452f'],
    [12, 23.5, '#8d6b45'],
    [-19, 18, '#8d6b45'],
    [18, 17, '#b8452f'],
  ] as [number, number, string][]) {
    cone(g, 2.3, 3, [x, 1.5, z], c as string);
    box(g, [0.16, 3.6, 0.16], [x, 1.8, z], '#5c3f26');
    ball(g, [0.2, 0.2, 0.2], [x, 3.4, z], '#e8c46a');
  }
  // A dry ditch scraped in front of the wall, so short shots visibly fall short.
  box(g, [34, 0.3, 3.2], [0, -0.13, CASTLE.z + 6.6], '#6f6144');
  const pile = new T.Group();
  pile.name = 'pile';
  pile.position.set(PILE.x, 0, PILE.z);
  box(pile, [4.4, 0.5, 3.4], [0, 0.25, 0], '#7a5533', true);
  for (const [x, z, r] of [
    [-1.2, -0.7, 0.62],
    [0.3, 0.6, 0.58],
    [1.3, -0.5, 0.5],
    [-0.4, 0.1, 0.66],
  ] as [number, number, number][])
    ball(pile, [r, r * 0.9, r], [x, 0.5 + r * 0.8, z], '#8e8778', 7);
  const sign = label('SUPPLY', '#2a2420', '#e8c46a', 2.6);
  sign.position.set(0, 2.4, 0);
  pile.add(sign);
  g.add(pile);
  batchScenery(g);
  return g;
}

/** Defenders on the battlements, hidden while the bees are working. */
export function defenders() {
  const g = new T.Group();
  g.name = 'defenders';
  for (const post of defenderPosts()) {
    const d = new T.Group();
    d.position.set(post.x, post.y, post.z);
    box(d, [0.44, 0.6, 0.3], [0, 0.3, 0], '#4a5a72', true);
    ball(d, [0.28, 0.3, 0.26], [0, 0.78, 0], '#d8b48c');
    cone(d, 0.24, 0.34, [0, 1.06, 0], '#8f9aa8');
    const arm = box(d, [0.16, 0.42, 0.16], [0.3, 0.42, 0], '#4a5a72', true);
    arm.name = 'throw';
    g.add(d);
  }
  return g;
}
