import { mapBounds, mapConfig, type MapId } from './maps';
import {
  Body,
  Box,
  Cylinder,
  GSSolver,
  Material,
  Plane,
  Quaternion,
  RaycastResult,
  SAPBroadphase,
  Sphere,
  Vec3,
  World as CannonWorld,
} from 'cannon-es';
import { pieceShape, scenerySolids } from './colliders';
import { pieceBase, stairHeight } from './levels';
import type { BodyState, Piece, Player, World } from './model';

const STEP = 1 / 90;
const PLAYER_CENTER = 0.9;
type Entry = { body: Body; key: string; center: number };
export type Impact = { target: string; piece: string; speed: number };
const tuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];

export class SitePhysics {
  world = new CannonWorld({ gravity: new Vec3(0, -20, 0), allowSleep: true });
  pieces = new Map<string, Entry>();
  players = new Map<string, Body>();
  carriers = new Map<string, string>();
  tags = new Map<number, { piece?: string; player?: string }>();
  impacts: Impact[] = [];
  localId?: string;
  stairs: Piece[] = [];
  constructor(public map: MapId = 'small') {
    const WALK_BOUNDS = mapBounds(map);
    const wallSpan = 40 * mapConfig(map).scale;
    this.world.broadphase = new SAPBroadphase(this.world);
    (this.world.solver as GSSolver).iterations = 12;
    this.world.defaultContactMaterial.friction = 0.55;
    this.world.defaultContactMaterial.restitution = 0.12;
    this.world.defaultMaterial.friction = 0.55;
    this.world.defaultMaterial.restitution = 0.12;
    const floor = new Body({ mass: 0, shape: new Plane() });
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    floor.position.y = 0.08;
    this.world.addBody(floor);
    for (const s of scenerySolids(map)) {
      const body = new Body({
        mass: 0,
        shape: new Box(new Vec3(s.w / 2, s.h / 2, s.d / 2)),
        position: new Vec3(s.x, s.y, s.z),
      });
      this.world.addBody(body);
    }
    for (const [x, z, w, d] of [
      [-WALK_BOUNDS.x - 0.2, 0, 0.4, wallSpan],
      [WALK_BOUNDS.x + 0.2, 0, 0.4, wallSpan],
      [0, WALK_BOUNDS.back - 0.2, wallSpan, 0.4],
      [0, WALK_BOUNDS.front + 0.2, wallSpan, 0.4],
    ]) {
      this.world.addBody(
        new Body({
          mass: 0,
          shape: new Box(new Vec3(w / 2, 4, d / 2)),
          position: new Vec3(x, 4, z),
        }),
      );
    }
    for (const body of this.world.bodies)
      body.material = this.world.defaultMaterial;
  }
  sync(pieces: Piece[], players: Player[], localId?: string) {
    this.localId = localId;
    this.stairs = pieces.filter(
      (p) => p.kind === 'stairs' && p.placed && !p.heldBy && !p.hoisted,
    );
    const wanted = new Set(
      pieces
        .filter((p) => !p.heldBy && !p.hoisted && !p.supply)
        .map((p) => p.id),
    );
    for (const [id, entry] of this.pieces)
      if (!wanted.has(id)) {
        this.world.removeBody(entry.body);
        this.tags.delete(entry.body.id);
        this.pieces.delete(id);
      }
    for (const piece of pieces) {
      if (piece.heldBy || piece.hoisted || piece.supply) continue;
      const key = `${piece.kind}:${piece.placed}:${piece.level ?? 0}`,
        shape = pieceShape(piece.kind);
      let entry = this.pieces.get(piece.id);
      if (entry?.key !== key) {
        if (entry) {
          this.world.removeBody(entry.body);
          this.tags.delete(entry.body.id);
        }
        const body = new Body({
          mass: piece.placed ? 0 : shape.mass,
          material: this.world.defaultMaterial,
          linearDamping: 0.12,
          angularDamping: 0.25,
          allowSleep: true,
          sleepSpeedLimit: 0.12,
          sleepTimeLimit: 0.7,
        });
        for (const s of shape.boxes) {
          const collider = new Box(new Vec3(s.w / 2, s.h / 2, s.d / 2));
          if (
            (piece.kind === 'roof' ||
              (piece.kind === 'floor' && (piece.level ?? 0) > 0)) &&
            piece.placed
          )
            collider.collisionFilterGroup = 4;
          body.addShape(collider, new Vec3(s.x, s.y - shape.center, s.z));
        }
        body.addEventListener(
          'collide',
          (event: {
            body: Body;
            contact: { getImpactVelocityAlongNormal(): number };
          }) => {
            const target = this.tags.get(event.body.id)?.player;
            const speed = Math.abs(
              event.contact.getImpactVelocityAlongNormal(),
            );
            if (speed > 3 && body.mass > 0)
              this.impacts.push({
                target: target || '',
                piece: piece.id,
                speed,
              });
          },
        );
        this.world.addBody(body);
        this.tags.set(body.id, { piece: piece.id });
        entry = { body, key, center: shape.center };
        this.pieces.set(piece.id, entry);
      }
      const body = entry.body,
        state = piece.physics;
      if (!piece.placed && state) body.quaternion.set(...state.q);
      else body.quaternion.setFromEuler(0, (piece.rotation * Math.PI) / 2, 0);
      const offset = body.quaternion.vmult(new Vec3(0, shape.center, 0));
      body.position.set(
        piece.x + offset.x,
        (piece.placed ? pieceBase(piece, this.map) : (state?.y ?? 0.43)) +
          offset.y,
        piece.z + offset.z,
      );
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
      if (!piece.placed && state) {
        body.velocity.set(...state.v);
        body.angularVelocity.set(...state.w);
      } else {
        body.velocity.setZero();
        body.angularVelocity.setZero();
      }
      body.aabbNeedsUpdate = true;
      if (state?.sleep && !piece.placed) body.sleep();
      else body.wakeUp();
    }
    const ids = new Set(players.map((p) => p.id));
    for (const [id, body] of this.players)
      if (!ids.has(id)) {
        this.world.removeBody(body);
        this.tags.delete(body.id);
        this.players.delete(id);
      }
    for (const p of players) {
      let body = this.players.get(p.id);
      const held = pieces.find((piece) => piece.heldBy === p.id),
        carryKey = held?.id || '';
      const previous = body
        ? { position: body.position.clone(), velocity: body.velocity.clone() }
        : null;
      if (body && this.carriers.get(p.id) !== carryKey) {
        this.world.removeBody(body);
        this.tags.delete(body.id);
        body = undefined;
      }
      if (!body) {
        body = new Body({
          mass: p.id === localId ? 75 : 0,
          type: p.id === localId ? Body.DYNAMIC : Body.KINEMATIC,
          fixedRotation: true,
          linearDamping: 0,
          material: new Material({ friction: 0, restitution: 0 }),
        });
        body.collisionFilterGroup = 2;
        body.addShape(new Sphere(0.37), new Vec3(0, -0.53, 0));
        body.addShape(new Cylinder(0.37, 0.37, 1.06, 8));
        body.addShape(new Sphere(0.37), new Vec3(0, 0.53, 0));
        if (held) {
          const shape = pieceShape(held.kind);
          for (const s of shape.boxes) {
            const collider = new Box(new Vec3(s.w / 2, s.h / 2, s.d / 2));
            // The overhead carry pose is an editing aid: ceilings must not trap carried furniture.
            // The worker, thrown objects, walls and other obstacles retain their collisions.
            collider.collisionFilterMask = ~4;
            body.addShape(
              collider,
              new Vec3(s.x, 2.35 - PLAYER_CENTER + s.y - shape.center, s.z),
            );
          }
        }
        body.position.set(p.x, (p.y ?? 0.43) + PLAYER_CENTER, p.z);
        if (previous && p.id === localId) {
          body.position.copy(previous.position);
          body.velocity.copy(previous.velocity);
        }
        this.world.addBody(body);
        this.players.set(p.id, body);
        this.tags.set(body.id, { player: p.id });
        this.carriers.set(p.id, carryKey);
      }
      if (p.id !== localId) {
        body.position.set(p.x, (p.y ?? 0.43) + PLAYER_CENTER, p.z);
        body.aabbNeedsUpdate = true;
      }
      if (p.id !== localId || !previous)
        body.quaternion.setFromEuler(0, p.angle, 0);
    }
  }
  grounded(id: string) {
    const body = this.players.get(id);
    if (!body) return false;
    if (
      this.world.contacts.some(
        (c) =>
          (c.bi === body && c.ni.y < -0.45) || (c.bj === body && c.ni.y > 0.45),
      )
    )
      return true;
    const hit = new RaycastResult();
    const p = body.position;
    this.world.raycastClosest(
      new Vec3(p.x, p.y - PLAYER_CENTER + 0.1, p.z),
      new Vec3(p.x, p.y - PLAYER_CENTER - 0.12, p.z),
      { collisionFilterMask: 1 },
      hit,
    );
    return hit.hasHit && body.velocity.y < 0.5;
  }
  move(id: string, x: number, z: number) {
    const body = this.players.get(id);
    if (!body) return;
    const speed = Math.hypot(x, z),
      feet = body.position.y - PLAYER_CENTER;
    if (speed > 0.05 && body.velocity.y < 1) {
      const probe = {
        x: body.position.x + (x / speed) * 0.44,
        z: body.position.z + (z / speed) * 0.44,
      };
      const next = this.stairs
        .map((p) => stairHeight(p, probe, this.map))
        .filter(
          (y): y is number =>
            y !== null && y > feet + 0.015 && y - feet <= 0.31,
        )
        .sort((a, b) => a - b)[0];
      if (next !== undefined) {
        body.position.y = next + PLAYER_CENTER + 0.012;
        body.velocity.y = 0;
        body.aabbNeedsUpdate = true;
      }
    }
    body.velocity.x = x;
    body.velocity.z = z;
    body.wakeUp();
  }
  jump(id: string) {
    const body = this.players.get(id);
    if (!body || !this.grounded(id)) return false;
    body.wakeUp();
    body.velocity.y = 7;
    return true;
  }
  step(dt: number) {
    this.world.step(STEP, Math.min(dt, 0.07), 7);
  }
  playerPosition(id: string) {
    const p = this.players.get(id)?.position;
    return p ? { x: p.x, y: p.y - PLAYER_CENTER, z: p.z } : null;
  }
  pose(id: string) {
    const e = this.pieces.get(id);
    if (!e) return null;
    const offset = e.body.quaternion.vmult(new Vec3(0, e.center, 0));
    return {
      x: e.body.position.x - offset.x,
      y: e.body.position.y - offset.y,
      z: e.body.position.z - offset.z,
      q: e.body.quaternion,
    };
  }
  save(pieces: Piece[]) {
    for (const p of pieces) {
      if (p.heldBy || p.placed || p.hoisted || p.supply) continue;
      const e = this.pieces.get(p.id),
        pose = this.pose(p.id);
      if (!e || !pose) continue;
      p.x = pose.x;
      p.z = pose.z;
      p.physics = {
        ...p.physics,
        y: pose.y,
        q: [pose.q.x, pose.q.y, pose.q.z, pose.q.w],
        v: tuple(e.body.velocity),
        w: tuple(e.body.angularVelocity),
        sleep: e.body.sleepState === Body.SLEEPING,
      };
      delete p.flight;
    }
  }
}

