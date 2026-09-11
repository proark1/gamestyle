import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionTracker, type TrackerEnvironment } from './tracker';
import { parseBatch, type Batch, type GameAnalytics } from './protocol';

const game: GameAnalytics = {
  game: 'test-game',
  milestones: [
    { key: 'bridge', label: 'Crossed the bridge' },
    { key: 'summit', label: 'Reached the summit' },
  ],
  actions: { grab: 'Grabbed a corner', 'stop-wind': 'Let go of the winch' },
};

type Handlers = Parameters<TrackerEnvironment['listen']>[0];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(visible = true) {
  let clock = 50_000,
    deliver = true,
    handlers: Handlers | undefined;
  const sent: { batch: Batch; final: boolean }[] = [];
  const invalid: unknown[] = [];
  const environment: TrackerEnvironment = {
    id: () => 'visit-0123456789abcdef',
    now: () => clock,
    visit: () => ({ device: 'touch', entry: 'invite' }),
    visible: () => visible,
    hash: async () => 'abcdef0123',
    listen(next) {
      handlers = next;
      return () => {
        handlers = undefined;
      };
    },
    async send(body, final) {
      try {
        // Every report the tracker produces must pass the server's validation.
        const batch = parseBatch(JSON.parse(body), (id) =>
          id === game.game ? game : undefined,
        );
        sent.push({ batch, final });
      } catch (error) {
        invalid.push(error);
      }
      return deliver;
    },
  };
  const tracker = new SessionTracker(game, () => environment);
  return {
    tracker,
    sent,
    invalid,
    advance: (ms: number) => void (clock += ms),
    handlers: () => handlers!,
    deliver: (value: boolean) => void (deliver = value),
    report: async () => {
      tracker.flush();
      await settle();
      assert.deepEqual(invalid, []);
      return sent.at(-1)!.batch;
    },
  };
}

void test('a solo round reports its steps, milestones, result, actions and time', async () => {
  const h = harness();
  h.tracker.observe({ stage: 'menu' });
  h.advance(4000);
  const solo = { mode: 'solo', room: 'PRACTICE', humans: 1, round: 1 } as const;
  h.tracker.observe({ stage: 'playing', ...solo });
  h.advance(10_000);
  h.tracker.observe({ stage: 'playing', ...solo, milestones: ['bridge'] });
  h.tracker.action('grab');
  h.tracker.action('grab');
  h.tracker.action('wave');
  h.tracker.action('stopWind');
  h.advance(5000);
  h.tracker.observe({
    stage: 'finished',
    ...solo,
    milestones: ['bridge'],
    result: { outcome: 'won', reason: 'Delivered' },
  });
  const { summary, events } = await h.report();
  assert.deepEqual(summary.reached, [
    'opened',
    'chose',
    'playing',
    'bridge',
    'finished',
    'won',
  ]);
  assert.equal(summary.current, 'won');
  assert.equal(summary.mode, 'solo');
  assert.equal(summary.room, '', 'practice has no room to group');
  assert.deepEqual(
    [summary.rounds, summary.wins, summary.losses, summary.humans],
    [1, 1, 0, 1],
  );
  assert.deepEqual(summary.results, { 'won:delivered': 1 });
  assert.deepEqual(summary.actions, { grab: 2, 'stop-wind': 1 });
  assert.deepEqual(summary.time, {
    menu: 4000,
    lobby: 0,
    playing: 15_000,
    finished: 0,
  });
  assert.equal(summary.elapsed, 19_000);
  assert.deepEqual(
    events.map((event) => event.type),
    ['opened', 'mode', 'crew', 'round', 'step', 'end'],
  );
  assert.deepEqual(events[5].data, { outcome: 'won', reason: 'delivered' });
});

void test('a host handover that rewinds the round counts it once', async () => {
  const h = harness();
  const room = { mode: 'host', room: 'ABC234', humans: 2 } as const;
  h.tracker.observe({ stage: 'lobby', ...room });
  h.tracker.observe({ stage: 'playing', ...room, round: 't1' });
  const won = { outcome: 'won' } as const;
  h.tracker.observe({ stage: 'finished', ...room, round: 't1', result: won });
  // The new host restores a checkpoint from just before the finish.
  h.tracker.observe({ stage: 'playing', ...room, round: 't1', mode: 'join' });
  h.tracker.observe({ stage: 'finished', ...room, round: 't1', result: won });
  let { summary } = await h.report();
  assert.deepEqual([summary.rounds, summary.wins], [1, 1]);
  assert.deepEqual(summary.results, { won: 1 });
  assert.equal(summary.mode, 'host', 'only the first mode for a room counts');
  h.tracker.observe({ stage: 'playing', ...room, round: 't2' });
  ({ summary } = await h.report());
  assert.equal(summary.room, 'abcdef0123', 'the room hash follows shortly');
  assert.equal(summary.rounds, 2);
  assert.ok(summary.reached.includes('again'));
  assert.ok(summary.reached.includes('lobby'));
});

