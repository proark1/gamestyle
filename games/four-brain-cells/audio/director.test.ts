import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BreakfastAudioDirector } from './director';
import { freshBreakfast } from '../simulation';
import { ROUND_MS, STOVE } from '../types';

void test('kitchen audio follows cooking, separate refills and real feet without replaying snapshots', () => {
  const director = new BreakfastAudioDirector(),
    w = freshBreakfast(100000);
  w.phase = 'playing';
  w.started = w.clock;
  w.utensils[1].fill = 0;
  director.update(w);
  w.clock += 100;
  Object.assign(w.utensils[0], STOVE, { fill: 1 });
  w.utensils[1].fill = 1;
  w.limbs[2].stepAt = w.clock;
  const plan = director.update(w);
  assert.ok(
    plan.loops.some((l) => l.channel === 'stove' && l.id === 'ambience.sizzle'),
  );
  assert.ok(plan.hits.some((h) => h.id === 'event.refill'));
  assert.ok(plan.hits.some((h) => h.id === 'event.coffee-refill'));
  assert.equal(plan.hits.filter((h) => h.id === 'event.step').length, 1);
  assert.deepEqual(director.update(w).hits, []);
  w.clock += 100;
  w.utensils[0].ready = true;
  const ready = director.update(w);
  assert.ok(ready.hits.some((h) => h.id === 'event.pancake-ready'));
  assert.ok(ready.loops.some((l) => l.channel === 'stove' && l.id === null));
  w.clock += 5000;
  w.limbs[2].stepAt = w.clock;
  assert.deepEqual(
    director.update(w).hits,
    [],
    'reconnection rebases old actions',
  );
});

void test('kitchen warning and failed finish are distinct from a win, and menu clears gameplay loops', () => {
  const director = new BreakfastAudioDirector(),
    w = freshBreakfast(100000);
  w.phase = 'playing';
  w.started = w.clock;
  w.clock += ROUND_MS - 60100;
  director.update(w);
  w.clock += 200;
  assert.ok(director.update(w).hits.some((h) => h.id === 'event.time-warning'));
  w.clock += 100;
  w.phase = 'lost';
  w.events.push({
    id: ++w.eventId,
    kind: 'finish',
    at: w.clock,
    text: '',
    limb: null,
  });
  const end = director.update(w);
  assert.deepEqual(
    end.hits.map((h) => h.id),
    ['event.fail', 'speech.fail'],
  );
  const menu = director.update(null);
  assert.equal(menu.reset, true);
  assert.ok(menu.loops.some((l) => l.id === 'music.menu'));
});
