import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import { DEFAULT_SETTINGS, type AudioManifest } from '../../shared/audio/types';
import type { AudioEvent } from '../../shared/audio/world';
import { sampleStampedeCatalog } from './audio';
import { STORE_SETTING } from './audio/catalog';
import { takeBase } from './audio/profile';
import type { StampedeSynth } from './audio/synth';
import {
  BED_CUES,
  CUE_SPACING_MS,
  LINE_PRIORITY,
  LINE_REPEAT_MS,
  MUSIC_CUES,
  SPEECH_GAP_MS,
  STINGER_MS,
  URGENT_LINES,
  itemGrabCue,
  pickLine,
  spaceCues,
  stampedeAmbience,
  stampedeAudioEvents,
  stampedeFootsteps,
  stampedeMusic,
  type StrideMemory,
} from './audio-events';
import { SampleStampedePhysics } from './physics';
import {
  advanceSampleStampedeWorld,
  freshSampleStampedeWorld,
  newStampedePlayer,
  sampleStampedeSnapshot,
} from './simulation';
import { SampleStampedeSound } from './sound';
import {
  ITEM_DEFS,
  type ItemKind,
  type SampleStampedeSnapshot,
  type SampleStampedeWorld,
  type StampedeEvent,
} from './types';

const catalog = sampleStampedeCatalog;
const catalogIds = new Set(catalog.map((cue) => cue.id));
const catalogBases = new Set(catalog.map((cue) => takeBase(cue.id)));

function round(now = 100_000) {
  const world = freshSampleStampedeWorld(now);
  world.players.push(
    newStampedePlayer('me', 'You', 0, 'red', 'cart-red', 'driver', false),
    newStampedePlayer('gus', 'Gus', 1, 'red', 'cart-red', 'grabber', true),
    newStampedePlayer('barry', 'Barry', 2, 'blue', 'cart-blue', 'driver', true),
    newStampedePlayer('tina', 'Tina', 3, 'blue', 'cart-blue', 'grabber', true),
  );
  return world;
}
const snap = (world: SampleStampedeWorld) =>
  structuredClone(sampleStampedeSnapshot(world, 'SOLO', 'me', 'me', 1));
/** The next update of a snapshot, one frame later, with edits applied. */
function later(
  before: SampleStampedeSnapshot,
  edit: (world: SampleStampedeWorld) => void = () => {},
  ms = 16,
) {
  const next = structuredClone(before);
  next.world.clock += ms;
  edit(next.world);
  return next;
}
const red = (world: SampleStampedeWorld) =>
  world.carts.find((cart) => cart.id === 'cart-red')!;
const blue = (world: SampleStampedeWorld) =>
  world.carts.find((cart) => cart.id === 'cart-blue')!;
let serial = 1;
const event = (
  type: StampedeEvent['type'],
  at: { x: number; z: number },
  extra: Partial<StampedeEvent> = {},
): StampedeEvent => ({ id: serial++, type, x: at.x, y: 1, z: at.z, ...extra });
const carried = (id: string, kind: ItemKind) => ({
  id,
  kind,
  relX: 0,
  relY: 0.2,
  relZ: 0,
  rotY: 0,
});

