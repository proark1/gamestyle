import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import {
  scaffoldAudioEvents,
  scaffoldLoops,
  scaffoldMusic,
  type ScaffoldCue,
} from './audio-events';
import { ScaffoldScrambleSound, scaffoldScrambleCatalog } from './audio';
import { scaffoldScrambleAudioProfile } from './audio/profile';
import { SCAFFOLD_SYNTH } from './audio/synth';
import {
  advanceScaffoldScramble,
  freshScaffoldWorld,
  newPlayer,
  scaffoldScrambleAction,
} from './simulation';
import {
  TARGET_CLEANED_WINDOWS,
  type GameEvent,
  type ScaffoldScrambleWorld,
} from './types';

type World = ScaffoldScrambleWorld;
const game = 'scaffold-scramble';
const clone = (world: World) => structuredClone(world);
const take = /\.[23]$/;

function lobby(): World {
  const world = freshScaffoldWorld(1_000_000, 7);
  world.players = [
    newPlayer('me', 'Me', 0, 'cleaner', false, 0),
    newPlayer('left', 'Lefty', 1, 'left-winch', true, 1),
    newPlayer('right', 'Righty', 2, 'right-winch', true, 2),
    newPlayer('extra', 'Extra', 3, 'all-rounder', true, 3),
  ];
  return world;
}

function playing(): World {
  const world = lobby();
  scaffoldScrambleAction(world, 'me', { type: 'start' });
  world.clock = world.started;
  return world;
}

/** The next frame, 16 ms later, optionally with one new simulation event. */
function frame(
  before: World,
  change: (world: World) => void = () => {},
  event?: Omit<GameEvent, 'id'>,
): World {
  const next = clone(before);
  next.clock += 16;
  change(next);
  if (event) {
    const last = next.events.length
      ? next.events[next.events.length - 1].id
      : 0;
    next.events.push({ ...event, id: last + 1 });
  }
  return next;
}

/** Runs one simulation step on a copy. */
function advanced(before: World, prepare: (world: World) => void = () => {}) {
  const next = clone(before);
  prepare(next);
  advanceScaffoldScramble(next, next.clock + 16, 0.016);
  return next;
}

const heard = new Set<string>();
const variants = new Set<string>();
function hear(before: World | null, after: World, local = 'me') {
  const cues: ScaffoldCue[] = scaffoldAudioEvents(before, after, local);
  for (const cue of cues) {
    heard.add(cue.id);
    if (cue.variant) variants.add(cue.id);
  }
  return cues.map((cue) => cue.id);
}

function alignWithDirtyWindow(world: World) {
  const target = world.windows.find((w) => w.status === 'dirty')!;
  world.cradle.leftHeight = world.cradle.rightHeight = target.y - 1;
  world.cradle.centerHeight = target.y - 1;
  world.cradle.tiltDeg = world.cradle.tiltRad = 0;
  world.players[0].deckX = target.x;
  return target;
}

void test('Scaffold Scramble catalog is unique, valid for generation and has the full score and narrator', () => {
  const cues = getCatalog(game);
  assert.equal(cues, scaffoldScrambleCatalog);
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
  for (const cue of cues) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
    if (cue.category === 'ambience' || cue.category === 'music')
      assert.ok(cue.duration >= 3);
    else if (cue.category !== 'speech')
      assert.ok(cue.duration <= 5, `${cue.id} is a short one-shot`);
  }
  const count = (category: string) =>
    cues.filter((c) => c.category === category).length;
  assert.ok(count('speech') >= 10);
  assert.equal(count('music'), 5);
  assert.ok(count('ambience') >= 3);
  for (const id of [
    'music.menu',
    'music.play',
    'music.tension',
    'music.win',
    'music.fail',
  ])
    assert.ok(cues.some((c) => c.id === id));
  for (const cue of cues.filter((c) => c.category === 'music'))
    assert.equal(cue.loop, !['music.win', 'music.fail'].includes(cue.id));
  for (const cue of cues.filter((c) => c.category === 'speech')) {
    assert.equal(cue.group, 'Chaos Commentator');
    assert.ok(cue.text.split(/\s+/).length <= 15, cue.text);
  }
  // Every id the game shipped before this library still exists.
  for (const id of [
    'event.start',
    'crank.ratchet',
    'squeegee.wipe',
    'soap.foam',
    'window.clean',
    'bucket.slide',
    'bucket.spill',
    'hazard.slip',
    'hazard.dangle',
    'hazard.wind',
    'hazard.pigeon',
    'hazard.tilt_warning',
    'event.win',
    'event.fail',
    'ambience.sky',
    'ambience.helicopter',
  ])
    assert.ok(
      cues.some((c) => c.id === id),
      id,
    );
});

