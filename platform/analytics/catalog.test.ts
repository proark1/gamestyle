import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { stepOrder, toKey } from '../../shared/analytics/protocol';
import { GAMES } from './catalog';
import { routeStage } from '../../games/uphill-delivery/level';
import { ROUTE_SECTIONS } from '../../games/uphill-delivery/analytics';
import { shelfStateReader } from '../../games/shelf-control/analytics';
import { giantPlayState } from '../../games/dont-wake-the-giant/analytics';
import { chaosPlayState } from '../../games/chaos/analytics';
import type { Snapshot as ShelfSnapshot } from '../../games/shelf-control/types';
import type { GiantSnapshot } from '../../games/dont-wake-the-giant/types';
import type { Snapshot as ChaosSnapshot } from '../../games/chaos/model';

const page = (route: string) =>
  existsSync(`app/${route}/page.tsx`) ||
  existsSync(`app/(handwerker)/${route}/page.tsx`);

void test('every game has its route, a sound workshop and well-formed report keys', () => {
  assert.equal(GAMES.length, 13);
  assert.equal(new Set(GAMES.map((game) => game.id)).size, GAMES.length);
  for (const game of GAMES) {
    assert.equal(game.analytics.game, game.id);
    assert.ok(page(game.id), `${game.id} has a route`);
    assert.ok(page(`${game.workshop.game}/admin`), `${game.id} has a workshop`);
    const steps = stepOrder(game.analytics);
    assert.equal(new Set(steps).size, steps.length, `${game.id} steps repeat`);
    for (const key of [
      ...steps,
      ...Object.keys(game.analytics.actions ?? {}),
      ...Object.keys(game.analytics.reasons ?? {}),
    ])
      assert.equal(toKey(key), key, `${game.id} key ${key}`);
  }
});

void test('Uphill Delivery milestones sit exactly where the route changes name', () => {
  for (const [height] of ROUTE_SECTIONS)
    assert.notEqual(routeStage(height - 0.01), routeStage(height));
  assert.equal(
    new Set(ROUTE_SECTIONS.map(([height]) => routeStage(height))).size,
    ROUTE_SECTIONS.length,
  );
});

void test('Shelf Control judges the result by the role the player had', () => {
  const read = shelfStateReader();
  const session = { code: 'SHELF2', id: 'me', token: 'token' };
  const snapshot = (
    phase: ShelfSnapshot['phase'],
    role: 'guard' | 'mannequin' | 'waiting',
  ) =>
    ({
      code: 'SHELF2',
      host: 'me',
      phase,
      round: 2,
      players: [
        { id: 'me', name: 'Ana' },
        { id: 'npc-1', name: 'Jo', bot: true },
      ],
      you: { role },
      mistakes: 3,
      escaped: 0,
      caught: 3,
      objectives: null,
    }) as unknown as ShelfSnapshot;
  const lobby = read(snapshot('lobby', 'waiting'), session);
  assert.deepEqual(
    [lobby.stage, lobby.mode, lobby.humans, lobby.npcs],
    ['lobby', 'host', 1, 1],
  );
  assert.equal(read(snapshot('hiding', 'guard'), session).stage, 'playing');
  // Roles are hidden again on the results screen.
  assert.deepEqual(read(snapshot('guard-win', 'waiting'), session).result, {
    outcome: 'won',
    reason: 'all-caught',
    score: 0,
  });
});

void test('Tiptoe Thieves tells a quiet exit, noise and sunrise apart', () => {
  const session = { code: 'PRACTICE', id: 'me' };
  const ended = (escapeAt: number, banked: number) =>
    ({
      code: 'PRACTICE',
      host: 'me',
      you: 'me',
      version: 1,
      world: {
        phase: 'ended',
        started: 1,
        deadline: 480_000,
        escapeAt,
        banked,
        target: 120,
        players: [{ id: 'me', escaped: true }],
      },
    }) as unknown as GiantSnapshot;
  const quiet = giantPlayState(ended(0, 130), session);
  assert.equal(quiet.mode, 'solo');
  assert.deepEqual(quiet.result, {
    outcome: 'won',
    reason: 'crept-out',
    score: 130,
  });
  assert.equal(
    giantPlayState(ended(508_000, 40), session).result?.reason,
    'sunrise',
  );
  assert.equal(
    giantPlayState(ended(200_000, 40), session).result?.reason,
    'woke-him',
  );
});

void test('Permit Pending maps party phases to lobby, building and inspection', () => {
  const session = { code: 'BUILD2', id: 'me' };
  const snapshot = (phase?: string, passed?: boolean) =>
    ({
      host: 'other',
      code: 'BUILD2',
      players: [{ id: 'me' }, { id: 'other' }],
      world: {
        mode: 'job',
        round: 3,
        party: phase
          ? {
              roundId: 'r1',
              phase,
              ...(passed === undefined ? {} : { result: { passed } }),
            }
          : undefined,
      },
    }) as unknown as ChaosSnapshot;
  const progress = { checklist: 1, projectDone: false };
  assert.equal(
    chaosPlayState(snapshot('lobby'), session, progress).stage,
    'lobby',
  );
  const building = chaosPlayState(snapshot('lastCall'), session, progress);
  assert.deepEqual(
    [building.stage, building.mode, building.humans, building.milestones],
    ['playing', 'join', 2, ['half-built', 'all-built', 'last-call']],
  );
  assert.deepEqual(
    chaosPlayState(snapshot('inspection', false), session, progress).result,
    { outcome: 'lost', reason: 'inspection-failed', score: 100 },
  );
  assert.equal(chaosPlayState(snapshot(), session, progress).stage, 'playing');
});