void test('Sample Stampede catalog is rich, valid for the provider and keeps every saved cue id', () => {
  assert.equal(getCatalog('sample-stampede'), catalog);
  assert.equal(catalogIds.size, catalog.length, 'ids are unique');
  for (const cue of catalog) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
    if (cue.category !== 'speech') assert.equal(cue.text, '', cue.id);
    if (cue.loop)
      assert.ok(['music', 'ambience'].includes(cue.category), cue.id);
    if (cue.category === 'ambience') {
      assert.ok(cue.loop && cue.duration >= 20 && cue.duration <= 28, cue.id);
      assert.ok(Object.values(BED_CUES).includes(cue.id as never), cue.id);
    }
    if (cue.category === 'music')
      assert.ok(
        cue.loop
          ? cue.duration >= 45 && cue.duration <= 60
          : cue.duration >= 6 && cue.duration <= 10,
        cue.id,
      );
    if (cue.category === 'event') {
      assert.ok(cue.duration >= 0.5 && cue.duration <= 4.5, cue.id);
      if (cue.id !== 'event.ui') assert.ok(cue.prompt.endsWith(STORE_SETTING));
    }
    if (cue.category === 'speech') {
      assert.equal(cue.group, 'Chaos Commentator');
      assert.ok(cue.text.split(/\s+/).length <= 15, cue.id);
    }
  }
  const count = (category: string) =>
    catalog.filter((cue) => cue.category === category).length;
  assert.ok(count('speech') >= 10 && count('speech') <= 16);
  assert.equal(count('music'), 5);
  assert.ok(count('ambience') >= 3);
  assert.ok(catalog.length >= 50);
  assert.deepEqual(
    catalog
      .filter((cue) => cue.category === 'music')
      .map((cue) => cue.id)
      .sort(),
    [...MUSIC_CUES].sort(),
  );
  assert.deepEqual(
    catalog
      .filter((cue) => cue.category === 'speech')
      .map((cue) => cue.id)
      .sort(),
    [...LINE_PRIORITY].sort(),
  );
  for (const id of [
    'stampede.squeaky_wheel',
    'stampede.cart_crash',
    'stampede.sample_bell',
    'stampede.sugar_rush',
    'stampede.plate_slip',
    'stampede.shelf_tumble',
    'stampede.receipt_approved',
    'stampede.receipt_rejected',
    'stampede.receipt_print',
    'stampede.store_muzak',
  ])
    assert.ok(catalogIds.has(id), `kept ${id}`);
  const byId = new Map(catalog.map((cue) => [cue.id, cue]));
  assert.equal(byId.get('stampede.receipt_approved')?.category, 'event');
  assert.equal(byId.get('stampede.squeaky_wheel')?.category, 'ambience');
  assert.equal(byId.get('stampede.squeaky_wheel')?.loop, true);
});

