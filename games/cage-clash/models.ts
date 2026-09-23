import * as T from 'three';
import { box, ball, taper, beam } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { TEAM, CLOTH } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { CAGE_RADIUS, type Fighter, type Grapple } from './types';
import { cageVertices } from './physics';
import { MOVES } from './combat';
import {
  guardFist,
  kickMotion,
  strikeMotion,
  type Point,
} from './strike-motion';
import { label } from './signage';
import { createRingside } from './ringside';
import { groundPose } from './ground-pose';

export function createCage() {
  const root = new T.Group();
  box(root, [35, 0.3, 30], [0, -0.8, 0], '#9aab95', true);
  const base = new T.Mesh(
    new T.CylinderGeometry(CAGE_RADIUS + 0.35, CAGE_RADIUS + 0.5, 0.6, 8),
    new T.MeshStandardMaterial({ color: '#355a55', roughness: 0.85 }),
  );
  base.rotation.y = Math.PI / 8;
  base.position.y = -0.27;
  base.receiveShadow = true;
  root.add(base);
  const mat = new T.Mesh(
    new T.CylinderGeometry(CAGE_RADIUS, CAGE_RADIUS, 0.06, 8),
    new T.MeshStandardMaterial({ color: '#8cae9c', roughness: 0.9 }),
  );
  mat.rotation.y = Math.PI / 8;
  mat.position.y = 0.05;
  mat.receiveShadow = true;
  root.add(mat);
  const center = label('CAGE CLASH', '#f6e5bd', '#527c69', 4.2, 0.9);
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.09, 0);
  root.add(center);
  const sub = label('JUMBLEYARD FIGHT CLUB', '#f6e5bd', '#527c69', 3.4, 0.35);
  sub.rotation.x = -Math.PI / 2;
  sub.position.set(0, 0.095, 0.72);
  root.add(sub);
  const vertices = cageVertices();
  const fences: {
    material: T.LineBasicMaterial;
    frameMaterials: T.MeshStandardMaterial[];
    x: number;
    z: number;
  }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % 8];
    const frame = [
      taper(root, 0.11, 0.14, 2.15, [a.x, 1.05, a.z], '#355a55', 10),
      ball(root, [0.15, 0.15, 0.15], [a.x, 2.16, a.z], '#e0bd70'),
      beam(root, [a.x, 2.1, a.z], [b.x, 2.1, b.z], 0.1, '#355a55'),
      beam(root, [a.x, 0.15, a.z], [b.x, 0.15, b.z], 0.1, '#355a55'),
    ];
    const frameMaterials = frame.map((mesh) => {
      mesh.material = mesh.material.clone();
      mesh.material.userData.shared = false;
      mesh.material.transparent = true;
      return mesh.material;
    });
    const points: number[] = [];
    for (let j = -18; j <= 18; j++)
      for (const slope of [-1, 1]) {
        const u0 = j / 18,
          u1 = u0 + slope * 0.45;
        const start = Math.max(
          0,
          Math.min((0 - u0) / (u1 - u0), (1 - u0) / (u1 - u0)),
        );
        const end = Math.min(
          1,
          Math.max((0 - u0) / (u1 - u0), (1 - u0) / (u1 - u0)),
        );
        if (end <= start) continue;
        for (const t of [start, end]) {
          const u = u0 + (u1 - u0) * t;
          points.push(
            a.x + (b.x - a.x) * u,
            0.2 + 1.85 * t,
            a.z + (b.z - a.z) * u,
          );
        }
      }
    const material = new T.LineBasicMaterial({
      color: '#355a55',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    root.add(
      new T.LineSegments(
        new T.BufferGeometry().setAttribute(
          'position',
          new T.Float32BufferAttribute(points, 3),
        ),
        material,
      ),
    );
    fences.push({
      material,
      frameMaterials,
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
    });
  }
  for (const [x, color] of [
    [-4.5, TEAM.red],
    [4.5, TEAM.blue],
  ] as const) {
    const corner = new T.Mesh(
      new T.CircleGeometry(0.42, 24),
      new T.MeshBasicMaterial({ color }),
    );
    corner.rotation.x = -Math.PI / 2;
    corner.position.set(x, 0.095, 0);
    root.add(corner);
  }
  const ringside = createRingside();
  root.add(ringside.root);
  return { root, fences, crowd: ringside.crowd };
}

