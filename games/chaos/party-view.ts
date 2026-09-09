import { disposeGeometry } from '../../shared/rendering/primitives';
import * as T from 'three';
import { makePiece, worker, label, disposePiece } from './objects';
import { roleAnchor } from './party';
import type { Snapshot } from './model';
import { findPath } from './colliders';
export class PartyView {
  root = new T.Group();
  load = new T.Group();
  target = new T.Group();
  handles: T.Group[] = [];
  inspector = worker(3);
  gear = new T.Group();
  bags = new T.Group();
  mission = new T.Mesh(
    new T.RingGeometry(1.2, 1.3, 32),
    new T.MeshBasicMaterial({
      color: '#ed87b6',
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.7,
    }),
  );
  private kind = '';
  private inspectionId = '';
  private paths: { x: number; z: number }[][] = [];
  constructor(scene: T.Scene) {
    scene.add(this.root);
    this.root.add(
      this.load,
      this.target,
      this.inspector,
      this.mission,
      this.gear,
      this.bags,
    );
    for (let i = 0; i < 4; i++) {
      const bag = new T.Mesh(
        new T.BoxGeometry(0.48, 0.25, 0.38),
        new T.MeshStandardMaterial({ color: '#dfbf82' }),
      );
      bag.rotation.y = i * 0.7;
      this.bags.add(bag);
    }
    this.mission.rotation.x = -Math.PI / 2;
    const mat = new T.MeshBasicMaterial({
      color: '#ffcf55',
      side: T.DoubleSide,
    });
    for (let i = -3; i <= 3; i++) {
      const stripe = new T.Mesh(new T.PlaneGeometry(3, 0.1), mat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.47, i * 0.3);
      this.target.add(stripe);
    }
    for (let i = 0; i < 2; i++) {
      const g = new T.Group(),
        ring = new T.Mesh(
          new T.RingGeometry(0.42, 0.53, 28),
          new T.MeshBasicMaterial({
            color: i ? '#62c9c9' : '#ffba32',
            side: T.DoubleSide,
          }),
        );
      ring.rotation.x = -Math.PI / 2;
      g.add(ring);
      const tag = label(
        i ? '2 · PARTNER' : '1 · HANDLE',
        i ? '#387d7c' : '#8f682b',
      );
      tag.scale.multiplyScalar(0.65);
      tag.position.y = 0.6;
      g.add(tag);
      this.handles.push(g);
      this.root.add(g);
    }
  }
  private mesh(
    w: number,
    h: number,
    d: number,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    opacity = 1,
  ) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        roughness: 0.45,
      }),
    );
    m.userData.ownedMaterial = true;
    m.position.set(x, y, z);
    m.castShadow = true;
    this.load.add(m);
    return m;
  }
  private clear() {
    disposePiece(this.load);
    this.load.clear();
  }
  update(s: Snapshot, now: number, localId?: string) {
    const p = s.world.party;
    this.root.visible = !!p && p.phase !== 'lobby';
    if (!p) return;
    const t = p.task;
    if (this.kind !== t.kind) {
      this.clear();
      this.kind = t.kind;
      this.gear.traverse((o) => {
        if (o instanceof T.Mesh) {
          disposeGeometry(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
      });
      this.gear.clear();
      if (t.kind === 'sofa') this.load.add(makePiece('sofa'));
      else if (t.kind === 'barrow') {
        this.load.add(makePiece('barrow'));
        for (let i = 0; i < 4; i++)
          this.mesh(
            0.28,
            0.15,
            0.4,
            '#bd7855',
            ((i % 2) - 0.5) * 0.35,
            1 + Math.floor(i / 2) * 0.16,
            0,
          );
      } else if (t.kind === 'glass') {
        this.mesh(2.5, 1.4, 0.09, '#99e0e5', 0, 0.85, 0, 0.45);
        for (const x of [-1.3, 1.3])
          this.mesh(0.09, 1.55, 0.16, '#c7a374', x, 0.85);
        for (const y of [0.1, 1.6]) this.mesh(2.7, 0.09, 0.16, '#c7a374', 0, y);
        const crack = new T.Line(
          new T.BufferGeometry().setFromPoints([
            new T.Vector3(-0.8, 0.2, 0.06),
            new T.Vector3(-0.35, 0.65, 0.06),
            new T.Vector3(-0.5, 0.85, 0.06),
            new T.Vector3(0.3, 1.5, 0.06),
          ]),
          new T.LineBasicMaterial({ color: '#eefdfb' }),
        );
        crack.name = 'crack';
        this.load.add(crack);
      } else if (t.kind === 'ladder') {
        for (const x of [-0.45, 0.45])
          this.mesh(0.1, 3, 0.12, '#e6c583', x, 1.5);
        for (let i = 0; i < 8; i++)
          this.mesh(1, 0.09, 0.12, '#d7bb89', 0, i * 0.35 + 0.15);
        this.mesh(1.35, 0.6, 0.15, '#ffcf55', 0, 3.25);
      } else {
        this.mesh(2.4, 0.3, 1.4, '#cf865d', 0, 0.15);
        const rope = this.mesh(0.035, 4, 0.035, '#393e3c', 0, 2.3);
        rope.name = 'rope';
      }
      if (t.kind === 'barrow') {
        const vertices = new Float32Array([
          -1.5, 0.44, 6.25, 0, 1.14, 6.25, 1.5, 0.44, 6.25, -1.5, 0.44, 8.05, 0,
          1.14, 8.05, 1.5, 0.44, 8.05,
        ]);
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(vertices, 3));
        geometry.setIndex([
          0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 0, 1, 2, 3, 5, 4,
        ]);
        geometry.computeVertexNormals();
        this.gear.add(
          new T.Mesh(
            geometry,
            new T.MeshStandardMaterial({
              color: '#c49b64',
              side: T.DoubleSide,
            }),
          ),
        );
      }
      if (t.kind === 'crane')
        for (const [x, y, w, h] of [
          [-6, 3.5, 0.2, 6],
          [6, 3.5, 0.2, 6],
          [0, 6.5, 12, 0.3],
        ]) {
          const bar = new T.Mesh(
            new T.BoxGeometry(w, h, 0.3),
            new T.MeshStandardMaterial({ color: '#eeb846' }),
          );
          bar.position.set(x, y, 7.15);
          this.gear.add(bar);
        }
    }
    this.load.position.set(t.x, t.kind === 'ladder' ? 0.43 : t.y, t.z);
    this.load.rotation.set(
      0,
      t.angle,
      t.kind === 'ladder' && t.phase === 'waiting' && t.progress
        ? 0.18
        : Math.sin(now / 140) * t.tilt * 0.25,
    );
    this.load.scale.y = t.phase === 'spilled' && t.kind === 'glass' ? 0.12 : 1;
    const crack = this.load.getObjectByName('crack');
    if (crack) crack.visible = t.damage > 0;
    this.bags.children.forEach((bag, i) => {
      const pos = t.cargo?.[i];
      bag.visible = !!pos;
      if (pos) bag.position.set(pos.x, 0.58, pos.z);
    });
    this.target.visible =
      t.kind !== 'ladder' &&
      (t.kind !== 'crane' || t.solo || !localId || t.roles[0] !== localId);
    this.target.position.set(t.target.x, 0, t.target.z);
    this.handles.forEach((g, i) => {
      const anchor = roleAnchor(t, i);
      g.position.set(anchor.x, 0.5, anchor.z);
      g.visible = t.phase !== 'done' && (!t.solo || i === 0);
    });
    this.mission.visible =
      !!s.mission &&
      !s.mission.done &&
      s.mission.id < 4 &&
      ['building', 'lastCall', 'rescue'].includes(p.phase);
    if (s.mission)
      this.mission.position.set(s.mission.target.x, 0.46, s.mission.target.z);
    this.inspector.visible =
      p.phase === 'inspection' ||
      p.phase === 'lastCall' ||
      p.phase === 'rescue';
    if (p.phase === 'rescue') {
      const pos = p.inspection?.firstCheck?.route.at(-1) || { x: 0, z: 5 };
      this.inspector.position.set(pos.x, 0.43, pos.z);
    }
    if (p.phase === 'lastCall') {
      const t = Math.min(1, (now - p.phaseAt) / 10000);
      this.inspector.position.set(-8 + t * 2, 0.43, 7);
    }
    if (p.phase === 'inspection') {
      if (this.inspectionId !== p.roundId) {
        this.inspectionId = p.roundId;
        this.paths = [];
        if (p.inspection?.check) {
          const route = p.inspection.check.route;
          const points = route.length ? route : [{ x: 0, z: 5 }];
          this.paths = [points, [points.at(-1)!], [points.at(-1)!]];
        }
        let from = { x: -6, z: 7 };
        for (const target of p.inspection
          ? []
          : p.result?.stations || [{ x: 0, z: 3 }, t.target, { x: 3, z: 5 }]) {
          const route = findPath(s.world, from, target, 2.2);
          const points = [from, ...(route || [])];
          this.paths.push(points);
          from = points.at(-1)!;
        }
      }
      const elapsed = Math.max(0, (now - p.phaseAt) / 1000),
        route = this.paths[Math.min(2, Math.floor(elapsed / 10))];
      const along = Math.min(1, (elapsed % 10) / 7) * (route.length - 1),
        index = Math.floor(along),
        a = route[index],
        b = route[Math.min(route.length - 1, index + 1)];
      this.inspector.position.set(
        T.MathUtils.lerp(a.x, b.x, along - index),
        0.43,
        T.MathUtils.lerp(a.z, b.z, along - index),
      );
      if (a !== b) this.inspector.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    }
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        disposeGeometry(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
}
