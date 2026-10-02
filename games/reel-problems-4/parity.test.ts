import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceReel as advanceOriginal,
  freshReel as freshOriginal,
  newAngler as newOriginalAngler,
  reelAction as originalAction,
} from '../reel-problems/simulation';
import {
  advanceReel as advanceVoyage,
  freshReel as freshVoyage,
  newAngler as newVoyageAngler,
  reelAction as voyageAction,
} from './simulation';

const START = 1_000_000;

function core(world: ReturnType<typeof freshVoyage>) {
  const copy = structuredClone(world) as ReturnType<typeof freshVoyage> & {
    voyage?: unknown;
  };
  delete (copy as { voyage?: unknown }).voyage;
  copy.fish = copy.fish.slice(0, 12);
  const monster = copy.fish.find((fish) => fish.kind === 'monster');
  if (monster) monster.respawnAt = 0;
  copy.events = copy.events.map((event) =>
    event.kind === 'start'
      ? {
          ...event,
          text: 'Five minutes. One tiny boat. Bring in the big ones!',
        }
      : event.kind === 'boss'
        ? {
            ...event,
            text: '⚠️ THE LAKE MANAGER HAS RISEN! PULL TOGETHER, CREW!',
          }
        : event,
  );
  return copy;
}

function startedPair() {
  const original = freshOriginal(START);
  const voyage = freshVoyage(START);
  for (let index = 0; index < 2; index++) {
    const id = String(index);
    original.players.push(
      newOriginalAngler(id, `Angler ${index}`, index, original.clock),
    );
    voyage.players.push(
      newVoyageAngler(id, `Angler ${index}`, index, voyage.clock),
    );
  }
  originalAction(original, '0', { type: 'start' }, '0');
  voyageAction(voyage, '0', { type: 'start' }, '0');
  // The guaranteed starting crab is voyage content, not a base-physics change.
  voyage.crab = null;
  voyage.fish = voyage.fish.slice(0, 12);
  voyage.fish.find((fish) => fish.kind === 'monster')!.respawnAt = 0;
  return { original, voyage };
}

void test('the Reel Problems 4 fork starts from the exact Reel Problems 1 state', () => {
  assert.deepEqual(core(freshVoyage(START)), freshOriginal(START));
});

void test('unmodified boat, player, weather and fishing physics stay in parity', () => {
  const { original, voyage } = startedPair();
  const originalFish = original.fish.find((fish) => fish.kind === 'monster')!;
  const voyageFish = voyage.fish.find((fish) => fish.id === originalFish.id)!;
  originalFish.x = voyageFish.x = 10;
  originalFish.z = voyageFish.z = 0;
  originalAction(
    original,
    '0',
    { type: 'cast', x: originalFish.x, z: originalFish.z },
    '0',
  );
  voyageAction(
    voyage,
    '0',
    { type: 'cast', x: voyageFish.x, z: voyageFish.z },
    '0',
  );

  for (let tick = 0; tick < 240; tick++) {
    const reeling = tick % 40 < 24;
    for (const world of [original, voyage]) {
      world.players[0].input = {
        x: tick % 80 < 40 ? 0.45 : -0.25,
        z: 0.2,
        reel: reeling,
        brace: !reeling,
        seq: tick,
      };
      world.players[1].input = {
        x: -0.15,
        z: 0.1,
        reel: false,
        brace: true,
        seq: tick,
      };
    }
    advanceOriginal(original, original.clock + 50);
    advanceVoyage(voyage, voyage.clock + 50);
  }

  assert.deepEqual(core(voyage), original);
});
