import * as C from 'cannon-es';
import { RING, STEP, type World } from './types';

/** Planar rigid bodies keep feet planted while hits and rope rebounds carry momentum. */
export class BoxingPhysics {
  private world = new C.World({ gravity: new C.Vec3(0, 0, 0) });
  private bodies = new Map<string, C.Body>();
  constructor() {
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0.15;
  }
  step(state: World) {
    const active = state.players.filter((p) => p.active && p.tagTransition === 0);
    for (const [id, body] of this.bodies)
      if (!active.some((p) => p.id === id)) {
        this.world.removeBody(body);
        this.bodies.delete(id);
      }
    for (const p of active) {
      let body = this.bodies.get(p.id);
      if (!body) {
        body = new C.Body({
          mass: 70,
          shape: new C.Sphere(RING.radius),
          linearDamping: 0,
          fixedRotation: true,
        });
        body.linearFactor.set(1, 0, 1);
        this.world.addBody(body);
        this.bodies.set(p.id, body);
      }
      body.position.set(p.x, 0, p.z);
      body.velocity.set(p.vx, 0, p.vz);
    }
    this.world.step(STEP);
    const rebounds: typeof active = [];
    for (const p of active) {
      const b = this.bodies.get(p.id)!;
      p.x = b.position.x;
      p.z = b.position.z;
      p.vx = b.velocity.x;
      p.vz = b.velocity.z;
      let rebound = false;
      for (const axis of ['x', 'z'] as const) {
        const limit = RING[axis] - RING.radius;
        const velocity = axis === 'x' ? 'vx' : 'vz';
        if (Math.abs(p[axis]) > limit) {
          const side = Math.sign(p[axis]);
          p[axis] = side * limit;
          if (p[velocity] * side > 0) {
            rebound ||= Math.abs(p[velocity]) > 2.5;
            p[velocity] *= -0.72;
          }
        }
      }
      if (rebound) rebounds.push(p);
    }
    return rebounds;
  }
}
