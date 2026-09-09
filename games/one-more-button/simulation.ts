import {
  DOOR_LOCK_MS,
  ESCAPE_MS,
  EXIT,
  HAZARD_NAMES,
  MAX_PRESSES,
  ROOM,
  ROUND_MS,
  idleInput,
  money,
  prizeForPress,
  type ButtonAction,
  type ButtonEvent,
  type ButtonSnapshot,
  type ButtonWorld,
  type Contestant,
} from './types';
import { glovePose, nextHazard, spinnerAngle } from './level';

export function freshButton(now: number): ButtonWorld {
  return {
    clock: now,
    started: 0,
    remainder: 0,
    phase: 'lobby',
    players: [],
    hazards: [],
    presses: 0,
    pot: 0,
    crewSize: 0,
    doorUntil: 0,
    escapeAt: 0,
    lastPress: -10000,
    lastPresser: '',
    events: [],
    eventId: 0,
    banked: 0,
  };
}
export function newContestant(
  id: string,
  name: string,
  color: number,
  now: number,
): Contestant {
  return {
    id,
    name: name.slice(0, 18),
    color,
    x: (color % 2 ? 1 : -1) * 1.7,
    y: 0,
    z: 2 + Math.floor(color / 2) * 1.5,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: Math.PI,
    hearts: 3,
    escaped: false,
    winnings: 0,
    presses: 0,
    seen: now,
    input: idleInput(),
    immuneUntil: 0,
    stunnedUntil: 0,
    lastAction: -10000,
    shoutUntil: 0,
    lastJump: -1,
  };
}
function emit(w: ButtonWorld, kind: ButtonEvent['kind'], text: string) {
  w.events.push({ id: ++w.eventId, at: w.clock, kind, text });
  if (w.events.length > 24) w.events.shift();
}
const active = (p: Contestant) => p.hearts > 0 && !p.escaped;
export const doorOpen = (w: ButtonWorld) =>
  w.presses > 0 && w.clock >= w.doorUntil;
