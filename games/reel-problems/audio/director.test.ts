import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReelAudioDirector } from './director';
import { freshReel, newAngler, announce } from '../simulation';

void test('lake audio follows weather and actual movement; held input and reconnects do not produce steps', () => {
  const director = new ReelAudioDirector(),
    w = freshReel(100000);
  w.players.push(newAngler('you', 'You', 0, w.clock));
  w.phase = 'playing';
  w.started = w.clock;
  director.update(w, 'you');
  w.clock += 100;
  w.weather.kind = 'storm';
  w.weather.rain = 0.9;
  w.players[0].input.x = 1;
  const still = director.update(w, 'you');
  assert.equal(
    still.hits.some((h) => h.id === 'step.deck'),
    false,
  );
  assert.ok(still.loops.some((l) => l.id === 'ambience.rain'));
  assert.ok(still.loops.some((l) => l.id === 'music.challenge'));
  w.clock += 100;
  w.players[0].x += 1;
  assert.equal(
    director.update(w, 'you').hits.filter((h) => h.id === 'step.deck').length,
    1,
  );
  assert.deepEqual(director.update(w, 'you').hits, []);
  w.clock += 5000;
  w.players[0].x += 1;
  announce(w, 'catch', 'old catch');
  assert.deepEqual(director.update(w, 'you').hits, []);
  w.clock += 100;
  w.weather.kind = 'calm';
  w.weather.rain = 0;
  assert.ok(
    director
      .update(w, 'you')
      .loops.some((l) => l.channel === 'rain' && l.id === null),
  );
});

void test('failed fishing finish uses its own result and menu stops the fishing layers', () => {
  const director = new ReelAudioDirector(),
    w = freshReel(100000);
  w.phase = 'playing';
  w.started = w.clock;
  director.update(w);
  w.clock += 100;
  w.phase = 'lost';
  announce(w, 'finish', 'lost');
  assert.deepEqual(
    director.update(w).hits.map((h) => h.id),
    ['event.fail', 'speech.fail'],
  );
  assert.deepEqual(director.update(w).hits, []);
  const menu = director.update(null);
  assert.equal(menu.reset, true);
  assert.ok(menu.loops.some((l) => l.id === 'music.menu'));
});
