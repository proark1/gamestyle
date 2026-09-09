import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mobileHud } from './mobile-hud';
import { farmAction, farmPlayer, farmSnapshot, freshFarm } from './simulation';
import { GATE, LADDER_EXIT, PANEL } from './types';

const hud = { target: '', watched: false, grazing: false };
function round() {
  const world = freshFarm(100_000, 1234, true);
  world.players = [farmPlayer('cow-player', 'Cow', world.clock)];
  farmAction(world, 'cow-player', { type: 'start' }, 'cow-player');
  const cow = world.cows.find((c) => c.id === world.players[0].cowId)!;
  const snapshot = () =>
    farmSnapshot(world, 'PRACTICE', 'cow-player', 'cow-player', world.clock);
  const interact = () =>
    farmAction(world, 'cow-player', { type: 'interact' }, 'cow-player');
  return { world, cow, snapshot, interact };
}

void test('idle touch play has no persistent hint or unavailable action', () => {
  const { world, cow, snapshot } = round();
  Object.assign(cow, { x: 0, z: 0 });
  for (const item of world.items) Object.assign(item, { x: 8, z: 8 });
  assert.equal(mobileHud(snapshot(), hud).hint, '');
  assert.equal(mobileHud(snapshot(), hud).available, false);
  assert.equal(
    mobileHud(snapshot(), { ...hud, grazing: true }).status,
    'Grazing',
  );
});

void test('touch pickup and unlock prompts lead to valid game actions', () => {
  const { world, cow, snapshot, interact } = round();
  const key = world.items.find((i) => i.kind === 'key')!;
  Object.assign(cow, { x: key.x, z: key.z });
  assert.equal(mobileHud(snapshot(), hud).label, 'Pick up');
  assert.equal(mobileHud(snapshot(), hud).available, true);
  interact();
  assert.equal(cow.carrying, key.id);
  Object.assign(cow, GATE);
  assert.equal(mobileHud(snapshot(), hud).label, 'Unlock');
  interact();
  assert.equal(world.keysDelivered, 1);
});

void test('power control exposes start and stop, and suppresses actions while shocked', () => {
  const { world, cow, snapshot, interact } = round();
  Object.assign(cow, PANEL);
  assert.equal(mobileHud(snapshot(), hud).label, 'Cut power');
  interact();
  assert.equal(mobileHud(snapshot(), hud).label, 'Stop');
  interact();
  assert.equal(cow.task, 0);
  cow.shockedAt = world.clock;
  assert.equal(mobileHud(snapshot(), hud).status, 'Exposed!');
  assert.equal(mobileHud(snapshot(), hud).available, false);
});

void test('escape stays unavailable until the gate requirements are met', () => {
  const { world, cow, snapshot, interact } = round();
  Object.assign(cow, GATE);
  assert.equal(mobileHud(snapshot(), hud).available, false);
  world.keysDelivered = 2;
  assert.equal(mobileHud(snapshot(), hud).available, false);
  world.powerOff = true;
  assert.equal(mobileHud(snapshot(), hud).label, 'Escape');
  assert.equal(mobileHud(snapshot(), hud).available, true);
  interact();
  assert.equal(cow.escaped, true);
  assert.equal(mobileHud(snapshot(), hud).available, false);
});

void test('ladder placement works without keys, but escape still needs power off', () => {
  const { world, cow, snapshot, interact } = round();
  const ladder = world.items.find((i) => i.kind === 'ladder')!;
  cow.carrying = ladder.id;
  ladder.holder = cow.id;
  Object.assign(cow, LADDER_EXIT);
  assert.equal(mobileHud(snapshot(), hud).label, 'Place ladder');
  interact();
  assert.equal(world.ladderPlaced, true);
  assert.equal(mobileHud(snapshot(), hud).available, false);
  world.powerOff = true;
  assert.equal(mobileHud(snapshot(), hud).available, true);
});

void test('farmer touch actions use only visible cows and remaining inspections', () => {
  const { world, snapshot } = round();
  const view = snapshot();
  view.you = { ...view.you, role: 'farmer', cowId: null };
  view.world.cows = [];
  assert.equal(mobileHud(view, hud).available, false);
  const cow = {
    ...world.cows[0],
    ...world.farmer,
    captured: false,
    escaped: false,
  };
  view.world.cows = [cow];
  assert.equal(mobileHud(view, hud).available, true);
  cow.x += 5;
  assert.equal(mobileHud(view, { ...hud, target: cow.id }).available, false);
  cow.x -= 5;
  view.world.inspections = 0;
  assert.equal(mobileHud(view, hud).available, false);
});