function finish(w: ButtonWorld) {
  w.phase = w.banked > 0 ? 'won' : 'lost';
  for (const p of w.players) p.input = idleInput();
  emit(
    w,
    'finish',
    w.banked
      ? `${money(w.banked)} made it out. Worth the friendship?`
      : 'We were rich until you touched it.',
  );
}
export function removeContestant(w: ButtonWorld, id: string) {
  w.players = w.players.filter((p) => p.id !== id);
  if (
    (w.phase === 'playing' || w.phase === 'escape') &&
    !w.players.some(active)
  )
    finish(w);
}
export function buttonAction(
  w: ButtonWorld,
  id: string,
  action: ButtonAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Join the show first.');
  if (action.type === 'start' || action.type === 'restart') {
    if (id !== host) throw new Error('Only the host can start the show.');
    if (action.type === 'start' && w.phase !== 'lobby')
      throw new Error('The show has already started.');
    if (action.type === 'restart' && w.phase !== 'won' && w.phase !== 'lost')
      throw new Error('Finish this show before a rematch.');
    const players = w.players.map((p) =>
      newContestant(p.id, p.name, p.color, w.clock),
    );
    const eventId = w.eventId;
    Object.assign(w, freshButton(w.clock), {
      players,
      phase: 'playing',
      started: w.clock,
      crewSize: players.length,
      eventId,
    });
    emit(
      w,
      'start',
      'Welcome to One More Button. Your first bad idea pays $500.',
    );
    return;
  }
  if (w.phase !== 'playing' && w.phase !== 'escape')
    throw new Error('Wait for the next show.');
  if (!active(p))
    throw new Error(
      p.escaped
        ? 'Your winnings are safe. Cheer on the crew!'
        : 'You are out of this show.',
    );
  if (action.type === 'stop') {
    if (p.shoutUntil > w.clock) return;
    p.shoutUntil = w.clock + 2500;
    emit(w, 'stop', `${p.name}: STOP! We have enough!`);
    return;
  }
  if (p.stunnedUntil > w.clock)
    throw new Error('You are dazed. A friend can help you up.');
  if (action.type === 'jump') {
    if (p.y <= 0.04 && w.clock - p.lastJump > 350) {
      p.vy = 8;
      p.lastJump = w.clock;
    }
    return;
  }
  if (action.type === 'help') {
    const friend = w.players.find(
      (f) =>
        f.id !== id &&
        active(f) &&
        f.stunnedUntil > w.clock &&
        Math.hypot(p.x - f.x, p.z - f.z) < 2.5,
    );
    if (!friend) throw new Error('Stand beside a dazed teammate to help.');
    friend.stunnedUntil = w.clock;
    friend.immuneUntil = w.clock + 1600;
    emit(w, 'warning', `${p.name} helped ${friend.name} up. Keep moving!`);
    return;
  }
  if (action.type === 'exit') {
    if (Math.hypot(p.x - EXIT.x, p.z - EXIT.z) > 2.2 || p.y > 0.6)
      throw new Error('Reach the glowing EXIT at the back of the room.');
    if (!doorOpen(w))
      throw new Error(
        w.presses
          ? 'The exit is locked. Wait for the countdown!'
          : 'Press the button once to put money in the prize pot.',
      );
    p.escaped = true;
    p.winnings = Math.floor(w.pot / w.crewSize);
    w.banked += p.winnings;
    p.input = idleInput();
    if (w.phase === 'playing') {
      w.phase = 'escape';
      w.escapeAt = w.clock + ESCAPE_MS;
    }
    emit(
      w,
      'escape',
      `${p.name} escaped with ${money(p.winnings)}. Everyone else: 25 seconds or less!`,
    );
    if (!w.players.some(active)) finish(w);
    return;
  }
  if (action.type !== 'press') throw new Error('Unknown show action.');
  if (Math.hypot(p.x, p.z) > 2.7 || p.y > 0.7)
    throw new Error('Get close to the big red button.');
  if (w.presses >= MAX_PRESSES)
    throw new Error('JACKPOT! All hazards are live. Get to the exit!');
  if (w.clock - w.lastPress < 2200)
    throw new Error('The button is recharging.');
  const prize = prizeForPress(w.presses),
    hazard = nextHazard(w.presses, w.clock);
  w.hazards.push(hazard);
  w.presses++;
  w.pot += prize;
  w.lastPress = w.clock;
  w.lastPresser = p.name;
  w.doorUntil = w.clock + DOOR_LOCK_MS;
  p.presses++;
  emit(
    w,
    'press',
    `${p.name} pressed again! +${money(prize)}. ${HAZARD_NAMES[hazard.kind]} incoming!`,
  );
}
function hit(
  w: ButtonWorld,
  p: Contestant,
  vx: number,
  vz: number,
  kind: 'punch' | 'hit' | 'fall',
) {
  if (p.immuneUntil > w.clock || !active(p)) return;
  p.hearts--;
  p.immuneUntil = w.clock + 1900;
  p.stunnedUntil = w.clock + 1150;
  p.vx = vx;
  p.vz = vz;
  p.vy = kind === 'punch' ? 11 : 6;
  emit(
    w,
    kind,
    p.hearts
      ? `${p.name} ${kind === 'punch' ? 'got absolutely launched!' : kind === 'fall' ? 'fell off the stage!' : 'met the spinning sofa!'}`
      : `${p.name} is out. Their prize share is gone!`,
  );
}
function step(w: ButtonWorld, dt: number) {
  if (w.phase !== 'playing' && w.phase !== 'escape') return;
  if (w.phase === 'playing' && w.clock >= w.started + ROUND_MS) {
    w.phase = 'escape';
    w.escapeAt = w.clock + ESCAPE_MS;
    emit(
      w,
      'warning',
      'SHOW OVER! 25 seconds to get out. The button still works…',
    );
  }
  if (w.phase === 'escape' && w.clock >= w.escapeAt) {
    finish(w);
    return;
  }
  for (const p of w.players) {
    if (!active(p)) continue;
    const grounded = p.y <= 0.04;
    const soapy =
      grounded &&
      w.hazards.some(
        (h) =>
          h.kind === 'soap' &&
          w.clock >= h.starts &&
          Math.hypot(p.x - h.x, p.z - h.z) < 2.8,
      );
    const length = Math.max(1, Math.hypot(p.input.x, p.input.z));
    const moving = p.stunnedUntil <= w.clock;
    const ix = moving ? p.input.x / length : 0,
      iz = moving ? p.input.z / length : 0;
    const grip = grounded ? (soapy ? 0.8 : 10) : 0.55;
    p.vx += (ix * 5.4 - p.vx) * Math.min(1, grip * dt);
    p.vz += (iz * 5.4 - p.vz) * Math.min(1, grip * dt);
    if (ix || iz) p.facing = Math.atan2(ix, iz);
    for (const h of w.hazards) {
      if (w.clock < h.starts) continue;
      if (
        h.kind === 'conveyor' &&
        grounded &&
        Math.abs(p.x - h.x) < 2.2 &&
        Math.abs(p.z - h.z) < 6
      )
        p.vz += h.direction * 28 * dt;
      if (h.kind === 'glove') {
        const now = glovePose(h, w.clock),
          before = glovePose(h, w.clock - dt * 1000);
        if (
          now.active &&
          p.y < 3 &&
          Math.abs(p.z - h.z) < 2.3 &&
          p.x >= Math.min(before.x, now.x) - 1.5 &&
          p.x <= Math.max(before.x, now.x) + 1.5
        )
          hit(w, p, h.direction * 22, 4, 'punch');
      }
      if (h.kind === 'spinner' && p.y < 1.4) {
        const a = spinnerAngle(h, w.clock),
          dx = p.x - h.x,
          dz = p.z - h.z;
        const lx = dx * Math.cos(a) - dz * Math.sin(a),
          lz = dx * Math.sin(a) + dz * Math.cos(a);
        if (Math.abs(lx) < 3.4 && Math.abs(lz) < 1.2) {
          const d = Math.max(0.1, Math.hypot(dx, dz));
          hit(w, p, (dx / d) * 12, (dz / d) * 12, 'hit');
        }
      }
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vy -= 19 * dt;
    p.y += p.vy * dt;
    if (p.y < 0) {
      p.y = 0;
      p.vy = 0;
    }
    // The back and sides are rails; only a launched airborne contestant clears them.
    if (
      p.y < 1.5 &&
      Math.abs(p.x) < ROOM.x + 1 &&
      p.z < ROOM.z + 1 &&
      p.z > -ROOM.z - 1
    ) {
      if (Math.abs(p.x) > ROOM.x - 0.5) {
        p.x = Math.sign(p.x) * (ROOM.x - 0.5);
        p.vx *= -0.45;
      }
      if (Math.abs(p.z) > ROOM.z - 0.5) {
        p.z = Math.sign(p.z) * (ROOM.z - 0.5);
        p.vz *= -0.45;
      }
    }
    // Solid central pedestal, including a usable ring within pressing distance.
    const d = Math.hypot(p.x, p.z);
    if (d < 1.5 && p.y < 1.35) {
      const nx = d > 0.001 ? p.x / d : 1,
        nz = d > 0.001 ? p.z / d : 0;
      p.x = nx * 1.5;
      p.z = nz * 1.5;
      const inward = p.vx * nx + p.vz * nz;
      if (inward < 0) {
        p.vx -= inward * nx;
        p.vz -= inward * nz;
      }
    }
    if (Math.abs(p.x) > ROOM.x + 3 || Math.abs(p.z) > ROOM.z + 3) {
      // A single punch never charges a second life for its resulting fall.
      hit(w, p, 0, 0, 'fall');
      p.x = (p.color % 2 ? 1 : -1) * 2.3;
      p.z = 5.5;
      p.y = 0;
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
      p.immuneUntil = w.clock + 1900;
    }
  }
  if (!w.players.some(active)) finish(w);
}
export function advanceButton(w: ButtonWorld, now: number) {
  if (!Number.isFinite(now) || now <= w.clock) return;
  const target = w.clock + Math.min(250, now - w.clock);
  w.remainder += target - w.clock;
  const tick = 1000 / 60;
  while (w.remainder + 1e-7 >= tick) {
    w.remainder -= tick;
    w.clock = target - w.remainder;
    step(w, tick / 1000);
  }
  w.remainder = Math.max(0, w.remainder);
  w.clock = target;
}
export function buttonSnapshot(
  w: ButtonWorld,
  code: string,
  host: string,
  _id: string,
  version: number,
): ButtonSnapshot {
  return { code, host, version, world: structuredClone(w) };
}