void test('every catalog cue is reachable from the planner, music and beds, and nothing else is asked for', () => {
  const heard = new Map<string, AudioEvent[]>();
  const hear = (cues: readonly AudioEvent[]) => {
    for (const cue of cues)
      heard.set(cue.id, [...(heard.get(cue.id) ?? []), cue]);
    return cues.map((cue) => cue.id);
  };
  const note = (id: string) => hear([{ id }]);

  // The doors open.
  const start = snap(round());
  assert.deepEqual(hear(stampedeAudioEvents(null, start)), [
    'event.round_start',
    'speech.start',
    'stampede.sample_bell',
  ]);
  const base = later(start);
  const r = red(base.world),
    b = blue(base.world);
  const plan = (
    events: StampedeEvent[] = [],
    edit?: (world: SampleStampedeWorld) => void,
    before = base,
  ) => hear(stampedeAudioEvents(before, later(before, edit), events));

  // Every confirmed event type.
  const announced = plan([event('sample_announcement', { x: 13.5, z: 0 })]);
  for (const id of [
    'stampede.sample_bell',
    'stampede.crowd_rush',
    'speech.sample',
  ])
    assert.ok(announced.includes(id), id);
  assert.deepEqual(plan([event('sugar_rush', r, { team: 'red' })]), [
    'stampede.sugar_rush',
    'speech.sugar_rush',
  ]);
  assert.deepEqual(plan([event('sugar_rush', b, { team: 'blue' })]), [
    'stampede.sugar_rush',
  ]);
  assert.deepEqual(plan([event('cart_crash', r, { intensity: 1 })]), [
    'stampede.cart_crash',
    'speech.crash',
  ]);
  assert.deepEqual(plan([event('item_snagged', r, { team: 'red' })]), [
    'grabber.snag',
  ]);
  assert.deepEqual(plan([event('plate_slip', r, { team: 'red' })]), [
    'stampede.plate_slip',
    'speech.slip',
  ]);
  assert.deepEqual(
    plan([
      event('shelf_tumble', { x: -9, z: -12 }),
      event('shelf_tumble', { x: -9, z: -10 }),
      event('shelf_tumble', { x: -9, z: -8 }),
    ]),
    ['stampede.shelf_tumble'],
    'a collapsing pyramid is one cascade, not three',
  );
  assert.deepEqual(plan([event('receipt_approved', r, { team: 'red' })]), [
    'stampede.receipt_approved',
    'stampede.receipt_print',
    'speech.approved',
  ]);
  assert.deepEqual(plan([event('receipt_approved', b, { team: 'blue' })]), [
    'stampede.receipt_approved',
    'stampede.receipt_print',
  ]);
  assert.deepEqual(plan([event('receipt_rejected', r, { team: 'red' })]), [
    'stampede.receipt_rejected',
    'stampede.receipt_print',
    'speech.rejected',
  ]);
  assert.deepEqual(plan([event('grabber_whack', b, { team: 'red' })]), [
    'grabber.swing',
    'grabber.whack',
  ]);
  assert.deepEqual(
    plan([event('grabber_whack', { x: -20, z: 30 }, { team: 'red' })]),
    ['grabber.swing'],
  );
  assert.deepEqual(plan([event('item_lost', b, { team: 'blue' })]), []);

  // Baskets: each product, the shopping list, drops and teddy gifts.
  for (const kind of Object.keys(ITEM_DEFS) as ItemKind[]) {
    const cues = plan([], (w) =>
      red(w).items.push(carried(`new-${kind}`, kind)),
    );
    assert.ok(cues.includes(itemGrabCue(kind)), kind);
    assert.equal(
      cues.includes('event.list_tick'),
      r.manifest.targetItems.some((target) => target.kind === kind),
      `list tick for ${kind}`,
    );
  }
  const nearlyDone = later(base, (w) =>
    red(w).items.push(
      carried('a', 'paper_towels'),
      carried('b', 'kibble_50lb'),
      carried('c', 'mega_soda'),
    ),
  );
  const done = plan(
    [],
    (w) => red(w).items.push(carried('d', 'sample_taquito')),
    nearlyDone,
  );
  assert.ok(done.includes('event.list_complete'));
  assert.ok(done.includes('speech.list_complete'));
  assert.ok(!done.includes('event.list_tick'));
  assert.ok(
    plan([], (w) => red(w).items.pop(), nearlyDone).includes('item.drop'),
  );
  assert.ok(
    !plan(
      [],
      (w) => {
        red(w).items = [];
        red(w).score += 900;
      },
      nearlyDone,
    ).includes('item.drop'),
    'a checkout is not a drop',
  );
  const teddyHere = later(base, (w) =>
    red(w).items.push(carried('t', 'giant_teddy')),
  );
  const gift = plan(
    [event('item_lost', b, { team: 'blue' })],
    (w) => blue(w).items.push(red(w).items.pop()!),
    teddyHere,
  );
  assert.ok(gift.includes('item.giant_teddy.grab'));
  assert.ok(gift.includes('speech.teddy_gift'));
  assert.ok(!gift.includes('item.drop'));
  const teddyThere = later(base, (w) =>
    blue(w).items.push(carried('t', 'giant_teddy')),
  );
  const stuck = plan(
    [event('item_lost', r, { team: 'red' })],
    (w) => red(w).items.push(blue(w).items.pop()!),
    teddyThere,
  );
  assert.ok(stuck.includes('speech.teddy_stuck'));

  // Impacts, skids and near misses read from the carts.
  const headOn = later(base, (w) => {
    Object.assign(red(w), { x: 0, z: 20, vx: 8, vz: 0 });
    Object.assign(blue(w), { x: 1.4, z: 20, vx: -2, vz: 0 });
  });
  assert.deepEqual(
    plan(
      [],
      (w) => {
        red(w).vx = -3;
        blue(w).vx = 5;
      },
      headOn,
    ),
    ['stampede.cart_crash', 'speech.crash'],
  );
  const toRack = later(base, (w) =>
    Object.assign(red(w), { x: -16, z: -12, vx: -8, vz: 0 }),
  );
  assert.deepEqual(
    plan([], (w) => (red(w).vx = 2), toRack),
    ['cart.hit_shelf', 'speech.crash'],
  );
  const openFloor = later(base, (w) =>
    Object.assign(red(w), { x: -4.5, z: 0, vx: -8, vz: 0 }),
  );
  assert.deepEqual(
    plan([], (w) => (red(w).vx = 2), openFloor),
    [],
    'no obstacle, no impact',
  );
  assert.deepEqual(
    plan([], (w) => (red(w).driftSlip = 2)),
    ['cart.skid'],
  );
  const speeding = later(base, (w) =>
    Object.assign(red(w), { x: -3, z: 5, vx: 7, vz: 0 }),
  );
  assert.deepEqual(
    plan(
      [],
      (w) => {
        Object.assign(red(w), { x: 0, z: 5 });
        Object.assign(w.npcShoppers[0], { x: 0.6, z: 5.4 });
      },
      speeding,
    ),
    ['cart.near_miss'],
  );

  // The clock.
  const at = (seconds: number) =>
    later(base, (w) => (w.timeRemaining = seconds));
  const tick = (from: number, to: number) =>
    plan([], (w) => (w.timeRemaining = to), at(from));
  assert.deepEqual(tick(90.1, 89.9), ['speech.midround']);
  assert.deepEqual(tick(60.1, 59.9), [
    'speech.one_minute',
    'event.closing_chime',
  ]);
  assert.deepEqual(tick(10.1, 9.9), ['speech.ten_seconds', 'event.countdown']);
  assert.deepEqual(tick(5.1, 4.9), ['event.countdown']);
  assert.deepEqual(tick(4.9, 4.8), []);
  const finish = (redScore: number, blueScore: number) =>
    plan(
      [],
      (w) => {
        w.status = 'finished';
        w.timeRemaining = 0;
        w.teamScores.red = redScore;
        w.teamScores.blue = blueScore;
      },
      at(0.01),
    );
  assert.deepEqual(finish(900, 300), ['speech.win', 'event.time_up']);
  assert.deepEqual(finish(300, 900), ['speech.fail', 'event.time_up']);
  assert.deepEqual(finish(0, 0), ['speech.fail', 'event.time_up']);

  // Music follows the round and plays the result once.
  const status = (
    value: SampleStampedeWorld['status'],
    edit: (world: SampleStampedeWorld) => void = () => {},
  ) =>
    later(base, (w) => {
      w.status = value;
      edit(w);
    });
  const won = status('finished', (w) => (w.teamScores.red = 900));
  const lost = status('finished', (w) => (w.teamScores.blue = 900));
  const music: [SampleStampedeSnapshot, number, string][] = [
    [status('warmup'), 0, 'music.menu'],
    [base, 0, 'stampede.store_muzak'],
    [at(25), 0, 'music.tension'],
    [won, 100, 'music.win'],
    [lost, 100, 'music.fail'],
    [won, STINGER_MS + 1, 'music.menu'],
  ];
  for (const [snapshot, since, id] of music) {
    assert.equal(stampedeMusic(snapshot, since), id);
    note(id);
  }

  // Beds mixed by state: all five alive while you shop.
  const shopping = later(base, (w) => {
    Object.assign(red(w), {
      x: -10,
      z: 8,
      vx: 6,
      vz: 0,
      wobbleIntensity: 0.9,
    });
    w.kiosks[0].active = true;
  });
  const beds = stampedeAmbience(shopping);
  for (const [channel, id] of Object.entries(BED_CUES)) {
    assert.ok(beds[channel as keyof typeof BED_CUES] > 0, channel);
    note(id);
  }
  const parked = stampedeAmbience(base);
  assert.equal(parked.roll, 0);
  assert.equal(parked.squeak, 0);
  assert.ok(
    stampedeAmbience(at(20)).shoppers > stampedeAmbience(base).shoppers,
    'the crowd swells for closing time',
  );
  const closed = stampedeAmbience(won);
  assert.equal(closed.roll + closed.squeak + closed.checkout, 0);

  // Running drivers and shoppers.
  let memory: StrideMemory = new Map();
  let moving = base;
  let steps = 0;
  for (let frame = 0; frame < 60; frame++) {
    moving = later(moving, (w) => (red(w).x += 0.1));
    const result = stampedeFootsteps(memory, moving);
    memory = result.memory;
    steps += hear(result.cues).length;
  }
  assert.ok(steps >= 2 && steps <= 6, `${steps} steps`);

  // Every cue the game can ask for is in the catalog, and every catalog cue is
  // asked for. The toolbar's button click is played by SiteAudio itself.
  const asked = new Set([...heard.keys(), 'event.ui']);
  assert.deepEqual([...asked].sort(), [...catalogBases].sort());
  for (const [id, cues] of heard)
    if (catalogIds.has(`${id}.2`))
      assert.ok(
        cues.every((cue) => cue.variant),
        `${id} has takes, so it plays as a variant`,
      );
});

