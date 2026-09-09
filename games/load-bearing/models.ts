import * as T from 'three';
import { box, material } from '../../shared/rendering/primitives';
import { BALL_RADIUS } from './physics';
import { HALF_D, HALF_W } from './structure';
import type { Part, PartKind } from './types';

export const palette = {
  /** The daylight the whole collection shares, so shell and fog agree. */
  sky: '#c7d3b6',
  sage: '#8fa282',
  grass: '#9cb689',
  /** Deep teal ink; the shared worker's overalls are cut from the same cloth. */
  ink: '#385d53',
  clay: '#c9805c',
  oak: '#d3b07b',
  timber: '#a8814c',
  stone: '#e9d9b0',
  ivory: '#f1e5c8',
  cream: '#f7edd4',
  amber: '#eaa43c',
  ochre: '#d8912f',
  coral: '#dd7154',
  slate: '#6f9a92',
  slateDeep: '#578079',
  soil: '#c3a86f',
};

export const PART_COLORS: Record<PartKind, string> = {
  column: palette.stone,
  beam: palette.oak,
  wall: palette.clay,
  slab: palette.ivory,
  roof: palette.slate,
};
const MORTAR = palette.cream;

/**
 * Build a wall as a frame around a punched opening, so the house reads as a
 * house rather than a stack of slabs. Returns false when it is too small.
 */
function punchedWall(g: T.Object3D, part: Part, color: string) {
  const wide = part.w > part.d;
  const span = wide ? part.w : part.d;
  const thickness = wide ? part.d : part.w;
  if (span < 2.4 || part.h < 1.8) return false;
  // A ground-floor bay gets a doorway; anything higher gets a window.
  const doorway = part.y < 2;
  const holeW = Math.min(span * 0.42, 2);
  const holeH = doorway ? part.h * 0.72 : part.h * 0.4;
  const sill = doorway ? -part.h / 2 : -part.h / 2 + part.h * 0.3;
  const side = (span - holeW) / 2;
  const put = (
    long: number,
    high: number,
    alongOffset: number,
    upOffset: number,
    shade = color,
  ) =>
    box(
      g,
      wide ? [long, high, thickness] : [thickness, high, long],
      wide ? [alongOffset, upOffset, 0] : [0, upOffset, alongOffset],
      shade,
    );
  for (const sign of [-1, 1]) put(side, part.h, (sign * (span - side)) / 2, 0);
  const headerH = part.h / 2 - (sill + holeH);
  if (headerH > 0.02) put(holeW, headerH, 0, part.h / 2 - headerH / 2);
  const underH = sill + part.h / 2;
  if (underH > 0.02) put(holeW, underH, 0, -part.h / 2 + underH / 2);
  // A frame around the opening reads as joinery at a glance.
  const frame = palette.ink;
  for (const sign of [-1, 1])
    put(0.1, holeH, (sign * holeW) / 2, sill + holeH / 2, frame);
  put(holeW, 0.1, 0, sill + holeH, frame);
  if (!doorway) put(holeW, 0.1, 0, sill, frame);
  return true;
}

