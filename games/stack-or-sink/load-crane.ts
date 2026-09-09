import * as T from 'three';
import { beam, box } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { LOAD_CRANE } from './geometry';

type Load = { x: number; z: number; top: number };

/** Moving cargo rig. The stationary mast and base use SCENERY colliders. */
export class LoadCrane extends T.Group {
  jib = new T.Group();
  trolley: T.Mesh;
  hook = new T.Group();
  rope: T.Mesh;
  private loadX = -5;
  private loadZ = 2;

  constructor() {
    super();
    this.name = 'load-crane';
    const { mastX, mastZ, boomY, reach } = LOAD_CRANE;
    const green = '#75978a',
      yellow = '#e5b343';
    for (let y = 0; y < boomY; y += 1.5) {
      const next = Math.min(y + 1.5, boomY);
      for (const z of [-0.55, 0.55])
        beam(
          this,
          [mastX - 0.45, y, mastZ + z],
          [mastX + 0.45, next, mastZ + z],
          0.075,
          green,
        );
      for (const x of [-0.45, 0.45])
        beam(
          this,
          [mastX + x, y, mastZ - 0.55],
          [mastX + x, next, mastZ + 0.55],
          0.075,
          green,
        );
    }
    batchScenery(this);
    this.jib.position.set(mastX, boomY, mastZ);
    this.add(this.jib);
    // A fixed-length lattice jib rotates; the trolley travels along its rail.
    box(
      this.jib,
      [reach + 3, 0.24, 0.7],
      [(reach - 3) / 2, 0, 0],
      yellow,
    ).name = 'load-crane-rail';
    box(this.jib, [reach + 3, 0.12, 0.12], [(reach - 3) / 2, 0.8, 0], yellow);
    for (let x = -3; x < reach; x += 1.5)
      beam(
        this.jib,
        [x, 0, 0],
        [Math.min(x + 1.5, reach), 0.8, 0],
        0.09,
        yellow,
      );
    beam(this.jib, [0, 0, 0], [0, 2.2, 0], 0.15, green);
    beam(this.jib, [0, 2.2, 0], [reach * 0.72, 0.8, 0], 0.085, green);
    beam(this.jib, [0, 2.2, 0], [-3, 0.8, 0], 0.085, green);
    box(this.jib, [1.5, 0.9, 1.4], [-2.5, 0.2, 0], '#668579');
    // Batch the rigid structure before adding independently moving parts.
    batchScenery(this.jib);
    this.trolley = box(this.jib, [0.65, 0.32, 0.85], [0, -0.22, 0], '#42685e');
    this.trolley.name = 'load-crane-trolley';
    box(this.hook, [0.4, 0.25, 0.4], [0, 0, 0], yellow);
    // The stem ends on the rendered load's top, including between snapshots.
    box(this.hook, [0.12, 0.35, 0.12], [0, -0.175, 0], '#526f63');
    this.hook.name = 'load-crane-hook';
    this.add(this.hook);
    this.rope = box(this, [0.045, 1, 0.045], [0, 0, 0], '#526f63');
    this.rope.name = 'load-crane-rope';
    this.update(null);
  }

  update(load: Load | null) {
    const { mastX, mastZ, boomY } = LOAD_CRANE;
    if (load) {
      this.loadX = load.x;
      this.loadZ = load.z;
    }
    const dx = this.loadX - mastX,
      dz = this.loadZ - mastZ;
    this.jib.rotation.y = Math.atan2(-dz, dx);
    this.trolley.position.x = Math.hypot(dx, dz);
    const top = boomY - 0.22;
    const bottom = load ? load.top + 0.35 : boomY - 0.9;
    this.hook.position.set(this.loadX, bottom, this.loadZ);
    this.rope.position.set(this.loadX, (top + bottom) / 2, this.loadZ);
    this.rope.scale.y = top - bottom;
  }
}