export function throwState(
  piece: Piece,
  player: Player,
  now: number,
): BodyState {
  const center = pieceShape(piece.kind).center;
  const q = new Quaternion();
  q.setFromEuler(0, player.angle, 0);
  return {
    y: (player.y ?? 0.43) + 2.35 - center,
    q: [q.x, q.y, q.z, q.w],
    v: [Math.sin(player.angle) * 8.4, 5.2, Math.cos(player.angle) * 8.4],
    w: [2.4, 1.1, -1.2],
    thrownAt: now,
    thrownBy: player.id,
  };
}

/** Rebuild from the committed snapshot so concurrent requests cannot share mutable physics. */
export function advancePhysics(world: World, players: Player[], now: number) {
  const last = world.physicsAt ?? now;
  const elapsed = Math.min(1, Math.max(0, (now - last) / 1000));
  const steps = Math.floor(elapsed / STEP);
  if (!steps) return [];
  const simulation = new SitePhysics(world.map);
  simulation.sync(world.pieces, players);
  for (const p of players) {
    const body = simulation.players.get(p.id)!,
      old = world.actors?.[p.id] || { x: p.x, y: p.y ?? 0.43, z: p.z };
    body.position.set(old.x, old.y + PLAYER_CENTER, old.z);
    body.velocity.set(
      (p.x - old.x) / (steps * STEP),
      ((p.y ?? 0.43) - old.y) / (steps * STEP),
      (p.z - old.z) / (steps * STEP),
    );
  }
  for (let i = 0; i < steps; i++) simulation.world.step(STEP);
  simulation.save(world.pieces);
  for (const piece of world.pieces) {
    const state = piece.physics;
    if (!state || piece.heldBy || piece.placed) continue;
    if (Math.hypot(...state.v) < 0.1 && Math.hypot(...state.w) < 0.1) {
      state.restAt ??= now;
      if (now - state.restAt > 700) {
        state.sleep = true;
        state.v = [0, 0, 0];
        state.w = [0, 0, 0];
      }
    } else {
      delete state.restAt;
      state.sleep = false;
    }
  }
  world.actors = Object.fromEntries(
    players.map((p) => [p.id, { x: p.x, y: p.y ?? 0.43, z: p.z }]),
  );
  world.physicsAt = now - (elapsed - steps * STEP) * 1000;
  return simulation.impacts;
}
