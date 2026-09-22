import * as THREE from 'three';
import { createCatch, nameLabel } from './models';
import type { ReelWorld } from './types';
import { ROCKS, GATE, surging } from './survival';
export class SurvivalScene {
  readonly root = new THREE.Group();
  private giant = createCatch('monster');
  private rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
    new THREE.MeshBasicMaterial({ color: '#ffdf76' }),
  );
  private wave = new THREE.Mesh(
    new THREE.BoxGeometry(25, 0.7, 0.6),
    new THREE.MeshBasicMaterial({
      color: '#f4f1df',
      transparent: true,
      opacity: 0.7,
    }),
  );
  private gate = new THREE.Group();
  private rocks: THREE.Mesh[] = [];
  private bonus = createCatch('salmon');
  private label = nameLabel('HOME · ALL CREW ABOARD', '#123f50');
  constructor() {
    this.root.add(
      this.giant,
      this.rope,
      this.wave,
      this.gate,
      this.bonus,
      this.label,
    );
    for (const r of ROCKS) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.3, 0),
        new THREE.MeshStandardMaterial({ color: '#65767b', roughness: 1 }),
      );
      rock.position.set(r.x, 0.5, r.z);
      rock.scale.y = 0.7;
      this.rocks.push(rock);
      this.root.add(rock);
    }
    for (const x of [-4, 4]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 4, 0.6),
        new THREE.MeshStandardMaterial({ color: '#ff934e' }),
      );
      post.position.set(x, 1.5, 0);
      this.gate.add(post);
    }
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: '#f4d36a' }),
    );
    bar.position.y = 3.4;
    this.gate.add(bar);
    const waterMark = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.12, 5, 36),
      new THREE.MeshBasicMaterial({ color: '#f4d36a' }),
    );
    waterMark.rotation.x = Math.PI / 2;
    waterMark.position.y = 0.2;
    this.gate.add(waterMark);
    this.gate.position.set(GATE.x, 0, GATE.z);
    this.label.position.set(0, 5, GATE.z);
  }
  update(w: ReelWorld) {
    const a = w.mission?.survival;
    this.root.visible = !!a;
    if (!a) return;
    const fight = a.stage === 'fight',
      recovery = w.mission!.status === 'recovering';
    this.giant.visible = fight && !recovery;
    this.rope.visible = this.giant.visible;
    const gx = w.boat.x + Math.sin(w.clock / 1800) * 4,
      gz = w.boat.z + 8;
    this.giant.position.set(gx, surging(w) ? 1.1 : 0.15, gz);
    this.giant.scale.setScalar(3.2);
    this.giant.rotation.set(0, Math.PI / 2, Math.sin(w.clock / 250) * 0.12);
    const from = new THREE.Vector3(w.boat.x, 1, w.boat.z + 2),
      to = new THREE.Vector3(gx, 0.5, gz),
      delta = to.clone().sub(from);
    this.rope.position.copy(from.add(to).multiplyScalar(0.5));
    this.rope.scale.y = delta.length();
    this.rope.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    for (const [i, r] of this.rocks.entries()) {
      r.visible = fight;
      r.position.x = ROCKS[i].x * (a.variant === 1 ? -1 : 1);
    }
    this.wave.visible = a.warned && a.waves < 3 && !recovery;
    this.wave.position.set(
      w.boat.x,
      0.5 + Math.sin(w.clock / 120) * 0.15,
      w.boat.z + Math.max(0, (a.waveAt - w.clock) / 3500) * 13,
    );
    this.bonus.visible =
      a.route === 'risk' && !a.bonus && a.progress > 0.25 && a.progress < 0.7;
    this.bonus.position.set(5, 1, w.boat.z + 4);
    this.gate.visible = !fight;
    this.label.visible = this.gate.visible;
  }
}
