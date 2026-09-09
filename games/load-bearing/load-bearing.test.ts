import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSite,
  freshSite,
  newWrecker,
  removeWrecker,
  siteAction,
  siteSnapshot,
  standingParts,
} from './simulation';
import { releaseUnsupported } from './structure';
import { CABLE } from './physics';
import { createEngine } from './peer';
import { loadBearingCatalog } from './audio';
import {
  PART_HITS,
  ROUND_MS,
  SWING_MS,
  alive,
  partTop,
  timeLeft,
  type LoadWorld,
} from './types';

const START = 100_000;

function site(count = 1, mode: LoadWorld['mode'] = 'normal') {
  const w = freshSite(START, mode);
  for (let i = 0; i < count; i++)
    w.players.push(newWrecker(`p${i}`, `Crew ${i}`, i, START));
  return w;
}
function begin(count = 1, mode: LoadWorld['mode'] = 'normal') {
  const w = site(count, mode);
  siteAction(w, 'p0', { type: mode === 'practice' ? 'practice' : 'start' }, 'p0');
  return w;
}
/** Run the world forward in realistic frames. */
function run(w: LoadWorld, ms: number, frame = 33) {
  for (let t = 0; t < ms; t += frame) advanceSite(w, w.clock + frame);
}
const near = (w: LoadWorld, id: string, partId: string) => {
  const part = w.parts.find((p) => p.id === partId)!;
  const player = w.players.find((p) => p.id === id)!;
  player.x = part.x + 1.2;
  player.z = part.z + 1.2;
  player.y = Math.max(0, part.y - part.h / 2);
  return part;
};

void test('a fresh site has a whole house and an intact piano', () => {
  const w = site();
  assert.ok(standingParts(w).length > 25);
  assert.equal(w.piano.integrity, 100);
  assert.equal(w.piano.resting, true);
  assert.equal(w.phase, 'lobby');
});

void test('only the foreman starts the job', () => {
  const w = site(2);
  assert.throws(() => siteAction(w, 'p1', { type: 'start' }, 'p0'), /foreman/);
  siteAction(w, 'p0', { type: 'start' }, 'p0');
  assert.equal(w.phase, 'playing');
  assert.throws(() => siteAction(w, 'p0', { type: 'start' }, 'p0'), /already/);
});

void test('a wall takes its documented number of blows', () => {
  const w = begin();
  const wall = near(w, 'p0', 'wall-side--5');
  for (let i = 0; i < PART_HITS.wall; i++) {
    w.clock += SWING_MS + 1;
    siteAction(w, 'p0', { type: 'swing', target: wall.id }, 'p0');
  }
  assert.equal(alive(wall), false, 'the wall should be gone');
  assert.equal(w.players[0].hits, PART_HITS.wall);
});

void test('the hammer has to come back round between blows', () => {
  const w = begin();
  const wall = near(w, 'p0', 'wall-side--5');
  siteAction(w, 'p0', { type: 'swing', target: wall.id }, 'p0');
  assert.throws(
    () => siteAction(w, 'p0', { type: 'swing', target: wall.id }, 'p0'),
    /come back round/,
  );
});

void test('swinging at nothing is refused', () => {
  const w = begin();
  const player = w.players[0];
  player.x = 40;
  player.z = 40;
  assert.throws(() => siteAction(w, 'p0', { type: 'swing' }, 'p0'), /closer/);
});

void test('cutting the ground floor drops the storey above it', () => {
  const w = begin();
  for (const p of w.parts) if (p.kind === 'column' && p.y < 3) p.hits = 0;
  for (const p of w.parts) if (p.kind === 'wall' && p.y < 3) p.hits = 0;
  const released = releaseUnsupported(w);
  assert.ok(released.length > 5, 'the upper structure lost its support');
  const roof = w.parts.find((p) => p.id === 'roof--2')!;
  assert.equal(roof.falling, true);
  const before = roof.y;
  run(w, 1500);
  assert.ok(roof.y < before - 1, 'the roof actually fell');
});

void test('the piano rides its bay down and gets hurt doing it', () => {
  const w = begin();
  const bay = w.parts.find((p) => p.id === 'slab-3.33--2')!;
  bay.hits = 0;
  releaseUnsupported(w);
  const height = w.piano.y;
  run(w, 2500);
  assert.equal(w.piano.resting, false, 'the piano lost its floor');
  assert.ok(w.piano.y < height - 1, 'the piano fell');
  assert.ok(w.piano.integrity < 100, 'the landing did damage');
});