void test('the profile plays Admin recordings only, with takes, crossfades and pitch spread', () => {
  const profile = scaffoldScrambleAudioProfile;
  assert.equal(profile.prepareManifest, undefined);
  assert.equal(profile.availableVariants, true);
  assert.equal(profile.crossfadeMusic, true);
  for (let i = 0; i < 20; i++) {
    const rate = profile.playbackRate!('crank.ratchet.2');
    assert.ok(rate >= 0.94 && rate <= 1.06);
  }
  assert.equal(profile.playbackRate!('music.play'), 1);
  assert.equal(profile.playbackRate!('speech.start'), 1);
  const ids = new Set(scaffoldScrambleCatalog.map((c) => c.id));
  for (const [id] of Object.entries(SCAFFOLD_SYNTH)) {
    assert.ok(ids.has(id), `${id} stand-in has no catalog cue`);
    assert.ok(!/^(speech|music|ambience)\./.test(id));
  }
});

void test('every catalog cue is reachable from the game and the planner names nothing else', () => {
  // Round start, including a restart from the result screen.
  const start = playing();
  assert.deepEqual(hear(null, start), ['speech.start', 'event.start']);
  assert.deepEqual(hear(lobby(), start), ['speech.start', 'event.start']);

  // Boots on dry and soapy steel.
  const walked = frame(start, (w) => (w.players[0].deckX += 0.7));
  assert.ok(hear(start, walked).includes('step.deck'));
  const soapy = frame(start, (w) => {
    w.players[0].deckX += 0.7;
    w.cradle.deckSuds = 1;
  });
  assert.ok(hear(start, soapy).includes('step.suds'));
  const quietOthers = scaffoldAudioEvents(
    start,
    frame(start, (w) => (w.players[1].deckX += 0.7)),
    'me',
  );
  assert.equal(quietOthers[0].strength, 0.3);

  // Winding the cable up clicks the ratchet; paying it out releases the brake.
  const cranked = clone(start);
  scaffoldScrambleAction(cranked, 'left', {
    type: 'crank',
    winch: 'left',
    dir: 'up',
  });
  assert.ok(hear(start, cranked).includes('crank.ratchet'));
  const lowered = clone(start);
  scaffoldScrambleAction(lowered, 'right', {
    type: 'crank',
    winch: 'right',
    dir: 'down',
  });
  assert.ok(hear(start, lowered).includes('crank.lower'));

  // The real simulation: a tilt warning, then a lurch that knocks the crew over.
  const warned = advanced(start, (w) => (w.cradle.rightHeight = 53.5));
  const warning = hear(start, warned);
  assert.ok(warning.includes('hazard.tilt_warning'));
  assert.ok(warning.includes('speech.tilt'));
  assert.ok(!warning.includes('hazard.slip'));
  const lurched = advanced(warned, (w) => (w.cradle.rightHeight = 54.8));
  const lurch = hear(warned, lurched);
  assert.ok(lurch.includes('cradle.lurch'));
  assert.ok(lurch.includes('hazard.slip'));

  // Buckets slide on the slope, knock the rail, spill and come back.
  let sliding = lurched;
  let slid = false;
  for (let i = 0; i < 120 && !slid; i++) {
    const next = advanced(sliding);
    slid = hear(sliding, next).includes('bucket.slide');
    sliding = next;
  }
  assert.ok(slid);
  const railBound = frame(start, (w) => {
    w.buckets[0].x = -4.3;
    w.buckets[0].vx = -1.6;
  });
  assert.ok(
    hear(
      railBound,
      frame(railBound, (w) => {
        w.buckets[0].x = -4.4;
        w.buckets[0].vx = 0.4;
      }),
    ).includes('bucket.bump'),
  );
  const spilled = frame(start, (w) => (w.buckets[0].spilled = true), {
    type: 'bucket_spill',
  });
  assert.deepEqual(hear(start, spilled), ['bucket.spill', 'speech.spill']);
  assert.deepEqual(
    hear(
      spilled,
      frame(spilled, (w) => (w.buckets[0].spilled = false)),
    ),
    ['bucket.refill'],
  );
  assert.deepEqual(
    hear(
      start,
      frame(start, () => {}, {
        type: 'slip',
        playerId: 'me',
        detail: 'Me got knocked over by a sliding soap bucket!',
      }),
    ),
    ['bucket.bonk', 'hazard.slip'],
  );

  // Over the edge, hauled back aboard, and back on their feet after a slide.
  assert.deepEqual(
    hear(
      start,
      frame(start, () => {}, { type: 'dangle', playerId: 'me' }),
    ),
    ['hazard.dangle', 'speech.dangle'],
  );
  assert.deepEqual(
    hear(
      start,
      frame(start, () => {}, { type: 'climb_up', playerId: 'me' }),
    ),
    ['crew.climbed'],
  );
  const slipping = frame(start, (w) => (w.players[2].state = 'sliding'));
  assert.deepEqual(
    hear(
      slipping,
      frame(slipping, (w) => (w.players[2].state = 'standing')),
    ),
    ['crew.recover'],
  );

  // Swapping tools both ways.
  const swapped = clone(start);
  scaffoldScrambleAction(swapped, 'me', { type: 'switchTool' });
  assert.deepEqual(hear(start, swapped), [`tool.${swapped.players[0].tool}`]);
  const back = clone(swapped);
  scaffoldScrambleAction(back, 'me', { type: 'switchTool' });
  assert.deepEqual(hear(swapped, back), [`tool.${back.players[0].tool}`]);

  // Soap, squeegee and the first spotless window, through the simulation.
  const ready = clone(start);
  alignWithDirtyWindow(ready);
  ready.players[0].tool = 'sponge';
  ready.players[0].input.action = true;
  const foamed = advanced(ready);
  assert.deepEqual(hear(ready, foamed), ['soap.foam']);
  const wiping = clone(foamed);
  wiping.players[0].tool = 'squeegee';
  wiping.players[0].state = 'standing';
  const wiped = advanced(wiping);
  assert.deepEqual(hear(wiping, wiped), [
    'squeegee.wipe',
    'window.clean',
    'speech.first-clean',
  ]);
  const fourDone = frame(start, (w) => (w.cleanedCount = 4));
  assert.deepEqual(
    hear(
      fourDone,
      frame(fourDone, (w) => (w.cleanedCount = 5)),
    ),
    ['event.milestone'],
  );
  const almost = frame(start, (w) => (w.cleanedCount = 24));
  assert.deepEqual(
    hear(
      almost,
      frame(almost, (w) => (w.cleanedCount = 25)),
    ),
    ['speech.almost', 'event.milestone'],
  );

  // Pigeons land, coo while they jam the winch, and leave shooed or bored.
  const landed = frame(start, (w) => (w.pigeons[0].perched = true), {
    type: 'pigeon_land',
  });
  assert.deepEqual(hear(start, landed), ['pigeon.land', 'speech.pigeon']);
  const perched = frame(landed, (w) => (w.pigeons[0].flapTimer = 4.99));
  assert.deepEqual(
    hear(
      perched,
      frame(perched, (w) => (w.pigeons[0].flapTimer = 5.01)),
    ),
    ['pigeon.coo'],
  );
  const shooed = frame(landed, (w) => (w.pigeons[0].perched = false), {
    type: 'pigeon_shoo',
    playerId: 'me',
  });
  assert.deepEqual(hear(landed, shooed), ['hazard.pigeon']);
  const bored = frame(landed, (w) => (w.pigeons[0].perched = false), {
    type: 'pigeon_shoo',
  });
  assert.deepEqual(hear(landed, bored), ['pigeon.flyoff']);

  // A gust; only a strong one gets a comment.
  const gust = (strength: number) =>
    hear(
      start,
      frame(start, (w) => Object.assign(w.wind, { active: true, strength }), {
        type: 'wind_gust',
      }),
    );
  assert.deepEqual(gust(-0.9), ['hazard.wind']);
  assert.deepEqual(gust(1.3), ['hazard.wind', 'speech.wind']);

  // The clock: halfway, the minute warning with the helicopter, the final ten.
  const at = (left: number) => frame(start, (w) => (w.clock = w.endsAt - left));
  assert.deepEqual(hear(at(75_001), at(74_999)), ['speech.halfway']);
  assert.deepEqual(hear(at(60_001), at(59_999)), [
    'speech.minute',
    'helicopter.flyby',
  ]);
  assert.deepEqual(hear(at(10_001), at(9_999)), ['speech.ten', 'event.tick']);
  assert.deepEqual(hear(at(5_001), at(4_999)), ['event.tick']);
  assert.deepEqual(hear(at(5_500), at(5_200)), []);

  // Both endings, through the simulation.
  const last = clone(start);
  last.cleanedCount = TARGET_CLEANED_WINDOWS - 1;
  alignWithDirtyWindow(last).status = 'foamed';
  last.players[0].tool = 'squeegee';
  last.players[0].input.action = true;
  const won = advanced(last);
  assert.equal(won.phase, 'ended');
  const winning = hear(last, won);
  for (const id of ['squeegee.wipe', 'window.clean', 'speech.win', 'event.win'])
    assert.ok(winning.includes(id), id);
  assert.ok(!winning.includes('event.milestone'));
  const late = frame(start, (w) => (w.clock = w.endsAt - 5));
  const failed = advanced(late);
  assert.equal(failed.winner, 'failed');
  assert.deepEqual(hear(late, failed), [
    'speech.fail',
    'event.fail',
    'helicopter.land',
  ]);

  // Music through every phase, and the layered beds.
  const music = [
    scaffoldMusic(null),
    scaffoldMusic(lobby()),
    scaffoldMusic(start),
    scaffoldMusic(at(20_000)),
    scaffoldMusic(won),
    scaffoldMusic(failed),
  ];
  assert.deepEqual(music, [
    'music.menu',
    'music.menu',
    'music.play',
    'music.tension',
    'music.win',
    'music.fail',
  ]);
  for (const id of music) heard.add(id);
  const cranking = frame(start, (w) => (w.players[1].input.crankLeftUp = true));
  for (const world of [null, lobby(), start, cranking, won, failed])
    for (const loop of scaffoldLoops(world)) if (loop.id) heard.add(loop.id);
  const loops = (world: World) =>
    Object.fromEntries(scaffoldLoops(world).map((l) => [l.channel, l]));
  assert.equal(loops(start).winch.level, 0);
  assert.ok(loops(cranking).winch.level > 0);
  assert.ok(loops(lurched).creak.level > loops(start).creak.level);
  assert.ok(
    loops(advanced(at(5_000))).helicopter.level > loops(start).helicopter.level,
  );
  const high = frame(start, (w) => (w.cradle.centerHeight = 90));
  assert.ok(loops(high).sky.level > loops(start).sky.level);
  assert.ok(loops(high).city.level < loops(start).city.level);
  assert.equal(loops(lobby()).helicopter.id, null);

  // `event.ui` is played by SiteAudio on every button press.
  heard.add('event.ui');
  const catalog = scaffoldScrambleCatalog.map((c) => c.id);
  assert.deepEqual(
    [...heard].sort(),
    [...new Set(catalog.map((id) => id.replace(take, '')))].sort(),
  );
  // Every cue played as a take has its three takes, and nothing else does.
  const withTakes = new Set(
    catalog.filter((id) => take.test(id)).map((id) => id.replace(take, '')),
  );
  assert.deepEqual([...variants].sort(), [...withTakes].sort());
  for (const id of withTakes)
    for (const suffix of ['.2', '.3']) assert.ok(catalog.includes(id + suffix));
});

