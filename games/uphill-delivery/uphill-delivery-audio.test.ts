import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryAudioDirector, deliverySurface } from './audio';
import {
  freshDelivery,
  deliveryPlayer,
  deliveryAction,
  advanceDelivery,
} from './simulation';
import { deliveryPhysics } from './physics';
import { getCatalog } from '../../platform/audio/catalog';
import { promptLimit } from '../../shared/audio/limits';
import type { DeliverySnapshot } from './types';

function snapshot(): DeliverySnapshot {
  const world = freshDelivery(10000);
  world.players = [
    deliveryPlayer('one', 'One', 0, world.clock),
    deliveryPlayer('two', 'Two', 1, world.clock),
  ];
  world.phase = 'playing';
  world.clock += 1000;
  for (const p of world.players) {
    p.support = 'depot';
    p.grounded = true;
  }
  return { code: 'ABC234', host: 'one', you: 'one', version: 1, world };
}
const ids = (frame: ReturnType<DeliveryAudioDirector['update']>) =>
  frame.events.map((e) => e.id);

void test('delivery release is cloth Foley; actual fresh contacts alone play a landing', () => {
  const s = snapshot(),
    director = new DeliveryAudioDirector(() => 0.5);
  s.world.players[0].grip = 0;
  director.update(s);
  deliveryAction(s.world, 'one', { type: 'release' }, 'one');
  s.world.clock += 50;
  const release = ids(director.update(s));
  assert.ok(release.includes('event.release'));
  assert.ok(!release.includes('event.drop'));
  s.world.clock += 50;
  s.world.sofaImpact = {
    id: 1,
    at: s.world.clock,
    speed: 5,
    position: { ...s.world.sofa },
  };
  assert.ok(ids(director.update(s)).includes('event.drop'));
  s.world.clock += 50;
  assert.ok(!ids(director.update(s)).includes('event.drop'));
});

void test('first snapshot, room changes, restart and reconnect do not replay old contacts or interactions', () => {
  const director = new DeliveryAudioDirector(() => 0.5),
    s = snapshot();
  s.world.sofaImpact = {
    id: 1,
    at: s.world.clock,
    speed: 7,
    position: { ...s.world.sofa },
  };
  s.world.players[0].grip = 0;
  assert.deepEqual(ids(director.update(s)), []);
  const stale = structuredClone(s);
  s.world.clock += 50;
  s.world.gateTarget = 1.5;
  assert.ok(ids(director.update(s)).includes('event.gate'));
  assert.deepEqual(ids(director.update(stale)), []);
  s.world.clock += 50;
  assert.deepEqual(ids(director.update(s)), []);
  s.code = 'NEW234';
  assert.deepEqual(ids(director.update(s)), []);
  s.world.clock += 5000;
  s.world.sofaImpact.id++;
  s.world.sofaImpact.at = s.world.clock;
  assert.deepEqual(ids(director.update(s)), []);
  s.world.started = s.world.clock - 1000;
  assert.deepEqual(ids(director.update(s)), []);
});

void test('all crew footsteps use their supporting materials, with real jump and landing IDs', () => {
  const s = snapshot(),
    director = new DeliveryAudioDirector(() => 0.5);
  s.world.players[0].support = 'ice-3';
  s.world.players[0].input.x = 1;
  s.world.players[1].support = 'sofa';
  director.update(s);
  s.world.clock += 250;
  for (const p of s.world.players) p.x += 0.9;
  const steps = director.update(s).events;
  assert.ok(steps.some((e) => e.id === 'step.ice' && e.variant));
  assert.ok(
    steps.some(
      (e) => e.id === 'step.fabric' && e.position?.x === s.world.players[1].x,
    ),
  );
  s.world.clock += 50;
  s.world.players[0].grounded = false;
  s.world.players[0].velocity.y = 5;
  assert.ok(ids(director.update(s)).includes('event.jump'));
  s.world.clock += 50;
  s.world.players[0].velocity.y = -4;
  director.update(s);
  s.world.clock += 50;
  s.world.players[0].grounded = true;
  s.world.players[0].velocity.y = 0;
  assert.ok(ids(director.update(s)).includes('event.land'));
  assert.equal(deliverySurface('bridge-4'), 'wood');
  assert.equal(deliverySurface('customer-floor'), 'wood');
  assert.equal(deliverySurface('bottom'), 'grass');
  assert.equal(deliverySurface('road-4'), 'stone');
});