void test('commentary speaks one line at a time and spaces out incidental lines', () => {
  const line = (ids: string[], now: number, last: number) =>
    pickLine(
      ids.map((id) => ({ id })),
      now,
      last,
    );
  assert.equal(line(['event.countdown'], 0, -Infinity), null);
  assert.deepEqual(line(['speech.slip', 'speech.win'], 0, -Infinity), {
    id: 'speech.win',
    urgent: true,
  });
  assert.equal(line(['speech.slip'], SPEECH_GAP_MS - 1, 0), null);
  assert.deepEqual(line(['speech.slip'], SPEECH_GAP_MS, 0), {
    id: 'speech.slip',
    urgent: false,
  });
  assert.deepEqual(line(['speech.ten_seconds'], 1, 0), {
    id: 'speech.ten_seconds',
    urgent: true,
  });
  const spoken = new Map([['speech.slip', 0]]);
  assert.equal(
    pickLine([{ id: 'speech.slip' }], LINE_REPEAT_MS - 1, -Infinity, spoken),
    null,
    'the same quip is not repeated soon',
  );
  assert.deepEqual(
    pickLine(
      [{ id: 'speech.slip' }, { id: 'speech.crash' }],
      LINE_REPEAT_MS - 1,
      -Infinity,
      spoken,
    ),
    { id: 'speech.crash', urgent: false },
  );
  assert.deepEqual(
    pickLine([{ id: 'speech.win' }], 1, 0, new Map([['speech.win', 0]])),
    { id: 'speech.win', urgent: true },
  );
  for (const id of URGENT_LINES)
    assert.ok((LINE_PRIORITY as readonly string[]).includes(id), id);
});

