import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { shouldRenderFrame } from '../../shared/rendering/runtime';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import { box, label } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import {
  getEquippedLook,
  subscribeWardrobe,
} from '../../shared/wardrobe/wardrobe-state';
import { pine, poseRider, riderModel } from './models';
import {
  FINISH_Z,
  HALF_WIDTH,
  KICKERS,
  slopeY,
  type Feature,
  type Snapshot,
} from './types';

type Avatar = { root: T.Group; body: T.Group; signature: string };

function slopeMesh() {
  const geo = new T.BufferGeometry();
  const verts: number[] = [],
    colors: number[] = [];
  const tint = [new T.Color('#e7f3ee'), new T.Color('#d2e9e6')];
  for (let z = -24; z < FINISH_Z + 44; z += 16) {
    for (const [x0, x1, lane] of [
      [-38, -HALF_WIDTH, 0],
      [-HALF_WIDTH, HALF_WIDTH, 1],
      [HALF_WIDTH, 38, 0],
    ] as const) {
      const y0 = slopeY(z),
        y1 = slopeY(z + 16);
      verts.push(
        x0,
        y0,
        z,
        x0,
        y1,
        z + 16,
        x1,
        y0,
        z,
        x1,
        y0,
        z,
        x0,
        y1,
        z + 16,
        x1,
        y1,
        z + 16,
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

function featureModel(f: Feature) {
  const root = new T.Group();
  const main = f.wild ? '#fa8154' : f.kind === 'ramp' ? '#e7b24d' : '#24a5aa';
  if (f.kind === 'ramp') {
    box(root, [3.5, 0.45, 3.3], [0, 0.24, 0], main, true);
    const lip = box(root, [3.5, 0.24, 0.5], [0, 0.58, 1.36], '#fff3cf', true);
    lip.rotation.x = -0.12;
  } else {
    box(root, [0.18, 1.0, 5.2], [-0.35, 0.5, 0], '#2d5c6a', true);
    box(root, [0.18, 1.0, 5.2], [0.35, 0.5, 0], '#2d5c6a', true);
    box(root, [1.15, 0.18, 5.5], [0, 1.08, 0], main, true);
  }
  root.position.set(f.x, slopeY(f.z), f.z);
  return root;
}

export class SlopeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(62, 1, 0.1, 210);
  private renderer: T.WebGLRenderer;
  private observer: ResizeObserver;
  private frame = 0;
  private previous = 0;
  private self = 'local';
  private current: Snapshot | null = null;
  private avatars = new Map<string, Avatar>();
  private features = new Map<number, T.Group>();
  private unsubscribe: () => void;
  private lookVersion = 0;

  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      label:
        'Slopewreck. Steer with A and D, tuck with W, brake with S, jump with Space, make a ramp with Q or rail with E while airborne.',
      exposure: HOUSE_EXPOSURE,
      shadows: 'soft',
      weight: 'heavy',
    }).renderer;
    addHouseLight(this.scene, { sky: '#c2e6ed', fog: { near: 85, far: 205 } });
    this.scene.add(slopeMesh());
    const scenery = new T.Group();
    this.scene.add(scenery);
    for (let z = -16; z <= FINISH_Z + 28; z += 16) {
      for (const side of [-1, 1]) {
        const x =
          side * (HALF_WIDTH + 3 + (Math.sin(z * 0.34 + side) + 1) * 2.2);
        pine(
          scenery,
          x,
          z + Math.sin(z * 2.5) * 4,
          slopeY(z),
          0.9 + (Math.sin(z * 0.18 + side) + 1) * 0.32,
        );
      }
      for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
        box(scenery, [0.16, 0.07, 2], [x, slopeY(z) + 0.05, z], '#28a5ab');
      }
    }
    for (const z of KICKERS) {
      const root = new T.Group();
      root.position.set(0, slopeY(z), z);
      box(root, [16, 0.4, 3.4], [0, 0.2, 0], '#f2b946', true);
      for (const x of [-6, -2, 2, 6])
        box(root, [1.5, 0.04, 0.42], [x, 0.44, 1.2], '#fff3cd');
      scenery.add(root);
    }
    {
      const z = FINISH_Z;
      box(scenery, [0.45, 6.2, 0.45], [-11, slopeY(z) + 3, z], '#234b63', true);
      box(scenery, [0.45, 6.2, 0.45], [11, slopeY(z) + 3, z], '#234b63', true);
      box(scenery, [22.4, 1.1, 0.55], [0, slopeY(z) + 6.2, z], '#f5885b', true);
      const sign = label('FINISH', '#173e5a', '#f8f3df', 5.5);
      sign.position.set(0, slopeY(z) + 6.2, z - 0.42);
      scenery.add(sign);
    }
    batchScenery(scenery);
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
        avatar.root.position.lerp(
          new T.Vector3(p.x, slopeY(p.z) + p.height, p.z),
          smooth,
        );
        avatar.root.rotation.y = p.trick ? (p.spin / 180) * Math.PI : 0;
        avatar.root.rotation.z =
          w.clock < p.wipeoutUntil ? 0.78 : -p.input.steer * 0.12;
        poseRider(avatar.body, p, w.clock / 1000);
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
        this.camera.position.lerp(
          new T.Vector3(me.x * 0.72, slopeY(z) + 8.5 + me.height * 0.3, z - 16),
          smooth,
        );
        this.camera.lookAt(me.x * 0.5, slopeY(z + 16) + 2.5, z + 16);
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
