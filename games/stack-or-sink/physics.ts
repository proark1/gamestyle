import * as C from 'cannon-es';
import {
  FLOOR,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PIECE_MASS,
  SCENERY,
  salvageShapes,
  type ShapeBox,
  type SceneryShape,
} from './geometry';
import {
  ITEMS,
  type Input,
  type Piece,
  type Player,
  type World,
} from './types';

export const STEP = 1 / 60;
const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);
export function orientation(p: Piece) {
  const q = new C.Quaternion();
  if (p.quaternion && !p.heldBy)
    q.set(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w);
  else q.setFromAxisAngle(vec(0, 1, 0), (p.rotation * Math.PI) / 2);
  return q;
}
export function resetMotion(p: Piece) {
  p.vx = p.vy = p.vz = 0;
  p.angular = { x: 0, y: 0, z: 0 };
  p.sleeping = false;
  p.idle = 0;
  p.tilt = 0;
  p.unstable = 0;
  delete p.quaternion;
}
export function touchPiece(p: Piece) {
  p.revision = (p.revision || 0) + 1;
}
type OBB = { center: C.Vec3; half: C.Vec3; axes: C.Vec3[]; id: string };
function obb(
  s: ShapeBox,
  position = vec(),
  q = new C.Quaternion(),
  id = '',
): OBB {
  return {
    center: q.vmult(vec(...s.pos)).vadd(position),
    half: vec(...(s.size.map((v) => v / 2) as [number, number, number])),
    axes: [vec(1), vec(0, 1), vec(0, 0, 1)].map((v) => q.vmult(v)),
    id,
  };
}
function pieceBoxes(p: Piece) {
  return salvageShapes(p.kind).map((s) =>
    obb(s, vec(p.x, p.y, p.z), orientation(p), p.id),
  );
}
function worldBoxes(w: World, ignore?: string) {
  return [
    ...SCENERY.map((s) =>
      obb({ ...s, pos: [0, 0, 0] }, vec(...s.pos), sceneryOrientation(s), s.id),
    ),
    ...w.pieces.filter((p) => p.id !== ignore && !p.heldBy).flatMap(pieceBoxes),
  ];
}
function intersects(a: OBB, b: OBB, tolerance = 0.018) {
  const delta = b.center.vsub(a.center),
    axes = [
      ...a.axes,
      ...b.axes,
      ...a.axes.flatMap((v) => b.axes.map((u) => v.cross(u))),
    ];
  const ah = [a.half.x, a.half.y, a.half.z],
    bh = [b.half.x, b.half.y, b.half.z];
  for (const axis of axes) {
    if (axis.lengthSquared() < 1e-9) continue;
    axis.normalize();
    const ra = a.axes.reduce((n, v, i) => n + Math.abs(axis.dot(v)) * ah[i], 0),
      rb = b.axes.reduce((n, v, i) => n + Math.abs(axis.dot(v)) * bh[i], 0);
    if (Math.abs(delta.dot(axis)) >= ra + rb - tolerance) return false;
  }
  return true;
}
export function poseError(w: World, item: Piece, ignorePlayer?: string) {
  const boxes = pieceBoxes(item),
    others = worldBoxes(w, item.id);
  for (const box of boxes) {
    for (const other of others)
      if (intersects(box, other))
        return other.id.startsWith('shed')
          ? 'The shed is in the way.'
          : 'There is something in the way.';
    for (const p of w.players) {
      if (p.id === ignorePlayer || p.down || p.rescued) continue;
      const body = obb({
        size: [PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2],
        pos: [p.x, p.y + PLAYER_HEIGHT / 2, p.z],
        color: '',
      });
      if (intersects(box, body)) return 'Someone is standing there.';
    }
  }
  return null;
}
/** Loose salvage reacts through the solver; fixed structures still block a route. */
export function cranePoseError(w: World, item: Piece) {
  return poseError({ ...w, pieces: [] }, item);
}
export function playerSpotClear(w: World, p: Player) {
  const box = obb({
    size: [PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2],
    pos: [p.x, p.y + PLAYER_HEIGHT / 2, p.z],
    color: '',
  });
  return (
    !worldBoxes(w).some((other) => intersects(box, other)) &&
    !w.players.some(
      (a) =>
        a.id !== p.id &&
        !a.down &&
        Math.hypot(a.x - p.x, a.z - p.z) < PLAYER_RADIUS * 2 &&
        Math.abs(a.y - p.y) < PLAYER_HEIGHT,
    )
  );
}
function corners(b: OBB) {
  const result: C.Vec3[] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1])
        result.push(
          b.center
            .vadd(b.axes[0].scale(x * b.half.x))
            .vadd(b.axes[1].scale(y * b.half.y))
            .vadd(b.axes[2].scale(z * b.half.z)),
        );
  return result;
}
function clipped(
  poly: C.Vec3[],
  axis: 'x' | 'z',
  bound: number,
  keepAbove: boolean,
) {
  const out: C.Vec3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      insideA = keepAbove ? a[axis] >= bound : a[axis] <= bound,
      insideB = keepAbove ? b[axis] >= bound : b[axis] <= bound;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push(a.vadd(b.vsub(a).scale(t)));
    }
  }
  return out;
}
/** Exact upper faces clipped against an upright placement footprint, including tilted salvage. */
function heightOver(
  box: OBB,
  x: number,
  z: number,
  w: number,
  d: number,
  ceiling: number,
) {
  const pts = corners(box),
    faces = [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ];
  let height = -Infinity;
  for (const indices of faces) {
    let poly = indices.map((i) => pts[i]);
    const normal = poly[1].vsub(poly[0]).cross(poly[2].vsub(poly[0]));
    if (normal.y <= 1e-8) continue;
    for (const [axis, bound, above] of [
      ['x', x - w / 2, true],
      ['x', x + w / 2, false],
      ['z', z - d / 2, true],
      ['z', z + d / 2, false],
    ] as const) {
      poly = clipped(poly, axis, bound, above);
      if (!poly.length) break;
    }
    if (poly.length) {
      const top = Math.max(...poly.map((v) => v.y));
      if (top <= ceiling + 0.025) height = Math.max(height, top);
    }
  }
  return height;
}
export function supportSurface(
  w: World,
  x: number,
  z: number,
  width: number,
  depth: number,
  ceiling: number,
  ignore?: string,
) {
  let y = FLOOR;
  for (const b of worldBoxes(w, ignore))
    y = Math.max(y, heightOver(b, x, z, width, depth, ceiling));
  return y;
}
export function landingHeight(
  w: World,
  item: Piece,
  x: number,
  z: number,
  ceiling: number,
) {
  const candidate = { ...item, x, y: 0, z, quaternion: undefined },
    boxes = pieceBoxes(candidate);
  let height = FLOOR;
  const others = worldBoxes(w, item.id);
  for (const box of boxes) {
    const pts = corners(box),
      minX = Math.min(...pts.map((v) => v.x)),
      maxX = Math.max(...pts.map((v) => v.x)),
      minZ = Math.min(...pts.map((v) => v.z)),
      maxZ = Math.max(...pts.map((v) => v.z)),
      bottom = Math.min(...pts.map((v) => v.y));
    for (const other of others)
      height = Math.max(
        height,
        heightOver(
          other,
          (minX + maxX) / 2,
          (minZ + maxZ) / 2,
          maxX - minX - 0.006,
          maxZ - minZ - 0.006,
          ceiling + bottom,
        ) - bottom,
      );
  }
  return height;
}
export function topOf(p: Piece) {
  return Math.max(...pieceBoxes(p).flatMap((b) => corners(b).map((v) => v.y)));
}

