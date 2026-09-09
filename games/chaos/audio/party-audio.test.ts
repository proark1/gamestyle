import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Countdown } from './countdown';
import { getCatalog } from '../../../platform/audio/construction/catalog';
import { parseCue } from '../../../platform/audio/construction/service';
import { generationRequest } from '../../../shared/audio/construction/provider';
import { DEFAULT_SETTINGS } from '../../../shared/audio/construction/types';
import {
  applyAction,
  freshWorld,
  type Player,
  type Snapshot,
  type ItemKind,
} from '../model';
import { enableParty, roleAnchor, partyAction, tickTask } from '../party';
import { PROP_USES } from '../house-props';
import { ChaosAudioDirector } from '../audio-director';
import type { SiteAudio } from '../../../shared/audio/construction/player';

const builder: Player = {
  id: 'a',
  name: 'Alex',
  color: 0,
  x: 0,
  z: 1.6,
  angle: 0,
  seen: 10000,
};
const catalog = new Map(getCatalog('chaos').map((c) => [c.id, c]));

void test('clock boundaries warn once, skip missed beats and reset between rounds', () => {
  const clock = new Countdown();
  assert.deepEqual(clock.sample('a', 61, true), []);
  assert.deepEqual(clock.sample('a', 60, true), [
    'timer.minute',
    'speech.timer.minute',
  ]);
  assert.deepEqual(clock.sample('a', 60, true), []);
  assert.deepEqual(clock.sample('a', 62, true), []);
  assert.deepEqual(
    clock.sample('a', 60, true),
    [],
    'clock corrections must not replay a warning',
  );
  assert.deepEqual(clock.sample('a', 30, true), [
    'timer.lastCall',
    'speech.timer.lastCall',
  ]);
  assert.deepEqual(clock.sample('a', 10, true), [
    'timer.ten',
    'speech.timer.ten',
  ]);
  assert.deepEqual(
    clock.sample('a', 6, true),
    ['timer.tick'],
    'four missed seconds are only one current tick',
  );
  assert.deepEqual(clock.sample('a', 0, true), ['timer.end']);
  assert.deepEqual(clock.sample('a', 0, true), []);
  assert.deepEqual(clock.sample('b', 4, true), [], 'late join is silent');
  assert.deepEqual(
    clock.sample('b', 3, false),
    [],
    'sandbox and frozen phases are silent',
  );
});

void test('new house props can be built, used, grabbed and thrown with validated audio', () => {
  for (const kind of ['fridge', 'washer', 'clock', 'duck'] as const) {
    const world = freshWorld();
    world.pieces = [];
    applyAction(
      world,
      { type: 'build', kind, x: 0, z: 0, rotation: 0 },
      builder,
      [builder],
      builder.id,
      10000,
    );
    const piece = world.pieces[0];
    applyAction(
      world,
      { type: 'use', id: piece.id },
      builder,
      [builder],
      builder.id,
      11000,
    );
    assert.equal(world.events.at(-1)?.audioCue, PROP_USES[kind]!.cue);
    assert.equal(piece.usedAt, 11000);
    const events = world.events.length;
    assert.throws(
      () =>
        applyAction(
          world,
          { type: 'use', id: piece.id },
          builder,
          [builder],
          builder.id,
          11100,
        ),
      /finish/,
    );
    assert.equal(world.events.length, events, 'rejected repeats emit no audio');
    const far = { ...builder, x: 10 };
    assert.throws(
      () =>
        applyAction(
          world,
          { type: 'use', id: piece.id },
          far,
          [far],
          builder.id,
          20000,
        ),
      /Walk/,
    );
    applyAction(
      world,
      { type: 'grab', id: piece.id },
      builder,
      [builder],
      builder.id,
      20000,
    );
    assert.throws(
      () =>
        applyAction(
          world,
          { type: 'use', id: piece.id },
          builder,
          [builder],
          builder.id,
          21000,
        ),
      /Walk/,
    );
    applyAction(
      world,
      { type: 'throw' },
      builder,
      [builder],
      builder.id,
      22000,
    );
    assert.ok(piece.physics);
    for (const event of world.events)
      if (event.audioCue)
        assert.ok(catalog.has(event.audioCue), event.audioCue);
  }
});

void test('house prop interactions respect walls and the frozen crew lobby', () => {
  const world = freshWorld('job');
  world.pieces = [
    { id: 'duck', kind: 'duck', x: 0, z: 0, rotation: 0, placed: true },
    { id: 'wall', kind: 'wall', x: 0, z: 0.8, rotation: 0, placed: true },
  ];
  assert.throws(
    () =>
      applyAction(
        world,
        { type: 'use', id: 'duck' },
        builder,
        [builder],
        builder.id,
        world.started + 100,
      ),
    /Walk/,
  );
  world.pieces.pop();
  enableParty(world, 10000);
  assert.throws(
    () =>
      applyAction(
        world,
        { type: 'use', id: 'duck' },
        builder,
        [builder],
        builder.id,
        10100,
      ),
    /Wait/,
  );
});

