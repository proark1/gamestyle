import * as THREE from 'three';
import { HARBOR, missionPosition } from './campaign';
import type { ReelWorld } from './types';
import { nameLabel } from './models';

function box(size: [number, number, number], color: string) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export class MissionScene {
  readonly root = new THREE.Group();
  private dock = new THREE.Group();
  private markers = new THREE.Group();
  private buildMarker = new THREE.Group();
  private components = new Map<string, THREE.Group>();
  private crates = Array.from({ length: 12 }, () =>
    box([0.8, 0.6, 0.8], '#e9b65e'),
  );
  private built: THREE.Mesh[] = [];
  private raft = new THREE.Group();
  private boatPieces: THREE.Object3D[];
  constructor(boat: THREE.Group) {
    this.root.add(this.dock, this.markers);
    this.boatPieces = boat.children.filter(
      (child) =>
        child.type === 'Mesh' && !['brine', 'bilge'].includes(child.name),
    );
    for (let i = 0; i < 9; i++) {
      const plank = box([8.3, 0.35, 0.65], i % 2 ? '#c99962' : '#e3bb81');
      plank.position.set(12, 0.35, 25.3 + i * 0.7);
      this.dock.add(plank);
    }
    for (const x of [8, 16])
      for (const z of [25, 31]) {
        const post = box([0.3, 1.8, 0.3], '#36666b');
        post.position.set(x, 0.4, z);
        post.name = 'dock-post';
        this.dock.add(post);
      }
    for (const [name, point, color] of [
      ['CAFÉ', HARBOR.home, '#f2ce65'],
      ['FISH', HARBOR.fish, '#68d6c0'],
      ['REPAIR', HARBOR.repair, '#f2ce65'],
    ] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(name === 'FISH' ? 7 : 3.5, 0.1, 5, 40),
        new THREE.MeshBasicMaterial({ color }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(point.x, 0.13, point.z);
      this.markers.add(ring);
      const label = nameLabel(name, '#174b57');
      label.position.set(point.x, 3, point.z);
      this.markers.add(label);
    }
    const frame = box([3.5, 0.15, 4], '#efce67');
    frame.position.set(14, 0.62, 28);
    this.dock.add(frame);
    // The build target must remain distinct from the wood and the harbour gate.
    this.buildMarker.position.set(HARBOR.frame.x, 0, HARBOR.frame.z);
    const outline = new THREE.MeshBasicMaterial({ color: '#123f50' });
    for (const x of [-1.75, 1.75]) {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 4),
        outline,
      );
      edge.position.set(x, 0.78, 0);
      this.buildMarker.add(edge);
    }
    for (const z of [-2, 2]) {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.12, 0.18),
        outline,
      );
      edge.position.set(0, 0.78, z);
      this.buildMarker.add(edge);
    }
    const buildLabel = nameLabel('BUILD HERE', '#123f50');
    buildLabel.scale.multiplyScalar(1.3);
    buildLabel.position.set(0, 2.8, -1.6);
    this.buildMarker.add(buildLabel);
    this.dock.add(this.buildMarker);
    for (let i = 0; i < 4; i++) {
      const part = box(
        i < 2 ? [1.6, 0.15, 3.5] : i === 2 ? [3, 0.6, 1] : [0.15, 0.15, 3.6],
        i < 2 ? '#b88752' : i === 2 ? '#2d8d91' : '#edac55',
      );
      part.position.set(13.2 + (i % 2) * 1.6, 0.85 + (i > 1 ? 0.4 : 0), 28);
      part.visible = false;
      this.built.push(part);
      this.dock.add(part);
    }
    for (const id of ['deck-a', 'deck-b', 'barrels', 'paddle']) {
      const group = new THREE.Group();
      const part = box(
        id.startsWith('deck')
          ? [1.4, 0.35, 0.6]
          : id === 'barrels'
            ? [0.8, 0.8, 1.2]
            : [0.18, 0.18, 1.8],
        id === 'barrels' ? '#2d8d91' : '#efc47f',
      );
      group.add(part);
      this.components.set(id, group);
      this.root.add(group);
    }
    for (const crate of this.crates) this.root.add(crate);
    for (let i = 0; i < 8; i++) {
      const plank = box([5.2, 0.2, 0.9], '#c7a16c');
      plank.position.set(0, 0.45, -3.2 + i * 0.9);
      this.raft.add(plank);
    }
    for (const x of [-2, 2]) {
      const barrel = box([0.85, 0.9, 6], '#258b91');
      barrel.position.set(x, -0.2, 0);
      this.raft.add(barrel);
    }
    boat.add(this.raft);
    this.raft.visible = false;
  }
  update(w: ReelWorld) {
    const m = w.mission;
    this.root.visible = !!m;
    this.raft.visible = !!m?.raft;
    for (const child of this.boatPieces) child.visible = !m?.raft;
    if (!m) return;
    this.markers.visible = !m.survival;
    this.dock.visible = !m.survival || m.status === 'recovering';
    this.buildMarker.visible = m.status === 'recovering';
    const anchor = m.survival?.wreck;
    this.dock.position.set(
      anchor ? anchor.x - HARBOR.dock.x : 0,
      0,
      anchor ? anchor.z - HARBOR.dock.z : 0,
    );
    for (const child of this.dock.children)
      if (child.name === 'dock-post') child.visible = !m.survival;
    for (const [i, part] of this.built.entries())
      part.visible = m.status === 'recovering' && !!m.components[i]?.installed;
    for (const [id, group] of this.components) {
      const component = m.components.find((c) => c.id === id);
      group.visible =
        m.status === 'recovering' && !!component && !component.installed;
      if (!component) continue;
      const carrier = w.players.find((p) => p.id === component.carrier);
      group.position.set(
        carrier?.x ?? component.x,
        carrier ? 1.8 : 0.95,
        carrier?.z ?? component.z,
      );
    }
    const visible = m.cargo.filter(
      (c) =>
        c.location === 'water' ||
        (c.location === 'boat' && !(m.survival?.jobs && c.kind === 'monster')),
    );
    for (const [i, crate] of this.crates.entries()) {
      const cargo = visible[i];
      crate.visible = !!cargo;
      if (!cargo) continue;
      if (cargo.location === 'boat') {
        const pos = missionPosition(w, {
          x: (i % 2 ? 1 : -1) * 1.5,
          z: 1.6 + Math.floor(i / 2) * 0.6,
          swimming: false,
        });
        crate.position.set(pos.x, 1.15, pos.z);
        crate.rotation.y = w.boat.yaw;
      } else {
        crate.position.set(cargo.x, 0.25, cargo.z);
        crate.rotation.y = 0.3;
      }
    }
  }
}
