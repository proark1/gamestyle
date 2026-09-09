import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Player } from './model';
import { enableParty, partyAction, roleAnchor, tickTask } from './party';
import { tickSwap, swapEditError } from './swap';
import { dailyJob, setDaily } from './daily';
import { portraitCrop, clipCaption } from './capture-layout';
import { buildSnapshot, restoreBuild } from './build-snapshot';
import { addMemento, roundMemento } from './scrapbook';
const now = 100000;
function fixture() {
  const world = enableParty(freshWorld('job', now), now);
  const players: Player[] = Array.from({ length: 4 }, (_, n) => ({
    id: `p${n}`,
    name: `Builder ${n}`,
    x: n - 2,
    z: 5,
    angle: 0,
    seen: now,
    color: n,
  }));
  partyAction(
    world,
    { type: 'party', op: 'configure', format: 'swap' },
    players[0],
    players,
    players[0].id,
    now,
  );
  partyAction(
    world,
    { type: 'party', op: 'start' },
    players[0],
    players,
    players[0].id,
    now,
  );
  const advance = (time: number) => {
    players.forEach((p) => (p.seen = time));
    tickSwap(world, players, time);
  };
  return { world, players, advance };
}
void test('Build & Swap requires four players, confines teams and freezes puzzles during runs', () => {
  const { world, players, advance } = fixture();
  const small = enableParty(freshWorld('job', now), now);
  small.party!.format = 'swap';
  assert.throws(
    () =>
      partyAction(
        small,
        { type: 'party', op: 'start' },
        players[0],
        players.slice(0, 3),
        players[0].id,
        now,
      ),
    /four/,
  );
  assert.equal(
    swapEditError(
      world,
      { type: 'build', kind: 'chair', x: -3, z: 0, rotation: 0 },
      players[0],
    ),
    null,
  );
  assert.ok(
    swapEditError(
      world,
      { type: 'build', kind: 'wall', x: 3, z: 0, rotation: 0 },
      players[0],
    ),
  );
  world.party!.swap!.owners.mine = 0;
  assert.ok(swapEditError(world, { type: 'remove', id: 'mine' }, players[2]));
  advance(now + 90000);
  assert.equal(world.party!.swap!.stage, 'prove-a');
  assert.ok(
    swapEditError(
      world,
      { type: 'build', kind: 'chair', x: -3, z: 0, rotation: 0 },
      players[0],
    ),
  );
  assert.throws(
    () =>
      partyAction(
        world,
        { type: 'party', op: 'role', role: 0 },
        players[2],
        players,
        players[0].id,
        now + 90001,
      ),
    /other pair/,
  );
});
void test('both puzzles must be proven; race uses opposing targets, equal clocks, and measured completion', () => {
  const { world: w, advance } = fixture();
  const p = w.party!;
  advance(now + 90000);
  p.task.phase = 'done';
  advance(now + 100000);
  assert.equal(p.swap!.stage, 'prove-b');
  assert.equal(p.task.target.x, 3);
  p.task.phase = 'done';
  advance(now + 110000);
  assert.deepEqual(p.swap!.verified, [true, true]);
  assert.equal(p.swap!.stage, 'run-a');
  assert.equal(p.task.target.x, 3);
  p.task.phase = 'done';
  advance(now + 130000);
  assert.equal(p.task.target.x, -3);
  assert.equal(p.deadline, now + 190000);
  p.task.phase = 'done';
  advance(now + 155000);
  assert.deepEqual(p.swap!.times, [20000, 25000]);
  assert.match(p.result!.title, /Yellow/);
  const other = fixture();
  other.advance(now + 90000);
  other.advance(now + 150000);
  assert.equal(other.world.party!.result!.passed, false);
  assert.match(other.world.party!.result!.title, /Prove/);
});
void test('disconnects stop the race clock and preserve a completed delivery', () => {
  const { world, players, advance } = fixture();
  advance(now + 90000);
  const p = world.party!;
  p.task.phase = 'done';
  const deadline = p.deadline;
  players.slice(0, 3).forEach((v) => (v.seen = now + 110000));
  tickSwap(world, players, now + 110000);
  assert.equal(p.task.phase, 'done');
  assert.ok(p.swap!.pausedAt);
  p.task.phase = 'waiting';
  advance(now + 120000);
  assert.equal(p.deadline, deadline + 10000);
  assert.equal(p.swap!.pausedAt, undefined);
});
void test('daily jobs are deterministic, distinct, validated and survive saved copies and rematches', () => {
  const w = enableParty(freshWorld('job', now), now);
  const variants = ['2026-09-06', '2026-09-07', '2026-09-08'].map(
    (date) => dailyJob(date).variant,
  );
  assert.equal(new Set(variants).size, 3);
  assert.throws(() => dailyJob('2026-02-30'));
  setDaily(w, '2026-09-06', now);
  const p: Player = {
    id: 'host',
    name: 'Host',
    x: 0,
    z: 5,
    color: 0,
    angle: 0,
    seen: now,
  };
  partyAction(w, { type: 'party', op: 'start' }, p, [p], p.id, now);
  const retry = applyAction(
    w,
    { type: 'reset', mode: 'job', retry: true },
    p,
    [p],
    p.id,
    now + 100,
  );
  assert.deepEqual(retry.party!.task.target, w.party!.task.target);
  assert.equal(retry.party!.seed, w.party!.seed);
  const saved = buildSnapshot(w),
    copy = enableParty(freshWorld('job', now + 200), now + 200);
  restoreBuild(copy, saved, 'saved', 'try');
  assert.deepEqual(copy.party!.daily, w.party!.daily);
});
void test('portrait focus clamps to source edges and captions remove literal names including regex characters', () => {
  const crop = portraitCrop(1920, 1080, 9 / 16, { x: 2, y: -1 });
  assert.equal(crop.x + crop.w, 1920);
  assert.equal(crop.y, 0);
  assert.ok(crop.h <= 1080);
  assert.equal(
    clipCaption('A.* caught the sofa', ['A.*'], false),
    'A builder caught the sofa',
  );
  assert.equal(
    clipCaption('A.* caught the sofa', ['A.*'], true),
    'A.* caught the sofa',
  );
});
void test('scrapbook keeps a bounded unique history of actual finished results', () => {
  const { world } = fixture();
  assert.equal(roundMemento(world.party!), null);
  const entry = {
    id: 'r',
    at: now,
    crew: 'Crew',
    title: 'Finished',
    badge: 'Built with friends',
  };
  assert.equal(addMemento([entry], entry).length, 1);
  assert.equal(
    addMemento(
      Array.from({ length: 40 }, (_, n) => ({ ...entry, id: String(n) })),
      entry,
    ).length,
    30,
  );
});