void test('a piano already on its last legs does not survive the drop', () => {
  const w = begin();
  w.piano.integrity = 0.5;
  w.parts.find((p) => p.id === 'slab-3.33--2')!.hits = 0;
  releaseUnsupported(w);
  run(w, 2500);
  assert.equal(w.piano.integrity, 0);
  assert.equal(w.phase, 'lost');
  assert.match(w.events.at(-1)!.text, /piano/i);
});

void test('a piano standing on an intact bay is left alone', () => {
  const w = begin();
  w.piano.resting = false;
  run(w, 1500);
  assert.equal(w.piano.integrity, 100, 'nothing hit it');
  assert.equal(w.phase, 'playing');
});

void test('flattening the house with the piano alive wins the job', () => {
  const w = begin();
  for (const p of w.parts) p.hits = 0;
  run(w, 200);
  assert.equal(w.standing, 0);
  assert.equal(w.phase, 'won');
});

void test('time running out with the house up loses the job', () => {
  const w = begin();
  assert.equal(timeLeft(w), ROUND_MS);
  w.started = w.clock - ROUND_MS - 1;
  run(w, 100);
  assert.equal(w.phase, 'lost');
  assert.match(w.events.at(-1)!.text, /standing/);
});

void test('practice has no clock', () => {
  const w = begin(1, 'practice');
  assert.equal(w.mode, 'practice');
  w.started = w.clock - ROUND_MS * 4;
  run(w, 200);
  assert.equal(w.phase, 'playing');
  assert.equal(timeLeft(w), ROUND_MS);
});

void test('the crane is taken, held and handed back', () => {
  const w = begin(2);
  siteAction(w, 'p0', { type: 'crane' }, 'p0');
  assert.equal(w.crane.owner, 'p0');
  assert.throws(() => siteAction(w, 'p1', { type: 'crane' }, 'p0'), /teammate/);
  const x = w.crane.x;
  siteAction(w, 'p0', { type: 'crane-move', x: 1, y: 0, z: 0 }, 'p0');
  assert.ok(w.crane.x > x, 'the hoist moved');
  siteAction(w, 'p0', { type: 'crane-drop' }, 'p0');
  assert.equal(w.crane.owner, null);
  assert.throws(
    () => siteAction(w, 'p1', { type: 'crane-move', x: 1 }, 'p0'),
    /Take the crane/,
  );
});

void test('the ball hangs on a cable and swings instead of teleporting', () => {
  const w = begin();
  siteAction(w, 'p0', { type: 'crane' }, 'p0');
  w.crane.x = 6;
  const start = w.crane.ballX;
  let longest = 0;
  let shortest = Infinity;
  for (let t = 0; t < 2000; t += 33) {
    advanceSite(w, w.clock + 33);
    // Ignore the first moments, while the initially slack cable pulls taut.
    if (t < 300) continue;
    const cable = Math.hypot(
      w.crane.ballX - w.crane.x,
      w.crane.ballY - w.crane.y,
      w.crane.ballZ - w.crane.z,
    );
    longest = Math.max(longest, cable);
    shortest = Math.min(shortest, cable);
  }
  assert.ok(w.crane.ballX > start + 2, 'the ball followed the hoist across');
  assert.ok(longest < CABLE + 1.5, `the cable stayed taut, saw ${longest}`);
  assert.ok(shortest > CABLE - 1.5, 'the ball never snapped up to the hoist');
  assert.ok(w.crane.ballY < w.crane.y - 2, 'the ball hangs below the hoist');
});

void test('falling debris pins a worker and a teammate digs them out', () => {
  const w = begin(2);
  const player = w.players[0];
  const slab = w.parts.find((p) => p.id === 'slab-0--2')!;
  player.x = slab.x;
  player.z = slab.z;
  player.y = 0;
  slab.falling = true;
  slab.vy = -6;
  slab.y = 1.4;
  advanceSite(w, w.clock + 33);
  assert.equal(player.down, true);
  const mate = w.players[1];
  mate.x = player.x + 1;
  mate.z = player.z;
  mate.y = player.y;
  siteAction(w, 'p1', { type: 'help' }, 'p0');
  assert.equal(player.down, false);
});

