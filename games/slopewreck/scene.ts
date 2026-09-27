import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { shouldRenderFrame } from '../../shared/rendering/runtime';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import { ball, box, label } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import {
  getEquippedLook,
  subscribeWardrobe,
} from '../../shared/wardrobe/wardrobe-state';
import { pine, poseRider, riderModel } from './models';
import { slopeCameraFrame, smoothCameraSteer } from './camera';
import { courseFrame, coursePoint, courseWidth } from './course';
import { HAZARDS, snowballX, type Hazard } from './hazards';
import {
  FINISH_Z,
  HALF_WIDTH,
  KICKERS,
  type Feature,
  type Snapshot,
} from './types';

type Avatar = { root: T.Group; body: T.Group; signature: string };

function slopeMesh() {
  const geo = new T.BufferGeometry();
  const verts: number[] = [],
    colors: number[] = [];
  const tint = [new T.Color('#e7f3ee'), new T.Color('#d2e9e6')];
  for (let z = -24; z < FINISH_Z + 44; z += 8) {
    for (const [x0, x1, lane] of [
      [-38, -HALF_WIDTH, 0],
      [-HALF_WIDTH, HALF_WIDTH, 1],
      [HALF_WIDTH, 38, 0],
    ] as const) {
      const p00 = coursePoint(x0, z);
      const p01 = coursePoint(x0, z + 8);
      const p10 = coursePoint(x1, z);
      const p11 = coursePoint(x1, z + 8);
      verts.push(
        p00.x,
        p00.y,
        p00.z,
        p01.x,
        p01.y,
        p01.z,
        p10.x,
        p10.y,
        p10.z,
        p10.x,
        p10.y,
        p10.z,
        p01.x,
        p01.y,
        p01.z,
        p11.x,
        p11.y,
        p11.z,
      );
      const c = tint[lane];
      for (let i = 0; i < 6; i++) colors.push(c.r, c.g, c.b);
    }
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      side: T.DoubleSide,
    }),
  );
}

function placeOnCourse(
  root: T.Object3D,
  lateral: number,
  distance: number,
  height = 0,
) {
  const point = coursePoint(lateral, distance, height);
  const frame = courseFrame(distance);
  root.position.set(point.x, point.y, point.z);
  root.rotation.order = 'YXZ';
  root.rotation.set(frame.pitch, frame.heading, -frame.bank);
}

function featureModel(f: Feature) {
  const root = new T.Group();
  const main = f.wild ? '#fa8154' : f.kind === 'ramp' ? '#e7b24d' : '#24a5aa';
  if (f.kind === 'ramp') {
    box(root, [3.74, 0.12, 3.5], [0, 0.08, 0], '#234b63', true);
    box(root, [3.5, 0.45, 3.3], [0, 0.24, 0], main, true);
    const lip = box(root, [3.5, 0.24, 0.5], [0, 0.58, 1.36], '#fff3cf', true);
    lip.rotation.x = -0.12;
    for (const x of [-1.66, 1.66])
      box(root, [0.13, 0.12, 3.15], [x, 0.51, -0.03], '#fff3cf', true);
  } else {
    box(root, [0.18, 1.0, 5.2], [-0.35, 0.5, 0], '#2d5c6a', true);
    box(root, [0.18, 1.0, 5.2], [0.35, 0.5, 0], '#2d5c6a', true);
    box(root, [1.15, 0.18, 5.5], [0, 1.08, 0], main, true);
    box(root, [1.26, 0.055, 5.62], [0, 1.19, 0], '#fff3cf', true);
  }
  placeOnCourse(root, f.x, f.z);
  return root;
}

function hazardModel(hazard: Hazard) {
  const root = new T.Group();
  root.name = `hazard-${hazard.id}`;
  if (hazard.type === 'snowball') {
    ball(
      root,
      [hazard.radius * 0.92, 0.05, hazard.radius * 0.7],
      [0, 0.045, 0],
      '#9bcaca',
      10,
    );
    const snowball = ball(
      root,
      [hazard.radius, hazard.radius, hazard.radius],
      [0, hazard.radius, 0],
      '#f8fbf2',
      12,
    );
    snowball.name = 'rolling-snowball';
    const warningBand = new T.Mesh(
      new T.TorusGeometry(hazard.radius * 0.72, 0.085, 6, 16),
      new T.MeshStandardMaterial({ color: '#f26f4d', roughness: 0.68 }),
    );
    warningBand.position.y = hazard.radius;
    warningBand.rotation.y = Math.PI / 2;
    warningBand.castShadow = true;
    root.add(warningBand);
  } else if (hazard.type === 'gate') {
    for (const side of [-1, 1]) {
      const x = side * hazard.gap * 0.5;
      box(root, [0.18, 2.25, 0.18], [x, 1.12, 0], '#173e5a', true);
      const flag = box(
        root,
        [0.9, 0.46, 0.06],
        [x + side * 0.42, 1.72, 0],
        side < 0 ? '#f26f4d' : '#f1bd43',
        true,
      );
      flag.rotation.z = side * -0.12;
    }
  } else {
    box(root, [hazard.halfX * 2, 0.86, 1.15], [0, 0.42, 0], '#d9efec', true);
    for (let x = -hazard.halfX + 0.7; x < hazard.halfX; x += 1.35)
      ball(root, [0.78, 0.42, 0.58], [x, 0.76, 0], '#f6fbef', 8);
  }
  return root;
}