/** One mesh per part, sized on demand so the house stays data-driven. */
export function partMesh(part: Part) {
  const g = new T.Group();
  const color = PART_COLORS[part.kind];
  const punched = part.kind === 'wall' && punchedWall(g, part, color);
  if (!punched) {
    const body = new T.Mesh(
      new T.BoxGeometry(part.w, part.h, part.d),
      material(color),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    g.userData.body = body;
  }
  g.userData.partId = part.id;
  g.userData.kind = part.kind;
  // Brick courses and slab lips read as construction rather than plain boxes.
  if (part.kind === 'wall' && !punched) {
    const courses = Math.max(1, Math.round(part.h / 0.7));
    for (let i = 1; i < courses; i++)
      box(
        g,
        [part.w * 1.005, 0.045, part.d * 1.005],
        [0, -part.h / 2 + (i * part.h) / courses, 0],
        MORTAR,
      );
  }
  // A slab is an exposed floor, so its lip is masonry; a roof is covered,
  // so its battens sit in the same slate rather than striping it.
  if (part.kind === 'slab')
    box(g, [part.w * 1.01, 0.07, part.d * 1.01], [0, part.h / 2, 0], MORTAR);
  if (part.kind === 'roof') {
    box(
      g,
      [part.w * 1.01, 0.07, part.d * 1.01],
      [0, part.h / 2, 0],
      palette.slate,
    );
    for (let i = -2; i <= 2; i++)
      box(
        g,
        [part.w * 0.99, 0.1, 0.16],
        [0, part.h / 2 + 0.06, i * 0.8],
        palette.slateDeep,
      );
  }
  if (part.kind === 'beam')
    for (const sign of [-1, 1])
      box(
        g,
        part.w > part.d
          ? [part.w * 0.99, 0.09, 0.09]
          : [0.09, 0.09, part.d * 0.99],
        part.w > part.d
          ? [0, 0, (sign * part.d) / 2]
          : [(sign * part.w) / 2, 0, 0],
        palette.timber,
      );
  if (part.kind === 'column')
    for (const y of [-part.h / 2 + 0.12, part.h / 2 - 0.12])
      box(
        g,
        [part.w * 1.15, 0.16, part.d * 1.15],
        [0, y, 0],
        palette.cream,
        true,
      );
  const cracks = new T.Mesh(
    new T.BoxGeometry(part.w * 1.02, part.h * 1.02, part.d * 1.02),
    new T.MeshBasicMaterial({
      color: palette.ink,
      transparent: true,
      opacity: 0,
      wireframe: true,
    }),
  );
  g.add(cracks);
  g.userData.cracks = cracks;
  const paint = new T.Mesh(
    new T.TorusGeometry(Math.min(part.w, part.d) * 0.34, 0.055, 6, 16),
    new T.MeshBasicMaterial({ color: palette.coral }),
  );
  paint.position.z = part.d / 2 + 0.03;
  paint.visible = false;
  g.add(paint);
  g.userData.paint = paint;
  return g;
}

export function piano() {
  const g = new T.Group();
  box(g, [1.5, 0.95, 0.7], [0, 0.05, 0], '#6d4530', true);
  box(g, [1.42, 0.1, 0.34], [0, 0.14, 0.2], palette.cream);
  for (let i = 0; i < 9; i++)
    box(g, [0.05, 0.11, 0.2], [-0.6 + i * 0.15, 0.15, 0.24], '#3d2a1e');
  box(g, [1.54, 0.12, 0.76], [0, 0.58, 0], '#54331f', true);
  for (const x of [-0.62, 0.62])
    for (const z of [-0.24, 0.24])
      box(g, [0.12, 0.5, 0.12], [x, -0.68, z], '#54331f');
  box(g, [0.9, 0.06, 0.3], [0, -0.3, 0.42], palette.oak);
  return g;
}

export function crane() {
  const g = new T.Group();
  const mast = new T.Group();
  g.add(mast);
  g.userData.mast = mast;
  box(mast, [1.5, 0.5, 1.5], [0, 0.25, 0], palette.ink, true);
  for (const x of [-0.45, 0.45])
    for (const z of [-0.45, 0.45])
      box(mast, [0.18, 13, 0.18], [x, 6.9, z], palette.amber);
  for (let y = 1.4; y < 13; y += 1.5)
    box(mast, [1.05, 0.13, 1.05], [0, y, 0], palette.ochre);
  const jib = new T.Group();
  jib.position.y = 12.6;
  mast.add(jib);
  g.userData.jib = jib;
  box(jib, [0.24, 0.24, 20], [0, 0, -4], palette.amber);
  box(jib, [0.9, 0.55, 1.6], [0, 0.42, 4.2], palette.ink, true);
  return g;
}

export function wreckingBall() {
  const g = new T.Group();
  const ball = new T.Mesh(
    new T.IcosahedronGeometry(BALL_RADIUS, 1),
    material('#4a6b62'),
  );
  ball.castShadow = true;
  g.add(ball);
  box(g, [0.22, 0.3, 0.22], [0, BALL_RADIUS + 0.1, 0], palette.cream);
  return g;
}

/** Jib height the trolley runs along, so the cable starts somewhere real. */
export const JIB_Y = 12.6;

export function cable() {
  return new T.Line(
    new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(),
      new T.Vector3(),
    ]),
    new T.LineBasicMaterial({ color: palette.ink }),
  );
}

export function trolley() {
  const g = new T.Group();
  box(g, [0.8, 0.36, 0.8], [0, 0, 0], palette.ink, true);
  box(g, [0.95, 0.14, 0.95], [0, 0.22, 0], palette.amber);
  return g;
}

