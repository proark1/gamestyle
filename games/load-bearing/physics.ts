import * as C from 'cannon-es';
import {
  FLOOR,
  PART_MASS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  alive,
  type LoadInput,
  type LoadWorld,
  type Part,
  type Piano,
  type Wrecker,
} from './types';

export const STEP = 1 / 60;
export const BALL_RADIUS = 0.85;
export const BALL_MASS = 400;
/** Cable length from hoist to the centre of the ball. */
export const CABLE = 4;
export const WALK_SPEED = 4.4;
export const JUMP_SPEED = 5.9;
const PIANO_SIZE = { w: 1.5, h: 1.1, d: 0.7 };
/**
 * cannon-es multiplies the two bodies' friction, and only consults them when
 * BOTH carry a material -- otherwise the pair silently falls back to the world
 * default. Everything on site except the crew therefore needs one, or the
 * crew's own zero-friction material never applies and the ground drags them to
 * a crawl. 0.74 squares to the 0.55 the collapse was tuned against.
 */
const SITE_FRICTION = 0.74;
const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);

function quaternionOf(p: Part) {
  const q = new C.Quaternion();
  if (p.quaternion)
    q.set(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w);
  return q;
}

/**
 * Only the collapse runs in the solver. Parts still carried by the support
 * graph are mass-zero bodies, so a settled house costs nothing to simulate and
 * cannot drift, while falling debris still lands on what is left standing.
 */
export class Collapse {
  engine = new C.World({ gravity: vec(0, -9.81, 0), allowSleep: true });
  bodies = new Map<string, C.Body>();
  people = new Map<string, C.Body>();
  piano: C.Body | null = null;
  ball: C.Body | null = null;
  hoist: C.Body | null = null;
  /** Damage the piano took this run of steps, drained by `save`. */
  pianoDamage = 0;
  destroyed = new Set<string>();

  constructor(public world: LoadWorld) {
    const e = this.engine;
    e.solver = new C.GSSolver();
    (e.solver as C.GSSolver).iterations = 24;
    (e.solver as C.GSSolver).tolerance = 1e-6;
    e.defaultContactMaterial.friction = 0.55;
    e.defaultContactMaterial.restitution = 0.03;
    e.defaultContactMaterial.contactEquationStiffness = 1e8;
    e.defaultContactMaterial.contactEquationRelaxation = 4;

    const site = new C.Material({
      friction: SITE_FRICTION,
      restitution: 0.03,
    });
    const ground = new C.Body({ mass: 0, material: site });
    ground.addShape(new C.Plane());
    ground.quaternion.setFromAxisAngle(vec(1, 0, 0), -Math.PI / 2);
    ground.position.set(0, FLOOR, 0);
    e.addBody(ground);

    for (const p of world.parts) {
      if (!alive(p)) continue;
      const body = new C.Body({
        mass: p.falling ? PART_MASS[p.kind] : 0,
        allowSleep: true,
        sleepSpeedLimit: 0.09,
        sleepTimeLimit: 0.6,
        linearDamping: 0.03,
        angularDamping: 0.08,
        material: site,
      });
      body.addShape(new C.Box(vec(p.w / 2, p.h / 2, p.d / 2)));
      body.position.set(p.x, p.y, p.z);
      body.quaternion.copy(quaternionOf(p));
      if (p.falling) {
        body.velocity.set(p.vx, p.vy, p.vz);
        body.angularVelocity.set(
          p.angular?.x ?? 0,
          p.angular?.y ?? 0,
          p.angular?.z ?? 0,
        );
        if (p.sleeping) body.sleep();
      }
      e.addBody(body);
      this.bodies.set(p.id, body);
    }

    for (const p of world.players) {
      if (p.down) continue;
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
      body.velocity.set(p.vx, p.vy, p.vz);
      body.updateMassProperties();
      e.addBody(body);
      this.people.set(p.id, body);
    }

    const piano = new C.Body({
      mass: world.piano.resting ? 0 : 240,
      allowSleep: true,
      sleepSpeedLimit: 0.09,
      sleepTimeLimit: 0.6,
      linearDamping: 0.05,
      angularDamping: 0.2,
      material: site,
    });
    piano.addShape(
      new C.Box(vec(PIANO_SIZE.w / 2, PIANO_SIZE.h / 2, PIANO_SIZE.d / 2)),
    );
    piano.position.set(world.piano.x, world.piano.y, world.piano.z);
    if (!world.piano.resting) piano.velocity.set(0, world.piano.vy, 0);
    piano.addEventListener(
      'collide',
      (event: { contact: C.ContactEquation }) => {
        const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (speed > 2.4) this.pianoDamage += (speed - 2.4) * 5.5;
      },
    );
    e.addBody(piano);
    this.piano = piano;

    if (world.crane.owner) {
      const ball = new C.Body({
        mass: BALL_MASS,
        linearDamping: 0.12,
        angularDamping: 0.4,
        allowSleep: false,
        material: site,
      });
      ball.addShape(new C.Sphere(BALL_RADIUS));
      ball.position.set(
        world.crane.ballX,
        world.crane.ballY,
        world.crane.ballZ,
      );
      ball.velocity.set(world.crane.vx, world.crane.vy, world.crane.vz);
      // A real cable, so the ball swings behind the hoist instead of chasing it.
      const hoist = new C.Body({ mass: 0 });
      hoist.position.set(world.crane.x, world.crane.y, world.crane.z);
      e.addBody(hoist);
      this.hoist = hoist;
      ball.addEventListener('collide', (event: { body: C.Body }) => {
        const speed = ball.velocity.length();
        if (speed < 1.6) return;
        for (const [id, other] of this.bodies)
          if (other === event.body) this.destroyed.add(id);
      });
      e.addBody(ball);
      this.ball = ball;
      const cable = new C.PointToPointConstraint(
        hoist,
        vec(0, 0, 0),
        ball,
        vec(0, CABLE, 0),
        BALL_MASS * 260,
      );
      e.addConstraint(cable);
    }
  }

