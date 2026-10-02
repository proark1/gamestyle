import { BoxingPhysics } from './physics';
import { updateBots } from './bots';
import { emit } from './events';
import { combatStep, resetCombat } from './combat';
import { updateTagRequests, cornerPlay } from './tagging';
import {
  CORNERS,
  STEP,
  idleInput,
  otherTeam,
  type Boxer,
  type Team,
  type TeamState,
  type World,
  type Snapshot,
} from './types';

const freshTeam = (): TeamState => ({
  score: 0,
  tagProgress: 0,
  tagCooldown: 0,
  towelCooldown: 0,
  ropeCooldown: 0,
});
export function newBoxer(
  id: string,
  name: string,
  color: number,
  team: Team,
  active: boolean,
  bot = false,
): Boxer {
  return {
    id,
    name,
    color,
    team,
    active,
    bot,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    heading: 0,
    stamina: 100,
    balance: 0,
    down: false,
    stagger: 0,
    charge: 0,
    attack: 0,
    heavy: false,
    struck: false,
    hand: 0,
    cooldown: 0,
    dodge: 0,
    dodgeCooldown: 0,
    wasDodge: false,
    lastHit: -10000,
    guarding: false,
    input: idleInput(),
    seen: 0,
    punches: 0,
    tags: 0,
    botHold: 0,
    assistCharge: 0,
    tagRequested: false,
    wasTag: false,
    tagTransition: 0,
    tagFromX: 0,
    tagFromZ: 0,
    botReturning: false,
    combo: 0,
    comboTime: 0,
    whiffed: false,
    guardAge: 0,
    parryCooldown: 0,
    counter: 0,
    counterPunch: false,
  };
}
export function resetPositions(w: World, rotate = false) {
  for (const p of w.players) {
    if (rotate) p.active = !p.active;
    const c = CORNERS[p.team];
    p.x = p.active ? (p.team === 'red' ? -2 : 2) : Math.sign(c.x) * 6.2;
    p.z = p.active ? 0 : c.z;
    p.heading = p.team === 'red' ? Math.PI / 2 : -Math.PI / 2;
    p.vx =
      p.vz =
      p.balance =
      p.stagger =
      p.charge =
      p.attack =
      p.dodge =
      p.cooldown =
      p.assistCharge =
        0;
    p.down = p.guarding = p.wasDodge = false;
    resetCombat(p);
    p.tagRequested = p.wasTag = p.botReturning = false;
    p.tagTransition = 0;
    p.input = idleInput();
    p.stamina = 100;
    p.lastHit = -10000;
  }
  for (const t of Object.values(w.teams)) t.tagProgress = 0;
}
export function freshWorld(now: number): World {
  const w: World = {
    clock: now,
    started: now,
    phase: 'lobby',
    time: 180,
    phaseTime: 0,
    overtime: false,
    winner: null,
    players: [
      newBoxer('bot-red-1', 'Jab Jasper', 0, 'red', true, true),
      newBoxer('bot-red-2', 'Towel Tony', 1, 'red', false, true),
      newBoxer('bot-blue-1', 'Hook Hazel', 2, 'blue', true, true),
      newBoxer('bot-blue-2', 'Dodge Daisy', 3, 'blue', false, true),
    ],
    teams: { red: freshTeam(), blue: freshTeam() },
    events: [],
    nextEvent: 0,
    tick: 0,
    remainder: 0,
  };
  resetPositions(w);
  return w;
}
export function startMatch(w: World) {
  w.teams = { red: freshTeam(), blue: freshTeam() };
  w.time = 180;
  w.overtime = false;
  w.winner = null;
  w.started = w.clock;
  w.phase = 'countdown';
  w.phaseTime = 3;
  resetPositions(w);
  emit(w, 'bell', w.players[0]);
}
function finish(w: World) {
  const { red, blue } = w.teams;
  w.winner =
    red.score === blue.score ? 'draw' : red.score > blue.score ? 'red' : 'blue';
  w.phase = 'ended';
  for (const p of w.players) {
    p.input = idleInput();
    p.charge = 0;
  }
  emit(w, 'bell', w.players[0]);
}
const physics = new WeakMap<World, BoxingPhysics>();
export function stepWorld(w: World) {
  const dt = STEP;
  w.clock += dt * 1000;
  w.tick++;
  if (w.phase === 'lobby' || w.phase === 'ended') return;
  if (w.phase === 'countdown' || w.phase === 'stoppage') {
    w.phaseTime -= dt;
    if (w.phaseTime <= 0) {
      if (w.phase === 'stoppage') resetPositions(w, true);
      w.phase = 'playing';
      emit(w, 'bell', w.players[0]);
    }
    return;
  }
  updateTagRequests(w);
  updateBots(w, dt);
  w.time = Math.max(0, w.time - dt);
  for (const t of Object.values(w.teams))
    for (const key of ['tagCooldown', 'towelCooldown', 'ropeCooldown'] as const)
      t[key] = Math.max(0, t[key] - dt);
  combatStep(w, dt);
  let body = physics.get(w);
  if (!body) {
    body = new BoxingPhysics();
    physics.set(w, body);
  }
  for (const p of body.step(w)) emit(w, 'rope', p);
  const fallen = w.players.filter((p) => p.active && p.balance >= 100);
  if (fallen.length) {
    for (const p of fallen) {
      p.down = true;
      p.attack = p.charge = 0;
      w.teams[otherTeam(p.team)].score++;
      emit(w, 'down', p);
    }
    const { red, blue } = w.teams;
    if (
      (red.score >= 3 || blue.score >= 3 || w.overtime) &&
      red.score !== blue.score
    )
      finish(w);
    else {
      w.phase = 'stoppage';
      w.phaseTime = 4;
      if (red.score >= 3 && red.score === blue.score && !w.overtime) {
        w.overtime = true;
        w.time = 45;
      }
    }
    return;
  }
  cornerPlay(w, dt);
  if (w.time <= 0) {
    if (w.teams.red.score !== w.teams.blue.score || w.overtime) finish(w);
    else {
      w.overtime = true;
      w.time = 45;
      emit(w, 'bell', w.players[0]);
    }
  }
}
export function advanceWorld(w: World, now: number) {
  // Recoverable tick state: no frame-rate-dependent accumulator hidden in the adapter.
  const elapsed = Math.max(0, now - w.clock) + w.remainder;
  const steps = Math.min(120, Math.floor((elapsed + 0.0001) / (STEP * 1000)));
  w.remainder = Math.max(0, elapsed - steps * STEP * 1000);
  for (let n = 0; n < steps; n++) stepWorld(w);
}
export function boxingAction(
  w: World,
  id: string,
  action: Record<string, unknown>,
  host: boolean,
) {
  const p = w.players.find((q) => q.id === id);
  if (!p) return;
  if (
    action.type === 'start' ||
    action.type === 'ready' ||
    action.type === 'reset'
  ) {
    if (!host) throw new Error('Only the host can start a match.');
    if (w.phase !== 'lobby' && w.phase !== 'ended')
      throw new Error('Finish this match first.');
    startMatch(w);
  } else if (action.type === 'switch_role') {
    if (w.phase !== 'lobby')
      throw new Error('Choose your starting role before the match.');
    const partner = w.players.find(
      (q) => q.team === p.team && q.id !== p.id && q.bot,
    );
    if (!partner) throw new Error('Your human partner chooses their own role.');
    p.active = !p.active;
    partner.active = !p.active;
    resetPositions(w);
  } else if (action.type === 'switch_team') {
    if (w.phase !== 'lobby')
      throw new Error('Teams are locked during a match.');
    const target = w.players.find((q) => q.team !== p.team && q.bot);
    if (!target) throw new Error('That team is full.');
    const { id: oldId, name, color, bot } = target;
    Object.assign(target, {
      id: p.id,
      name: p.name,
      color: p.color,
      bot: p.bot,
    });
    Object.assign(p, { id: oldId, name, color, bot });
  }
}
export function snapshot(
  w: World,
  code: string,
  host: string,
  selfId: string,
  version: number,
): Snapshot {
  return { code, host, selfId, version, world: structuredClone(w) };
}

export { tagReason } from './tagging';