void test('old events never replay, and a new round or a stalled clock starts clean', () => {
  const start = playing();
  const slipped = frame(start, () => {}, { type: 'slip', playerId: 'me' });
  assert.deepEqual(hear(start, slipped), ['hazard.slip']);
  // The same event log on the following frames, even after pruning, is silent.
  assert.deepEqual(hear(slipped, frame(slipped)), []);
  const pruned = frame(slipped, (w) => (w.events = w.events.slice(-1)));
  assert.deepEqual(hear(slipped, pruned), []);
  assert.deepEqual(hear(slipped, slipped), []);

  // Joining mid-round or after a stall hears nothing from the backlog.
  const midway = frame(slipped, (w) => (w.clock += 30_000));
  assert.deepEqual(hear(null, midway), []);
  const stalled = frame(slipped, (w) => (w.clock += 3000), {
    type: 'dangle',
    playerId: 'me',
  });
  assert.deepEqual(hear(slipped, stalled), []);

  // A restart begins numbering events again from one; they must still play.
  const ended = clone(slipped);
  for (let i = 0; i < 40; i++)
    ended.events.push({ id: 100 + i, type: 'crank', playerId: 'left' });
  ended.phase = 'ended';
  ended.winner = 'failed';
  const restarted = clone(ended);
  scaffoldScrambleAction(restarted, 'me', { type: 'restart' });
  restarted.clock = restarted.started;
  assert.deepEqual(hear(ended, restarted), ['speech.start', 'event.start']);
  assert.deepEqual(
    hear(
      restarted,
      frame(restarted, () => {}, { type: 'slip', playerId: 'me' }),
    ),
    ['hazard.slip'],
  );
});