export function createFighter(p: Fighter, look?: Look) {
  const root = new T.Group();
  const { model } = dressedGameAvatar(
    p.color,
    {
      shirt: TEAM[p.team],
      overalls: TEAM[p.team],
      boots: CLOTH.cream,
      trousers: false,
    },
    look,
  );
  root.add(model);
  const rig = model.userData as Record<string, T.Group>;
  const arms = (['L', 'R'] as const).map((side) => {
    const parent = rig['arm' + side];
    rig['sleeve' + side].visible = false;
    const upper = ball(parent, [0.065, 0.1, 0.065], [0, -0.1, 0], '#de9268');
    const elbow = ball(parent, [0.067, 0.067, 0.067], [0, -0.2, 0], '#de9268');
    const forearm = ball(parent, [0.064, 0.1, 0.064], [0, -0.3, 0], '#de9268');
    const glove = new T.Group();
    parent.add(glove);
    // Open-finger MMA gloves leave the palm and fingertips visible for grappling.
    ball(glove, [0.079, 0.083, 0.066], [0, 0, -0.01], '#de9268');
    box(glove, [0.19, 0.1, 0.13], [0, 0.025, 0.04], TEAM[p.team], true);
    box(glove, [0.15, 0.045, 0.125], [0, -0.087, 0], CLOTH.cream, true);
    for (const x of [-0.066, -0.022, 0.022, 0.066])
      ball(glove, [0.021, 0.034, 0.028], [x, 0.109, -0.008], '#de9268', 10);
    ball(
      glove,
      [0.031, 0.039, 0.032],
      [side === 'L' ? -0.1 : 0.1, 0.005, -0.015],
      '#de9268',
      10,
    );
    return { upper, elbow, forearm, glove, side: side === 'L' ? -1 : 1 };
  });
  const ring = new T.Mesh(
    new T.RingGeometry(0.43, 0.51, 32),
    new T.MeshBasicMaterial({
      color: TEAM[p.team],
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.13;
  root.add(ring);
  const marker = new T.Mesh(
    new T.ConeGeometry(0.12, 0.26, 4),
    new T.MeshBasicMaterial({ color: '#f3ca6b' }),
  );
  marker.rotation.z = Math.PI;
  marker.position.y = 2.4;
  root.add(marker);
  const groundLegs = ([-1, 1] as const).map((side) => {
    const group = new T.Group();
    root.add(group);
    const thigh = ball(group, [0.125, 0.1, 0.125], [0, 0, 0], TEAM[p.team]);
    const knee = ball(group, [0.095, 0.095, 0.095], [0, 0, 0], '#de9268');
    const shin = ball(group, [0.075, 0.1, 0.075], [0, 0, 0], '#de9268');
    const foot = ball(group, [0.1, 0.085, 0.17], [0, 0, 0], CLOTH.cream);
    group.visible = false;
    return { group, thigh, knee, shin, foot, side };
  });
  const kickGroup = new T.Group();
  kickGroup.position.copy(rig.legR.position);
  rig.body.add(kickGroup);
  const kickLeg = {
    group: kickGroup,
    thigh: ball(kickGroup, [0.13, 0.1, 0.13], [0, -0.12, 0], TEAM[p.team]),
    knee: ball(kickGroup, [0.095, 0.095, 0.095], [0, -0.25, 0], '#de9268'),
    shin: ball(kickGroup, [0.078, 0.1, 0.078], [0, -0.36, 0], '#de9268'),
    foot: ball(kickGroup, [0.1, 0.085, 0.17], [0, -0.48, 0.04], CLOTH.cream),
  };
  kickGroup.visible = false;
  return {
    root,
    model,
    rig,
    arms,
    groundLegs,
    kickLeg,
    marker,
    ring,
    team: p.team,
  };
}
export function poseFighter(
  visual: ReturnType<typeof createFighter>,
  p: Fighter,
  time: number,
  reduced: boolean,
  g: Grapple | null = null,
) {
  const { rig, model } = visual;
  model.position.x = model.position.z = 0;
  model.rotation.order = 'XYZ';
  rig.head.rotation.set(0, 0, 0);
  const grounded = !!g && g.mode !== 'clinch';
  rig.legL.visible = rig.legR.visible = !grounded;
  visual.kickLeg.group.visible = false;
  for (const limb of visual.groundLegs) limb.group.visible = grounded;
  const stride = Math.sin(time * 12) * Math.min(1, Math.hypot(p.vx, p.vz) / 3);
  model.position.y = p.down
    ? 0.35
    : reduced
      ? 0
      : Math.abs(Math.sin(time * 6)) * 0.025;
  model.rotation.set(
    p.down ? -Math.PI / 2 : p.dodge ? 0.35 : 0,
    p.heading,
    p.down ? 0.2 : 0,
  );
  rig.body.rotation.set(p.stagger ? -0.2 : 0.06, 0, 0);
  rig.legL.rotation.set(stride * 0.5, 0, -0.06);
  rig.legR.rotation.set(-stride * 0.5, 0, 0.06);
  rig.armL.rotation.set(p.guarding ? -2.3 : -1.2, 0.1, -0.25);
  rig.armR.rotation.set(p.guarding ? -2.3 : -1.2, -0.1, 0.25);
  if (p.charge > 0) {
    rig.armR.rotation.x = -0.6;
    rig.armR.rotation.z = 0.6;
    rig.body.rotation.y = -0.25;
  }
  if (p.attack > 0) {
    const profile = MOVES[p.move],
      elapsed = profile.duration - p.attack;
    const swing = strikeMotion(
      p.move,
      elapsed,
      p.move === 'jab' ? -1 : 1,
    ).drive;
    if (p.move === 'kick') {
      const kick = kickMotion(elapsed);
      rig.legR.visible = false;
      visual.kickLeg.group.visible = true;
      poseSegment(visual.kickLeg.thigh, [0, 0, 0], kick.knee);
      visual.kickLeg.knee.position.set(...kick.knee);
      poseSegment(visual.kickLeg.shin, kick.knee, kick.ankle);
      visual.kickLeg.foot.position.set(...kick.ankle);
      visual.kickLeg.foot.rotation.y = -kick.drive * 0.45;
      rig.legL.rotation.y = -kick.drive * 0.32;
      rig.legL.rotation.x = -kick.drive * 0.08;
      rig.body.rotation.x = -kick.drive * 0.16;
      rig.body.rotation.y = -kick.drive * 0.38;
      rig.head.rotation.y = kick.drive * 0.28;
      rig.armL.rotation.x = -1.2 - kick.drive * 0.2;
      rig.armR.rotation.x = -1.2 + kick.drive * 0.2;
    } else if (p.move === 'clinch') {
      rig.armL.rotation.x = rig.armR.rotation.x = -1.2 - swing * 0.6;
      rig.body.rotation.x = swing * 0.3;
    } else {
      const arm = p.move === 'jab' ? rig.armL : rig.armR;
      arm.rotation.x = -1.1 - swing;
      arm.rotation.y = p.move === 'hook' ? -swing * 0.8 : 0;
      const direction = p.move === 'jab' ? 1 : -1;
      rig.body.rotation.y =
        direction * swing * (p.move === 'hook' ? 0.24 : 0.22);
      rig.head.rotation.y = -rig.body.rotation.y * 0.55;
      rig.legR.rotation.y = p.move === 'jab' ? 0 : swing * 0.14;
    }
  }
  if (g?.mode === 'clinch') {
    rig.armL.rotation.x = rig.armR.rotation.x = -1.6;
    rig.body.rotation.x = 0.2;
  } else if (g) {
    const top = g.top === p.id;
    const pose = groundPose(top, g.mode === 'mount');
    model.position.set(...pose.position);
    if (top)
      model.position.z +=
        (g.mode === 'guard'
          ? -Math.max(0, g.progress)
          : -Math.min(0, g.progress)) * 0.22;
    model.rotation.set(...pose.rotation, 'YXZ');
    rig.body.rotation.set(0, 0, 0);
    rig.head.rotation.x = top ? 0.38 : 0;
    rig.armL.rotation.set(0, 0, 0);
    rig.armR.rotation.set(0, 0, 0);
    if (!top && p.input.guard && p.input.dodge) {
      rig.body.rotation.x = -0.28;
      rig.head.rotation.x = -0.12;
    } else if (!top && p.input.kick && !reduced) {
      rig.body.rotation.z = Math.sin(time * 8) * 0.08;
    }
    const scale = (model.userData.avatarRig as T.Group).scale.x;
    for (const limb of visual.groundLegs) {
      const hip = (limb.side < 0 ? rig.legL : rig.legR).position
        .clone()
        .multiplyScalar(scale)
        .applyQuaternion(model.quaternion)
        .add(model.position);
      const side = top ? -limb.side : limb.side;
      const knee = pose.knee(side),
        ankle = pose.ankle(side);
      if (!top && p.input.guard && p.input.dodge) knee[1] += 0.1;
      limb.knee.position.set(...knee);
      limb.foot.position.set(
        ankle[0],
        ankle[1],
        ankle[2] + (top ? 0.06 : 0.02),
      );
      poseSegment(limb.thigh, [hip.x, hip.y, hip.z], knee);
      poseSegment(limb.shin, knee, ankle);
    }
  }
  const standing = !g && !p.down;
  if (standing) {
    rig.armL.rotation.set(0, 0, 0);
    rig.armR.rotation.set(0, 0, 0);
  }
  for (const [index, limb] of visual.arms.entries()) {
    let fist: Point = standing ? guardFist(limb.side) : [0, -0.39, 0.07];
    if (g && g.mode !== 'clinch') {
      const top = g.top === p.id;
      const side = limb.side;
      fist = top ? [side * 0.15, -0.28, 0.22] : [side * 0.12, -0.15, 0.22];
      if (p.guarding) fist = [side * 0.11, -0.08, 0.27];
      if (p.input.kick || (p.input.dodge && !p.guarding))
        fist = [side * 0.18, -0.21, 0.36];
      if (g.submissionBy === p.id) fist = [side * 0.09, -0.05, 0.39];
      if (p.attack > 0 && index === p.punches % 2) {
        const drive = Math.sin(((0.3 - p.attack) / 0.3) * Math.PI);
        fist = [side * 0.1, -0.19 + drive * 0.09, 0.22 + drive * 0.32];
        rig.body.rotation.y = side * drive * 0.12;
      }
    }
    if (standing && p.guarding) fist = [-limb.side * 0.04, 0.3, 0.3];
    if (standing && p.charge > 0 && !p.attack) {
      const next =
        p.charge >= 0.4
          ? 'hook'
          : p.comboTime > 0 && p.combo === 1
            ? 'cross'
            : p.comboTime > 0 && p.combo === 2
              ? 'hook'
              : 'jab';
      if (index === (next === 'jab' ? 0 : 1))
        fist = strikeMotion(
          next,
          Math.min(1, p.charge / 0.4) * MOVES[next].windup * 0.3,
          limb.side,
        ).fist;
    }
    if (standing && p.attack > 0) {
      const motion = strikeMotion(
        p.move,
        MOVES[p.move].duration - p.attack,
        limb.side,
      );
      if (
        ['jab', 'cross', 'hook'].includes(p.move) &&
        index === (p.move === 'jab' ? 0 : 1)
      ) {
        fist = motion.fist;
      } else if (p.move === 'clinch')
        fist = [limb.side * 0.05, 0.12, 0.3 + motion.drive * 0.4];
    }
    const elbow: Point =
      g && g.mode !== 'clinch'
        ? [
            fist[0] * 0.6 + limb.side * 0.07,
            fist[1] * 0.55 - 0.17,
            fist[2] * 0.5,
          ]
        : standing &&
            p.attack > 0 &&
            ['jab', 'cross', 'hook'].includes(p.move) &&
            index === (p.move === 'jab' ? 0 : 1)
          ? strikeMotion(p.move, MOVES[p.move].duration - p.attack, limb.side)
              .elbow
          : standing
            ? [
                fist[0] * 0.45 + limb.side * 0.09,
                fist[1] * 0.45 - 0.16,
                fist[2] * 0.43,
              ]
            : [0, -0.19, 0];
    limb.elbow.position.set(...elbow);
    limb.glove.position.set(...fist);
    limb.glove.rotation.x = standing ? Math.PI / 2 : 0;
    poseSegment(limb.upper, [0, 0, 0], elbow);
    poseSegment(limb.forearm, elbow, fist);
  }
}

const segmentDirection = new T.Vector3();
const segmentUp = new T.Vector3(0, 1, 0);
function poseSegment(mesh: T.Mesh, from: Point, to: Point) {
  mesh.position.set(
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  );
  segmentDirection.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  mesh.scale.y = segmentDirection.length() / 2 + 0.035;
  mesh.quaternion.setFromUnitVectors(segmentUp, segmentDirection.normalize());
}
