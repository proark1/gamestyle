import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { ITEMS } from '../../games/stack-or-sink/types';
import { freshWorld } from '../../games/stack-or-sink/simulation';
import { freshFarm, farmSnapshot } from '../../games/act-natural/simulation';
import { Footsteps } from './world';
import { stackEvents } from '../../games/stack-or-sink/audio/events';
import { farmEvents } from '../../games/act-natural/audio-events';
import { canEditAudio } from './access';
void test('all three catalogs cover playable materials and generated prompts satisfy provider constraints', () => {
  for (const game of [
    'stack-or-sink',
    'act-natural',
    'uphill-delivery',
  ] as const) {
    const cues = getCatalog(game);
    assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
    assert.equal(new Set(cues.map((c) => c.prompt + c.text)).size, cues.length);
    for (const cue of cues)
      assert.doesNotThrow(() => parseCue(cue, cue), cue.id);
  }
  for (const kind of Object.keys(ITEMS))
    for (const action of ['grab', 'place', 'impact', 'rotate', 'splash'])
      assert.ok(
        getCatalog('stack-or-sink').some(
          (c) => c.id === `material.${kind}.${action}`,
        ),
      );
});
void test('footsteps use distance, ignore standing and teleporting, and do not hold mutable body references', () => {
  const f = new Footsteps(),
    p = { x: 0, y: 0, z: 0 };
  assert.deepEqual(f.update('cow', p, true, 'hoof', 0), []);
  assert.deepEqual(f.update('cow', p, true, 'hoof', 50), []);
  p.x = 0.8;
  assert.equal(f.update('cow', p, true, 'hoof', 100)[0].id, 'step.hoof');
  p.x = 9;
  assert.deepEqual(f.update('cow', p, true, 'hoof', 150), []);
  assert.deepEqual(f.update('cow', p, true, 'hoof', 200), []);
});
void test('stack sounds follow confirmed transitions and suppress duplicate/reconnect effects', () => {
  const before = freshWorld(1000),
    after = structuredClone(before);
  const p = after.pieces[0];
  p.heldBy = 'builder';
  after.clock += 100;
  assert.ok(
    stackEvents(before, after).some((e) => e.id === `material.${p.kind}.grab`),
  );
  assert.deepEqual(stackEvents(after, structuredClone(after)), []);
  after.clock += 3000;
  assert.deepEqual(stackEvents(before, after), []);
});
void test('farm sounds use visible state only and map power, lock, inspection and outcome changes', () => {
  const before = farmSnapshot(freshFarm(1000), 'ROOMAA', '', '', 0).world,
    after = structuredClone(before);
  after.clock += 100;
  after.powerOff = true;
  after.inspections--;
  after.keysDelivered = 1;
  after.clues = [
    { id: 1, clock: after.clock, sound: 'item.key.unlock', x: 0, z: 9.3 },
  ];
  const ids = farmEvents(before, after).map((e) => e.id);
  for (const id of [
    'event.power-off',
    'speech.power-off',
    'event.inspect',
    'item.key.unlock',
  ])
    assert.ok(ids.includes(id));
  assert.deepEqual(farmEvents(after, structuredClone(after)), []);
  after.round++;
  assert.deepEqual(farmEvents(before, after), []);
});
void test('hosted workshop saves need no password and still reject other origins', () => {
  const request = (origin?: string) =>
    new Request('http://internal/api/audio/stack-or-sink', {
      headers: origin ? { origin } : {},
    });
  assert.equal(
    canEditAudio(request('https://game.example'), 'https://game.example'),
    true,
  );
  assert.equal(
    canEditAudio(request('https://evil.example'), 'https://game.example'),
    false,
  );
  assert.equal(canEditAudio(request(), 'https://game.example'), false);
  assert.equal(
    canEditAudio(
      new Request('http://localhost:3012/api/audio/stack-or-sink', {
        headers: { origin: 'http://localhost:3012' },
      }),
      '',
    ),
    true,
  );
});