void test('the sound plays each cue once, follows the round with music and rations the narrator', async (t) => {
  let now = 100_000;
  t.mock.method(performance, 'now', () => now);
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  const everything = Object.fromEntries(
    scaffoldScrambleCatalog.map((c) => [
      c.id,
      {
        url: `/api/audio/${game}/file/${c.id}.mp3`,
        volume: c.volume,
        loop: c.loop,
        category: c.category,
      },
    ]),
  );
  let cues: Record<string, unknown> = {};
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues });
  const audio = new ScaffoldScrambleSound();
  const played: string[] = [];
  const loops = new Map<string, string | null>();
  audio.play = (id) => {
    played.push(id);
  };
  audio.variant = (id) => {
    played.push(id);
  };
  audio.setLoop = (channel, id) => {
    loops.set(channel, id);
  };
  try {
    // Nothing recorded yet: effects fall back to stand-ins, never to recordings.
    await audio.refresh();
    const idle = lobby();
    audio.update(idle, 'me');
    assert.equal(loops.get('music'), null, 'no score until one is recorded');
    assert.equal(loops.get('sky'), 'ambience.sky');
    const start = playing();
    audio.update(start, 'me');
    assert.deepEqual(played, []);

    cues = everything;
    await audio.refresh();
    audio.update(idle, 'me');
    audio.update(start, 'me');
    assert.deepEqual(played, ['speech.start', 'event.start']);
    assert.equal(loops.get('music'), 'music.play');
    assert.equal(loops.get('helicopter'), 'ambience.helicopter');
    played.length = 0;
    audio.update(frame(start), 'me');
    assert.deepEqual(played, []);

    // One incidental line at a time; urgent lines always speak.
    now += 3000;
    const tilted = frame(start, () => {}, { type: 'tilt_warning' });
    audio.update(tilted, 'me');
    assert.deepEqual(played, ['hazard.tilt_warning']);
    played.length = 0;
    now += 5000;
    const dangled = frame(tilted, () => {}, {
      type: 'dangle',
      playerId: 'me',
    });
    audio.update(dangled, 'me');
    now += 16;
    const spilled = frame(dangled, (w) => (w.buckets[0].spilled = true), {
      type: 'bucket_spill',
    });
    audio.update(spilled, 'me');
    assert.deepEqual(played, [
      'speech.dangle',
      'hazard.dangle',
      'bucket.spill',
    ]);
    played.length = 0;

    // A stale frame is ignored rather than replayed.
    audio.update(dangled, 'me');
    audio.update(spilled, 'me');
    assert.deepEqual(played, []);

    // The win is heard once, not again when the phase changes.
    const last = clone(spilled);
    last.cleanedCount = TARGET_CLEANED_WINDOWS - 1;
    alignWithDirtyWindow(last).status = 'foamed';
    last.players[0].tool = 'squeegee';
    last.players[0].input.action = true;
    const won = advanced(last);
    audio.update(last, 'me');
    now += 16;
    audio.update(won, 'me');
    now += 16;
    audio.update(frame(won), 'me');
    assert.equal(played.filter((id) => id === 'event.win').length, 1);
    assert.equal(played.filter((id) => id === 'speech.win').length, 1);
    assert.equal(loops.get('music'), 'music.win');
    assert.equal(loops.get('winch'), null);

    // Play again: a fresh round starts from its own first event.
    played.length = 0;
    const again = clone(won);
    scaffoldScrambleAction(again, 'me', { type: 'restart' });
    again.clock = again.started;
    audio.update(again, 'me');
    audio.update(
      frame(again, () => {}, { type: 'soap_apply', playerId: 'me' }),
      'me',
    );
    assert.deepEqual(played, ['speech.start', 'event.start', 'soap.foam']);
    assert.equal(loops.get('music'), 'music.play');

    audio.setMuted(true);
    assert.equal(audio.enabled, false);
    audio.setMuted(false);
    assert.equal(audio.enabled, true);
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});

void test('a partly recorded score falls back to play for tension and stops for a missing result', async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  globalThis.fetch = async () =>
    Response.json({
      settings: DEFAULT_SETTINGS,
      cues: {
        'music.play': {
          url: `/api/audio/${game}/file/play.mp3`,
          volume: 0.6,
          loop: true,
          category: 'music',
        },
      },
    });
  const audio = new ScaffoldScrambleSound();
  const music: (string | null)[] = [];
  audio.setLoop = (channel, id) => {
    if (channel === 'music') music.push(id);
  };
  try {
    await audio.refresh();
    const start = playing();
    audio.update(start, 'me');
    assert.equal(music.at(-1), 'music.play');
    audio.update(
      frame(start, (w) => (w.clock = w.endsAt - 5_000)),
      'me',
    );
    assert.equal(music.at(-1), 'music.play', 'tension falls back to play');
    audio.update(
      frame(start, (w) => {
        w.clock = w.endsAt - 4_000;
        w.phase = 'ended';
        w.winner = 'failed';
      }),
      'me',
    );
    assert.equal(music.at(-1), null, 'the play score stops for the result');
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});