/** A beacon the crew can see through the walls, so the piano can be planned around. */
export function pianoBeacon() {
  const g = new T.Group();
  const material = new T.MeshBasicMaterial({
    color: palette.amber,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const pin = new T.Mesh(new T.ConeGeometry(0.34, 0.9, 6), material);
  pin.rotation.x = Math.PI;
  pin.position.y = 1.9;
  g.add(pin);
  const ring = new T.Mesh(new T.TorusGeometry(0.6, 0.07, 6, 20), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.6;
  g.add(ring);
  g.renderOrder = 999;
  return g;
}

/** A seeded shuffle keeps the yard dressing identical for every client. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function cone(g: T.Object3D, x: number, z: number) {
  const c = new T.Group();
  c.position.set(x, 0, z);
  box(c, [0.52, 0.08, 0.52], [0, 0.04, 0], palette.ink, true);
  const body = new T.Mesh(
    new T.ConeGeometry(0.22, 0.66, 8),
    material(palette.coral),
  );
  body.position.y = 0.4;
  body.castShadow = true;
  c.add(body);
  box(c, [0.3, 0.09, 0.3], [0, 0.46, 0], palette.cream);
  g.add(c);
}

function pallets(g: T.Object3D, x: number, z: number, count: number) {
  for (let i = 0; i < count; i++)
    box(g, [1.5, 0.14, 1.2], [x, 0.08 + i * 0.16, z], palette.oak, true);
}

function portaloo(g: T.Object3D, x: number, z: number) {
  const c = new T.Group();
  c.position.set(x, 0, z);
  box(c, [1.1, 2.2, 1.1], [0, 1.1, 0], '#7fb2ab', true);
  box(c, [1.16, 0.14, 1.16], [0, 2.2, 0], palette.ink);
  box(c, [0.62, 1.5, 0.06], [0, 1.05, 0.56], palette.cream);
  box(c, [0.3, 0.24, 0.05], [0, 1.85, 0.58], palette.ink);
  g.add(c);
}

function truck(g: T.Object3D, x: number, z: number) {
  const c = new T.Group();
  c.position.set(x, 0, z);
  c.rotation.y = 0.42;
  box(c, [2.1, 1.05, 4.6], [0, 1.15, 0], palette.coral, true);
  box(c, [2.2, 0.9, 1.9], [0, 1.95, -1.3], '#c25f4c', true);
  box(c, [1.9, 0.5, 0.12], [0, 2.05, -0.36], palette.ink);
  box(c, [2.16, 0.9, 3], [0, 1.9, 0.9], palette.ivory);
  for (const sx of [-1.02, 1.02])
    for (const sz of [-1.5, 1.4]) {
      const wheel = new T.Mesh(
        new T.CylinderGeometry(0.45, 0.45, 0.28, 12),
        material('#3d4f45'),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.45, sz);
      wheel.castShadow = true;
      c.add(wheel);
    }
  g.add(c);
}

/** Loose spoil left over from previous jobs, so the plot is not a bare plane. */
function spoil(g: T.Object3D, random: () => number, x: number, z: number) {
  const heap = new T.Group();
  heap.position.set(x, 0, z);
  const shades = [palette.clay, palette.stone, palette.oak, palette.slate];
  for (let i = 0; i < 9; i++) {
    const size = 0.3 + random() * 0.55;
    const chunk = box(
      heap,
      [size, size * 0.55, size * 0.8],
      [(random() - 0.5) * 1.9, size * 0.28, (random() - 0.5) * 1.9],
      shades[Math.floor(random() * shades.length)],
      true,
    );
    chunk.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.3);
  }
  g.add(heap);
}

/** The plot, its hoarding, and the yard dressing around the condemned house. */
export function site() {
  const g = new T.Group();
  const random = rng(20260909);
  const ground = new T.Mesh(
    new T.PlaneGeometry(90, 90),
    material(palette.grass),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  const pad = new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2 + 7, HALF_D * 2 + 7),
    material(palette.soil),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  g.add(pad);
  // Worn patches break up the flat pad without needing textures.
  for (let i = 0; i < 14; i++) {
    const patch = new T.Mesh(
      new T.CircleGeometry(0.8 + random() * 1.7, 7),
      material(random() > 0.5 ? '#b59a63' : '#cdb684'),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = random() * Math.PI;
    patch.position.set((random() - 0.5) * 24, 0.02, (random() - 0.5) * 22);
    patch.receiveShadow = true;
    g.add(patch);
  }

  // Hoarding runs the full perimeter, so the plot reads as a closed site.
  const fenceHalfX = 15;
  const fenceHalfZ = 13;
  const panel = (x: number, z: number, rotated: boolean, index: number) => {
    const post = box(g, [0.14, 2.1, 0.14], [x, 1.05, z], palette.ink);
    post.castShadow = true;
    const face = box(
      g,
      rotated ? [0.08, 1.6, 1.9] : [1.9, 1.6, 0.08],
      rotated ? [x, 1.2, z + 0.95] : [x + 0.95, 1.2, z],
      index % 2 ? palette.ivory : palette.amber,
    );
    face.castShadow = true;
  };
  let index = 0;
  for (let x = -fenceHalfX; x < fenceHalfX; x += 2)
    for (const z of [-fenceHalfZ, fenceHalfZ]) panel(x, z, false, index++);
  for (let z = -fenceHalfZ; z < fenceHalfZ; z += 2)
    for (const x of [-fenceHalfX, fenceHalfX]) panel(x, z, true, index++);

  // Skip, welfare unit, wagon and materials, kept clear of the play area.
  box(g, [3.6, 1.7, 2.3], [-12, 0.85, 7.4], palette.coral, true);
  box(g, [3.7, 0.14, 2.4], [-12, 1.72, 7.4], '#bf5c46');
  box(g, [3.4, 0.5, 2.1], [-12, 1.5, 7.4], palette.stone);
  portaloo(g, -13, 2.4);
  portaloo(g, -13, 0.9);
  truck(g, 11.5, 9);
  pallets(g, -11.5, -4, 4);
  pallets(g, -9.6, -5.6, 2);
  spoil(g, random, 12, -6);
  spoil(g, random, -12.5, -8.5);
  spoil(g, random, 9.5, 10.5);
  for (const [x, z] of [
    [-7.5, 6.5],
    [-3, 7.2],
    [2.5, 7.4],
    [7.5, 6.6],
    [8.4, -7.4],
    [-8.4, -7.6],
  ])
    cone(g, x, z);
  // Site office and a distant terrace so the horizon is not empty.
  box(g, [4.4, 2.6, 2.6], [13.5, 1.3, 2], palette.ivory, true);
  box(g, [4.6, 0.2, 2.8], [13.5, 2.65, 2], palette.stone);
  for (let i = -3; i <= 3; i++) {
    const height = 5 + ((i * 7919) % 5);
    box(
      g,
      [5.5, height, 5],
      [i * 7, height / 2, -26],
      i % 2 ? '#a7bd9b' : '#9bb391',
      true,
    );
    box(g, [5.8, 0.5, 5.3], [i * 7, height + 0.25, -26], palette.slate);
  }
  return g;
}

/**
 * A pooled puff of masonry dust and chips. Parts are destroyed whole, so the
 * burst is what sells the break; without it pieces simply blink out.
 */
export class DustBursts {
  group = new T.Group();
  private pool: T.Mesh[] = [];
  private live: {
    mesh: T.Mesh;
    life: number;
    span: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
  }[] = [];

  constructor(private limit = 90) {
    this.group.name = 'dust';
  }

  private take(color: string) {
    const mesh =
      this.pool.pop() ??
      new T.Mesh(
        new T.IcosahedronGeometry(0.22, 0),
        new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
    (mesh.material as T.MeshBasicMaterial).color.set(color);
    mesh.visible = true;
    this.group.add(mesh);
    return mesh;
  }

  burst(x: number, y: number, z: number, color: string, strength = 1) {
    const count = Math.min(14, Math.round(8 * strength));
    for (let i = 0; i < count; i++) {
      if (this.live.length >= this.limit) break;
      const mesh = this.take(i % 3 === 0 ? color : '#efe2c4');
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.35 + Math.random() * 0.85);
      const angle = Math.random() * Math.PI * 2;
      const out = 1.4 + Math.random() * 2.6;
      this.live.push({
        mesh,
        life: 0,
        span: 0.55 + Math.random() * 0.7,
        vx: Math.cos(angle) * out,
        vy: 1.5 + Math.random() * 3.4,
        vz: Math.sin(angle) * out,
        spin: (Math.random() - 0.5) * 6,
      });
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.span;
      if (t >= 1) {
        p.mesh.visible = false;
        this.group.remove(p.mesh);
        this.pool.push(p.mesh);
        this.live.splice(i, 1);
        continue;
      }
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.08) {
        p.mesh.position.y = 0.08;
        p.vy = 0;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * dt * 0.6;
      (p.mesh.material as T.MeshBasicMaterial).opacity = 1 - t * t;
    }
  }

  clear() {
    for (const p of this.live) {
      p.mesh.visible = false;
      this.group.remove(p.mesh);
      this.pool.push(p.mesh);
    }
    this.live.length = 0;
  }
}
