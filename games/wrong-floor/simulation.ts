import { clamp } from '../../shared/math/clamp';
import {
  STATIONS,
  STOPS,
  INSPECT_MS,
  ESCAPE_MS,
  TRAVEL_MS,
  idleInput,
  type Guest,
  type HotelAction,
  type HotelWorld,
  type HotelSnapshot,
  type Choice,
} from './types';

function random(w: HotelWorld) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
function event(
  w: HotelWorld,
  kind: HotelWorld['events'][number]['kind'],
  text: string,
) {
  w.events.push({ id: ++w.eventId, kind, text });
  w.events = w.events.slice(-12);
}
export function newGuest(
  id: string,
  name: string,
  color: number,
  now: number,
  slot = color,
  bot = false,
): Guest {
  return {
    id,
    name,
    color: color % 4,
    slot,
    bot,
    x: (slot - 1.5) * 0.8,
    z: 3.2,
    facing: Math.PI,
    seen: now,
    input: idleInput(),
    inspected: false,
    report: '',
    vote: null,
    safe: false,
    caught: false,
  };
}
export function freshHotel(now: number): HotelWorld {
  return {
    clock: now,
    started: 0,
    phase: 'lobby',
    stage: 'inspect',
    stageAt: now,
    stopAt: now,
    escapeAt: 0,
    players: [],
    cleared: 0,
    mistakes: 0,
    run: 0,
    seed: now >>> 0 || 1,
    deck: [],
    plan: { anomalies: [], witness: 0, wallpaper: 0 },
    ghostZ: -29,
    eventId: 0,
    events: [],
    lastDecision: null,
  };
}
export function stationFor(w: HotelWorld, p: Guest) {
  return (p.slot + w.cleared) % 4;
}
function observation(w: HotelWorld, p: Guest) {
  const station = stationFor(w, p);
  return w.plan.anomalies.includes(station)
    ? STATIONS[station].odd
    : STATIONS[station].normal;
}
function stop(w: HotelWorld) {
  w.phase = 'playing';
  w.stage = 'inspect';
  w.stageAt = w.clock;
  w.stopAt = w.clock;
  const first = Math.floor(random(w) * 4);
  const cursed = w.deck[w.cleared];
  const humans = w.players.filter((p) => !p.bot);
  w.plan = {
    anomalies: cursed ? [first] : [],
    witness: humans[Math.floor(random(w) * humans.length)]?.slot ?? 0,
    wallpaper: w.cleared % 3,
  };
  if (cursed && random(w) < 0.5)
    w.plan.anomalies.push((first + 1 + Math.floor(random(w) * 3)) % 4);
  w.ghostZ = -29;
  for (const p of w.players) {
    p.x = (p.slot - 1.5) * 0.8;
    p.z = 3.2;
    p.facing = Math.PI;
    p.inspected = false;
    p.report = '';
    p.vote = null;
    p.safe = false;
    p.caught = false;
    p.input = idleInput();
  }
  event(
    w,
    'start',
    `Stop ${w.cleared + 1}. Compare what you see. Vote at the far end of the hall.`,
  );
}
function start(w: HotelWorld) {
  w.players = w.players.filter((p) => !p.bot);
  const names = ['Pip', 'Moss', 'Cleo', 'Bea'];
  for (let slot = 0; slot < 4; slot++)
    if (!w.players.some((p) => p.slot === slot))
      w.players.push(
        newGuest(`hotel-bot-${slot}`, names[slot], slot, w.clock, slot, true),
      );
  w.started = w.clock;
  w.cleared = 0;
  w.mistakes = 0;
  w.run++;
  // Shuffle the safe/haunted order so memorizing stop numbers cannot solve a stay.
  w.deck = [true, true, true, false, false];
  for (let i = w.deck.length - 1; i > 0; i--) {
    const j = Math.floor(random(w) * (i + 1));
    [w.deck[i], w.deck[j]] = [w.deck[j], w.deck[i]];
  }
  w.lastDecision = null;
  stop(w);
}
export function removeGuest(w: HotelWorld, id: string) {
  const p = w.players.find((p) => p.id === id);
  if (!p) return;
  w.players = w.players.filter((p) => p.id !== id);
  // A computer guest preserves the departed witness's evidence and keeps votes live.
  if (w.phase === 'playing' || w.phase === 'escape')
    w.players.push({
      ...p,
      id: `hotel-bot-${p.slot}`,
      name: `${p.name.slice(0, 12)} (NPC)`,
      bot: true,
      vote: null,
      input: idleInput(),
    });
  const humans = w.players.filter((p) => !p.bot);
  if (w.plan.witness === p.slot && humans.length)
    w.plan.witness = humans[0].slot;
  if (
    w.phase === 'playing' &&
    w.stage === 'inspect' &&
    humans.length &&
    humans.every((p) => p.vote)
  )
    resolve(w);
}
export function hotelAction(
  w: HotelWorld,
  id: string,
  a: HotelAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id && !p.bot);
  if (!p) throw new Error('Rejoin the hotel to play.');
  if (a.type === 'start' || a.type === 'restart') {
    if (id !== host) throw new Error('Only the host can start a new stay.');
    if (w.phase !== 'lobby' && w.phase !== 'won' && w.phase !== 'lost')
      throw new Error('Finish this stay before restarting.');
    start(w);
    return;
  }
  if (w.phase !== 'playing' || w.stage !== 'inspect')
    throw new Error('Wait for the elevator to stop.');
  if (a.type === 'inspect') {
    const s = STATIONS[stationFor(w, p)];
    if (Math.hypot(p.x - s.x, p.z - s.z) > 3)
      throw new Error(`Move closer to ${s.name.toLowerCase()} to inspect it.`);
    p.inspected = true;
  } else if (a.type === 'report') {
    if (!p.inspected)
      throw new Error('Inspect your clue before sharing a finding.');
    if (!p.report) {
      p.report = observation(w, p);
      event(w, 'report', `${p.name} shared a finding.`);
    }
  } else if (a.type === 'vote') {
    if (a.choice !== 'advance' && a.choice !== 'retreat')
      throw new Error('Choose advance or retreat.');
    if (Math.hypot(p.x, p.z + 23.5) > 4)
      throw new Error('Vote at the elevator panel at the far end of the hall.');
    p.vote = a.choice;
    event(w, 'vote', `${p.name} votes to ${a.choice}.`);
    const humans = w.players.filter((p) => !p.bot);
    if (humans.length && humans.every((p) => p.vote)) resolve(w);
  } else throw new Error('Unknown hotel action.');
}
function resolve(w: HotelWorld) {
  const humans = w.players.filter((p) => !p.bot);
  const advance = humans.filter((p) => p.vote === 'advance').length;
  const retreat = humans.filter((p) => p.vote === 'retreat').length;
  // A tie or no votes chooses retreat. Computer guests advise; humans decide.
  const choice: Choice = advance > retreat ? 'advance' : 'retreat';
  const correct = choice === (w.plan.anomalies.length ? 'retreat' : 'advance');
  const evidence = w.plan.anomalies.length
    ? w.plan.anomalies.map((n) => STATIONS[n].short).join(' · ')
    : 'Dry carpet. Still portrait. Silent door. Clock at 12:00.';
  w.lastDecision = { choice, correct, evidence, escaped: 0 };
  for (const p of w.players) p.input = idleInput();
  if (correct) {
    w.cleared++;
    w.stage = 'travel';
    w.stageAt = w.clock;
    event(
      w,
      'correct',
      `Correct ${choice}. ${w.cleared} of ${STOPS} stops cleared.`,
    );
  } else {
    w.mistakes++;
    w.phase = 'escape';
    w.escapeAt = w.clock;
    w.ghostZ = -29;
    event(w, 'alarm', 'WRONG FLOOR. Run back to the brass elevator!');
  }
}
function finishEscape(w: HotelWorld) {
  const survivors = w.players.filter((p) => !p.bot && p.safe).length;
  if (w.lastDecision) w.lastDecision.escaped = survivors;
  if (!survivors || w.mistakes >= 3) {
    w.phase = 'lost';
    event(
      w,
      'finish',
      w.mistakes >= 3
        ? 'Three wrong calls. The hotel is keeping your reservation.'
        : 'Nobody reached the elevator. Your checkout has been delayed.',
    );
  } else {
    w.phase = 'playing';
    w.stage = 'travel';
    w.stageAt = w.clock;
    w.deck[w.cleared] = random(w) < 0.6;
    event(
      w,
      'safe',
      'Someone held the elevator. Everyone returns; retry this stop with new evidence.',
    );
  }
}
function move(p: Guest, dx: number, dz: number, speed: number, dt: number) {
  const length = Math.max(1, Math.hypot(dx, dz));
  const x = clamp(p.x + (dx / length) * speed * dt, -4.55, 4.55);
  const z = clamp(p.z + (dz / length) * speed * dt, -24.5, 4.2);
  // Elevator opening is narrower than the hall; the brass jambs are solid.
  if (z > 0.9 && Math.abs(x) > 1.65) {
    p.x = x;
    p.z = Math.min(z, 0.9);
  } else {
    p.x = x;
    p.z = z;
  }
  if (dx || dz) p.facing = Math.atan2(dx, dz);
}
function botStep(w: HotelWorld, p: Guest, dt: number) {
  if (p.safe || p.caught) return;
  if (w.phase === 'escape') {
    const x = p.z < 0 ? 0 : p.x;
    move(p, x - p.x, 4 - p.z, 5.2, dt);
    return;
  }
  const s = STATIONS[stationFor(w, p)];
  const tx = p.report ? (p.slot - 1.5) * 0.7 : s.x;
  const tz = p.report ? -23 : s.z;
  if (Math.hypot(tx - p.x, tz - p.z) > 0.3)
    move(p, tx - p.x, tz - p.z, 2.7, dt);
  if (
    !p.report &&
    Math.hypot(p.x - s.x, p.z - s.z) < 2 &&
    w.clock - w.stopAt > 5000 + p.slot * 1500
  ) {
    p.inspected = true;
    p.report = observation(w, p);
    event(w, 'report', `${p.name} shared a finding.`);
  }
}
export function advanceHotel(w: HotelWorld, now: number) {
  // Bound long gaps so tab suspension cannot teleport guests through the chase.
  const elapsed = Math.max(0, Math.min(250, now - w.clock));
  const steps = Math.ceil(elapsed / (1000 / 60));
  if (!steps) return;
  const step = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    w.clock += step;
    if (w.phase === 'lobby' || w.phase === 'won' || w.phase === 'lost')
      continue;
    if (w.phase === 'playing' && w.stage === 'travel') {
      if (w.clock - w.stageAt >= TRAVEL_MS) {
        if (w.cleared >= STOPS) {
          w.phase = 'won';
          event(w, 'finish', 'Lobby reached. All four checked out.');
        } else stop(w);
      }
      continue;
    }
    for (const p of w.players) {
      if (p.bot) botStep(w, p, step / 1000);
      else if (!p.safe && !p.caught)
        move(
          p,
          p.input.x,
          p.input.z,
          w.phase === 'escape' || p.input.sprint ? 5.8 : 3.7,
          step / 1000,
        );
    }
    if (w.phase === 'playing' && w.clock - w.stopAt >= INSPECT_MS) resolve(w);
    if (w.phase === 'escape') {
      w.ghostZ = -29 + Math.max(0, w.clock - w.escapeAt - 1800) * 0.0041;
      for (const p of w.players) {
        if (p.safe || p.caught) continue;
        if (p.z >= 2.7 && Math.abs(p.x) < 1.65) {
          p.safe = true;
          event(w, 'safe', `${p.name} is holding the elevator.`);
        } else if (w.ghostZ >= p.z + 0.3 || w.clock - w.escapeAt >= ESCAPE_MS)
          p.caught = true;
      }
      const humans = w.players.filter((p) => !p.bot);
      if (humans.every((p) => p.safe || p.caught)) finishEscape(w);
    }
  }
}
export function hotelSnapshot(
  w: HotelWorld,
  code: string,
  host: string,
  id: string,
  version: number,
): HotelSnapshot {
  const me = w.players.find((p) => p.id === id);
  const station = me ? stationFor(w, me) : 0;
  const active =
    w.phase === 'escape' || (w.phase === 'playing' && w.stage === 'inspect');
  const {
    seed: _seed,
    deck: _deck,
    plan: _plan,
    players: _players,
    ...world
  } = w;
  return structuredClone({
    code,
    host,
    version,
    world: {
      ...world,
      wallpaper: w.plan.wallpaper,
      players: w.players.map(
        ({
          input: _input,
          seen: _seen,
          inspected: _inspected,
          slot: _slot,
          ...p
        }) => p,
      ),
    },
    you: {
      station,
      inspected: me?.inspected ?? false,
      observation: active && me?.inspected ? observation(w, me) : '',
      anomaly: active && !!me && w.plan.anomalies.includes(station),
      apparition:
        active &&
        me?.slot === w.plan.witness &&
        (w.phase === 'escape' || w.plan.anomalies.length > 0),
    },
  });
}
