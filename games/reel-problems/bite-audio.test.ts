import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshReel, newAngler, announce } from './simulation';
import { advanceChaos } from './chaos';
import { ReelAudioDirector } from './audio/director';

for (const health of [1, 0.4]) {
  void test(
    'Shark bite sounds once at the distant swimmer, health ' + health,
    () => {
      const w = freshReel(100_000);
      w.phase = 'playing';
      w.started = w.clock - 5000;
      const p = newAngler('swimmer', 'Swimmer', 0, w.clock);
      p.swimming = true;
      p.x = 30;
      p.z = 5;
      p.health = health;
      w.players.push(p);
      w.wildlife = [
        {
          id: 'shark',
          kind: 'shark',
          x: 30,
          z: 5,
          angle: 0,
          nextAt: 0,
          activeUntil: w.clock + 10000,
          hitAt: 0,
        },
      ];
      const director = new ReelAudioDirector();
      director.update(w, p.id);
      w.clock += 50;
      advanceChaos(w, 0.05, announce);
      const event = w.events.find((e) => e.kind === 'chomp');
      assert.ok(event);
      assert.deepEqual(event.position, { x: p.x, z: p.z });
      const hits = director
        .update(w, p.id)
        .hits.filter((h) => h.id === 'event.chomp');
      assert.equal(hits.length, 1);
      assert.deepEqual(hits[0].position, { x: p.x, z: p.z });
      assert.equal(hits[0].strength, 1);
      assert.equal(
        director.update(w, p.id).hits.filter((h) => h.id === 'event.chomp')
          .length,
        0,
      );
      const saved = structuredClone(event.position);
      p.x += 3;
      assert.deepEqual(
        event.position,
        saved,
        'impact position does not follow later movement',
      );
      assert.equal(p.downedUntil > w.clock, health < 0.55);
    },
  );
}
