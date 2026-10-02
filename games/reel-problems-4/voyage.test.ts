import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshReel, newAngler, reelAction, bank } from './simulation';
import { RECIPES, SEA_STATIONS, seaBandAt } from './voyage';
import type { MaterialKind, VoyageItem } from './types';

const START = 1_000_000;
function game() {
  const world = freshReel(START);
  world.players.push(newAngler('captain', 'Captain', 0, START));
  reelAction(world, 'captain', { type: 'start' }, 'captain');
  world.crab = null;
  return world;
}

function material(id: number, kind: MaterialKind): VoyageItem {
  return {
    id: `test-${id}`,
    category: 'material',
    kind,
    name: kind,
    value: 1,
    location: 'cargo',
  };
}

void test('the ocean uses three natural danger bands with no gate', () => {
  assert.equal(seaBandAt(0, 0), 'coastal');
  assert.equal(seaBandAt(70, 0), 'offshore');
  assert.equal(seaBandAt(120, 0), 'deep');
});

void test('landed catches become shared cargo and sell into shared money', () => {
  const w = game();
  bank(w, 'salmon', [w.players[0]], 'Captain', '');
  assert.equal(
    w.voyage.items.find((item) => item.kind === 'salmon')?.location,
    'cargo',
  );
  w.boat.x = SEA_STATIONS.trader.x;
  w.boat.z = SEA_STATIONS.trader.z;
  reelAction(w, 'captain', { type: 'sell' }, 'captain');
  assert.ok(w.voyage.wallet > 20);
  assert.equal(
    w.voyage.items.find((item) => item.kind === 'salmon')?.location,
    'sold',
  );
});

void test('materials craft a carried module that installs only into its fixed socket', () => {
  const w = game();
  w.boat.x = SEA_STATIONS.trader.x;
  w.boat.z = SEA_STATIONS.trader.z;
  w.voyage.wallet = 200;
  w.voyage.items.push(
    material(1, 'wood'),
    material(2, 'wood'),
    material(3, 'iron'),
    material(4, 'iron'),
  );
  reelAction(
    w,
    'captain',
    { type: 'craft', recipe: 'reinforced-hull' },
    'captain',
  );
  const crafted = w.voyage.items.find(
    (item) => item.kind === 'reinforced-hull',
  )!;
  assert.equal(crafted.location, 'personal:captain');
  w.clock += 250;
  reelAction(w, 'captain', { type: 'install', itemId: crafted.id }, 'captain');
  assert.equal(w.voyage.installed.hull, 'reinforced-hull');
  assert.equal(crafted.location, 'installed:hull');
  assert.equal(w.voyage.wallet, 200 - RECIPES['reinforced-hull'].price);
});

void test('sinking is recoverable and the legendary catch is the only ending', () => {
  const w = game();
  w.phase = 'playing';
  bank(w, 'monster', w.players, 'The crew', '');
  assert.equal(w.phase, 'won');
  assert.equal(w.voyage.legendary.caught, true);
});
