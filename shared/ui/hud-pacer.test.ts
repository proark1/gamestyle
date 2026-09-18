import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUD_INTERVAL_MS, hudPacer } from './hud-pacer';

type Snapshot = { phase: string; eventId: number; clock: number };

const snap = (phase: string, eventId: number, clock: number): Snapshot => ({
  phase,
  eventId,
  clock,
});

/** A pacer over a clock the test controls, matching how the games use it. */
function harness(interval = HUD_INTERVAL_MS) {
  let time = 1000;
  const pacer = hudPacer<Snapshot>(
    (snapshot) => `${snapshot.phase}:${snapshot.eventId}`,
    { interval, now: () => time },
  );
  return {
    pacer,
    advance: (ms: number) => {
      time += ms;
    },
    /** Feeds a 20Hz run and counts the renders it would cause. */
    feed: (count: number, build: (tick: number) => Snapshot) => {
      let rendered = 0;
      for (let tick = 0; tick < count; tick++) {
        if (pacer.due(build(tick))) rendered++;
        time += 50;
      }
      return rendered;
    },
  };
}

void test('the first snapshot always renders', () => {
  const { pacer } = harness();
  assert.equal(pacer.due(snap('lobby', 0, 0)), true);
});

void test('a second of routine 20Hz updates renders about half as often', () => {
  const { feed } = harness(90);
  const rendered = feed(20, (tick) => snap('playing', 7, tick));
  assert.ok(rendered <= 12, `expected pacing, got ${rendered} renders of 20`);
  assert.ok(rendered >= 8, `the HUD must keep up, got ${rendered}`);
});

void test('a phase change renders immediately, however recent the last one', () => {
  const { pacer, advance } = harness(90);
  assert.equal(pacer.due(snap('playing', 1, 0)), true);
  advance(5);
  assert.equal(pacer.due(snap('playing', 1, 1)), false, 'routine update waits');
  assert.equal(
    pacer.due(snap('finished', 1, 2)),
    true,
    'the end of a round cannot wait for the interval',
  );
});

void test('a new event renders immediately', () => {
  const { pacer, advance } = harness(90);
  pacer.due(snap('playing', 1, 0));
  advance(5);
  assert.equal(pacer.due(snap('playing', 2, 1)), true);
});

void test('an important update restarts the interval', () => {
  const { pacer, advance } = harness(90);
  pacer.due(snap('playing', 1, 0));
  advance(5);
  assert.equal(pacer.due(snap('playing', 2, 1)), true);
  advance(5);
  assert.equal(
    pacer.due(snap('playing', 2, 2)),
    false,
    'a burst of events does not open the gate for routine updates too',
  );
});

void test('a gap longer than the interval renders on arrival', () => {
  const { pacer, advance } = harness(90);
  pacer.due(snap('playing', 1, 0));
  advance(5000);
  assert.equal(pacer.due(snap('playing', 1, 1)), true);
});

void test('the interval boundary is inclusive, so pacing cannot stall', () => {
  const { pacer, advance } = harness(90);
  pacer.due(snap('playing', 1, 0));
  advance(89);
  assert.equal(pacer.due(snap('playing', 1, 1)), false);
  advance(1);
  assert.equal(pacer.due(snap('playing', 1, 2)), true);
});

void test('resetting makes the next snapshot render, as when rejoining', () => {
  const { pacer, advance } = harness(90);
  pacer.due(snap('playing', 1, 0));
  advance(5);
  assert.equal(pacer.due(snap('playing', 1, 1)), false);
  pacer.reset();
  assert.equal(
    pacer.due(snap('playing', 1, 2)),
    true,
    'a fresh room must paint at once, even with the same phase',
  );
});

void test('an unchanging world still refreshes at the interval', () => {
  // A HUD clock counts down inside one phase; it must not freeze.
  const { feed } = harness(90);
  assert.ok(feed(10, () => snap('playing', 1, 0)) >= 4);
});