function sceneryOrientation(s: SceneryShape) {
  const q = new C.Quaternion();
  q.setFromAxisAngle(vec(0, 1, 0), s.rotationY || 0);
  return q;
}

function addShapes(
  body: C.Body,
  shapes: SceneryShape[],
  offsetY = 0,
  q = new C.Quaternion(),
) {
  for (const s of shapes)
    body.addShape(
      new C.Box(vec(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2)),
      q.vmult(vec(...s.pos)).vadd(vec(0, offsetY, 0)),
      q.mult(sceneryOrientation(s)),
    );
}
export class Physics {
  engine = new C.World({ gravity: vec(0, -9.81, 0), allowSleep: true });
  pieces = new Map<string, C.Body>();
  players = new Map<string, C.Body>();
  constructor(
    public world: World,
    public prediction = false,
  ) {
    if (!prediction) {
      const signature = world.pieces
        .map((p) => `${p.id}:${p.revision || 0}:${p.heldBy || ''}`)
        .join('|');
      if (signature !== world.physicsSignature)
        for (const p of world.pieces) {
          p.sleeping = false;
          p.idle = 0;
        }
      world.physicsSignature = signature;
    }
    const e = this.engine;
    e.solver = new C.GSSolver();
    (e.solver as C.GSSolver).iterations = 60;
    (e.solver as C.GSSolver).tolerance = 1e-8;
    e.defaultContactMaterial.friction = 0.65;
    e.defaultContactMaterial.restitution = 0.02;
    e.defaultContactMaterial.contactEquationStiffness = 1e8;
    e.defaultContactMaterial.contactEquationRelaxation = 4;
    const rough = new C.Material({ friction: 0.8, restitution: 0.02 });
    const ground = new C.Body({ mass: 0, material: rough });
    addShapes(ground, SCENERY);
    e.addBody(ground);
    // Yard boundary matches the existing fenced play area.
    const boundary = new C.Body({ mass: 0, material: rough });
    for (const axis of ['x', 'z'])
      for (const sign of [-1, 1])
        boundary.addShape(
          new C.Box(axis === 'x' ? vec(0.1, 15, 11) : vec(11, 15, 0.1)),
          axis === 'x' ? vec(sign * 10.1, 15, 0) : vec(0, 15, sign * 10.1),
        );
    e.addBody(boundary);
    for (const p of world.pieces) {
      if (p.heldBy && p.heldBy !== 'crane') continue;
      const q = orientation(p),
        body = new C.Body({
          mass: prediction ? 0 : PIECE_MASS[p.kind],
          fixedRotation: p.heldBy === 'crane',
          // The hoist supports this body's weight. Its contact grip must not
          // pin it to the floor while the motor is trying to move the cable.
          material:
            p.heldBy === 'crane'
              ? new C.Material({ friction: 0.01, restitution: 0.02 })
              : rough,
          allowSleep: p.heldBy !== 'crane',
          sleepSpeedLimit: 0.075,
          sleepTimeLimit: 0.7,
          linearDamping: 0.08,
          angularDamping: 0.12,
        });
      body.quaternion.copy(q);
      body.position.copy(
        vec(p.x, p.y, p.z).vadd(q.vmult(vec(0, ITEMS[p.kind].h / 2, 0))),
      );
      addShapes(body, salvageShapes(p.kind), -ITEMS[p.kind].h / 2);
      body.velocity.set(p.vx || 0, p.vy || 0, p.vz || 0);
      body.angularVelocity.set(
        p.angular?.x || 0,
        p.angular?.y || 0,
        p.angular?.z || 0,
      );
      e.addBody(body);
      if (!prediction && !p.heldBy) {
        if (p.sleeping) body.sleep();
        else if (p.idle) {
          body.sleepState = C.Body.SLEEPY;
          body.timeLastSleepy = -p.idle;
        }
      }
      this.pieces.set(p.id, body);
    }
    for (const p of world.players) {
      if (p.down || p.rescued) continue;
      const body = new C.Body({
        mass: 80,
        fixedRotation: true,
        allowSleep: false,
        linearDamping: 0,
        material: new C.Material({ friction: 0, restitution: 0 }),
      });
      body.addShape(
        new C.Box(vec(PLAYER_RADIUS, PLAYER_HEIGHT / 2, PLAYER_RADIUS)),
      );
      body.position.set(p.x, p.y + PLAYER_HEIGHT / 2, p.z);
      body.velocity.y = p.vy;
      const held = world.pieces.find((s) => s.heldBy === p.id);
      if (held)
        addShapes(
          body,
          salvageShapes(held.kind),
          2.1 - PLAYER_HEIGHT / 2,
          orientation(held),
        );
      body.updateMassProperties();
      e.addBody(body);
      this.players.set(p.id, body);
    }
  }
  /** A room round-trips through JSON between requests, so an unchanged
   *  rigid-body world is re-pointed at the freshly parsed objects rather than
   *  rebuilt. Only dynamic state moves across; topology decides a rebuild, so
   *  shapes, mass and body membership are already correct. */
  adopt(world: World) {
    this.world = world;
    for (const p of world.pieces) {
      if (p.heldBy && p.heldBy !== 'crane') continue;
      const body = this.pieces.get(p.id);
      if (!body) continue;
      const q = orientation(p);
      body.quaternion.copy(q);
      body.position.copy(
        vec(p.x, p.y, p.z).vadd(q.vmult(vec(0, ITEMS[p.kind].h / 2, 0))),
      );
      body.velocity.set(p.vx || 0, p.vy || 0, p.vz || 0);
      body.angularVelocity.set(
        p.angular?.x || 0,
        p.angular?.y || 0,
        p.angular?.z || 0,
      );
      body.force.setZero();
      body.torque.setZero();
      body.wakeUp();
      if (!p.heldBy) {
        if (p.sleeping) body.sleep();
        else if (p.idle) {
          body.sleepState = C.Body.SLEEPY;
          // The engine clock persists across requests, unlike a fresh build.
          body.timeLastSleepy = this.engine.time - p.idle;
        }
      }
      body.aabbNeedsUpdate = true;
    }
    for (const p of world.players) {
      const body = this.players.get(p.id);
      if (!body) continue;
      body.position.set(p.x, p.y + PLAYER_HEIGHT / 2, p.z);
      body.velocity.set(0, p.vy, 0);
      body.force.setZero();
      body.aabbNeedsUpdate = true;
    }
  }
  controls(p: Player, input: Input, _dt: number) {
    const body = this.players.get(p.id);
    if (!body) return;
    const length = Math.max(1, Math.hypot(input.x, input.z)),
      speed = this.world.pieces.some((s) => s.heldBy === p.id) ? 3.6 : 4.4;
    const x = this.world.crane.owner === p.id ? 0 : input.x / length,
      z = this.world.crane.owner === p.id ? 0 : input.z / length;
    // Idle characters have no horizontal momentum, including contact impulses
    // from sloped salvage. Gravity and vertical support stay fully simulated.
    const moving = Math.hypot(x, z) > 0.001;
    body.linearFactor.set(moving ? 1 : 0, 1, moving ? 1 : 0);
    body.velocity.x = moving ? x * speed : 0;
    body.velocity.z = moving ? z * speed : 0;
    if (moving) p.angle = Math.atan2(x, z);
    if (input.jump && input.seq !== p.lastJump && p.grounded) {
      body.velocity.y = 5.9;
      p.grounded = false;
      p.lastJump = input.seq;
    }
  }
  step(dt: number) {
    if (!this.prediction) this.driveCrane();
    this.engine.step(dt);
  }
  driveCrane() {
    const c = this.world.crane;
    if (!c.owner || !c.piece) return;
    const load = this.world.pieces.find((p) => p.id === c.piece);
    const body = this.pieces.get(c.piece);
    if (!load || load.heldBy !== 'crane' || !body) return;
    // A force-limited hoist drives a real dynamic body toward the requested
    // position. Contacts transfer momentum and torque to nearby salvage, and
    // a trapped load stalls rather than forcing boxes through solid walls.
    const dx = c.x - body.position.x;
    const dy = c.y + ITEMS[load.kind].h / 2 - body.position.y;
    const dz = c.z - body.position.z;
    const horizontal = Math.max(1, (Math.hypot(dx, dz) * 8) / 3.5);
    const velocity = [
      (dx * 8) / horizontal,
      Math.max(-3.75, Math.min(3.75, dy * 8)),
      (dz * 8) / horizontal,
    ];
    for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) {
      const acceleration = Math.max(
        -60,
        Math.min(60, (velocity[i] - body.velocity[axis]) * 20),
      );
      body.force[axis] +=
        body.mass * (acceleration - this.engine.gravity[axis]);
    }
    body.wakeUp();
  }
  readPlayer(p: Player) {
    const b = this.players.get(p.id);
    if (!b) return;
    p.x = b.position.x;
    p.y = b.position.y - PLAYER_HEIGHT / 2;
    p.z = b.position.z;
    p.vy = b.velocity.y;
    p.grounded = this.engine.contacts.some(
      (c) =>
        c.enabled &&
        ((c.bi === b && -c.ni.y > 0.55) || (c.bj === b && c.ni.y > 0.55)),
    );
    if (p.grounded && Math.abs(p.vy) < 0.08) p.vy = 0;
  }
  save() {
    for (const p of this.world.players) this.readPlayer(p);
    for (const p of this.world.pieces) {
      if (p.heldBy && p.heldBy !== 'crane') {
        const owner = this.world.players.find((a) => a.id === p.heldBy);
        if (owner) {
          p.x = owner.x;
          p.y = owner.y + 2.1;
          p.z = owner.z;
        }
        continue;
      }
      const b = this.pieces.get(p.id);
      if (!b) continue;
      const origin = b.position.vsub(
        b.quaternion.vmult(vec(0, ITEMS[p.kind].h / 2, 0)),
      );
      p.x = origin.x;
      p.y = origin.y;
      p.z = origin.z;
      p.vx = b.velocity.x;
      p.vy = b.velocity.y;
      p.vz = b.velocity.z;
      p.quaternion = {
        x: b.quaternion.x,
        y: b.quaternion.y,
        z: b.quaternion.z,
        w: b.quaternion.w,
      };
      p.angular = {
        x: b.angularVelocity.x,
        y: b.angularVelocity.y,
        z: b.angularVelocity.z,
      };
      p.sleeping = b.sleepState === C.Body.SLEEPING;
      p.idle =
        b.sleepState === C.Body.SLEEPY
          ? this.engine.time - b.timeLastSleepy
          : 0;
    }
  }
}
function topology(w: World) {
  return `${w.started}|${w.pieces.map((p) => `${p.id}:${p.kind}:${p.heldBy || ''}:${p.revision || 0}`).join('|')}|${w.players.map((p) => `${p.id}:${p.down}:${p.rescued}`).join('|')}`;
}
const simulationCache = new WeakMap<object, SimulationEntry>();
type SimulationEntry = {
  physics: Physics;
  signature: string;
  pieces: Piece[];
};
/** A server request parses a fresh World every time, so the object-keyed cache
 *  can never hit there. Callers that own a stable identity (a room code) pass
 *  it instead. Bounded because rooms come and go and each entry holds a world. */
