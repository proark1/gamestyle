import * as T from 'three';
import { label } from './objects';
import type { Snapshot } from './model';
export class SwapView {
  root = new T.Group();
  constructor(scene: T.Scene) {
    scene.add(this.root);
    for (const [x, color, name] of [
      [-3, '#edb83e', 'YELLOW CREW'],
      [3, '#36aeb7', 'TURQUOISE CREW'],
    ] as const) {
      const points = [
        [-3, -4],
        [3, -4],
        [3, 3.8],
        [-3, 3.8],
      ].map(([dx, z]) => new T.Vector3(x + dx, 0.48, z));
      this.root.add(
        new T.LineLoop(
          new T.BufferGeometry().setFromPoints(points),
          new T.LineBasicMaterial({ color }),
        ),
      );
      const title = label(name, color);
      title.position.set(x, 0.8, -4);
      this.root.add(title);
      const ring = new T.Mesh(
        new T.RingGeometry(0.85, 1, 24),
        new T.MeshBasicMaterial({ color, side: T.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.49, -1);
      this.root.add(ring);
    }
  }
  update(s: Snapshot) {
    this.root.visible = !!s.world.party?.swap;
  }
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineLoop) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
}