  /** Drive a worker as a character controller rather than a shoved crate. */
  controls(p: Wrecker, input: LoadInput) {
    const body = this.people.get(p.id);
    if (!body) return;
    const onCrane = this.world.crane.owner === p.id;
    const length = Math.max(1, Math.hypot(input.x, input.z));
    const x = onCrane ? 0 : input.x / length;
    const z = onCrane ? 0 : input.z / length;
    // An idle worker carries no horizontal momentum, so resting on tilted
    // rubble cannot slide them. Gravity and support stay fully simulated.
    const moving = Math.hypot(x, z) > 0.001;
    body.linearFactor.set(moving ? 1 : 0, 1, moving ? 1 : 0);
    body.velocity.x = moving ? x * WALK_SPEED : 0;
    body.velocity.z = moving ? z * WALK_SPEED : 0;
    if (moving) p.facing = Math.atan2(x, z);
    if (input.jump && input.seq !== p.lastJump && p.grounded) {
      body.velocity.y = JUMP_SPEED;
      p.grounded = false;
      p.lastJump = input.seq;
    }
  }

  readPlayer(p: Wrecker) {
    const body = this.people.get(p.id);
    if (!body) return;
    p.x = body.position.x;
    p.y = body.position.y - PLAYER_HEIGHT / 2;
    p.z = body.position.z;
    p.vx = body.velocity.x;
    p.vy = body.velocity.y;
    p.vz = body.velocity.z;
    p.grounded = this.engine.contacts.some(
      (c) =>
        c.enabled &&
        ((c.bi === body && -c.ni.y > 0.55) || (c.bj === body && c.ni.y > 0.55)),
    );
    if (p.grounded && Math.abs(p.vy) < 0.08) p.vy = 0;
  }

  step(steps: number) {
    for (let i = 0; i < steps; i++) this.engine.step(STEP);
  }

  save() {
    for (const p of this.world.parts) {
      const body = this.bodies.get(p.id);
      if (!body || !p.falling) continue;
      p.x = body.position.x;
      p.y = body.position.y;
      p.z = body.position.z;
      p.vx = body.velocity.x;
      p.vy = body.velocity.y;
      p.vz = body.velocity.z;
      p.angular = {
        x: body.angularVelocity.x,
        y: body.angularVelocity.y,
        z: body.angularVelocity.z,
      };
      p.quaternion = {
        x: body.quaternion.x,
        y: body.quaternion.y,
        z: body.quaternion.z,
        w: body.quaternion.w,
      };
      p.sleeping = body.sleepState === C.Body.SLEEPING;
    }
    const piano: Piano = this.world.piano;
    if (this.piano && !piano.resting) {
      piano.x = this.piano.position.x;
      piano.y = this.piano.position.y;
      piano.z = this.piano.position.z;
      piano.vy = this.piano.velocity.y;
    }
    if (this.ball) {
      const c = this.world.crane;
      c.ballX = this.ball.position.x;
      c.ballY = this.ball.position.y;
      c.ballZ = this.ball.position.z;
      c.vx = this.ball.velocity.x;
      c.vy = this.ball.velocity.y;
      c.vz = this.ball.velocity.z;
    }
    const damage = this.pianoDamage;
    this.pianoDamage = 0;
    return { damage, destroyed: [...this.destroyed] };
  }
}
