import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { material } from '../../shared/rendering/primitives';
import { orb } from './objects';
import {
  restingGiantParts,
  SIT_PIVOT,
  armPosition,
  type Platform,
} from './level';
import type { GiantWorld, ItemKind, Vec } from './types';
import { giantJoints, THIGH, SHIN, UPPER_ARM, FOREARM } from './giant-motion';

const SKIN = '#dfa680',
  LIGHT_SKIN = '#edb991',
  SHIRT = '#739284',
  HAIR = '#ddd0ae';
function rounded(
  g: T.Object3D,
  size: number[],
  pos: number[],
  color: string,
  radius = 0.3,
) {
  const mesh = new T.Mesh(
    new RoundedBoxGeometry(size[0], size[1], size[2], 5, radius),
    material(color),
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function limb(
  g: T.Object3D,
  from: number[],
  to: number[],
  radius: number,
  color: string,
) {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to);
  const mesh = new T.Mesh(
    new T.CapsuleGeometry(
      radius,
      Math.max(0.01, a.distanceTo(b) - radius * 2),
      5,
      12,
    ),
    material(color),
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.sub(a).normalize(),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function hand() {
  const g = new T.Group();
  rounded(g, [1.35, 0.6, 1.35], [0, 0, 0], SKIN, 0.28);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.31,
      length = i === 0 || i === 3 ? 0.65 : 0.85;
    rounded(
      g,
      [0.29, 0.42, length],
      [x, -0.03, 0.55 + length * 0.3],
      LIGHT_SKIN,
      0.14,
    );
    rounded(
      g,
      [0.17, 0.035, 0.19],
      [x, 0.19, 0.72 + length * 0.3],
      '#f4ceb0',
      0.06,
    );
  }
  limb(g, [-0.5, -0.02, -0.15], [-1, -0.02, 0.3], 0.22, SKIN);
  return g;
}
function shirt(g: T.Group, p: Platform) {
  const geometry = new T.BufferGeometry();
  const positions: number[] = [],
    indices: number[] = [];
  const rows = 18,
    columns = 32;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const fullness = Math.sin(Math.PI * t) ** 0.35;
    const width =
      p.id === 'chest'
        ? 0.7 + 0.3 * Math.sin(Math.PI * t)
        : 0.78 + 0.22 * Math.sin(Math.PI * t);
    for (let col = 0; col <= columns; col++) {
      const a = (col / columns) * Math.PI * 2;
      const x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.72;
      const y = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.72;
      positions.push(
        ((x * p.w) / 2) * width,
        -p.h / 2 + ((y * p.h) / 2) * (0.8 + fullness * 0.2),
        (t - 0.5) * p.d,
      );
      if (row < rows && col < columns) {
        const n = row * (columns + 1) + col;
        indices.push(
          n,
          n + 1,
          n + columns + 1,
          n + 1,
          n + columns + 2,
          n + columns + 1,
        );
      }
    }
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material(p.color));
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  // Recessed end caps close the neckline and hem without a square silhouette.
  for (const z of [-1, 1])
    orb(
      g,
      [p.w * (p.id === 'chest' ? 0.35 : 0.39), p.h * 0.4, 0.16],
      [0, -p.h / 2, (z * p.d) / 2],
      p.color,
    );
}
function part(p: Platform) {
  const g = new T.Group();
  if (p.id === 'belly' || p.id === 'chest') {
    if (p.id === 'belly') {
      const continuousShirt = new T.Group();
      continuousShirt.position.z = -1.125;
      shirt(continuousShirt, { ...p, d: 7.15 });
      g.add(continuousShirt);
    }
    // Rounded sides, a shirt opening and buttons make a continuous human torso.
    rounded(g, [0.2, 0.055, p.d - 0.65], [0, 0.018, 0], '#abc0a7', 0.045);
    for (const z of p.id === 'belly' ? [-1.3, 0, 1.3] : [-0.65, 0.55]) {
      orb(g, [0.15, 0.08, 0.15], [0, 0.07, z], '#dac183');
      orb(g, [0.035, 0.015, 0.035], [0, 0.15, z], '#8b7750');
    }
    if (p.id === 'belly') {
      rounded(g, [1.2, 0.08, 1], [1.6, 0.04, 0.45], '#547568', 0.17);
      rounded(g, [1.15, 0.07, 0.12], [1.6, 0.09, 0.02], '#b6c5a4', 0.04);
    } else {
      for (const side of [-1, 1]) {
        const collar = rounded(
          g,
          [1.22, 0.12, 0.78],
          [side * 0.68, 0.04, -1],
          '#c2cbb0',
          0.12,
        );
        collar.rotation.y = side * 0.3;
      }
      orb(g, [0.95, 0.67, 1], [0, -0.68, -1.75], SKIN);
    }
  } else if (p.id === 'head') {
    rounded(g, [p.w * 0.94, p.h, p.d * 0.94], [0, -p.h / 2, 0], SKIN, 1.12);
    for (const side of [-1, 1]) {
      orb(g, [0.44, 0.6, 0.56], [side * 2, -1, -0.1], LIGHT_SKIN);
      orb(g, [0.17, 0.31, 0.31], [side * 2.3, -0.82, -0.07], '#c68d70');
      orb(g, [0.58, 0.22, 0.56], [side * 1.08, -0.06, 0.33], '#e8ad87');
    }
    // Broad, warm beard and moustache frame the mouth rather than covering the face.
    orb(g, [1.65, 0.47, 0.9], [0, -0.34, 1.2], HAIR);
    for (const x of [-1.22, -0.62, 0, 0.62, 1.22])
      orb(
        g,
        [0.43, 0.32, 0.6],
        [x, -0.17, 1.62 - Math.abs(x) * 0.16],
        '#e5d7b8',
      );
    const mouth = orb(g, [0.39, 0.11, 0.24], [0, 0.2, 0.88], '#653e31');
    g.userData.mouth = mouth;
    for (const side of [-1, 1]) {
      const whisker = orb(g, [0.59, 0.19, 0.3], [side * 0.4, 0.27, 0.62], HAIR);
      whisker.rotation.y = side * 0.14;
      const x = side * 0.83;
      const white = orb(g, [0.45, 0.17, 0.39], [x, 0.055, -0.57], '#fff3d7');
      const pupil = orb(g, [0.19, 0.06, 0.22], [x, 0.225, -0.49], '#39443b');
      orb(pupil, [0.2, 0.1, 0.2], [-0.3, 1, -0.25], '#fffbe7');
      const lid = rounded(
        g,
        [0.86, 0.07, 0.13],
        [x, 0.17, -0.48],
        '#74523e',
        0.06,
      );
      lid.rotation.y = side * 0.09;
      const brow = rounded(
        g,
        [1, 0.16, 0.25],
        [x, 0.22, -1.06],
        '#97856a',
        0.08,
      );
      g.userData[side < 0 ? 'leftEye' : 'rightEye'] = {
        white,
        pupil,
        lid,
        brow,
      };
    }
    orb(g, [0.5, 0.47, 0.57], [0, 0.21, 0.02], LIGHT_SKIN);
    for (const x of [-0.2, 0.2])
      orb(g, [0.09, 0.025, 0.12], [x, 0.49, 0.36], '#b47657');
    rounded(g, [3.9, 0.72, 0.85], [0, -0.51, -1.55], '#8da294', 0.34);
    const cap = new T.Mesh(
      new T.ConeGeometry(1.75, 2.3, 16),
      material('#648171'),
    );
    cap.rotation.x = -Math.PI / 2;
    cap.rotation.z = -0.18;
    cap.position.set(-0.2, -0.89, -2.45);
    cap.castShadow = true;
    g.add(cap);
    orb(g, [0.4, 0.4, 0.4], [-0.43, -0.89, -3.53], '#eee0bb');
  }
  return g;
}

const UP = new T.Vector3(0, 1, 0);
const FORWARD = new T.Vector3(0, 0, 1);
const vector = (p: Vec) => new T.Vector3(p.x, p.y, p.z);

/** Sculpted, tapered segments with a fixed distance between the joint pivots. */
function bone(length: number, radius: number, color: string) {
  const group = new T.Group();
  const profile = [
    [0.64, 0],
    [0.88, 0.08],
    [1, 0.28],
    [0.92, 0.55],
    [0.7, 0.83],
    [0.63, 1],
  ].map(([r, y]) => new T.Vector2(r * radius, y * length));
  const mesh = new T.Mesh(new T.LatheGeometry(profile, 20), material(color));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  orb(group, [radius * 0.66, radius * 0.66, radius * 0.66], [0, 0, 0], color);
  orb(
    group,
    [radius * 0.63, radius * 0.63, radius * 0.63],
    [0, length, 0],
    color,
  );
  return group;
}
function aim(group: T.Group, from: Vec, to: Vec) {
  group.position.copy(vector(from));
  group.quaternion.setFromUnitVectors(
    UP,
    vector(to).sub(vector(from)).normalize(),
  );
}
function foot(side: number) {
  const group = new T.Group();
  // A heel, raised instep, broad forefoot and five graded toes share a flat sole.
  rounded(group, [1.38, 0.52, 1.85], [0, -0.12, 0.35], SKIN, 0.24);
  orb(group, [0.57, 0.4, 0.66], [0, 0.03, 0.03], SKIN);
  for (let i = 0; i < 5; i++) {
    const x = side * (i - 2) * 0.26;
    const r = 0.24 - i * 0.021;
    orb(
      group,
      [r, 0.22, 0.32 - i * 0.022],
      [x, -0.06, 1.18 - i * 0.035],
      LIGHT_SKIN,
    );
    rounded(
      group,
      [r * 1.25, 0.025, 0.18],
      [x, 0.145, 1.28 - i * 0.035],
      '#f4ceb0',
      0.03,
    );
  }
  return group;
}

/** Joint positions are shared with collision; interpolate the clock, never bone lengths. */
export class GiantModel extends T.Group {
  torso = new T.Group();
  legs = new T.Group();
  parts = new Map<string, T.Group>();
  heights = new Map<string, number>();
  legRigs = ([-1, 1] as const).map((side) => ({
    thigh: bone(THIGH, 0.92, '#637f73'),
    shin: bone(SHIN, 0.67, '#6d897b'),
    foot: foot(side),
  }));
  armRigs = ([-1, 1] as const).map((side) => {
    const upper = bone(UPPER_ARM, 0.76, SHIRT);
    const forearm = bone(FOREARM, 0.55, SKIN);
    const palm = hand();
    palm.scale.x = -side;
    rounded(
      upper,
      [1.04, 0.3, 1.02],
      [0, UPPER_ARM - 0.22, 0],
      '#a7baa4',
      0.13,
    );
    return { upper, forearm, palm };
  });
  private poseClock = Number.NaN;
  private escapeAt = 0;
  private surfaceRay = new T.Raycaster();
  constructor(w: GiantWorld) {
    super();
    this.add(this.torso, this.legs);
    for (const p of restingGiantParts(w, w.started)) {
      if (!['belly', 'chest', 'head'].includes(p.id)) continue;
      const model = part(p);
      this.parts.set(p.id, model);
      this.heights.set(p.id, p.id === 'head' ? 2.35 : 2.3);
      this.torso.add(model);
    }
    // A waist and pelvis join the tapered thighs beneath the shirt hem.
    orb(this.torso, [2.08, 0.78, 1.3], [0, 0.27, -1.1], '#637f73');
    for (const rig of this.legRigs)
      this.legs.add(rig.thigh, rig.shin, rig.foot);
    for (const rig of this.armRigs) this.add(rig.upper, rig.forearm, rig.palm);
    // Keep the room's low-poly materials intact; the giant has smooth skin and cloth.
    const smooth = new Map<T.Material, T.Material>();
    this.traverse((object) => {
      if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
      let mat = smooth.get(object.material);
      if (!mat) {
        const cloned = object.material.clone() as T.MeshStandardMaterial;
        cloned.flatShading = false;
        smooth.set(object.material, cloned);
        mat = cloned;
      }
      object.material = mat;
      object.userData.ownedMaterial = true;
    });
    this.update(w, 1);
  }
  get clock() {
    return this.poseClock;
  }
  /** Seat loose items on the visible skin/cloth, including the raised knees and nose. */
  restingLootPosition(point: Vec, kind: ItemKind): Vec {
    this.surfaceRay.set(
      new T.Vector3(point.x, point.y + 4, point.z),
      new T.Vector3(0, -1, 0),
    );
    const surface = this.surfaceRay.intersectObject(this, true)[0];
    if (!surface) return point;
    const clearance =
      kind === 'pouch'
        ? 0.2
        : kind === 'gem'
          ? 0.145
          : kind === 'cup'
            ? 0.13
            : 0.12;
    return { ...point, y: surface.point.y + clearance };
  }
  update(w: GiantWorld, mix: number) {
    if (
      !Number.isFinite(this.poseClock) ||
      this.escapeAt !== w.escapeAt ||
      w.clock < this.poseClock
    )
      this.poseClock = w.clock;
    else this.poseClock += (w.clock - this.poseClock) * mix;
    this.escapeAt = w.escapeAt;
    const joints = giantJoints(
      w,
      armPosition(w, this.poseClock),
      this.poseClock,
    );
    const wake = joints.wake;
    this.torso.rotation.x = wake.angle;
    this.torso.position.set(
      SIT_PIVOT.x,
      SIT_PIVOT.y + wake.lift,
      SIT_PIVOT.z + wake.shift,
    );
    for (const p of restingGiantParts(w, this.poseClock)) {
      const g = this.parts.get(p.id);
      if (!g) continue;
      g.position.set(p.x - SIT_PIVOT.x, p.y - SIT_PIVOT.y, p.z - SIT_PIVOT.z);
      g.scale.y = p.h / this.heights.get(p.id)!;
      if (p.id === 'head') g.scale.set(0.86, 0.93, 0.87);
    }
    joints.legs.forEach((leg, i) => {
      const rig = this.legRigs[i];
      aim(rig.thigh, leg.hip, leg.knee);
      aim(rig.shin, leg.knee, leg.ankle);
      rig.foot.position.copy(vector(leg.ankle));
      rig.foot.rotation.set(leg.footPitch, leg.footYaw, 0);
    });
    joints.arms.forEach((arm, i) => {
      const rig = this.armRigs[i];
      aim(rig.upper, arm.shoulder, arm.elbow);
      aim(rig.forearm, arm.elbow, arm.wrist);
      const direction = vector(arm.wrist).sub(vector(arm.elbow)).normalize();
      rig.palm.position.copy(vector(arm.wrist)).addScaledVector(direction, 0.3);
      rig.palm.quaternion.setFromUnitVectors(FORWARD, direction);
      const braced = new T.Quaternion().setFromAxisAngle(UP, arm.side * -0.25);
      rig.palm.quaternion.slerp(braced, arm.brace);
      rig.palm.rotation.z += arm.side * arm.reach * 0.12;
    });
    const head = this.parts.get('head')!;
    const awake = w.escapeAt > 0;
    const warn =
      w.pending?.kind === 'wake'
        ? Math.max(0, 1 - (w.pending.at - w.clock) / 3000)
        : 0;
    // Neck motion trails the chest during the first curl; gaze turns about the neck.
    head.rotation.x = -0.12 * Math.sin(wake.rise * Math.PI);
    head.rotation.z = awake ? -joints.look * wake.rise : 0;
    const blink =
      awake && wake.elapsed > 5800 && Math.sin(wake.elapsed / 1900) > 0.996;
    for (const side of [-1, 1]) {
      const eye = head.userData[side < 0 ? 'leftEye' : 'rightEye'];
      eye.white.visible = eye.pupil.visible = awake && !blink;
      eye.lid.visible = !awake || blink;
      eye.brow.rotation.y = side * (awake ? 0.48 : 0.09 + warn * 0.16);
      eye.brow.position.y = awake ? 0.26 : 0.22;
      eye.brow.position.z = awake ? -0.85 : -1.06;
      eye.white.scale.z = awake ? 0.28 : 0.39;
      eye.pupil.position.x = side * 0.83 + (awake ? joints.look * 0.35 : 0);
    }
    const mouth = head.userData.mouth as T.Mesh;
    const shouting = awake && wake.elapsed < 8500;
    const syllable = shouting ? 0.5 + 0.5 * Math.sin(wake.elapsed / 110) : 0;
    mouth.scale.x = awake ? 0.49 + syllable * 0.1 : 0.39;
    mouth.scale.z = awake ? 0.3 + syllable * 0.28 : 0.24;
    this.updateMatrixWorld(true);
  }
}