void test('a pair physically carries a swap sofa and spectators cannot veto delivery; rematch restores the puzzle', () => {
  const { world, players, advance } = fixture();
  advance(now + 90000);
  const p = world.party!,
    t = p.task;
  for (let n = 0; n < 2; n++) {
    Object.assign(players[n], roleAnchor(t, n));
    partyAction(
      world,
      { type: 'party', op: 'role', role: n },
      players[n],
      players,
      players[0].id,
      now + 90000,
    );
  }
  for (let frame = 1; frame <= 40; frame++) {
    const time = now + 90000 + frame * 100;
    players.forEach((v) => (v.seen = time));
    for (let n = 0; n < 2; n++)
      partyAction(
        world,
        { type: 'party', op: 'drive', x: 0, z: -1, turn: 0 },
        players[n],
        players,
        players[0].id,
        time,
      );
    tickTask(world, players, time);
  }
  assert.equal(t.phase, 'working');
  assert.ok(Math.abs(t.z - t.target.z) < 1.25);
  Object.assign(players[2], t.target);
  for (let n = 0; n < 2; n++)
    partyAction(
      world,
      { type: 'party', op: 'place' },
      players[n],
      players,
      players[0].id,
      now + 94001,
    );
  assert.equal(t.phase, 'done');
  const puzzle = JSON.stringify(p.swap!.puzzle);
  const retry = applyAction(
    world,
    { type: 'reset', mode: 'job', retry: true },
    players[0],
    players,
    players[0].id,
    now + 95000,
  );
  partyAction(
    retry,
    { type: 'party', op: 'start' },
    players[0],
    players,
    players[0].id,
    now + 95000,
  );
  assert.equal(retry.party!.swap!.stage, 'prove-a');
  assert.equal(JSON.stringify(retry.pieces), puzzle);
});