void test('crew lift, spills, collection, recovery and delivery emit catalogued sounds without private state', () => {
  for (const kind of ['sofa', 'glass', 'crane', 'ladder', 'barrow'] as const) {
    const world = freshWorld('sandbox', 10000);
    world.pieces = [];
    enableParty(world, 10000, 123, kind);
    let t = world.party!.task;
    const a = { ...builder, ...roleAnchor(t, 0) },
      b = { ...builder, id: 'b', ...roleAnchor(t, 1) };
    partyAction(
      world,
      { type: 'party', op: 'role', role: 0 },
      a,
      [a, b],
      a.id,
      10000,
    );
    partyAction(
      world,
      { type: 'party', op: 'role', role: 1 },
      b,
      [a, b],
      a.id,
      10000,
    );
    assert.ok(world.events.some((e) => e.audioCue === 'party.lift'));
    if (kind === 'ladder') {
      t.progress = 0.5;
      partyAction(
        world,
        { type: 'party', op: 'release' },
        a,
        [a, b],
        a.id,
        10010,
      );
      assert.ok(world.events.some((e) => e.audioCue === 'party.ladder.fall'));
    } else if (kind !== 'crane') {
      t.tilt = 0.99;
      t.inputs = {
        a: { x: 1, z: 0, turn: 0, at: 10000 },
        b: { x: -1, z: 0, turn: 0, at: 10000 },
      };
      tickTask(world, [a, b], 10100);
      assert.ok(
        world.events.some(
          (e) =>
            e.audioCue ===
            (kind === 'glass' ? 'party.glass.crack' : `party.${kind}.spill`),
        ),
      );
      if (kind === 'barrow') {
        const bag = t.cargo[0];
        partyAction(
          world,
          { type: 'party', op: 'collect' },
          { ...a, ...bag },
          [a, b],
          a.id,
          10110,
        );
        assert.equal(world.events.at(-1)?.audioCue, 'party.collect');
      }
    }
    t.roles = ['', ''];
    partyAction(
      world,
      { type: 'party', op: 'recover' },
      { ...a, ...t.origin },
      [a, b],
      a.id,
      10200,
    );
    assert.equal(world.events.at(-1)?.audioCue, 'party.recover');
    t = world.party!.task;
    t.phase = 'working';
    t.roles = ['a', 'b'];
    Object.assign(t, t.target);
    if (kind !== 'ladder') {
      if (kind !== 'crane')
        partyAction(
          world,
          { type: 'party', op: 'place' },
          a,
          [a, b],
          a.id,
          10300,
        );
      partyAction(
        world,
        { type: 'party', op: 'place' },
        b,
        [a, b],
        a.id,
        10300,
      );
    } else {
      t.progress = 0.999;
      t.lastTick = 10200;
      t.inputs.b = { x: 0, z: 1, turn: 0, at: 10300 };
      tickTask(world, [a, b], 10300);
    }
    assert.ok(world.events.some((e) => e.audioCue === 'party.delivered'));
    for (const event of world.events) {
      if (event.audioCue)
        assert.ok(catalog.has(event.audioCue), event.audioCue);
      assert.ok(!('roles' in event) && !('inputs' in event));
    }
  }
});

void test('director follows party phases, only plays current inspection lines and keeps private card sound local', () => {
  const played: string[] = [],
    moods: string[] = [],
    loops = new Map<string, string | null>();
  const audio = {
    play: (id: string) => {
      assert.ok(catalog.has(id), id);
      played.push(id);
    },
    atmosphere: (id: string) => moods.push(id),
    setLoop: (c: string, id: string | null) => loops.set(c, id),
  } as unknown as SiteAudio;
  const director = new ChaosAudioDirector(audio);
  const world = freshWorld('job', 10000);
  enableParty(world, 10000);
  const s: Snapshot = {
    code: 'ABCDEF',
    host: 'a',
    now: 10000,
    version: 1,
    world,
    players: [builder],
  };
  director.update(s, 10000);
  assert.equal(moods.at(-1), 'lobby');
  assert.equal(played.length, 0);
  partyAction(
    world,
    { type: 'party', op: 'start' },
    builder,
    [builder],
    'a',
    11000,
  );
  director.update(s, 11000);
  assert.equal(played.at(-1), 'speech.crew.start');
  world.party!.phase = 'lastCall';
  world.party!.deadline = 50000;
  director.update(s, 20000);
  assert.equal(moods.at(-1), 'lastCall');
  const count = played.length;
  director.update(s, 20000);
  assert.equal(played.length, count);
  world.party!.phase = 'inspection';
  world.party!.phaseAt = 50000;
  director.update(s, 50000);
  assert.equal(moods.at(-1), 'inspection');
  assert.equal(loops.get('crew'), null);
  director.update(s, 70500);
  assert.equal(
    played.at(-1),
    'speech.inspection.spills.none',
    'no burst of missed inspection lines',
  );
  assert.ok(!played.includes('party.card.done'));
  director.update(null, 80000);
  assert.equal(moods.at(-1), 'menu');
});

void test('variant metadata resolves, new defaults validate and a voice override reaches only its own line', () => {
  for (const cue of catalog.values()) {
    assert.doesNotThrow(() => parseCue(cue, cue));
    if (cue.variantOf) assert.ok(catalog.has(cue.variantOf), cue.id);
  }
  for (const kind of Object.keys(PROP_USES) as ItemKind[])
    assert.ok(catalog.has(PROP_USES[kind]!.cue));
  const base = catalog.get('speech.inspection.arrive')!;
  const cue = parseCue(base, { ...base, voiceId: 'inspector_123' });
  assert.match(generationRequest(cue, DEFAULT_SETTINGS).path, /inspector_123/);
  assert.throws(
    () => parseCue(base, { ...base, voiceId: 'bad/path' }),
    /voice override/,
  );
  assert.throws(() => generationRequest(base, DEFAULT_SETTINGS), /voice/);
});