export class SlopeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(60, 1, 0.1, 420);
  private renderer: T.WebGLRenderer;
  private observer: ResizeObserver;
  private frame = 0;
  private previous = 0;
  private self = 'local';
  private current: Snapshot | null = null;
  private avatars = new Map<string, Avatar>();
  private features = new Map<number, T.Group>();
  private hazards = new Map<string, T.Group>();
  private unsubscribe: () => void;
  private lookVersion = 0;
  private cameraRoll = 0;
  private cameraSteer = 0;
  private cameraTarget = new T.Vector3();
  private cameraTargetReady = false;

  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      label:
        'Slopewreck. Steer with A and D, tuck with W, brake with S, jump with Space, make a ramp with Q or rail with E while airborne.',
      exposure: HOUSE_EXPOSURE,
      shadows: 'soft',
      weight: 'heavy',
    }).renderer;
    addHouseLight(this.scene, {
      sky: '#c2e6ed',
      fog: { near: 175, far: 360 },
    });
    this.scene.add(slopeMesh());
    const scenery = new T.Group();
    this.scene.add(scenery);
    for (let z = -16; z <= FINISH_Z + 28; z += 16) {
      for (const side of [-1, 1]) {
        const x =
          side * (courseWidth(z) + 3 + (Math.sin(z * 0.34 + side) + 1) * 2.2);
        const point = coursePoint(x, z + Math.sin(z * 2.5) * 4);
        pine(
          scenery,
          point.x,
          point.z,
          point.y,
          0.9 + (Math.sin(z * 0.18 + side) + 1) * 0.32,
        );
      }
      for (const x of [-courseWidth(z), courseWidth(z)]) {
        const marker = new T.Group();
        box(marker, [0.18, 0.09, 2.3], [0, 0.06, 0], '#078d9f');
        placeOnCourse(marker, x, z);
        scenery.add(marker);
      }
    }
    for (const z of KICKERS) {
      const root = new T.Group();
      placeOnCourse(root, 0, z);
      box(root, [16.5, 0.12, 3.9], [0, 0.08, 0], '#234b63', true);
      box(root, [16, 0.46, 3.6], [0, 0.23, 0], '#eea72f', true);
      for (const x of [-6, -2, 2, 6])
        box(root, [1.5, 0.06, 0.46], [x, 0.5, 1.24], '#fff7d7');
      scenery.add(root);
    }
    {
      const z = FINISH_Z;
      const finish = new T.Group();
      box(finish, [0.45, 6.2, 0.45], [-11, 3, 0], '#234b63', true);
      box(finish, [0.45, 6.2, 0.45], [11, 3, 0], '#234b63', true);
      box(finish, [22.4, 1.1, 0.55], [0, 6.2, 0], '#f5885b', true);
      const sign = label('FINISH', '#173e5a', '#f8f3df', 5.5);
      sign.position.set(0, 6.2, -0.42);
      finish.add(sign);
      placeOnCourse(finish, 0, z);
      scenery.add(finish);
    }
    batchScenery(scenery);
    for (const hazard of HAZARDS) {
      const root = hazardModel(hazard);
      const x = hazard.type === 'snowball' ? snowballX(hazard, 0) : hazard.x;
      placeOnCourse(root, x, hazard.z);
      this.scene.add(root);
      this.hazards.set(hazard.id, root);
    }
    this.unsubscribe = subscribeWardrobe(() => {
      this.lookVersion++;
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  setLocalPlayer(id: string) {
    this.self = id;
    this.lookVersion++;
    this.cameraSteer = 0;
    this.cameraTargetReady = false;
  }
  render(snapshot: Snapshot) {
    this.current = snapshot;
  }
  private resize() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private animate = (now: number) => {
    this.frame = requestAnimationFrame(this.animate);
    if (!shouldRenderFrame(this.renderer)) return;
    const dt = Math.min(0.1, (now - (this.previous || now)) / 1000);
    this.previous = now;
    const w = this.current?.world;
    if (w) {
      const smooth = 1 - Math.exp(-dt * 13);
      for (const [id, avatar] of this.avatars)
        if (!w.players.some((p) => p.id === id)) {
          this.scene.remove(avatar.root);
          disposeObject(avatar.root);
          this.avatars.delete(id);
        }
      for (const p of w.players) {
        const local = p.id === this.self;
        const signature = `${p.color}:${p.name}:${local}:${local ? this.lookVersion : 0}`;
        let avatar = this.avatars.get(p.id);
        if (!avatar || avatar.signature !== signature) {
          if (avatar) {
            this.scene.remove(avatar.root);
            disposeObject(avatar.root);
          }
          const { root, body } = riderModel(
            p.color,
            local ? getEquippedLook() : undefined,
          );
          const tag = label(
            local ? 'YOU' : p.name,
            local ? '#f8e99c' : '#24546b',
            local ? '#204a5a' : '#ffffff',
            1.8,
          );
          tag.position.y = 2.55;
          root.add(tag);
          this.scene.add(root);
          avatar = { root, body, signature };
          this.avatars.set(p.id, avatar);
        }
        const point = coursePoint(p.x, p.z, p.height);
        const course = courseFrame(p.z);
        avatar.root.position.lerp(
          new T.Vector3(point.x, point.y, point.z),
          smooth,
        );
        avatar.root.rotation.order = 'YXZ';
        avatar.root.rotation.x = course.pitch;
        avatar.root.rotation.y =
          course.heading + (p.trick ? (p.spin / 180) * Math.PI : 0);
        avatar.root.rotation.z =
          -course.bank +
          (w.clock < p.wipeoutUntil ? 0.78 : -p.input.steer * 0.2) +
          (w.clock < p.impactUntil ? p.impactSide * 0.1 : 0);
        const trails = avatar.root.getObjectByName('snowboard-trails');
        if (trails) {
          trails.visible = p.grounded && p.speed > 8;
          trails.scale.z = T.MathUtils.clamp((p.speed - 6) / 7, 0.35, 1.35);
        }
        const spray = avatar.root.getObjectByName('snow-impact');
        if (spray) {
          spray.visible = w.clock < p.impactUntil;
          spray.position.x = p.impactSide * 0.46;
          spray.rotation.y = p.impactSide * -0.35;
        }
        poseRider(avatar.body, p, w.clock / 1000);
      }
      for (const hazard of HAZARDS) {
        const mesh = this.hazards.get(hazard.id);
        if (!mesh) continue;
        const x =
          hazard.type === 'snowball' ? snowballX(hazard, w.clock) : hazard.x;
        placeOnCourse(mesh, x, hazard.z, hazard.type === 'snowball' ? 0.02 : 0);
        if (hazard.type === 'snowball') {
          const ballMesh = mesh.getObjectByName('rolling-snowball');
          if (ballMesh) ballMesh.rotation.x = w.clock * 0.002 * hazard.speed;
        } else if (hazard.type === 'snowbank') {
          const collapsed = w.collapsedHazards.includes(hazard.id);
          const target = collapsed ? 0.18 : 1;
          mesh.scale.y += (target - mesh.scale.y) * smooth;
        }
      }
      for (const [id, mesh] of this.features)
        if (!w.features.some((f) => f.id === id)) {
          this.scene.remove(mesh);
          disposeObject(mesh);
          this.features.delete(id);
        }
      for (const f of w.features)
        if (!this.features.has(f.id)) {
          const mesh = featureModel(f);
          this.scene.add(mesh);
          this.features.set(f.id, mesh);
        }
      const me = w.players.find((p) => p.id === this.self) ?? w.players[0];
      if (me) {
        const z = Math.min(me.z, FINISH_Z - 6);
        this.cameraSteer = smoothCameraSteer(
          this.cameraSteer,
          me.input.steer,
          dt,
        );
        const frame = slopeCameraFrame({ ...me, z, steer: this.cameraSteer });
        if (w.clock < me.impactUntil) {
          const course = courseFrame(z);
          const nudge = me.impactSide * 0.24;
          frame.position.x += course.sideX * nudge;
          frame.position.z += course.sideZ * nudge;
        }
        const cameraSmooth = 1 - Math.exp(-dt * 6.5);
        const lensSmooth = 1 - Math.exp(-dt * 4.5);
        const targetSmooth = 1 - Math.exp(-dt * 5.5);
        this.camera.position.lerp(
          new T.Vector3(frame.position.x, frame.position.y, frame.position.z),
          cameraSmooth,
        );
        this.camera.fov += (frame.fov - this.camera.fov) * lensSmooth;
        this.camera.updateProjectionMatrix();
        const nextTarget = new T.Vector3(
          frame.target.x,
          frame.target.y,
          frame.target.z,
        );
        if (this.cameraTargetReady)
          this.cameraTarget.lerp(nextTarget, targetSmooth);
        else {
          this.cameraTarget.copy(nextTarget);
          this.cameraTargetReady = true;
        }
        this.camera.lookAt(this.cameraTarget);
        this.cameraRoll += (frame.roll - this.cameraRoll) * lensSmooth;
        this.camera.rotation.z += this.cameraRoll;
      }
    }
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.unsubscribe();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