void test('a sustained slide or scrape is spaced out per cart', () => {
  const skid = (sourceId: string) => ({
    id: 'cart.skid',
    sourceId,
    variant: true,
  });
  let last: ReadonlyMap<string, number> = new Map();
  const heard: string[] = [];
  for (let now = 0; now < 3000; now += 16) {
    const spaced = spaceCues(
      [skid('cart-red'), skid('cart-blue'), { id: 'grabber.swing' }],
      now,
      last,
    );
    last = spaced.last;
    heard.push(...spaced.cues.map((cue) => `${cue.id}:${cue.sourceId ?? ''}`));
  }
  const count = (key: string) => heard.filter((id) => id === key).length;
  const expected = Math.ceil(3000 / CUE_SPACING_MS['cart.skid']);
  assert.equal(count('cart.skid:cart-red'), expected);
  assert.equal(count('cart.skid:cart-blue'), expected);
  assert.equal(count('grabber.swing:'), Math.ceil(3000 / 16));
  for (const id of Object.keys(CUE_SPACING_MS))
    assert.ok(catalogIds.has(id), id);
});

void test('history never replays: late joins, restarts, room changes and clock gaps are silent', () => {
  const world = round();
  world.clock += 30_000;
  world.timeRemaining -= 30;
  const before = snap(world);
  const replay = [event('plate_slip', red(world), { team: 'red' })];
  const next = later(before);
  assert.deepEqual(stampedeAudioEvents(null, next, replay), []);
  assert.deepEqual(
    stampedeAudioEvents(before, { ...next, code: 'ROOM2' }, replay),
    [],
  );
  assert.deepEqual(
    stampedeAudioEvents(
      before,
      later(before, () => {}, 3000),
      replay,
    ),
    [],
  );
  const reset = later(before, (w) => (w.timeRemaining = w.matchDuration));
  assert.deepEqual(
    stampedeAudioEvents(before, reset, replay).map((cue) => cue.id),
    ['event.round_start', 'speech.start', 'stampede.sample_bell'],
  );
});

function stubBrowser(cues: AudioManifest['cues']) {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues });
  return () => {
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  };
}
const everything = Object.fromEntries(
  catalog.map((cue) => [
    cue.id,
    {
      url: `/test/${cue.id}.mp3`,
      volume: cue.volume,
      loop: cue.loop,
      category: cue.category,
    },
  ]),
);

