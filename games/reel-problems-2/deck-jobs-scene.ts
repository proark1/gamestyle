import * as THREE from 'three';
import { STATIONS, giantAboard } from './deck-jobs';
import { missionPosition } from './campaign';
import { createCatch, nameLabel } from './models';
import type { ReelWorld } from './types';
const box = (x: number, y: number, z: number, color: string) =>
  new THREE.Mesh(
    new THREE.BoxGeometry(x, y, z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
const coil = () => {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.075, 5, 14),
    new THREE.MeshStandardMaterial({ color: '#f4d36a' }),
  );
  m.rotation.x = Math.PI / 2;
  return m;
};
export class DeckJobsScene {
  readonly root = new THREE.Group();
  private fish = createCatch('monster');
  private lash = coil();
  private crank = new THREE.Group();
  private labels = new Map<string, THREE.Sprite>();
  private carried = Array.from({ length: 4 }, () => ({
    rope: coil(),
    plank: box(0.35, 0.12, 1.3, '#efb76e'),
  }));
  private deck = new THREE.Group();
  constructor(boat: THREE.Group) {
    boat.add(this.deck);
    const rope = coil();
    rope.position.set(STATIONS.rope.x, 1, STATIONS.rope.z);
    this.deck.add(rope);
    for (let i = 0; i < 3; i++) {
      const plank = box(0.7, 0.12, 1.1, '#efb76e');
      plank.position.set(STATIONS.timber.x, 0.75 + i * 0.14, STATIONS.timber.z);
      this.deck.add(plank);
    }
    const base = box(0.7, 0.4, 0.7, '#557e91');
    this.crank.add(base);
    const wheel = coil();
    wheel.rotation.x = 0;
    wheel.position.y = 0.45;
    this.crank.add(wheel);
    this.crank.position.set(STATIONS.winch.x, 1, STATIONS.winch.z);
    this.deck.add(this.crank);
    this.fish.scale.setScalar(1.1);
    this.deck.add(this.fish, this.lash);
    this.lash.scale.set(2.4, 1, 2.4);
    for (const [key, text] of Object.entries({
      rope: 'ROPE',
      timber: 'TIMBER',
      fish: 'TIE FISH',
      winch: 'WINCH',
      bucket: 'BAIL',
    })) {
      const label = nameLabel(text, '#123f50');
      label.scale.multiplyScalar(0.8);
      this.labels.set(key, label);
      this.root.add(label);
    }
    for (const item of this.carried) this.root.add(item.rope, item.plank);
  }
  update(w: ReelWorld) {
    const j = w.mission?.survival?.jobs;
    this.root.visible = !!j && !w.boat.sunk;
    this.deck.visible = this.root.visible;
    if (!j) return;
    const loose = giantAboard(w) && !j.secured;
    this.fish.visible = giantAboard(w);
    this.lash.visible = this.fish.visible && j.secured;
    const flopping = loose && w.clock - j.lastFlop < 900;
    this.fish.position.set(
      STATIONS.fish.x,
      1.45 + (flopping ? Math.abs(Math.sin(w.clock / 65)) * 0.6 : 0),
      STATIONS.fish.z,
    );
    this.fish.rotation.set(
      0,
      Math.PI / 2,
      loose
        ? Math.sin(w.clock / (flopping ? 60 : 700)) * (flopping ? 0.6 : 0.09)
        : 0,
    );
    this.lash.position.copy(this.fish.position);
    this.lash.position.y += 0.3;
    this.crank.rotation.y =
      w.players.some(
        (p) => p.input.work && w.mission!.holds[p.id]?.target === 'gate-winch',
      ) ||
      (j.gateLift >= 1 && w.players.some((p) => p.input.work))
        ? w.clock / 150
        : 0;
    for (const [key, label] of this.labels) {
      const point = STATIONS[key as keyof typeof STATIONS];
      const pos = missionPosition(w, { ...point, swimming: false });
      label.position.set(pos.x, 2.2, pos.z);
      label.visible =
        key === 'fish'
          ? loose
          : key === 'winch'
            ? w.mission?.survival?.stage === 'escape'
            : key === 'timber'
              ? !!w.leak
              : key === 'bucket'
                ? w.boat.flood > 0.03
                : loose;
    }
    for (const [i, item] of this.carried.entries()) {
      const p = w.players[i],
        kind = p ? j.carried[p.id] : null;
      item.rope.visible = kind === 'rope';
      item.plank.visible = kind === 'plank';
      if (!p || !kind) continue;
      const pos = missionPosition(w, p);
      for (const model of [item.rope, item.plank]) {
        model.position.set(pos.x, 2, pos.z);
        model.rotation.y = w.boat.yaw + p.facing;
      }
    }
  }
}
