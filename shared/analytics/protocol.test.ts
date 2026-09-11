import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalyticsError,
  MAX_BATCH_EVENTS,
  parseBatch,
  stepLabel,
  stepOrder,
  toKey,
  type GameAnalytics,
} from './protocol';

const game: GameAnalytics = {
  game: 'test-game',
  milestones: [{ key: 'bridge', label: 'Crossed the bridge' }],
  labels: { playing: 'Started building' },
};
const resolve = (id: string) => (id === game.game ? game : undefined);

function batch(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    id: 'visit-0123456789abcdef',
    game: 'test-game',
    b: 1,
    summary: {
      device: 'pointer',
      entry: 'home',
      mode: 'host',
      room: '0123456789',
      reached: ['opened', 'chose', 'playing', 'bridge'],
      current: 'bridge',
      rounds: 1,
      wins: 0,
      losses: 0,
      humans: 2,
      npcs: 1,
      elapsed: 61_000.4,
      active: 50_000,
      time: { menu: 1000, lobby: 10_000, playing: 50_000, finished: 0 },
      actions: { grab: 3 },
      results: { 'ended:left': 1 },
      exit: '',
    },
    events: [{ seq: 0, at: 0, type: 'opened', data: { entry: 'home' } }],
    ...overrides,
  };
}

void test('valid reports pass and are normalised', () => {
  const parsed = parseBatch(batch(), resolve);
  assert.equal(parsed.summary.elapsed, 61_000);
  assert.deepEqual(parsed.summary.results, { 'ended:left': 1 });
  assert.deepEqual(parsed.events[0].data, { entry: 'home' });
});

void test('reports that do not match the game or the limits are rejected', () => {
  const invalid = [
    batch({ game: 'other-game' }),
    batch({ v: 2 }),
    batch({ id: 'short' }),
    batch({ b: 0 }),
    batch({ summary: { ...batch().summary, reached: ['summit'] } }),
    batch({ summary: { ...batch().summary, current: 'summit' } }),
    batch({ summary: { ...batch().summary, room: 'ABC234' } }),
    batch({ summary: { ...batch().summary, results: { 'draw:x': 1 } } }),
    batch({ summary: { ...batch().summary, actions: { 'Bad Key': 1 } } }),
    batch({ summary: { ...batch().summary, humans: -1 } }),
    batch({ events: [{ seq: 400, at: 0, type: 'opened' }] }),
    batch({ events: [{ seq: 1, at: 0, type: 'step', data: { step: 'x' } }] }),
    batch({ events: [{ seq: 1, at: 0, type: 'mode', data: { note: 'A b' } }] }),
    batch({
      events: Array.from({ length: MAX_BATCH_EVENTS + 1 }, (_, seq) => ({
        seq,
        at: 0,
        type: 'hidden',
      })),
    }),
    'not an object',
  ];
  for (const report of invalid)
    assert.throws(() => parseBatch(report, resolve), AnalyticsError);
});

void test('keys, step order and labels follow each game', () => {
  assert.equal(toKey('stopWind'), 'stop-wind');
  assert.equal(toKey('  Crane Move! '), 'crane-move');
  assert.equal(toKey('fill_npcs'), 'fill-npcs');
  assert.equal(toKey('123'), '');
  assert.deepEqual(stepOrder(game), [
    'opened',
    'chose',
    'lobby',
    'playing',
    'bridge',
    'finished',
    'won',
    'again',
  ]);
  assert.equal(stepLabel(game, 'playing'), 'Started building');
  assert.equal(stepLabel(game, 'bridge'), 'Crossed the bridge');
  assert.equal(stepLabel(game, 'won'), 'Won a round');
});
