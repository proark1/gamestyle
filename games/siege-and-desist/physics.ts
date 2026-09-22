import * as C from 'cannon-es';
import { AMMO, FIELD, type Block, type Shot, type SiegeWorld } from './types';

export const GRAVITY = -12;
const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);
const DENSITY = 22;
// Courses start with 0.02m clearance, before Cannon has any contact history.
const SUPPORT_GAP = 0.06;

/**
 * The keep is a real rigid-body stack, so the crew's shots decide how it comes
 * apart. One solver is kept per world object: a checkpoint restore hands the
 * engine a fresh world, which rebuilds the masonry from the stored transforms.
 */
export class CastleSolver {
  engine = new C.World({ gravity: vec(0, GRAVITY, 0), allowSleep: true });
  blocks = new Map<number, C.Body>();
  shots = new Map<number, C.Body>();
  private stone = new C.Material({ friction: 0.62, restitution: 0.04 });
  private masonry = new Set<C.Body>();
  /** Bodies resting on each support, retained while both bodies sleep. */
  private supported = new Map<C.Body, Set<C.Body>>();

  constructor(world: SiegeWorld) {
    const e = this.engine;
    e.solver = new C.GSSolver();
    (e.solver as C.GSSolver).iterations = 14;
    (e.solver as C.GSSolver).tolerance = 1e-5;
    e.defaultContactMaterial.friction = 0.62;
    e.defaultContactMaterial.restitution = 0.02;
    e.defaultContactMaterial.contactEquationStiffness = 1e7;
    e.defaultContactMaterial.contactEquationRelaxation = 4;
    const ground = new C.Body({ mass: 0, material: this.stone });
    ground.addShape(new C.Plane());
    ground.quaternion.setFromAxisAngle(vec(1, 0, 0), -Math.PI / 2);
    e.addBody(ground);
    // A far boundary keeps stray boulders from travelling forever.
    const fence = new C.Body({ mass: 0, material: this.stone });
    for (const sign of [-1, 1]) {
      fence.addShape(
        new C.Box(vec(0.5, 12, FIELD.z + 8)),
        vec(sign * (FIELD.x + 6), 12, 0),
      );
      fence.addShape(
        new C.Box(vec(FIELD.x + 8, 12, 0.5)),
        vec(0, 12, sign * (FIELD.z + 8)),
      );
    }
    e.addBody(fence);
    for (const b of world.blocks) this.addBlock(b);
    for (const s of world.shots) this.addShot(s);
    this.seedSupports();
  }

  addBlock(b: Block) {
    const body = new C.Body({
      mass: b.w * b.h * b.d * DENSITY * (b.part === 'gate' ? 0.5 : 1),
      material: this.stone,
      allowSleep: true,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 0.55,
      linearDamping: 0.02,
      angularDamping: 0.09,
    });
    body.addShape(new C.Box(vec(b.w / 2, b.h / 2, b.d / 2)));
    // The banner is set into a broad stone plinth. A bare pole tips off the
    // roof at the first tremor, which would end the siege without a breach.
    if (b.part === 'banner')
      body.addShape(new C.Box(vec(0.78, 0.3, 0.78)), vec(0, -b.h / 2 + 0.3, 0));
    body.position.set(b.x, b.y, b.z);
    body.quaternion.set(b.qx, b.qy, b.qz, b.qw);
    body.updateMassProperties();
    this.engine.addBody(body);
    if (b.sleeping) body.sleep();
    this.blocks.set(b.id, body);
    this.masonry.add(body);
    return body;
  }

  addShot(s: Shot) {
    const spec = AMMO[s.kind];
    const body = new C.Body({
      mass: spec.mass,
      material: new C.Material({ friction: 0.45, restitution: 0.02 }),
      allowSleep: true,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.8,
      linearDamping: 0.005,
      angularDamping: 0.16,
    });
    body.addShape(new C.Sphere(spec.radius));
    body.position.set(s.x, s.y, s.z);
    body.velocity.set(s.vx, s.vy, s.vz);
    body.angularVelocity.set(0, 0, s.spin);
    this.engine.addBody(body);
    this.shots.set(s.id, body);
    return body;
  }

  removeBlock(id: number) {
    const body = this.blocks.get(id);
    if (body) {
      this.removeSupport(body);
      this.masonry.delete(body);
      this.engine.removeBody(body);
    }
    this.blocks.delete(id);
  }

  removeShot(id: number) {
    const body = this.shots.get(id);
    if (body) {
      this.removeSupport(body);
      this.engine.removeBody(body);
    }
    this.shots.delete(id);
  }

  /** Wakes and shoves masonry around a burst, used by fire pots and beehives. */
  burst(x: number, y: number, z: number, strength: number, radius: number) {
    return this.shove(x, y, z, radius, strength, null);
  }

  /**
   * A struck stone carries the shot's own direction into the wall, which is
   * what makes a hit shear a face off instead of politely nudging it upward.
   */
  impact(
    x: number,
    y: number,
    z: number,
    direction: { x: number; y: number; z: number },
    strength: number,
    radius: number,
  ) {
    return this.shove(x, y, z, radius, strength, direction);
  }