void test('moving airborne sofas do not scrape; supported sofas scrape their contact material', () => {
  const s = snapshot(),
    director = new DeliveryAudioDirector(() => 0);
  s.world.sofa.velocity.x = 2;
  director.update(s);
  for (let i = 0; i < 30; i++) {
    s.world.clock += 100;
    assert.ok(
      !ids(director.update(s)).some((id) => id.startsWith('sofa.scrape')),
    );
  }
  s.world.sofaSurface = 'bridge-3';
  const sounds: string[] = [];
  for (let i = 0; i < 20; i++) {
    s.world.clock += 100;
    sounds.push(...ids(director.update(s)));
  }
  assert.ok(sounds.includes('sofa.scrape-wood'));
  s.world.sofaSurface = null;
  s.world.clock += 1000;
  assert.ok(
    !ids(director.update(s)).some((id) => id.startsWith('sofa.scrape')),
  );
});

void test('cottage muffles outdoors, exposed heights gain wind and foreground details remain sparse', () => {
  const s = snapshot(),
    director = new DeliveryAudioDirector(() => 0.5);
  const get = (channel: string) =>
    director.update(s).loops.find((l) => l.channel === channel)!.strength;
  const lowWind = get('ridge');
  Object.assign(s.world.players[0], { x: 8, y: 21, z: -23, support: 'porch' });
  assert.ok(get('ridge') > lowWind);
  const outside = get('mountain');
  Object.assign(s.world.players[0], {
    x: -6,
    y: 22,
    z: -23,
    support: 'customer-floor',
  });
  assert.ok(get('mountain') < outside * 0.2);
  assert.ok(get('room') > 0.7);
  const calls: string[] = [];
  for (let i = 0; i < 100; i++) {
    s.world.clock += 100;
    calls.push(...ids(director.update(s)));
  }
  assert.ok(!calls.includes('bird.call'));
});

void test('real falling sofa reports a collision at contact, supports resolve, resting contacts remain quiet', () => {
  const s = snapshot(),
    w = s.world;
  w.sofa.y += 3;
  const physics = deliveryPhysics(w);
  assert.equal(Boolean(w.sofaImpact), false);
  for (let i = 0; i < 8; i++) advanceDelivery(w, w.clock + 1000 / 60);
  assert.equal(Boolean(w.sofaImpact), false);
  for (let i = 0; i < 150; i++) advanceDelivery(w, w.clock + 1000 / 60);
  assert.ok(w.sofaImpact && w.sofaImpact.speed > 2);
  assert.equal(w.sofaSurface, 'depot');
  assert.equal(w.players[0].support, 'depot');
  const id = w.sofaImpact.id;
  for (let i = 0; i < 120; i++) advanceDelivery(w, w.clock + 1000 / 60);
  assert.equal(w.sofaImpact.id, id);
  assert.ok(physics.sofa.position.y < 2);
});

void test('delivery catalog preserves original cues and covers director effects within generation limits', () => {
  const catalog = getCatalog('uphill-delivery');
  const available = new Set(catalog.map((c) => c.id));
  assert.equal(available.size, catalog.length);
  for (const cue of catalog)
    assert.ok(cue.prompt.length <= promptLimit(cue.category), cue.id);
  for (const id of [
    'event.grab',
    'event.drop',
    'event.bounce',
    'event.gate',
    'event.door',
    'event.goat',
    'ambience.mountain',
    'speech.start',
    'speech.win',
    'material.sofa.impact',
  ])
    assert.ok(available.has(id));
  const s = snapshot(),
    director = new DeliveryAudioDirector(() => 0);
  s.world.players[0].grip = 0;
  s.world.players[0].support = 'bridge-2';
  s.world.sofaSurface = 'bridge-2';
  s.world.sofa.velocity.x = 2;
  for (let i = 0; i < 300; i++) {
    s.world.clock += 100;
    s.world.players[0].x += 0.15;
    for (const cue of director.update(s).events)
      for (const id of cue.variant
        ? [1, 2, 3].map((v) => `${cue.id}.${v}`)
        : [cue.id])
        assert.ok(available.has(id), id);
  }
});
