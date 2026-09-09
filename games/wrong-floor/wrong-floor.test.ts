import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHotel,
  newGuest,
  hotelAction,
  advanceHotel,
  hotelSnapshot,
  stationFor,
  removeGuest,
} from './simulation';
import { STATIONS, idleInput, type HotelWorld, type Choice } from './types';
import { createEngine } from './peer';
import { hotelCatalog } from './audio';
import { parseCue } from '../../platform/audio/service';

function game(count = 1, seed = 100000) {
  const w = freshHotel(seed);
  for (let i = 0; i < count; i++)
    w.players.push(newGuest(String(i), `Guest ${i}`, i, w.clock));
  hotelAction(w, '0', { type: 'start' }, '0');
  return w;
}
function tick(w: HotelWorld, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++)
    advanceHotel(w, w.clock + 50);
}
function vote(w: HotelWorld, choice: Choice, id = '0') {
  const p = w.players.find((p) => p.id === id)!;
  p.x = 0;
  p.z = -23;
  hotelAction(w, id, { type: 'vote', choice }, '0');
}
function moveTo(w: HotelWorld, id: string, x: number, z: number) {
  const p = w.players.find((p) => p.id === id)!;
  for (let i = 0; i < 900 && Math.hypot(p.x - x, p.z - z) > 0.16; i++) {
    const dx = x - p.x,
      dz = z - p.z,
      length = Math.hypot(dx, dz);
    p.input = { x: dx / length, z: dz / length, seq: i, sprint: false };
    advanceHotel(w, w.clock + 50);
  }
  p.input = idleInput();
  assert.ok(Math.hypot(p.x - x, p.z - z) < 0.3, `Guest reached ${x}, ${z}`);
}

