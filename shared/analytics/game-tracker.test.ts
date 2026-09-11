import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameTracker } from './game-tracker';
import type { Batch, GameAnalytics } from './protocol';
import type { TrackerEnvironment } from './tracker';

const game: GameAnalytics = { game: 'test-game', milestones: [] };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

void test('a game that mounts again after it was left follows a new visit', async () => {
  let visits = 0;
  const sent: Batch[] = [];
  const environment = (): TrackerEnvironment => {
    const id = `visit-${++visits}-0123456789abcdef`;
    return {
      id: () => id,
      now: () => 1000,
      visit: () => ({ device: 'pointer', entry: 'direct' }),
      visible: () => true,
      hash: async () => 'abcdef0123',
      listen: () => () => {},
      send: async (body) => {
        sent.push(JSON.parse(body) as Batch);
        return true;
      },
    };
  };
  const tracker = new GameTracker(game, environment);

  // React's development remount keeps the same visit open.
  tracker.mount();
  tracker.unmount();
  tracker.mount();
  await settle();
  assert.equal(sent.length, 0);

  tracker.unmount();
  await settle();
  assert.equal(sent.at(-1)?.summary.exit, 'left');
  assert.equal(sent.at(-1)?.id, 'visit-1-0123456789abcdef');

  tracker.mount();
  tracker.observe({ stage: 'lobby', mode: 'join', room: 'NEXT22' });
  tracker.flush();
  await settle();
  assert.equal(sent.at(-1)?.id, 'visit-2-0123456789abcdef');
  assert.equal(sent.at(-1)?.summary.mode, 'join');
  tracker.unmount();
  await settle();
});
