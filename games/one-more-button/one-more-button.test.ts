import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceButton,
  buttonAction,
  buttonSnapshot,
  doorOpen,
  freshButton,
  newContestant,
  removeContestant,
} from './simulation';
import { glovePose, nextHazard } from './level';
import { createEngine } from './peer';
import { buttonCatalog } from './audio';
import {
  DOOR_LOCK_MS,
  ESCAPE_MS,
  MAX_PRESSES,
  ROUND_MS,
  type ButtonWorld,
} from './types';

function game(count = 1) {
  const w = freshButton(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newContestant(String(i), `Player ${i}`, i, w.clock));
  buttonAction(w, '0', { type: 'start' }, '0');
  return w;
}
function tick(w: ButtonWorld, ms: number, frame = 50) {
  const end = w.clock + ms;
  while (w.clock < end - 1e-6) advanceButton(w, Math.min(end, w.clock + frame));
}
function press(w: ButtonWorld, id = '0') {
  const p = w.players.find((p) => p.id === id)!;
  p.x = 0;
  p.z = 2;
  p.y = 0;
  buttonAction(w, id, { type: 'press' }, '0');
}
function atExit(w: ButtonWorld, id: string) {
  const p = w.players.find((p) => p.id === id)!;
  p.x = 0;
  p.z = -9;
  p.y = 0;
}
void test('Presses add increasing money, exactly one visible hazard and a timed door lock', () => {
  const w = game();
  press(w);
  assert.equal(w.pot, 500);
  assert.equal(w.hazards.length, 1);
  assert.equal(w.hazards[0].kind, 'conveyor');
  assert.equal(w.doorUntil, w.clock + DOOR_LOCK_MS);
  assert.equal(doorOpen(w), false);
  assert.throws(() => press(w), /recharging/);
  tick(w, 2300);
  press(w);
  assert.equal(w.pot, 1250);
  assert.equal(w.hazards[1].kind, 'glove');
  assert.equal(w.players[0].presses, 2);
});
void test('Actions require membership, host authority, proximity, and a live contestant', () => {
  const w = game(2);
  assert.throws(
    () => buttonAction(w, 'absent', { type: 'press' }, '0'),
    /Join/,
  );
  assert.throws(() => buttonAction(w, '1', { type: 'restart' }, '0'), /host/);
  assert.throws(() => buttonAction(w, '0', { type: 'start' }, '0'), /already/);
  w.players[0].x = 10;
  assert.throws(() => buttonAction(w, '0', { type: 'press' }, '0'), /close/);
  assert.throws(() => buttonAction(w, '0', { type: 'exit' }, '0'), /EXIT/);
  w.players[0].hearts = 0;
  assert.throws(() => press(w), /out/);
});
void test('Solo can press, move around the pedestal, reach the exit and bank the pot', () => {
  const w = game(),
    p = w.players[0];
  press(w);
  p.input.x = 1;
  tick(w, 600);
  p.input.x = 0;
  p.input.z = -1;
  tick(w, 2100);
  p.input.z = 0;
  p.input.x = -1;
  tick(w, 550);
  p.input.x = 0;
  tick(w, 2500);
  assert.ok(Math.hypot(p.x, p.z + 9) < 2.2, JSON.stringify(p));
  buttonAction(w, '0', { type: 'exit' }, '0');
  assert.equal(w.phase, 'won');
  assert.equal(w.banked, 500);
  assert.equal(p.winnings, 500);
});
void test('First escape banks a fixed share; greed locks the door without extending the escape deadline', () => {
  const w = game(4);
  press(w);
  tick(w, 5100);
  atExit(w, '0');
  buttonAction(w, '0', { type: 'exit' }, '0');
  const deadline = w.escapeAt;
  assert.equal(deadline, w.clock + ESCAPE_MS);
  assert.equal(w.banked, 125);
  press(w, '1');
  assert.equal(w.escapeAt, deadline);
  assert.equal(w.players[0].winnings, 125);
  atExit(w, '2');
  assert.throws(() => buttonAction(w, '2', { type: 'exit' }, '0'), /locked/);
  tick(w, 5100);
  buttonAction(w, '2', { type: 'exit' }, '0');
  assert.equal(w.players[2].winnings, 312);
  assert.equal(w.banked, 437);
  assert.throws(() => buttonAction(w, '0', { type: 'exit' }, '0'), /safe/);
  tick(w, 21000);
  assert.equal(w.phase, 'won');
  assert.equal(w.banked, 437);
});
void test('A telegraphed boxing glove launches the entire clustered crew and charges one life each', () => {
  const w = game(4),
    h = nextHazard(1, w.clock);
  w.hazards = [h];
  for (let i = 0; i < 4; i++) {
    w.players[i].x = -2 + i * 1.3;
    w.players[i].z = 1.5;
  }
  tick(w, 2200);
  assert.ok(w.players.every((p) => p.hearts === 3));
  assert.equal(glovePose(h, w.clock).warning, true);
  tick(w, 900);
  assert.ok(
    w.players.every((p) => p.hearts === 2 && p.y > 0.5 && p.vx > 10),
    JSON.stringify(w.players),
  );
  assert.equal(w.events.filter((e) => e.kind === 'punch').length, 4);
  tick(w, 1400);
  assert.ok(w.players.every((p) => p.hearts === 2));
});
void test('Conveyors push, soap preserves momentum, and a spinning sofa physically strikes players', () => {
  const belt = game(),
    bp = belt.players[0];
  belt.hazards = [nextHazard(0, belt.clock - 2000)];
  bp.x = -5;
  bp.z = 0;
  tick(belt, 700);
  assert.ok(bp.z > 1);
  const dry = game(),
    wet = game();
  for (const w of [dry, wet]) {
    w.players[0].x = 3.6;
    w.players[0].z = -3.8;
    w.players[0].vx = 5;
  }
  wet.hazards = [nextHazard(2, wet.clock - 2000)];
  tick(dry, 300);
  tick(wet, 300);
  assert.ok(wet.players[0].vx > dry.players[0].vx * 3);
  const spin = game();
  spin.hazards = [nextHazard(3, spin.clock - 1400)];
  spin.players[0].x = -4;
  spin.players[0].z = -4.5;
  tick(spin, 50);
  assert.equal(spin.players[0].hearts, 2);
  assert.ok(spin.players[0].vy > 0);
});
void test('Jumping clears a sofa; helping reduces daze without inventing extra lives', () => {
  const w = game(2),
    p = w.players[0];
  buttonAction(w, '0', { type: 'jump' }, '0');
  tick(w, 400);
  assert.ok(p.y > 1.5);
  w.hazards = [nextHazard(3, w.clock - 1400)];
  p.x = -4;
  p.z = -4.5;
  tick(w, 50);
  assert.equal(p.hearts, 3);
  w.hazards = [];
  p.x = 2;
  p.z = 2;
  p.y = 0;
  const friend = w.players[1];
  friend.x = 3;
  friend.z = 2;
  friend.hearts = 2;
  friend.stunnedUntil = w.clock + 1000;
  buttonAction(w, '0', { type: 'help' }, '0');
  assert.equal(friend.stunnedUntil, w.clock);
  assert.equal(friend.hearts, 2);
});
void test('STOP calls are visible and rate limited without pressing or pausing the show', () => {
  const w = game();
  const id = w.eventId;
  buttonAction(w, '0', { type: 'stop' }, '0');
  buttonAction(w, '0', { type: 'stop' }, '0');
  assert.equal(w.eventId, id + 1);
  assert.equal(w.pot, 0);
  assert.ok(w.players[0].shoutUntil > w.clock);
  tick(w, 3000);
  assert.ok(w.players[0].shoutUntil < w.clock);
});
void test('Sixteen presses cap the jackpot at $38,000 and cannot add unbounded hazards', () => {
  const w = game();
  for (let i = 0; i < MAX_PRESSES; i++) {
    w.clock += 2300;
    press(w);
  }
  assert.equal(w.pot, 38000);
  assert.equal(w.hazards.length, 16);
  assert.equal(new Set(w.hazards.map((h) => h.kind)).size, 4);
  assert.throws(() => press(w), /JACKPOT/);
});
void test('Time expires, all knockouts, and disconnects finish cleanly; banked money survives a departure', () => {
  const timed = game();
  tick(timed, ROUND_MS + 50);
  assert.equal(timed.phase, 'escape');
  tick(timed, ESCAPE_MS + 50);
  assert.equal(timed.phase, 'lost');
  const knocked = game();
  knocked.players[0].hearts = 0;
  tick(knocked, 50);
  assert.equal(knocked.phase, 'lost');
  const left = game(2);
  press(left);
  tick(left, 5100);
  atExit(left, '0');
  buttonAction(left, '0', { type: 'exit' }, '0');
  removeContestant(left, '0');
  assert.equal(left.banked, 250);
  removeContestant(left, '1');
  assert.equal(left.phase, 'won');
});
void test('Rematches reset danger and funds while preserving monotonically increasing event IDs', () => {
  const w = game();
  press(w);
  tick(w, 5100);
  atExit(w, '0');
  buttonAction(w, '0', { type: 'exit' }, '0');
  const lastId = w.eventId;
  buttonAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.pot, 0);
  assert.equal(w.banked, 0);
  assert.equal(w.hazards.length, 0);
  assert.equal(w.players[0].hearts, 3);
  assert.ok(w.eventId > lastId);
});
void test('Simulation produces the same movement at 20Hz and 100Hz and caps background catchup', () => {
  const a = game(),
    b = game();
  for (const w of [a, b]) {
    w.players[0].x = 4;
    w.players[0].input.z = -1;
  }
  tick(a, 2000, 50);
  tick(b, 2000, 10);
  assert.ok(Math.abs(a.players[0].z - b.players[0].z) < 1e-6);
  assert.equal(a.clock, b.clock);
  const start = a.clock;
  advanceButton(a, a.clock + 100000);
  assert.equal(a.clock - start, 250);
});
void test('Peer actions are idempotent and checkpoints recover hazards, prize, and idle movement', () => {
  const engine = createEngine(100000);
  engine.reconcile([
    {
      id: '0',
      name: 'Host',
      order: 0,
      color: 0,
      instance: 'one',
      seen: 100000,
    },
  ]);
  assert.deepEqual(engine.execute('0', 'start1', { type: 'start' }, '0'), {});
  engine.execute('0', 'press1', { type: 'press' }, '0');
  engine.execute('0', 'press1', { type: 'press' }, '0');
  assert.equal(engine.world.pot, 500);
  engine.input('0', { x: 1, z: 0, seq: 1 }, 1);
  const recovered = createEngine(120000, engine.checkpoint());
  assert.equal(recovered.world.pot, 500);
  assert.equal(recovered.world.hazards.length, 1);
  assert.equal(recovered.world.players[0].input.x, 0);
  assert.deepEqual(
    recovered.execute('0', 'press1', { type: 'press' }, '0'),
    {},
  );
  assert.equal(recovered.world.pot, 500);
  const snapshot = buttonSnapshot(recovered.world, 'ABC234', '0', '0', 1);
  snapshot.world.pot = 0;
  assert.equal(recovered.world.pot, 500);
});
void test('The sound workshop covers every game event with unique bounded effects', () => {
  const kinds = [
    'start',
    'press',
    'warning',
    'punch',
    'hit',
    'fall',
    'escape',
    'stop',
    'finish',
  ];
  assert.deepEqual(
    buttonCatalog
      .filter((c) => kinds.some((kind) => c.id === `event.${kind}`))
      .map((c) => c.id)
      .sort(),
    kinds.map((kind) => `event.${kind}`).sort(),
  );
  assert.ok(
    buttonCatalog
      .filter((c) => c.category === 'event')
      .every((c) => c.duration <= 5 && c.volume > 0 && !c.loop),
  );
});