void test('the game plays each new event once, resets on a new round and follows the score', async () => {
  const restore = stubBrowser(everything);
  const audio = new SampleStampedeSound();
  const played: string[] = [];
  const loops = new Map<string, string | null>();
  audio.play = (id) => void played.push(id);
  audio.variant = (id) => void played.push(id);
  audio.setLoop = (channel, id) => void loops.set(channel, id);
  try {
    await audio.refresh();
    const first = snap(round());
    audio.update(first, [], 0);
    assert.deepEqual(played, [
      'event.round_start',
      'speech.start',
      'stampede.sample_bell',
    ]);
    assert.equal(loops.get('music'), 'stampede.store_muzak');
    assert.equal(loops.get('squeak'), 'stampede.squeaky_wheel');
    assert.equal(loops.get('warehouse'), 'ambience.warehouse');

    played.length = 0;
    const slip = event('plate_slip', red(first.world), { team: 'red' });
    const second = later(first);
    audio.update(second, [slip], SPEECH_GAP_MS + 1);
    assert.deepEqual(played, ['stampede.plate_slip', 'speech.slip']);

    played.length = 0;
    const third = later(second);
    third.world.events = [slip];
    audio.update(third, [slip], 2 * SPEECH_GAP_MS);
    assert.deepEqual(played, [], 'an event already heard stays quiet');
    audio.update(
      later(first, () => {}, 8),
      [event('sugar_rush', red(first.world), { team: 'red' })],
      3 * SPEECH_GAP_MS,
    );
    assert.deepEqual(played, [], 'a late packet is ignored');

    const restart = snap(round(first.world.started + 60_000));
    restart.world.events = [slip];
    audio.update(restart, [], 4 * SPEECH_GAP_MS);
    assert.deepEqual(played, [
      'event.round_start',
      'speech.start',
      'stampede.sample_bell',
    ]);

    played.length = 0;
    const ended = later(restart, (w) => {
      w.status = 'finished';
      w.teamScores.red = 800;
    });
    audio.update(ended, [], 5 * SPEECH_GAP_MS);
    assert.deepEqual(played, ['speech.win', 'event.time_up']);
    assert.equal(loops.get('music'), 'music.win');
    assert.equal(loops.get('roll'), null);
    audio.update(ended, [], 5 * SPEECH_GAP_MS + STINGER_MS + 1);
    assert.equal(loops.get('music'), 'music.menu');

    audio.setMuted(true);
    assert.equal(audio.enabled, false);
  } finally {
    audio.dispose();
    restore();
  }
});

void test('synthesized stand-ins play only for cues without a recording, and the muzak stops once a score exists', async () => {
  for (const recorded of [false, true]) {
    const restore = stubBrowser(
      recorded
        ? {
            'stampede.plate_slip': everything['stampede.plate_slip'],
            'music.menu': everything['music.menu'],
          }
        : {},
    );
    const audio = new SampleStampedeSound();
    const synth = (audio as unknown as { synth: StampedeSynth }).synth;
    const recordings: string[] = [],
      stand: string[] = [],
      muzak: boolean[] = [];
    audio.play = (id) => void recordings.push(id);
    audio.variant = (id) => void recordings.push(id);
    synth.play = (id) => {
      stand.push(id);
      return true;
    };
    synth.setMuzak = (on) => void muzak.push(on);
    try {
      await audio.refresh();
      const first = snap(round());
      audio.update(first, [], 0);
      audio.update(
        later(first),
        [event('plate_slip', red(first.world), { team: 'red' })],
        SPEECH_GAP_MS + 1,
      );
      assert.equal(recordings.includes('stampede.plate_slip'), recorded);
      assert.equal(stand.includes('stampede.plate_slip'), !recorded);
      assert.equal(muzak[muzak.length - 1], !recorded);
    } finally {
      audio.dispose();
      restore();
    }
  }
});

void test('a simulated derby with bots only asks for catalog cues', () => {
  const world = round();
  for (const player of world.players) player.bot = true;
  const physics = new SampleStampedePhysics(world);
  let before: SampleStampedeSnapshot | null = null;
  let memory: StrideMemory = new Map();
  const asked = new Set<string>();
  const frame = () => {
    const events: StampedeEvent[] = [];
    advanceSampleStampedeWorld(world, physics, 1 / 60, events);
    const next = snap(world);
    for (const cue of stampedeAudioEvents(before, next, events))
      asked.add(cue.id);
    const steps = stampedeFootsteps(memory, next);
    memory = steps.memory;
    for (const cue of steps.cues) asked.add(cue.id);
    asked.add(stampedeMusic(next));
    before = next;
  };
  try {
    for (let i = 0; i < 60 * 45; i++) frame();
    world.timeRemaining = 11;
    for (let i = 0; i < 60 * 12 && world.status === 'active'; i++) frame();
  } finally {
    physics.destroy();
  }
  for (const id of asked) assert.ok(catalogBases.has(id), id);
  for (const id of [
    'step.concrete',
    'stampede.sample_bell',
    'event.countdown',
    'speech.ten_seconds',
    'event.time_up',
    'stampede.store_muzak',
    'music.tension',
  ])
    assert.ok(asked.has(id), id);
  assert.ok(asked.has('speech.win') || asked.has('speech.fail'));
});
