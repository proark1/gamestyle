import * as T from 'three';
import type { Snapshot } from './model';
import { footprint } from './placement';
import { roofSamples } from './inspection';

/** Lightweight visible tests: coverage targets, a leaking pipe and bounded rain. */
export class InspectionView {
  root = new T.Group();
  puddle = new T.Mesh(
    new T.CircleGeometry(1.8, 28),
    new T.MeshBasicMaterial({
      color: '#38a4dd',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  pipe = new T.Mesh(
    new T.CylinderGeometry(0.12, 0.12, 0.7, 8),
    new T.MeshStandardMaterial({
      color: '#3a8fc0',
      metalness: 0.4,
      roughness: 0.4,
    }),
  );
  spots: T.Mesh[] = [];
  rain: T.LineSegments;
  constructor(scene: T.Scene) {
    scene.add(this.root);
    this.puddle.rotation.x = -Math.PI / 2;
    this.root.add(this.puddle, this.pipe);
    for (let n = 0; n < 9; n++) {
      const dot = new T.Mesh(
        new T.RingGeometry(0.11, 0.16, 12),
        new T.MeshBasicMaterial({ color: '#398fc0', side: T.DoubleSide }),
      );
      dot.rotation.x = -Math.PI / 2;
      this.spots.push(dot);
      this.root.add(dot);
    }
    const positions = new Float32Array(120 * 6);
    for (let n = 0; n < 120; n++) {
      const x = Math.sin(n * 73.7) * 1.1,
        z = Math.cos(n * 27.3) * 1.1,
        y = (n % 20) / 5;
      positions.set([x, y, z, x - 0.03, y + 0.2, z], n * 6);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    this.rain = new T.LineSegments(
      geometry,
      new T.LineBasicMaterial({
        color: '#87cfff',
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.root.add(this.rain);
  }
  update(s: Snapshot, now: number) {
    const p = s.world.party,
      i = p?.inspection;
    this.root.visible = !!i && p?.phase !== 'lobby';
    if (!i) return;
    const leaking =
      !i.leakFixed &&
      now >= i.rainAt &&
      now <= i.rainUntil &&
      !['inspection', 'results'].includes(p!.phase);
    this.puddle.visible = leaking;
    this.puddle.position.set(i.target.x, 0.465, i.target.z + 2);
    this.pipe.position.set(i.target.x, 0.8, i.target.z + 2);
    const roofs = s.world.pieces
      .filter((v) => v.placed && v.kind === 'roof' && !v.hoisted)
      .map((v) => footprint(v.kind, v, v.rotation));
    const covered = (x: number, z: number) =>
      roofs.some(
        (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ,
      );
    roofSamples(i.target).forEach((v, n) => {
      this.spots[n].position.set(v.x, 0.47, v.z);
      (this.spots[n].material as T.MeshBasicMaterial).color.set(
        covered(v.x, v.z) ? '#74bb5a' : '#398fc0',
      );
    });
    const positions = this.rain.geometry.getAttribute('position');
    for (let n = 0; n < 120; n++) {
      const x = positions.getX(n * 2),
        z = positions.getZ(n * 2),
        dry = covered(x + i.target.x, z + i.target.z);
      const y = dry ? 4 : (n % 20) / 5;
      positions.setY(n * 2, y);
      positions.setY(n * 2 + 1, dry ? y : y + 0.2);
    }
    positions.needsUpdate = true;
    this.rain.visible = p?.phase === 'inspection' || p?.phase === 'rescue';
    this.rain.position.set(i.target.x, 0.4 - (now % 500) / 500, i.target.z);
  }
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
}