  private shove(
    x: number,
    y: number,
    z: number,
    radius: number,
    strength: number,
    direction: { x: number; y: number; z: number } | null,
  ) {
    let moved = 0;
    for (const [, body] of this.blocks) {
      const dx = body.position.x - x,
        dy = body.position.y - y,
        dz = body.position.z - z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > radius) continue;
      const falloff = (1 - distance / radius) * strength;
      const n = Math.max(0.5, distance);
      body.wakeUp();
      const push = direction
        ? {
            x: direction.x * falloff + (dx / n) * falloff * 0.35,
            y: direction.y * falloff * 0.5 + falloff * 0.12,
            z: direction.z * falloff + (dz / n) * falloff * 0.35,
          }
        : {
            x: (dx / n) * falloff,
            y: (dy / n) * falloff + falloff * 0.35,
            z: (dz / n) * falloff,
          };
      body.applyImpulse(vec(push.x, push.y, push.z), vec(0, 0, 0));
      moved++;
    }
    return moved;
  }

  step(dt: number) {
    this.wakeSupported(this.activeBodies());
    this.engine.step(dt);
    // Collisions can wake a foundation during this step as well as before it.
    this.wakeSupported(this.activeBodies());
    this.rememberSupports();
  }

  private activeBodies() {
    return [...this.blocks.values(), ...this.shots.values()].filter(
      (body) => body.sleepState !== C.Body.SLEEPING,
    );
  }

  private support(lower: C.Body, upper: C.Body) {
    if (!this.masonry.has(upper)) return;
    let resting = this.supported.get(lower);
    if (!resting) this.supported.set(lower, (resting = new Set()));
    resting.add(upper);
  }

  /** Seed the untouched sleeping stack; later movement uses real contacts. */
  private seedSupports() {
    const bodies = [...this.blocks.values(), ...this.shots.values()];
    for (const body of bodies) body.updateAABB();
    for (const upper of this.masonry) {
      const a = upper.aabb;
      let seated = a.lowerBound.y <= SUPPORT_GAP;
      for (const lower of bodies) {
        if (lower.position.y >= upper.position.y) continue;
        const b = lower.aabb;
        if (
          Math.abs(a.lowerBound.y - b.upperBound.y) <= SUPPORT_GAP &&
          a.lowerBound.x < b.upperBound.x &&
          a.upperBound.x > b.lowerBound.x &&
          a.lowerBound.z < b.upperBound.z &&
          a.upperBound.z > b.lowerBound.z
        ) {
          this.support(lower, upper);
          seated = true;
        }
      }
      // A restored airborne body must not inherit a floating sleep state.
      // Rotated rubble also needs real contacts, not its approximate bounds.
      const q = upper.quaternion;
      if (!seated || Math.hypot(q.x, q.y, q.z) > 0.002) upper.wakeUp();
    }
  }

  /** Cannon wakes on a collision, but not when a support slides or vanishes. */
  private wakeSupported(sources: C.Body[]) {
    const visited = new Set(sources);
    for (let i = 0; i < sources.length; i++) {
      for (const upper of this.supported.get(sources[i]) ?? []) {
        if (visited.has(upper)) continue;
        if (upper.sleepState === C.Body.SLEEPING) upper.wakeUp();
        visited.add(upper);
        sources.push(upper);
      }
    }
  }

  private removeSupport(body: C.Body) {
    this.wakeSupported([body]);
    this.supported.delete(body);
    for (const resting of this.supported.values()) resting.delete(body);
  }

  private rememberSupports() {
    // Sleeping pairs produce no Cannon contacts, so keep their last support.
    // Awake bodies rebuild theirs as they fall, tip and land on new rubble.
    for (const [lower, resting] of this.supported) {
      for (const upper of resting) {
        if (upper.sleepState !== C.Body.SLEEPING) resting.delete(upper);
      }
      if (!resting.size) this.supported.delete(lower);
    }
    for (const contact of this.engine.contacts) {
      if (contact.ni.y > 0.3) this.support(contact.bi, contact.bj);
      else if (contact.ni.y < -0.3) this.support(contact.bj, contact.bi);
    }
  }

  read(world: SiegeWorld) {
    for (const b of world.blocks) {
      const body = this.blocks.get(b.id);
      if (!body) continue;
      b.sleeping = body.sleepState === C.Body.SLEEPING;
      if (b.sleeping && b.fallen) continue;
      b.x = body.position.x;
      b.y = body.position.y;
      b.z = body.position.z;
      b.qx = body.quaternion.x;
      b.qy = body.quaternion.y;
      b.qz = body.quaternion.z;
      b.qw = body.quaternion.w;
    }
    for (const s of world.shots) {
      const body = this.shots.get(s.id);
      if (!body) continue;
      s.x = body.position.x;
      s.y = body.position.y;
      s.z = body.position.z;
      s.vx = body.velocity.x;
      s.vy = body.velocity.y;
      s.vz = body.velocity.z;
    }
  }
}

const solvers = new WeakMap<SiegeWorld, CastleSolver>();
export function solverFor(world: SiegeWorld) {
  let solver = solvers.get(world);
  if (!solver) {
    solver = new CastleSolver(world);
    solvers.set(world, solver);
  }
  return solver;
}
export function dropSolver(world: SiegeWorld) {
  solvers.delete(world);
}
