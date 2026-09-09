import { Vec3 } from 'cannon-es';
import { DOOR, GATE } from './level';
import {
  changeNpcSlots,
  isNpcAction,
  type NpcSlot,
} from '../../shared/rooms/npc-slots';
import { tickDeliveryNpcs } from './npcs';
import { prepareDeliveryNavigation } from './npc-path';
import {
  deliveryEvent,
  deliveryPhysics,
  gripPosition,
  plainVector,
  STEP,
  cargoInsideRoom,
} from './physics';
import {
  GRIPS,
  SOFA_CENTER,
  idleInput,
  type DeliveryAction,
  type DeliveryPlayer,
  type DeliveryWorld,
  type DeliverySnapshot,
} from './types';

export function deliveryPlayer(
  id: string,
  name: string,
  color: number,
  now: number,
): DeliveryPlayer {
  return {
    id,
    name,
    color,
    x: -13 + (color % 2) * 3.8,
    y: 0.15,
    z: 14.7 - Math.floor(color / 2) * 3.2,
    angle: Math.PI,
    velocity: { x: 0, y: 0, z: 0 },
    grounded: false,
    support: null,
    input: idleInput(),
    seen: now,
    lastJump: 0,
    grip: null,
    stumble: 0,
  };
}
export function freshDelivery(now: number): DeliveryWorld {
  return {
    phase: 'lobby',
    clock: now,
    started: now,
    players: [],
    carryYaw: 0,
    sofa: {
      x: -11.1,
      y: SOFA_CENTER + 0.1,
      z: 13,
      velocity: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    },
    gate: 0,
    gateTarget: 0,
    door: 0,
    doorTarget: 0,
    bestHeight: 0,
    drops: 0,
    settle: 0,
    remainder: 0,
    events: [],
    sofaSurface: null,
    sofaImpact: undefined,
  };
}
export function deliverySnapshot(
  world: DeliveryWorld,
  code: string,
  host: string,
  you: string,
  version: number,
): DeliverySnapshot {
  const { npcBrains: _brains, npcTeam: _team, ...visible } = world;
  return { world: visible, code, host, you, version };
}
export function removeDeliveryPlayer(w: DeliveryWorld, id: string) {
  w.players = w.players.filter((p) => p.id !== id);
  if (w.npcBrains) delete w.npcBrains[id];
}
export function reconcileDeliveryNpcs(w: DeliveryWorld, slots: NpcSlot[]) {
  if (slots.length) prepareDeliveryNavigation();
  for (const p of w.players)
    if (p.bot && !slots.some((slot) => slot.id === p.id))
      removeDeliveryPlayer(w, p.id);
  for (const slot of slots)
    if (!w.players.some((p) => p.id === slot.id))
      w.players.push({
        ...deliveryPlayer(slot.id, slot.name, slot.color, w.clock),
        bot: true,
        task: 'Ready to help',
      });
}
export function deliveryAction(
  w: DeliveryWorld,
  id: string,
  action: DeliveryAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Join the delivery crew first.');
  if (isNpcAction(action)) {
    if (p.bot || id !== host)
      throw new Error('Only the crew leader can manage NPCs.');
    if (w.phase === 'playing')
      throw new Error('Finish this delivery before changing NPCs.');
    const slots = changeNpcSlots(
      w.players.filter((player) => player.bot),
      w.players.filter((player) => !player.bot),
      action,
    );
    reconcileDeliveryNpcs(w, slots);
    return;
  }
  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host) throw new Error('The crew leader starts the delivery.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('The delivery has already started.');
    const players = w.players.map((p) => ({
      ...deliveryPlayer(p.id, p.name, p.color, w.clock),
      ...(p.bot ? { bot: true as const } : {}),
    }));
    delete w.npcBrains;
    delete w.npcTeam;
    Object.assign(w, freshDelivery(w.clock), { phase: 'playing', players });
    deliveryEvent(w, 'No. 4, at the very top. Mind the sofa.');
    return;
  }
  if (w.phase !== 'playing') throw new Error('Start the delivery first.');
  if (
    action.type === 'release' ||
    (action.type === 'grab' && p.grip !== null)
  ) {
    p.grip = null;
    if (!w.players.some((p) => p.grip !== null)) {
      w.drops++;
      deliveryEvent(w, 'Hands off. Gravity has the sofa now.');
    }
    return;
  }
  if (action.type === 'grab') {
    const candidates = GRIPS.map((_, i) => ({
      i,
      position: gripPosition(w, i),
    }))
      .filter((g) => !w.players.some((p) => p.grip === g.i))
      .map((g) => ({
        ...g,
        distance: g.position.distanceTo(new Vec3(p.x, p.y + 1.2, p.z)),
      }))
      .sort((a, b) => a.distance - b.distance);
    if (!candidates[0] || candidates[0].distance > 2.25)
      throw new Error('Move beside a free corner of the sofa to grab it.');
    if (p.stumble > w.clock)
      throw new Error('Find your feet, then grab again.');
    if (!w.players.some((p) => p.grip !== null)) {
      const q = w.sofa.quaternion;
      w.carryYaw = Math.atan2(
        2 * (q.w * q.y + q.x * q.z),
        1 - 2 * (q.y * q.y + q.z * q.z),
      );
    }
    p.grip = candidates[0].i;
    return;
  }
  if (action.type === 'rotate') {
    if (p.grip === null)
      throw new Error('Grab a corner before turning the sofa.');
    const b = deliveryPhysics(w).sofa;
    b.angularVelocity.y += 0.8;
    w.carryYaw += Math.PI / 2;
    w.sofa.angular = plainVector(b.angularVelocity);
    return;
  }
  if (action.type === 'interact') {
    if (p.grip !== null)
      throw new Error(
        'Release your corner first. Opening doors needs a free hand.',
      );
    if (
      Math.hypot(p.x - GATE.x, p.z - GATE.z) < 3.5 &&
      Math.abs(p.y - GATE.y) < 2
    ) {
      w.gateTarget = w.gateTarget ? 0 : Math.PI / 2;
      deliveryEvent(
        w,
        w.gateTarget
          ? 'Gate opening. The rest of you: hold that weight.'
          : 'Gate closing.',
      );
      return;
    }
    if (
      Math.hypot(p.x - DOOR.x, p.z - (DOOR.z + 1.85)) < 4.1 &&
      Math.abs(p.y - DOOR.y) < 2
    ) {
      w.doorTarget = w.doorTarget ? 0 : Math.PI / 2;
      deliveryEvent(
        w,
        w.doorTarget
          ? 'Oh. The customer’s door opens OUTWARD.'
          : 'Door closing. Watch your fingers.',
      );
      return;
    }
    throw new Error('Stand beside the village gate or the customer’s door.');
  }
}
export function sofaInside(w: DeliveryWorld) {
  const s = deliveryPhysics(w).sofa;
  if (
    w.door < 1.35 ||
    w.players.some((p) => p.grip !== null) ||
    s.velocity.length() > 0.32 ||
    s.angularVelocity.length() > 0.3
  )
    return false;
  return cargoInsideRoom(w);
}
export function advanceDelivery(w: DeliveryWorld, now: number) {
  if (now <= w.clock) return;
  if (w.phase !== 'playing') {
    w.clock = now;
    return;
  }
  // Bound inactive-room work; pause elapsed simulation instead of rewinding cargo.
  const elapsed = Math.min(300, now - w.clock) / 1000 + w.remainder;
  const steps = Math.floor((elapsed + 1e-9) / STEP);
  w.remainder = elapsed - steps * STEP;
  const physics = deliveryPhysics(w);
  for (let i = 0; i < steps; i++) {
    w.clock += STEP * 1000;
    tickDeliveryNpcs(w, (id, action) =>
      deliveryAction(w, id, action, w.players.find((p) => !p.bot)?.id ?? ''),
    );
    physics.step();
    w.bestHeight = Math.max(w.bestHeight, w.sofa.y - SOFA_CENTER);
    w.settle = sofaInside(w) ? w.settle + STEP : 0;
    if (w.settle >= 1.5) {
      w.phase = 'delivered';
      deliveryEvent(w, 'Delivered. Four stars. One very tired sofa.');
      break;
    }
  }
  w.clock = now;
}
