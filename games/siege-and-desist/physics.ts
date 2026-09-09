import * as C from 'cannon-es';
import { AMMO, FIELD, type Block, type Shot, type SiegeWorld } from './types';

export const GRAVITY = -12;
const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);
const DENSITY = 22;

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
    if (body) this.engine.removeBody(body);
    this.blocks.delete(id);
  }

  removeShot(id: number) {
    const body = this.shots.get(id);
    if (body) this.engine.removeBody(body);
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
    this.engine.step(dt);
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
