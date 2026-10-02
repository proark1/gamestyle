import { clearCombat, standingStep } from './combat';
import { grapplingStep } from './grappling';
import { updateBots } from './bots';
import { physicsStep } from './physics';
import { resetSelection, selectionAction } from './selection';
import { score } from './styles';
import { emit } from './events';
import {
  idleInput,
  STEP,
  type Fighter,
  type Team,
  type World,
  type Snapshot,
} from './types';
export function newFighter(
  id: string,
  name: string,
  color: number,
  team: Team,
  bot = true,
): Fighter {
  return {
    id,
    name,
    color,
    team,
    bot,
    seen: 0,
    style: null,
    commitment: '',
    revealed: false,
    x: team === 'red' ? -2 : 2,
    z: 0,
    vx: 0,
    vz: 0,
    heading: team === 'red' ? Math.PI / 2 : -Math.PI / 2,
    health: 100,
    stamina: 100,
    balance: 0,
    down: 0,
    input: idleInput(),
    previous: idleInput(),
    attack: 0,
    move: 'jab',
    struck: false,
    whiffed: false,
    charge: 0,
    queuedMove: null,
    queueTime: 0,
    cooldown: 0,
    dodge: 0,
    dodgeCooldown: 0,
    guarding: false,
    guardAge: 0,
    parryCooldown: 0,
    counter: 0,
    combo: 0,
    comboTime: 0,
    stagger: 0,
    lastHit: 0,
    damage: 0,
    takedowns: 0,
    advances: 0,
    knockdowns: 0,
    punches: 0,
  };
}
export function freshWorld(now: number): World {
  const w: World = {
    clock: now,
    started: now,
    phase: 'selection',
    time: 60,
    phaseTime: 0,
    round: 1,
    selection: Math.floor(now),
    selectionTime: 0,
    winner: null,
    finish: null,
    players: [
      newFighter('bot-red', 'Red fighter', 0, 'red'),
      newFighter('bot-blue', 'Blue fighter', 1, 'blue'),
    ],
    grapple: null,
    events: [],
    nextEvent: 0,
    tick: 0,
    remainder: 0,
    botChoices: {},
  };
  resetSelection(w);
  return w;
}
export function resetPositions(w: World) {
  w.grapple = null;
  for (const p of w.players) {
    clearCombat(p);
    p.x = p.team === 'red' ? -2 : 2;
    p.z = 0;
    p.heading = p.team === 'red' ? Math.PI / 2 : -Math.PI / 2;
    p.down =
      p.balance =
      p.combo =
      p.comboTime =
      p.dodgeCooldown =
      p.parryCooldown =
      p.guardAge =
        0;
    p.stamina = 100;
    p.input = idleInput();
    p.previous = idleInput();
  }
}
export function startMatch(w: World) {
  w.round = 1;
  w.time = 60;
  w.phaseTime = 3;
  w.phase = 'countdown';
  w.started = w.clock;
  for (const p of w.players) {
    p.health = 100;
    p.damage = p.takedowns = p.advances = p.knockdowns = p.punches = 0;
  }
  resetPositions(w);
  emit(w, 'bell', w.players[0]);
}
export function stepWorld(w: World) {
  w.tick++;
  w.clock += STEP * 1000;
  if (w.phase === 'selection') {
    if (w.players.every((p) => p.commitment && p.revealed)) startMatch(w);
    else if (w.players.some((p) => !p.bot && p.commitment)) {
      w.selectionTime += STEP;
      if (w.selectionTime >= 30) resetSelection(w);
    }
    return;
  }
  if (w.winner !== null) return;
  if (w.phase === 'countdown' || w.phase === 'break') {
    w.phaseTime -= STEP;
    if (w.phaseTime <= 0) {
      w.phase = 'playing';
      emit(w, 'bell', w.players[0]);
    }
    return;
  }
  updateBots(w);
  if (w.grapple) grapplingStep(w);
  else standingStep(w);
  physicsStep(w);
  for (const p of w.players) p.previous = { ...p.input };
  if (w.winner !== null) return;
  const fallen = w.players.filter((p) => p.health <= 0);
  if (fallen.length) {
    w.phase = 'ended';
    w.finish = 'KO';
    w.winner =
      fallen.length === 2 ? 'draw' : w.players.find((p) => p.health > 0)!.team;
    emit(w, 'bell', w.players[0]);
    return;
  }
  w.time = Math.max(0, w.time - STEP);
  if (w.time <= 0) {
    if (w.round === 3) {
      const [a, b] = w.players,
        delta = score(a) - score(b);
      w.winner = delta === 0 ? 'draw' : delta > 0 ? a.team : b.team;
      w.finish = 'Decision';
      w.phase = 'ended';
      emit(w, 'bell', a);
    } else {
      w.round++;
      w.time = 60;
      w.phase = 'break';
      w.phaseTime = 4;
      for (const p of w.players) p.health = Math.min(100, p.health + 8);
      resetPositions(w);
      emit(w, 'bell', w.players[0]);
    }
  }
}
export function advanceWorld(w: World, now: number) {
  if (!Number.isFinite(now)) return;
  const elapsed = Math.max(0, now - w.clock) + w.remainder;
  const steps = Math.min(120, Math.floor((elapsed + 0.0001) / (STEP * 1000)));
  w.remainder = elapsed - steps * STEP * 1000;
  if (w.remainder > 2000) w.remainder = 0;
  for (let i = 0; i < steps; i++) stepWorld(w);
  w.clock = now;
}
export function fightAction(
  w: World,
  id: string,
  action: Record<string, unknown>,
  isHost: boolean,
) {
  if (!w.players.some((p) => p.id === id))
    throw new Error('Join the fight first.');
  if (action.type === 'commit' || action.type === 'reveal')
    selectionAction(w, id, action);
  else if (action.type === 'reset' && isHost && w.phase === 'ended') {
    resetSelection(w);
    resetPositions(w);
  } else throw new Error('That action is unavailable.');
}
export function snapshot(
  w: World,
  code: string,
  host: string,
  selfId: string,
  version: number,
): Snapshot {
  const world = structuredClone(w);
  world.botChoices = {};
  if (w.phase === 'selection') for (const p of world.players) p.style = null;
  return { code, host, selfId, version, world };
}
