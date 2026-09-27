import * as C from 'cannon-es';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  WORLD_LIMIT,
  adventureColliders,
  physicsEnvironmentKey,
  positionIsBlocked,
  safeSpawn,
  type AdventureCollider,
} from './physics-layout';
import type { AdventurePlayer, AdventureWorld } from './types';

const STEP = 1 / 60;
const MAX_SUBSTEPS = 8;
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 6.2;
const PLAYER_GROUP = 1;
const SCENERY_GROUP = 2;

function desiredVelocity(player: AdventurePlayer) {
  if (player.station === 'helm') return { x: 0, z: 0 };
  const { x, z, yaw, sprint } = player.input;
  const length = Math.hypot(x, z);
  if (length < 0.05) return { x: 0, z: 0 };
  const nx = x / Math.max(1, length);
  const nz = z / Math.max(1, length);
  const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: (nx * cos - nz * sin) * speed,
    z: (-nz * cos - nx * sin) * speed,
  };
}

function staticBody(collider: AdventureCollider, material: C.Material) {
  const body = new C.Body({
    type: C.Body.STATIC,
    material,
    position: new C.Vec3(collider.x, PLAYER_HEIGHT / 2, collider.z),
    collisionFilterGroup: SCENERY_GROUP,
    collisionFilterMask: PLAYER_GROUP,
  });
  if (collider.shape === 'cylinder')
    body.addShape(new C.Cylinder(collider.radius, collider.radius, 3, 12));
  else {
    body.addShape(
      new C.Box(new C.Vec3(collider.width / 2, 1.5, collider.depth / 2)),
    );
    body.quaternion.setFromAxisAngle(new C.Vec3(0, 1, 0), collider.angle ?? 0);
  }
  return body;
}

export class AdventurePhysics {
  private engine = new C.World({ gravity: new C.Vec3(0, 0, 0) });
  private playerMaterial = new C.Material('adventure-player');
  private sceneryMaterial = new C.Material('adventure-scenery');
  private playerBodies = new Map<string, C.Body>();
  private environmentKey = '';

  constructor(private state: AdventureWorld) {
    this.configureEngine();
    this.rebuildEnvironment();
  }

  private configureEngine() {
    this.engine.allowSleep = false;
    this.engine.solver = new C.GSSolver();
    (this.engine.solver as C.GSSolver).iterations = 12;
    (this.engine.solver as C.GSSolver).tolerance = 1e-5;
    this.engine.addContactMaterial(
      new C.ContactMaterial(this.playerMaterial, this.sceneryMaterial, {
        friction: 0,
        restitution: 0,
      }),
    );
  }

  private rebuildEnvironment() {
    while (this.engine.bodies.length > 0)
      this.engine.removeBody(this.engine.bodies.at(-1)!);
    this.playerBodies.clear();
    for (const collider of adventureColliders(this.state))
      this.engine.addBody(staticBody(collider, this.sceneryMaterial));
    this.environmentKey = physicsEnvironmentKey(this.state);
  }

  private addPlayer(player: AdventurePlayer) {
    const spawn = safeSpawn(this.state.phase, player.seat);
    if (
      !Number.isFinite(player.x) ||
      !Number.isFinite(player.z) ||
      positionIsBlocked(this.state, player.x, player.z)
    ) {
      player.x = spawn.x;
      player.z = spawn.z;
    }
    const body = new C.Body({
      mass: 72,
      material: this.playerMaterial,
      position: new C.Vec3(player.x, PLAYER_HEIGHT / 2, player.z),
      linearDamping: 0,
      angularDamping: 1,
      fixedRotation: true,
      collisionFilterGroup: PLAYER_GROUP,
      collisionFilterMask: SCENERY_GROUP,
    });
    body.addShape(new C.Sphere(PLAYER_RADIUS));
    body.linearFactor.set(1, 0, 1);
    body.angularFactor.set(0, 0, 0);
    body.updateMassProperties();
    this.engine.addBody(body);
    this.playerBodies.set(player.id, body);
  }

  private syncPlayers() {
    const enabled = new Set(
      this.state.players
        .filter((player) => !player.bot && !player.overboard)
        .map((player) => player.id),
    );
    for (const [id, body] of this.playerBodies)
      if (!enabled.has(id)) {
        this.engine.removeBody(body);
        this.playerBodies.delete(id);
      }
    for (const player of this.state.players) {
      if (player.bot || player.overboard) continue;
      const body = this.playerBodies.get(player.id);
      if (!body) {
        this.addPlayer(player);
        continue;
      }
      if (
        Math.hypot(body.position.x - player.x, body.position.z - player.z) >
        0.75
      ) {
        body.position.set(player.x, PLAYER_HEIGHT / 2, player.z);
        body.velocity.setZero();
      }
    }
  }

  step(deltaSeconds: number) {
    if (physicsEnvironmentKey(this.state) !== this.environmentKey)
      this.rebuildEnvironment();
    this.syncPlayers();
    const seconds = Math.max(0, Math.min(0.1, deltaSeconds));
    if (seconds <= 0) return;
    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;
      const velocity = desiredVelocity(player);
      body.velocity.set(velocity.x, 0, velocity.z);
      body.position.y = PLAYER_HEIGHT / 2;
      body.force.set(0, 0, 0);
      body.torque.set(0, 0, 0);
    }
    this.engine.step(STEP, seconds, MAX_SUBSTEPS);
    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;
      const valid =
        Number.isFinite(body.position.x) && Number.isFinite(body.position.z);
      if (!valid) {
        const spawn = safeSpawn(this.state.phase, player.seat);
        body.position.set(spawn.x, PLAYER_HEIGHT / 2, spawn.z);
        body.velocity.setZero();
      }
      body.position.x = Math.max(
        -WORLD_LIMIT,
        Math.min(WORLD_LIMIT, body.position.x),
      );
      body.position.z = Math.max(
        -WORLD_LIMIT,
        Math.min(WORLD_LIMIT, body.position.z),
      );
      player.x = body.position.x;
      player.z = body.position.z;
    }
  }

  destroy() {
    while (this.engine.bodies.length > 0)
      this.engine.removeBody(this.engine.bodies.at(-1)!);
    this.playerBodies.clear();
  }
}

const physicsCache = new WeakMap<AdventureWorld, AdventurePhysics>();

export function adventurePhysics(world: AdventureWorld) {
  let physics = physicsCache.get(world);
  if (!physics) {
    physics = new AdventurePhysics(world);
    physicsCache.set(world, physics);
  }
  return physics;
}

export function resetAdventurePhysics(world: AdventureWorld) {
  physicsCache.get(world)?.destroy();
  physicsCache.delete(world);
}