const KEYED_LIMIT = 128;
const keyedCache = new Map<string, SimulationEntry>();
export function simulationPhysics(w: World, cacheKey: object | string = w) {
  const signature = topology(w);
  const keyed = typeof cacheKey === 'string';
  let cached = keyed ? keyedCache.get(cacheKey) : simulationCache.get(cacheKey);
  if (!cached || cached.signature !== signature) {
    cached = { physics: new Physics(w), signature, pieces: w.pieces };
    if (keyed) {
      keyedCache.delete(cacheKey);
      keyedCache.set(cacheKey, cached);
      for (const stale of keyedCache.keys()) {
        if (keyedCache.size <= KEYED_LIMIT) break;
        keyedCache.delete(stale);
      }
    } else simulationCache.set(cacheKey, cached);
  } else if (cached.pieces !== w.pieces) {
    cached.physics.adopt(w);
    cached.pieces = w.pieces;
    if (keyed) {
      // Keep insertion order as recency so eviction drops the coldest room.
      keyedCache.delete(cacheKey);
      keyedCache.set(cacheKey, cached);
    }
  }
  return cached.physics;
}
const predictionCache = new WeakMap<
  object,
  { physics: Physics; pieces: Piece[]; signature: string; id: string }
>();
export function predictPlayer(
  w: World,
  p: Player,
  dt: number,
  input: Input,
  cacheKey: object = w,
) {
  if (p.down || p.rescued || dt <= 0) return;
  let cached = predictionCache.get(cacheKey);
  const signature = topology(w);
  if (!cached || cached.signature !== signature || cached.id !== p.id) {
    const shadow = {
      ...w,
      players: [p, ...w.players.filter((a) => a.id !== p.id)],
    };
    const physics = new Physics(shadow, true);
    for (const [id, body] of physics.players)
      if (id !== p.id) {
        body.mass = 0;
        body.type = C.Body.STATIC;
        body.updateMassProperties();
      }
    cached = { physics, pieces: w.pieces, signature, id: p.id };
    predictionCache.set(cacheKey, cached);
  } else if (cached.pieces !== w.pieces) {
    cached.physics.world = w;
    cached.pieces = w.pieces;
    for (const piece of w.pieces) {
      const body = cached.physics.pieces.get(piece.id);
      if (!body) continue;
      const q = orientation(piece);
      body.quaternion.copy(q);
      body.position.copy(
        vec(piece.x, piece.y, piece.z).vadd(
          q.vmult(vec(0, ITEMS[piece.kind].h / 2, 0)),
        ),
      );
      body.aabbNeedsUpdate = true;
    }
    for (const player of w.players) {
      const body = cached.physics.players.get(player.id);
      if (body && player.id !== p.id) {
        body.position.set(player.x, player.y + PLAYER_HEIGHT / 2, player.z);
        body.aabbNeedsUpdate = true;
      }
    }
  }
  const physics = cached.physics,
    body = physics.players.get(p.id)!;
  body.position.set(p.x, p.y + PLAYER_HEIGHT / 2, p.z);
  body.velocity.y = p.vy;
  const count = Math.ceil(dt / STEP);
  for (let i = 0; i < count; i++) {
    physics.controls(p, input, dt / count);
    physics.step(dt / count);
    physics.readPlayer(p);
  }
}