void test('repeated round identities count again after the menu', async () => {
  const h = harness();
  const solo = { mode: 'solo', room: 'PRACTICE', humans: 1, round: 0 } as const;
  h.tracker.observe({ stage: 'playing', ...solo });
  h.tracker.observe({
    stage: 'finished',
    ...solo,
    result: { outcome: 'lost' },
  });
  h.tracker.observe({ stage: 'menu' });
  h.tracker.observe({ stage: 'playing', ...solo });
  const { summary } = await h.report();
  assert.deepEqual([summary.rounds, summary.losses], [2, 1]);
  assert.equal(summary.current, 'playing');
});

void test('rounds without a result are recorded as abandoned, restarted or left', async () => {
  const h = harness();
  const room = { mode: 'join', room: 'ROOM22', humans: 3, npcs: 1 } as const;
  h.tracker.observe({ stage: 'lobby', ...room });
  h.tracker.observe({ stage: 'playing', ...room, round: 1 });
  h.tracker.observe({ stage: 'lobby', ...room });
  h.tracker.observe({ stage: 'playing', ...room, round: 2 });
  h.tracker.observe({ stage: 'playing', ...room, round: 3 });
  h.tracker.observe({ stage: 'menu' });
  const { summary } = await h.report();
  assert.equal(summary.rounds, 3);
  assert.deepEqual(summary.results, {
    'ended:abandoned': 1,
    'ended:restarted': 1,
    'ended:left': 1,
  });
  assert.ok(!summary.reached.includes('finished'));
  assert.equal(summary.current, 'opened');
  assert.deepEqual([summary.humans, summary.npcs], [3, 1]);
});

void test('joining during a results screen counts neither a round nor a result', async () => {
  const h = harness();
  const room = { mode: 'join', room: 'LATE22', humans: 4 } as const;
  h.tracker.observe({ stage: 'lobby', ...room });
  h.tracker.observe({
    stage: 'finished',
    ...room,
    round: 9,
    result: { outcome: 'won' },
  });
  const { summary } = await h.report();
  assert.deepEqual([summary.rounds, summary.wins], [0, 0]);
  assert.deepEqual(summary.results, {});
});

void test('milestones only move the current step forward within a round', async () => {
  const h = harness();
  const solo = { mode: 'solo', room: 'P', humans: 1, round: 'a' } as const;
  h.tracker.observe({ stage: 'playing', ...solo, milestones: ['summit'] });
  h.tracker.observe({
    stage: 'playing',
    ...solo,
    milestones: ['summit', 'bridge', 'unknown'],
  });
  const { summary, events } = await h.report();
  assert.equal(summary.current, 'summit');
  assert.deepEqual(summary.reached, [
    'opened',
    'chose',
    'playing',
    'summit',
    'bridge',
  ]);
  assert.equal(events.filter((event) => event.type === 'step').length, 2);
});

void test('visibility, page hide and back-forward restore are reported', async () => {
  const h = harness();
  h.tracker.start();
  h.advance(3000);
  h.handlers().visibility(false);
  await settle();
  assert.equal(h.sent.at(-1)!.final, false);
  h.advance(7000);
  h.handlers().visibility(true);
  h.advance(2000);
  h.handlers().hide();
  await settle();
  const closed = h.sent.at(-1)!;
  assert.equal(closed.final, true);
  assert.equal(closed.batch.summary.exit, 'closed');
  assert.equal(closed.batch.summary.active, 5000);
  assert.equal(closed.batch.summary.elapsed, 12_000);
  h.handlers().show();
  let { summary, events } = await h.report();
  assert.equal(summary.exit, '');
  assert.ok(events.some((event) => event.type === 'return'));
  h.tracker.stop();
  await settle();
  ({ summary } = h.sent.at(-1)!.batch);
  assert.equal(summary.exit, 'left');
  ({ events } = h.sent.at(-1)!.batch);
  assert.deepEqual(events.at(-1)?.data, { how: 'left' });
});

void test('a React remount keeps the visit open', async () => {
  const h = harness();
  h.tracker.start();
  h.tracker.stop();
  h.tracker.start();
  await settle();
  assert.equal(h.sent.length, 0);
  h.tracker.stop();
  await settle();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].final, true);
  assert.deepEqual(h.invalid, []);
});

void test('undelivered events are sent again with a newer delivery number', async () => {
  const h = harness();
  h.deliver(false);
  h.tracker.observe({ stage: 'lobby', mode: 'host', room: 'NEW222' });
  const first = await h.report();
  h.deliver(true);
  const second = await h.report();
  assert.ok(second.b > first.b);
  assert.deepEqual(
    second.events.map((event) => event.seq),
    first.events.map((event) => event.seq),
  );
  const third = await h.report();
  assert.deepEqual(third.events, []);
});

void test('the tracker stays silent during server rendering', () => {
  const tracker = new SessionTracker(game, () => {
    throw new Error('no window');
  });
  tracker.observe({ stage: 'playing', humans: 1 });
  tracker.action('grab');
  tracker.start();
  tracker.flush();
  tracker.stop();
});
