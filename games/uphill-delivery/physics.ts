import * as C from 'cannon-es';
import {
  sofaShapes,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
} from '../../shared/physics/sofa';
import { LEVEL, bridgePose, DOOR, GATE, goatPose, GOATS } from './level';
import {
  GRIPS,
  SOFA_CENTER,
  SOFA_SCALE,
  type DeliveryWorld,
  type DeliveryPlayer,
  type DeliveryBody,
  type Vec,
} from './types';

const vec = (p: Vec) => new C.Vec3(p.x, p.y, p.z);
export const plainVector = (p: Vec): Vec => ({ x: p.x, y: p.y, z: p.z });
const up = new C.Vec3(0, 1, 0);
export const STEP = 1 / 60;
export function gripPosition(w: DeliveryWorld, index: number) {
  const q = new C.Quaternion(
    w.sofa.quaternion.x,
    w.sofa.quaternion.y,
    w.sofa.quaternion.z,
    w.sofa.quaternion.w,
  );
  return q.vmult(vec(GRIPS[index])).vadd(vec(w.sofa));
}
export function deliveryEvent(w: DeliveryWorld, text: string) {
  w.events.push({ id: (w.events.at(-1)?.id ?? 0) + 1, text });
  w.events = w.events.slice(-6);
}
export function cargoInsideRoom(w: DeliveryWorld) {
  const body = deliveryPhysics(w).sofa;
  for (const x of [-2.1, 2.1])
    for (const y of [-SOFA_CENTER, SOFA_CENTER])
      for (const z of [-0.94, 0.94]) {
        const p = body.pointToWorldFrame(new C.Vec3(x, y, z));
        if (
          p.x < -8.85 ||
          p.x > -3.25 ||
          p.z < -26.15 ||
          p.z > -19.85 ||
          p.y < 21.92 ||
          p.y > 25
        )
          return false;
      }
  return true;
}
export class DeliveryPhysics {
  engine = new C.World({ gravity: new C.Vec3(0, -9.81, 0) });
  sofa: C.Body;
  players = new Map<string, C.Body>();
  gate: C.Body;
  door: C.Body;
  bridges: { body: C.Body; box: (typeof LEVEL)[number] }[] = [];
  goats: C.Body[] = [];
  private surfaces = new Map<number, string>();
  constructor(public world: DeliveryWorld) {
    const e = this.engine;
    e.broadphase = new C.SAPBroadphase(e);
    e.narrowphase.enableFrictionReduction = true;
    (e.solver as C.GSSolver).iterations = 35;
    e.defaultContactMaterial.friction = 0.55;
    e.defaultContactMaterial.restitution = 0.02;
    const cargoMaterial = new C.Material('cargo'),
      groundMaterial = new C.Material('road'),
      ice = new C.Material('ice'),
      person = new C.Material('worker');
    e.addContactMaterial(
      new C.ContactMaterial(cargoMaterial, groundMaterial, {
        friction: 0.45,
        restitution: 0.05,
      }),
    );
    // A compound sofa makes several simultaneous contacts across stair treads.
    e.addContactMaterial(
      new C.ContactMaterial(cargoMaterial, ice, {
        friction: 0.0003,
        restitution: 0.015,
      }),
    );
    e.addContactMaterial(
      new C.ContactMaterial(person, groundMaterial, {
        friction: 0,
        restitution: 0,
      }),
    );
    e.addContactMaterial(
      new C.ContactMaterial(person, ice, { friction: 0, restitution: 0 }),
    );
    e.addContactMaterial(
      new C.ContactMaterial(person, cargoMaterial, {
        friction: 0.15,
        restitution: 0,
      }),
    );
    for (const box of LEVEL) {
      const b = new C.Body({
        mass: 0,
        type: box.bridge ? C.Body.KINEMATIC : C.Body.STATIC,
        material: box.ice ? ice : groundMaterial,
      });
      b.addShape(
        new C.Box(
          new C.Vec3(
            ...(box.size.map((n) => n / 2) as [number, number, number]),
          ),
        ),
      );
      b.position.copy(vec(box.position));
      b.quaternion.set(
        box.quaternion.x,
        box.quaternion.y,
        box.quaternion.z,
        box.quaternion.w,
      );
      e.addBody(b);
      this.surfaces.set(b.id, box.id);
      if (box.bridge) this.bridges.push({ body: b, box });
    }
    // The lowest ground catches falls. Boundary walls never move cargo uphill.
    for (const [x, z, sx, sz] of [
      [-23, -4, 0.5, 62],
      [23, -4, 0.5, 62],
      [0, 27, 46, 0.5],
      [0, -35, 46, 0.5],
    ]) {
      const b = new C.Body({
        mass: 0,
        shape: new C.Box(new C.Vec3(sx / 2, 25, sz / 2)),
        position: new C.Vec3(x, 24, z),
      });
      e.addBody(b);
    }
    this.sofa = new C.Body({
      mass: 84,
      material: cargoMaterial,
      linearDamping: 0.08,
      angularDamping: 0.18,
    });
    for (const shape of sofaShapes())
      this.sofa.addShape(
        new C.Box(
          new C.Vec3(
            ...(shape.size.map((n) => (n * SOFA_SCALE) / 2) as [
              number,
              number,
              number,
            ]),
          ),
        ),
        new C.Vec3(
          shape.pos[0] * SOFA_SCALE,
          shape.pos[1] * SOFA_SCALE - SOFA_CENTER,
          shape.pos[2] * SOFA_SCALE,
        ),
      );
    this.restore(this.sofa, world.sofa);
    e.addBody(this.sofa);
    for (const p of world.players) {
      const b = new C.Body({
        mass: 80,
        material: person,
        fixedRotation: true,
        linearDamping: 0,
      });
      // A rounded foot slides over the shallow stair risers without invisible ramps.
      b.addShape(
        new C.Sphere(PLAYER_RADIUS),
        new C.Vec3(0, -PLAYER_HEIGHT / 2 + PLAYER_RADIUS, 0),
      );
      b.addShape(
        new C.Box(
          new C.Vec3(
            PLAYER_RADIUS,
            (PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2,
            PLAYER_RADIUS,
          ),
        ),
      );
      b.position.set(p.x, p.y + PLAYER_HEIGHT / 2, p.z);
      b.velocity.copy(vec(p.velocity));
      b.updateMassProperties();
      this.players.set(p.id, b);
      e.addBody(b);
    }
    this.gate = this.panel(GATE.x, GATE.y, GATE.z - 2.3, 4.6, 1.8);
    this.door = this.panel(DOOR.x, DOOR.y, DOOR.z, 3.7, 3);
    this.surfaces.set(this.gate.id, 'gate');
    this.surfaces.set(this.door.id, 'door');
    this.sofa.addEventListener(
      'collide',
      ({ body, contact }: { body: C.Body; contact: C.ContactEquation }) => {
        if (!this.surfaces.has(body.id)) return;
        const speed = Math.abs(contact.getImpactVelocityAlongNormal());
        const old = world.sofaImpact;
        // Compound feet may collide in one step; retain the strongest contact.
        if (old?.at === world.clock) {
          old.speed = Math.max(old.speed, speed);
          return;
        }
        if (speed < 0.65 || (old && world.clock - old.at < 180)) return;
        world.sofaImpact = {
          id: (old?.id ?? 0) + 1,
          at: world.clock,
          speed,
          position: plainVector(this.sofa.position),
        };
      },
    );
    this.gate.quaternion.setFromAxisAngle(up, world.gate);
    this.door.quaternion.setFromAxisAngle(up, world.door);
    for (let i = 0; i < GOATS.length; i++) {
      const p = goatPose(i, world.clock - world.started);
      const b = new C.Body({
        type: C.Body.KINEMATIC,
        mass: 0,
        shape: new C.Box(new C.Vec3(0.42, 0.55, 0.7)),
        position: new C.Vec3(p.x, p.y + 0.55, p.z),
      });
      this.goats.push(b);
      e.addBody(b);
    }
  }
  panel(x: number, y: number, z: number, width: number, height: number) {
    const b = new C.Body({
      type: C.Body.KINEMATIC,
      mass: 0,
      position: new C.Vec3(x, y, z),
    });
    b.addShape(
      new C.Box(new C.Vec3(0.12, height / 2, width / 2)),
      new C.Vec3(0, height / 2, width / 2),
    );
    this.engine.addBody(b);
    return b;
  }
  restore(body: C.Body, p: DeliveryBody) {
    body.position.copy(vec(p));
    body.velocity.copy(vec(p.velocity));
    body.angularVelocity.copy(vec(p.angular));
    body.quaternion.set(
      p.quaternion.x,
      p.quaternion.y,
      p.quaternion.z,
      p.quaternion.w,
    );
  }
  support(body: C.Body) {
    return this.engine.contacts.find(
      (c) =>
        c.enabled &&
        ((c.bi === body && -c.ni.y > 0.5) || (c.bj === body && c.ni.y > 0.5)),
    );
  }
  controls(p: DeliveryPlayer) {
    const b = this.players.get(p.id)!;
    const stale = this.world.clock - p.seen > 650;
    const input = stale
      ? { x: 0, z: 0, jump: false, seq: p.lastJump }
      : p.input;
    const length = Math.max(1, Math.hypot(input.x, input.z));
    const gripping = p.grip !== null,
      speed = gripping ? 2.65 : 4.4;
    const icy = p.y > 15.7 && p.y < 19.8 && p.z < -12.7 && p.z > -17.3;
    const acceleration = icy ? (gripping ? 10 : 3.2) : p.grounded ? 25 : 7;
    const maxChange = acceleration * STEP;
    const vx = (input.x / length) * speed,
      vz = (input.z / length) * speed;
    b.velocity.x += Math.max(
      -maxChange,
      Math.min(maxChange, vx - b.velocity.x),
    );
    b.velocity.z += Math.max(
      -maxChange,
      Math.min(maxChange, vz - b.velocity.z),
    );
    // Boots step over the visible shallow ice risers; taller ledges still need a jump.
    if (icy && p.grounded && Math.hypot(input.x, input.z) > 0.05) {
      const directionLength = Math.hypot(input.x, input.z);
      const dx = (input.x / directionLength) * 0.55,
        dz = (input.z / directionLength) * 0.55;
      const hit = new C.RaycastResult();
      this.engine.raycastClosest(
        new C.Vec3(p.x + dx, p.y + 0.3, p.z + dz),
        new C.Vec3(p.x + dx, p.y + 0.035, p.z + dz),
        { skipBackfaces: true },
        hit,
      );
      if (
        hit.hasHit &&
        hit.body?.type === C.Body.STATIC &&
        hit.hitNormalWorld.y > 0.8
      ) {
        b.position.y += Math.max(0, hit.hitPointWorld.y - p.y) + 0.008;
        // A riser contact can push a slow-moving boot backward. Complete the
        // step at the requested walking speed, then resume normal ice traction.
        b.velocity.x = vx;
        b.velocity.z = vz;
        b.velocity.y = Math.max(0, b.velocity.y);
        b.aabbNeedsUpdate = true;
      }
    }
    if (Math.hypot(input.x, input.z) > 0.02)
      p.angle = Math.atan2(input.x, input.z);
    const contact = this.support(b),
      onSofa =
        contact && (contact.bi === this.sofa || contact.bj === this.sofa);
    if (input.jump && input.seq > p.lastJump) {
      p.lastJump = input.seq;
      if (p.grounded || contact) {
        b.velocity.y = onSofa ? 9.1 : 5.9;
        p.grounded = false;
      }
    }
    if (!gripping) return;
    const grip = this.sofa.pointToWorldFrame(vec(GRIPS[p.grip!]));
    // Hands face the sofa independently of the direction the worker walks.
    const toward = this.sofa.position.vsub(b.position);
    toward.y = 0;
    toward.normalize();
    const hand = b.position.vadd(toward.scale(0.65));
    hand.y += 0.26;
    const delta = hand.vsub(grip);
    if (delta.length() > 3.4 || p.stumble > this.world.clock) {
      p.grip = null;
      deliveryEvent(this.world, `${p.name} lost their grip. Catch the sofa!`);
      return;
    }
    const velocity = new C.Vec3();
    this.sofa.getVelocityAtWorldPoint(grip, velocity);
    const force = delta.scale(750).vadd(b.velocity.vsub(velocity).scale(75));
    // One worker can drag it; two carry it. Solo has an explicit helping hand.
    const maxForce = this.world.players.length === 1 ? 1600 : 720;
    if (force.length() > maxForce)
      force.scale(maxForce / force.length(), force);
    this.sofa.applyForce(force, grip.vsub(this.sofa.position));
    // Arms support part of the cargo's weight without making it kinematic.
    // One solo mover gets a helping hand; a crew needs at least two to lift.
    this.sofa.applyForce(
      new C.Vec3(0, this.world.players.length === 1 ? 780 : 390),
    );
    const sofaUp = this.sofa.quaternion.vmult(up);
    const carriers = this.world.players.filter(
      (player) => player.grip !== null,
    ).length;
    if (this.world.players.length === 1 || carriers >= 2) {
      const q = this.sofa.quaternion;
      const yaw = Math.atan2(
        2 * (q.w * q.y + q.x * q.z),
        1 - 2 * (q.y * q.y + q.z * q.z),
      );
      const error = Math.atan2(
        Math.sin(this.world.carryYaw - yaw),
        Math.cos(this.world.carryYaw - yaw),
      );
      this.sofa.torque.y +=
        Math.max(
          -650,
          Math.min(650, error * 950 - this.sofa.angularVelocity.y * 150),
        ) / Math.max(1, carriers);
    }
    const balance =
      this.world.players.length === 1 ||
      this.world.players.filter((p) => p.grip !== null).length >= 2;
    if (balance) {
      // Multiple pairs of arms resist the uneven load from an asymmetric crew.
      // This applies to human and NPC carriers alike; solo assistance is unchanged.
      const solo = this.world.players.length === 1;
      const torque = sofaUp.cross(up).scale(solo ? 240 : 480);
      const damping = solo ? 80 : 120;
      this.sofa.torque.vadd(
        new C.Vec3(
          torque.x - this.sofa.angularVelocity.x * damping,
          0,
          torque.z - this.sofa.angularVelocity.z * damping,
        ),
        this.sofa.torque,
      );
    }
    b.applyForce(
      new C.Vec3(
        -force.x * 0.55,
        Math.min(0, -force.y * 0.18),
        -force.z * 0.55,
      ),
    );
  }
  movingPanel(body: C.Body, value: number, target: number, speed: number) {
    const change = Math.max(
      -speed * STEP,
      Math.min(speed * STEP, target - value),
    );
    body.quaternion.setFromAxisAngle(up, value);
    body.angularVelocity.set(0, change / STEP, 0);
    body.aabbNeedsUpdate = true;
    return value + change;
  }
  step() {
    const w = this.world;
    w.gate = this.movingPanel(this.gate, w.gate, w.gateTarget, 1.2);
    w.door = this.movingPanel(this.door, w.door, w.doorTarget, 2.5);
    for (const { body, box } of this.bridges) {
      const pose = bridgePose(box, w.clock - w.started);
      body.velocity.y = (pose.y - body.position.y) / STEP;
      const q = new C.Quaternion(
        box.quaternion.x,
        box.quaternion.y,
        box.quaternion.z,
        box.quaternion.w,
      );
      q.mult(
        new C.Quaternion().setFromAxisAngle(new C.Vec3(1, 0, 0), pose.roll),
        body.quaternion,
      );
      body.aabbNeedsUpdate = true;
    }
    this.goats.forEach((b, i) => {
      const p = goatPose(i, w.clock - w.started);
      b.velocity.set(
        (p.x - b.position.x) / STEP,
        (p.y + 0.55 - b.position.y) / STEP,
        (p.z - b.position.z) / STEP,
      );
      b.quaternion.setFromAxisAngle(up, p.angle);
    });
    const falling = new Map(
      w.players.map((p) => [p.id, this.players.get(p.id)!.velocity.y]),
    );
    for (const p of w.players) this.controls(p);
    this.engine.step(STEP);
    for (const p of w.players) {
      const b = this.players.get(p.id)!,
        contact = this.support(b);
      p.grounded = !!contact;
      const supportingBody =
        contact && (contact.bi === b ? contact.bj : contact.bi);
      p.support =
        supportingBody === this.sofa
          ? 'sofa'
          : supportingBody
            ? (this.surfaces.get(supportingBody.id) ?? null)
            : null;
      if (
        contact &&
        (contact.bi === this.sofa || contact.bj === this.sofa) &&
        falling.get(p.id)! < -2.2
      ) {
        const local = this.sofa.pointToLocalFrame(b.position);
        const sofaUp = this.sofa.quaternion.vmult(up);
        if (sofaUp.y > 0.55 && Math.abs(local.x) < 1.9 && local.z > -0.65) {
          b.velocity.y = 7.8;
          p.grounded = false;
          deliveryEvent(w, `${p.name} caught a cushion. Sofa saves lives.`);
        }
      }
      for (const goat of this.goats) {
        if (
          this.engine.contacts.some(
            (c) =>
              (c.bi === b && c.bj === goat) || (c.bi === goat && c.bj === b),
          ) &&
          p.stumble < w.clock
        ) {
          const kick = b.position.vsub(goat.position);
          kick.y = 0;
          kick.normalize();
          b.velocity.x += kick.x * 3.5;
          b.velocity.z += kick.z * 3.5;
          b.velocity.y = 2.5;
          p.stumble = w.clock + 1300;
          p.grip = null;
          deliveryEvent(w, 'The goat has right of way. Apparently.');
        }
      }
      p.x = b.position.x;
      p.y = b.position.y - PLAYER_HEIGHT / 2;
      p.z = b.position.z;
      p.velocity = plainVector(b.velocity);
    }
    const s = this.sofa;
    const support = this.support(s);
    w.sofaSurface = support
      ? (this.surfaces.get((support.bi === s ? support.bj : support.bi).id) ??
        null)
      : null;
    Object.assign(w.sofa, {
      x: s.position.x,
      y: s.position.y,
      z: s.position.z,
      velocity: plainVector(s.velocity),
      angular: plainVector(s.angularVelocity),
      quaternion: {
        x: s.quaternion.x,
        y: s.quaternion.y,
        z: s.quaternion.z,
        w: s.quaternion.w,
      },
    });
  }
}
const cache = new WeakMap<
  DeliveryWorld,
  { key: string; physics: DeliveryPhysics; sofa: DeliveryBody }
>();
export function deliveryPhysics(w: DeliveryWorld) {
  const key = `${w.started}|${w.players.map((p) => p.id).join(',')}`;
  let entry = cache.get(w);
  if (!entry || entry.key !== key || entry.sofa !== w.sofa) {
    entry = { key, sofa: w.sofa, physics: new DeliveryPhysics(w) };
    cache.set(w, entry);
  }
  return entry.physics;
}
