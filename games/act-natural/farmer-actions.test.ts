import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceFarm,
  farmAction,
  farmPlayer,
  farmSnapshot,
  freshFarm,
} from './simulation';
import { GATE, LADDER_EXIT, PANEL } from './types';
import { ITEM_HOMES } from './farmer-actions';
import { mobileHud } from './mobile-hud';

function setup() {
  const w = freshFarm(100000);
  w.players = ['farmer', 'cow', 'friend'].map((id) =>
    farmPlayer(id, id, w.clock),
  );
  farmAction(w, 'farmer', { type: 'start' }, 'farmer');
  const cow = w.cows.find((c) => c.id === w.players[1].cowId)!;
  const act = (id = 'cow') => farmAction(w, id, { type: 'interact' }, 'farmer');
  const deliver = (id: string) => {
    Object.assign(cow, w.items.find((i) => i.id === id) && ITEM_HOMES[id]);
    act();
    Object.assign(cow, id === 'ladder' ? LADDER_EXIT : GATE);
    act();
  };
  return { w, cow, act, deliver };
}

void test('farmer relocks partial and full gate progress; returned keys allow escape again', () => {
  const { w, cow, act, deliver } = setup();
  deliver('barn-key');
  Object.assign(cow, ITEM_HOMES['shed-key']);
  act();
  Object.assign(w.farmer, GATE);
  w.inspections = 0;
  act('farmer');
  assert.equal(w.keysDelivered, 0);
  assert.equal(cow.carrying, 'shed-key');
  assert.equal(w.items[0].delivered, false);
  Object.assign(cow, GATE);
  act();
  deliver('barn-key');
  assert.equal(w.keysDelivered, 2);
  act('farmer');
  assert.equal(w.keysDelivered, 0);
  w.powerOff = true;
  Object.assign(cow, GATE);
  assert.throws(() => act(), /both keys/);
  deliver('barn-key');
  deliver('shed-key');
  act();
  assert.equal(cow.escaped, true);
  act('farmer');
  assert.equal(cow.escaped, true);
  assert.equal(w.inspections, 0);
});

void test('ladder removal is local, works with no inspections, and can be placed again', () => {
  const { w, cow, act, deliver } = setup();
  deliver('ladder');
  w.inspections = 0;
  assert.throws(() => act('farmer'), /No inspections/);
  assert.equal(w.ladderPlaced, true);
  Object.assign(w.farmer, LADDER_EXIT);
  const snapshot = farmSnapshot(w, 'ABCDEF', 'farmer', 'farmer', 1);
  const hud = mobileHud(snapshot, {
    target: cow.id,
    watched: false,
    grazing: false,
  });
  assert.equal(hud.label, 'Put ladder away');
  assert.equal(hud.available, true);
  act('farmer');
  assert.equal(w.ladderPlaced, false);
  assert.deepEqual(
    w.items.find((i) => i.id === 'ladder'),
    {
      id: 'ladder',
      kind: 'ladder',
      ...ITEM_HOMES.ladder,
      delivered: false,
      holder: null,
    },
  );
  deliver('ladder');
  w.powerOff = true;
  act();
  assert.equal(cow.escaped, true);
});

void test('restoring power blocks escape and cows can sabotage it again', () => {
  const { w, cow, act } = setup();
  w.powerOff = true;
  Object.assign(w.farmer, PANEL);
  w.inspections = 0;
  act('farmer');
  assert.equal(w.powerOff, false);
  Object.assign(cow, GATE);
  assert.throws(() => act(), /still live/);
  Object.assign(cow, PANEL);
  act();
  for (let i = 0; i < 41; i++) {
    w.players[1].seen = w.clock + 100;
    advanceFarm(w, w.clock + 100);
  }
  assert.equal(w.powerOff, true);
  assert.equal(w.inspections, 0);
});

void test('computer farmer repairs nearby objectives and finished rounds reject repairs', () => {
  const { w, deliver } = setup();
  deliver('ladder');
  w.mode = 'computer';
  w.farmerId = 'computer-farmer';
  Object.assign(w.farmer, LADDER_EXIT);
  advanceFarm(w, w.clock + 100);
  assert.equal(w.ladderPlaced, false);
  w.phase = 'cows-win';
  w.farmerId = 'farmer';
  w.powerOff = true;
  Object.assign(w.farmer, PANEL);
  assert.throws(
    () => farmAction(w, 'farmer', { type: 'interact' }, 'farmer'),
    /next round/,
  );
  assert.equal(w.powerOff, true);
});