void test('solo and mixed crews get four distinct witnesses, without making NPCs room members', () => {
  for (const count of [1, 2, 3, 4]) {
    const w = game(count);
    assert.equal(w.players.length, 4);
    assert.equal(w.players.filter((p) => p.bot).length, 4 - count);
    assert.equal(new Set(w.players.map((p) => stationFor(w, p))).size, 4);
    assert.ok(
      w.players.filter((p) => !p.bot).some((p) => p.slot === w.plan.witness),
    );
  }
});
void test('safe and haunted stops shuffle between stays; private deck survives recovery', () => {
  const decks = new Set<string>();
  for (let seed = 10; seed < 35; seed++) {
    const w = game(1, seed);
    decks.add(w.deck.join(','));
    assert.equal(w.deck.filter(Boolean).length, 3);
  }
  assert.ok(decks.size > 3);
});
void test('only host can start; mid-run restart and fabricated player actions are rejected', () => {
  const w = freshHotel(100);
  w.players.push(
    newGuest('0', 'Host', 0, 100),
    newGuest('1', 'Friend', 1, 100),
  );
  assert.throws(
    () => hotelAction(w, '1', { type: 'start' }, '0'),
    /Only the host/,
  );
  hotelAction(w, '0', { type: 'start' }, '0');
  assert.throws(
    () => hotelAction(w, '0', { type: 'restart' }, '0'),
    /Finish this stay/,
  );
  assert.throws(
    () => hotelAction(w, 'fake', { type: 'inspect' }, '0'),
    /Rejoin/,
  );
});
void test('inspection and voting require proximity; uninspected evidence cannot be reported', () => {
  const w = game();
  assert.throws(
    () => hotelAction(w, '0', { type: 'inspect' }, '0'),
    /Move closer/,
  );
  assert.throws(
    () => hotelAction(w, '0', { type: 'report' }, '0'),
    /Inspect your clue/,
  );
  assert.throws(
    () => hotelAction(w, '0', { type: 'vote', choice: 'advance' }, '0'),
    /far end/,
  );
  assert.throws(
    () =>
      hotelAction(w, '0', { type: 'vote', choice: 'banana' as Choice }, '0'),
    /Choose/,
  );
});
void test('snapshots contain only the local clue and shared reports; seed, deck and other observations stay private', () => {
  const w = game(4);
  w.plan.anomalies = [0, 2];
  w.plan.witness = 3;
  const views = w.players.map((p) => hotelSnapshot(w, 'ABCDEF', '0', p.id, 1));
  assert.deepEqual(
    views.map((s) => s.you.anomaly),
    [true, false, true, false],
  );
  assert.deepEqual(
    views.map((s) => s.you.apparition),
    [false, false, false, true],
  );
  for (const s of views) {
    assert.equal('plan' in s.world, false);
    assert.equal('seed' in s.world, false);
    assert.equal('deck' in s.world, false);
    assert.equal(s.you.observation, '');
    for (const p of s.world.players) {
      assert.equal('input' in p, false);
      assert.equal('slot' in p, false);
      assert.equal('inspected' in p, false);
      assert.equal(p.report, '');
    }
  }
  const p = w.players[0];
  p.x = STATIONS[0].x;
  p.z = STATIONS[0].z;
  hotelAction(w, '0', { type: 'inspect' }, '0');
  assert.equal(
    hotelSnapshot(w, 'ABCDEF', '0', '0', 2).you.observation,
    STATIONS[0].odd,
  );
  assert.equal(
    hotelSnapshot(w, 'ABCDEF', '0', '1', 2).world.players[0].report,
    '',
  );
  hotelAction(w, '0', { type: 'report' }, '0');
  assert.equal(
    hotelSnapshot(w, 'ABCDEF', '0', '1', 3).world.players[0].report,
    STATIONS[0].odd,
  );
  views[0].world.players[0].x = 999;
  assert.notEqual(w.players[0].x, 999);
});
void test('majority wins and a 2–2 tie retreats; only human votes count', () => {
  const w = game(4);
  w.plan.anomalies = [2];
  vote(w, 'advance', '0');
  vote(w, 'retreat', '1');
  vote(w, 'advance', '2');
  assert.equal(w.stage, 'inspect');
  vote(w, 'retreat', '3');
  assert.equal(w.lastDecision?.choice, 'retreat');
  assert.equal(w.cleared, 1);
  const solo = game();
  solo.plan.anomalies = [];
  for (const p of solo.players.filter((p) => p.bot)) p.vote = 'retreat';
  vote(solo, 'advance');
  assert.equal(solo.cleared, 1);
});
void test('a normal floor punishes retreat and an anomalous floor punishes advance', () => {
  for (const haunted of [false, true]) {
    const w = game();
    w.plan.anomalies = haunted ? [1] : [];
    vote(w, haunted ? 'advance' : 'retreat');
    assert.equal(w.phase, 'escape');
    assert.equal(w.mistakes, 1);
    assert.equal(w.cleared, 0);
  }
});
void test('deadline uses submitted votes and no votes default to retreat', () => {
  const w = game(2);
  w.plan.anomalies = [];
  vote(w, 'advance');
  tick(w, 90.1);
  assert.equal(w.cleared, 1);
  assert.equal(w.lastDecision?.choice, 'advance');
  const empty = game();
  empty.plan.anomalies = [1];
  tick(empty, 90.1);
  assert.equal(empty.cleared, 1);
  assert.equal(empty.lastDecision?.choice, 'retreat');
});
void test('one human can run the entire corridor in time and hold the elevator for a caught friend', () => {
  const w = game(2);
  w.plan.anomalies = [1];
  vote(w, 'advance', '0');
  vote(w, 'advance', '1');
  w.players[0].input = { ...idleInput(), z: 1 };
  tick(w, 5.3);
  assert.equal(w.players[0].safe, true);
  assert.equal(w.players[1].caught, true);
  assert.equal(w.phase, 'playing');
  assert.equal(w.stage, 'travel');
  assert.equal(w.cleared, 0);
  tick(w, 3);
  assert.equal(w.stage, 'inspect');
  assert.equal(
    w.players.some((p) => p.caught || p.safe),
    false,
  );
});
void test('the pursuing entity catches a stationary crew; NPC survivors do not save humans', () => {
  const w = game();
  w.plan.anomalies = [0];
  vote(w, 'advance');
  tick(w, 4);
  assert.equal(w.phase, 'lost');
  assert.equal(w.players[0].caught, true);
});
void test('the third wrong decision ends the stay even if the crew reaches the elevator', () => {
  const w = game();
  w.mistakes = 2;
  w.plan.anomalies = [0];
  vote(w, 'advance');
  w.players[0].input.z = 1;
  tick(w, 5.3);
  assert.equal(w.phase, 'lost');
  assert.equal(w.players[0].safe, true);
  assert.equal(w.mistakes, 3);
});
void test('NPCs visit their stations and share truthful distinct observations without input', () => {
  const w = game();
  w.plan.anomalies = [1, 3];
  tick(w, 20);
  for (const p of w.players.filter((p) => p.bot)) {
    const n = stationFor(w, p);
    assert.equal(
      p.report,
      w.plan.anomalies.includes(n) ? STATIONS[n].odd : STATIONS[n].normal,
    );
    assert.ok(p.z < -20, `${p.name} reaches the vote panel`);
  }
});
void test('an entire five-stop solo playthrough works using movement, inspection and NPC reports', () => {
  const w = game();
  for (let floor = 0; floor < 5; floor++) {
    assert.equal(w.stage, 'inspect');
    const you = hotelSnapshot(w, 'PRACTICE', '0', '0', 1).you;
    const station = STATIONS[you.station];
    moveTo(w, '0', station.x, station.z);
    hotelAction(w, '0', { type: 'inspect' }, '0');
    hotelAction(w, '0', { type: 'report' }, '0');
    moveTo(w, '0', 0, -23);
    tick(w, 9);
    const visible = hotelSnapshot(w, 'PRACTICE', '0', '0', 2);
    assert.ok(visible.world.players.every((p) => p.report));
    const odd = visible.world.players.some((p) =>
      STATIONS.some((s) => s.odd === p.report),
    );
    hotelAction(
      w,
      '0',
      { type: 'vote', choice: odd ? 'retreat' : 'advance' },
      '0',
    );
    assert.equal(w.cleared, floor + 1);
    tick(w, 3);
  }
  assert.equal(w.phase, 'won');
  assert.equal(w.mistakes, 0);
  hotelAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.phase, 'playing');
  assert.equal(w.cleared, 0);
  assert.equal(w.players.length, 4);
  assert.equal(w.run, 2);
});
void test('diagonal input does not exceed sprint speed and elevator jambs block movement', () => {
  const w = game(),
    p = w.players[0];
  p.x = 0;
  p.z = -10;
  p.input = { x: 1, z: -1, seq: 1, sprint: true };
  tick(w, 0.5);
  assert.ok(Math.hypot(p.x, p.z + 10) <= 2.901);
  p.x = 4;
  p.z = 0.5;
  p.input = { ...idleInput(), z: 1 };
  tick(w, 1);
  assert.ok(p.z <= 0.9);
});
void test('departed witnesses become NPCs and an outstanding vote resolves without waiting 90 seconds', () => {
  const w = game(2);
  w.plan.anomalies = [0];
  vote(w, 'retreat');
  removeGuest(w, '1');
  assert.equal(w.players.length, 4);
  assert.equal(w.players.filter((p) => p.bot).length, 3);
  assert.equal(w.cleared, 1);
});
void test('checkpoint retains private floor, votes and NPCs, clears held movement, and deduplicates actions', () => {
  const members = [0, 1].map((n) => ({
    id: String(n),
    name: `Guest ${n}`,
    color: n,
    order: n,
    instance: `instance-${n}`,
    seen: 100000,
  }));
  const engine = createEngine(100000);
  engine.reconcile(members);
  assert.deepEqual(engine.execute('0', 'start-1', { type: 'start' }, '0'), {});
  engine.input('0', { x: 1, z: -1, sprint: true }, 1);
  const checkpoint = engine.checkpoint();
  const resumed = createEngine(200000, checkpoint);
  resumed.reconcile(members);
  assert.deepEqual(resumed.world.plan, engine.world.plan);
  assert.deepEqual(resumed.world.deck, engine.world.deck);
  assert.equal(resumed.world.players.length, 4);
  assert.deepEqual(
    resumed.world.players.find((p) => p.id === '0')!.input,
    idleInput(),
  );
  assert.deepEqual(resumed.execute('0', 'start-1', { type: 'start' }, '0'), {});
  assert.equal(resumed.world.run, 1);
  assert.equal(resumed.open, false);
  const target = resumed.world.players.find((p) => p.id === '0')!;
  resumed.input('0', { x: NaN, z: Infinity, sprint: true }, 2);
  assert.deepEqual(target.input, idleInput());
  resumed.reconcile(members.slice(1));
  assert.equal(resumed.world.players.filter((p) => p.bot).length, 3);
});
void test('published hotel audio prompts conform to provider limits without paid generation', () => {
  assert.equal(
    new Set(hotelCatalog.map((c) => c.id)).size,
    hotelCatalog.length,
  );
  for (const cue of hotelCatalog) assert.equal(parseCue(cue, cue).id, cue.id);
  assert.ok(hotelCatalog.some((c) => c.id === 'event.knock'));
});