void test('a pinned worker cannot swing', () => {
  const w = begin();
  w.players[0].down = true;
  assert.throws(() => siteAction(w, 'p0', { type: 'swing' }, 'p0'), /pinned/);
});

void test('marking a part is a toggle and leaves with its owner', () => {
  const w = begin(2);
  const wall = near(w, 'p0', 'wall-side--5');
  siteAction(w, 'p0', { type: 'mark', target: wall.id }, 'p0');
  assert.equal(wall.markedBy, 'p0');
  siteAction(w, 'p0', { type: 'mark', target: wall.id }, 'p0');
  assert.equal(wall.markedBy, undefined);
  siteAction(w, 'p0', { type: 'mark', target: wall.id }, 'p0');
  removeWrecker(w, 'p0');
  assert.equal(wall.markedBy, undefined);
  assert.equal(w.players.length, 1);
});

void test('a leaving crane operator releases the crane', () => {
  const w = begin(2);
  siteAction(w, 'p0', { type: 'crane' }, 'p0');
  removeWrecker(w, 'p0');
  assert.equal(w.crane.owner, null);
});

void test('workers cannot walk through a standing wall', () => {
  const w = begin();
  const wall = w.parts.find((p) => p.id === 'wall-side--5')!;
  const player = w.players[0];
  player.x = wall.x - 2;
  player.z = wall.z;
  player.y = 0;
  for (let i = 0; i < 60; i++) {
    player.input = { x: 1, z: 0, jump: false, seq: i };
    player.seen = w.clock;
    advanceSite(w, w.clock + 33);
  }
  assert.ok(player.x < wall.x - wall.w / 2, 'the wall stopped them');
});

void test('rubble on the ground can be stood on', () => {
  const w = begin();
  const slab = w.parts.find((p) => p.id === 'slab-0--2')!;
  slab.falling = false;
  slab.y = 0.2;
  slab.h = 0.4;
  const player = w.players[0];
  player.x = slab.x;
  player.z = slab.z;
  player.y = 3;
  run(w, 1200);
  assert.ok(player.y >= partTop(slab) - 0.05, 'they landed on the debris');
});

void test('the peer engine drives the same rules and recovers from a checkpoint', () => {
  const engine = createEngine(START);
  engine.reconcile([
    { id: 'p0', name: 'Foreman', color: 0, order: 0, instance: 'a', seen: START },
    { id: 'p1', name: 'Mate', color: 1, order: 1, instance: 'b', seen: START },
  ]);
  assert.equal(engine.world.players.length, 2);
  assert.deepEqual(engine.execute('p0', 'r1', { type: 'start' }, 'p0'), {});
  assert.equal(engine.world.phase, 'playing');
  // Replaying the same request identifier must not start a second job.
  assert.deepEqual(engine.execute('p0', 'r1', { type: 'start' }, 'p0'), {});
  const refused = engine.execute('p1', 'r2', { type: 'start' }, 'p0');
  assert.match(refused.error!, /foreman/);
  engine.advance(33);
  const checkpoint = engine.checkpoint();
  const revived = createEngine(START, checkpoint);
  assert.equal(revived.world.phase, 'playing');
  assert.equal(
    (revived.world as LoadWorld).parts.length,
    (engine.world as LoadWorld).parts.length,
  );
  const snapshot = revived.snapshot('ABC123', 'p0', 'p0', 1);
  assert.equal(snapshot.code, 'ABC123');
  assert.equal(snapshot.host, 'p0');
});

void test('the snapshot carries the world the crew needs to draw', () => {
  const w = begin();
  const snapshot = siteSnapshot(w, 'ABC123', 'p0', 'p0', 7);
  assert.equal(snapshot.version, 7);
  assert.equal(snapshot.world.parts.length, w.parts.length);
  assert.equal(snapshot.world.piano.integrity, 100);
});

void test('every catalogue cue is uniquely identified and priced', () => {
  const ids = new Set(loadBearingCatalog.map((c) => c.id));
  assert.equal(ids.size, loadBearingCatalog.length);
  for (const cue of loadBearingCatalog) {
    assert.ok(cue.duration >= 0.5, `${cue.id} needs a usable duration`);
    assert.ok(cue.prompt.length > 40, `${cue.id} needs a real prompt`);
  }
});
