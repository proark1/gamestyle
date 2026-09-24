import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { shouldRenderFrame } from '../../shared/rendering/runtime';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import { ball, box, taper } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { poseWorker } from '../../shared/rendering/worker-pose';
import {
  getEquippedLook,
  subscribeWardrobe,
} from '../../shared/wardrobe/wardrobe-state';
import { CLOTH } from '../../shared/rendering/palette';
import { flipLabel, flipObject, flipPlayer } from './models';
import { COLORS, TABLE, charge, type Snapshot } from './types';
import { tableHeight } from './simulation';

type Avatar = {
  root: T.Group;
  body: T.Group;
  held: T.Group;
  selected: number;
  signature: string;
};
export class FlipScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(37, 1, 0.1, 120);
  private renderer: T.WebGLRenderer;
  private observer: ResizeObserver;
  private frame = 0;
  private previous = 0;
  private self = 'local';
  private current: Snapshot | null = null;
  private table = new T.Group();
  private avatars = new Map<string, Avatar>();
  private props = new Map<number, T.Group>();
  private targets: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[] = [];
  private rings: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[] = [];
  private unsubscribe: () => void;
  private lookVersion = 0;
  private ray = new T.Raycaster();
  private plane = new T.Plane(new T.Vector3(0, 1, 0), -TABLE.y);
  private vector = new T.Vector3();
  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      label:
        'Flip Happens. Aim on the table or use WASD. Hold Space and release in the gold band to flip. Q banks points. E changes object.',
      exposure: HOUSE_EXPOSURE,
      shadows: 'soft',
    }).renderer;
    const { sun } = addHouseLight(this.scene, {
      sky: '#dce3d4',
      fog: { near: 45, far: 95 },
    });
    sun.shadow.camera.left = sun.shadow.camera.bottom = -14;
    sun.shadow.camera.right = sun.shadow.camera.top = 14;
    const fixed = new T.Group();
    this.scene.add(fixed);
    box(fixed, [110, 0.2, 110], [0, -0.25, 0], '#bfc9ae');
    box(fixed, [15.6, 0.16, 12], [0, -0.09, 0], '#efe4cb', true);
    for (let x = -7; x <= 7; x += 1.4) {
      box(fixed, [0.025, 0.012, 11.4], [x, 0.001, 0], '#d9cba9');
    }
    for (const x of [-3.9, 3.9])
      for (const z of [-2.35, 2.35]) {
        taper(fixed, 0.2, 0.28, 1.2, [x, 0.6, z], CLOTH.brown, 12);
        ball(fixed, [0.28, 0.2, 0.28], [x, 1.18, z], CLOTH.gold);
      }
    box(this.table, [9.55, 0.28, 6.35], [0, -0.12, 0], '#b48c60', true);
    box(this.table, [9.2, 0.08, 6], [0, 0.03, 0], '#7caaa0', true);
    for (const x of [-4.35, 4.35])
      box(this.table, [0.035, 0.012, 5.65], [x, 0.078, 0], '#dbe7c7');
    for (const z of [-2.75, 2.75])
      box(this.table, [8.7, 0.012, 0.035], [0, 0.078, z], '#dbe7c7');
    for (let x = -3; x <= 3; x += 1.5)
      for (let z = -1.5; z <= 1.5; z += 1.5)
        ball(this.table, [0.025, 0.015, 0.025], [x, 0.085, z], '#cae0c9');
    this.table.position.y = TABLE.y;
    this.scene.add(this.table);
    batchScenery(this.table);
    const banner = flipLabel('FLIP RESPONSIBLY. OR DON’T.', '#fff2d7', 6.3);
    banner.position.set(0, 2.8, -6.1);
    fixed.add(banner);
    for (const x of [-5, 5]) {
      taper(fixed, 0.055, 0.055, 3.7, [x, 1.85, -6.1], CLOTH.brown);
      ball(fixed, [0.15, 0.15, 0.15], [x, 3.75, -6.1], CLOTH.gold);
    }
    // The existing hat prop doubles as a spectator decoration.
    for (const x of [-6.6, 6.6])
      for (const z of [-3, 0, 3]) {
        const decoration = flipObject(z === 0 ? 1 : 2, CLOTH.gold);
        decoration.position.set(x, 0.65, z);
        fixed.add(decoration);
        taper(fixed, 0.55, 0.65, 0.2, [x, 0.1, z], '#c5b287', 12);
      }
    batchScenery(fixed);
    for (let i = 0; i < 4; i++) {
      const target = new T.Mesh(
        new T.RingGeometry(0.48, 0.56, 48),
        new T.MeshBasicMaterial({
          color: COLORS[i],
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      target.rotation.x = -Math.PI / 2;
      this.scene.add(target);
      this.targets.push(target);
    }
    for (let i = 0; i < 8; i++) {
      const ring = new T.Mesh(
        new T.RingGeometry(0.94, 1, 48),
        new T.MeshBasicMaterial({
          color: '#fff3b8',
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.rings.push(ring);
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
  }
  render(s: Snapshot) {
    this.current = s;
  }
  aim(clientX: number, clientY: number) {
    const r = this.host.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        1 - ((clientY - r.top) / r.height) * 2,
      ),
      this.camera,
    );
    return this.ray.ray.intersectPlane(this.plane, this.vector)
      ? { x: this.vector.x, z: this.vector.z }
      : null;
  }
  private resize() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const distance = Math.max(18, 18 / this.camera.aspect);
    this.camera.position.set(0, distance * 0.74, distance * 0.78);
    this.camera.lookAt(0, 0.75, 0);
    this.camera.updateProjectionMatrix();
  }
  private animate = (now: number) => {
    this.frame = requestAnimationFrame(this.animate);
    if (!shouldRenderFrame(this.renderer)) return;
    const dt = Math.min(0.1, (now - (this.previous || now)) / 1000);
    this.previous = now;
    const w = this.current?.world;
    if (w) {
      const smooth = 1 - Math.exp(-dt * 24),
        time = w.clock / 1000;
      this.table.rotation.set(w.table.x, 0, w.table.z);
      for (const [id, a] of this.avatars)
        if (!w.players.some((p) => p.id === id)) {
          this.scene.remove(a.root);
          disposeObject(a.root);
          this.avatars.delete(id);
        }
      for (const p of w.players) {
        const local = p.id === this.self,
          signature = `${p.seat}:${p.name}:${local}:${local ? this.lookVersion : 0}`;
        let a = this.avatars.get(p.id);
        if (!a || a.signature !== signature) {
          if (a) {
            this.scene.remove(a.root);
            disposeObject(a.root);
          }
          const root = new T.Group(),
            body = flipPlayer(
              p.seat,
              p.color,
              local ? getEquippedLook() : undefined,
            );
          root.add(body);
          root.position.set(p.x, 0, p.z);
          const tag = flipLabel(
            local ? 'YOU' : p.name,
            local ? '#fff1ac' : '#fff5df',
            local ? 1 : 1.5,
          );
          tag.position.y = 2.15;
          root.add(tag);
          const held = flipObject(p.selected, COLORS[p.seat]);
          root.add(held);
          this.scene.add(root);
          a = { root, body, held, selected: p.selected, signature };
          this.avatars.set(p.id, a);
        }
        a.root.visible = w.mode !== 'daily' || !p.bot;
        if (a.selected !== p.selected) {
          a.root.remove(a.held);
          disposeObject(a.held);
          a.held = flipObject(p.selected, COLORS[p.seat]);
          a.root.add(a.held);
          a.selected = p.selected;
        }
        a.body.rotation.y = p.z > 0 ? Math.PI : 0;
        const celebrating = p.last === 'bank' && w.clock - p.lastAt < 1000;
        poseWorker(
          a.body,
          time,
          celebrating ? 'hero' : p.chargingAt !== null ? 'wave' : 'still',
        );
        a.held.position.set(
          0.6,
          1.25 + charge(w, p) * 0.45,
          p.z > 0 ? -0.1 : 0.1,
        );
        a.held.rotation.x = p.chargingAt === null ? 0 : -charge(w, p) * 0.65;
        a.held.visible = !w.props.some(
          (o) => o.owner === p.id && o.state === 'air' && !o.scored,
        );
        const target = this.targets[p.seat];
        target.visible = a.root.visible && (local || p.chargingAt !== null);
        target.position.set(
          p.aimX,
          tableHeight(w, p.aimX, p.aimZ) + 0.11,
          p.aimZ,
        );
        target.rotation.set(-Math.PI / 2 + w.table.x, w.table.z, 0);
        target.scale.setScalar(local ? 1 + Math.sin(time * 4) * 0.035 : 0.8);
      }
      for (const [id, obj] of this.props)
        if (!w.props.some((p) => p.id === id)) {
          this.scene.remove(obj);
          disposeObject(obj);
          this.props.delete(id);
        }
      for (const p of w.props) {
        let obj = this.props.get(p.id);
        if (!obj) {
          obj = flipObject(
            p.object,
            COLORS[w.players.find((q) => q.id === p.owner)?.seat ?? 0],
          );
          obj.position.set(p.x, p.y, p.z);
          this.scene.add(obj);
          this.props.set(p.id, obj);
        }
        obj.position.lerp(
          this.vector.set(p.x, p.y + (p.state === 'landed' ? 0.075 : 0), p.z),
          smooth,
        );
        obj.rotation.set(p.angle, 0, p.state === 'landed' ? w.table.z : 0);
      }
      const recent = w.events
        .filter((e) => e.kind === 'impact' && w.clock - e.born < 700)
        .slice(-8);
      this.rings.forEach((ring, i) => {
        const e = recent[i];
        ring.visible = !!e;
        if (!e) return;
        const progress = (w.clock - e.born) / 700;
        ring.position.set(e.x, tableHeight(w, e.x, e.z) + 0.15, e.z);
        ring.scale.setScalar(0.2 + progress * (1.5 + e.strength * 2));
        ring.material.opacity = (1 - progress) * 0.8;
      });
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
