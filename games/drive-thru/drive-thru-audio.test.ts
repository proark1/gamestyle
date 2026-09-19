import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import { DEFAULT_SETTINGS, type AudioManifest } from '../../shared/audio/types';
import { driveThruCatalog, DriveThruSound, SPEECH_GAP_MS } from './audio';
import {
  audioCopy,
  driveThruAmbience,
  driveThruAudioEvents,
  driveThruDanger,
  driveThruListener,
  driveThruMusic,
  driveThruResultCues,
  MOMENTS,
  RESULT_MUSIC_MS,
  SPOTS,
  VERDICT_DELAY_MS,
  type DriveThruCue,
} from './audio-events';
import { reconcileDriveThruBots, stepDriveThruBot } from './bots';
import { GRILL_BOUNDS, SPEAKER_POLE_POS, stepCarPhysics } from './physics';
import {
  addDriveThruEvent,
  advanceDriveThruWorld,
  driveThruAction,
  freshDriveThruWorld,
  newDriveThruPlayer,
} from './simulation';
import type { DriveThruAction, DriveThruWorld, RoleId } from './types';

const LOCAL = 'me';
const T0 = 1_700_000_000_000;

/** A shift two seconds in, with the local player in `role` and bots elsewhere. */
function shift(role: RoleId = 'driver'): DriveThruWorld {
  const w = freshDriveThruWorld(T0);
  w.players = [newDriveThruPlayer(LOCAL, 'Me', 0, role)];
  reconcileDriveThruBots(w);
  w.clock = T0 + 2000;
  return w;
}
const advance = (w: DriveThruWorld, seconds = 0.016) =>
  advanceDriveThruWorld(w, seconds, w.clock + seconds * 1000);
const act = (w: DriveThruWorld, action: DriveThruAction) =>
  driveThruAction(w, LOCAL, action);
/** Planner cues for one change of `w`; the clock always moves at least 16 ms. */
function frame(
  w: DriveThruWorld,
  change: (w: DriveThruWorld) => void,
): DriveThruCue[] {
  const before = audioCopy(w);
  const clock = w.clock;
  change(w);
  if (w.clock === clock) w.clock += 16;
  return driveThruAudioEvents(before, w, LOCAL);
}
const ids = (cues: DriveThruCue[]) => cues.map((cue) => cue.id);
const baseId = (id: string) => id.replace(/\.[23]$/, '');
const ORIGINAL_IDS = [
  'event.speaker-crackle',
  'event.car-horn',
  'event.fan-belt',
  'event.toddler-toy',
  'event.grill-sizzle',
  'event.patty-flip',
  'event.shake-vent',
  'event.shake-explode',
  'event.fryer-splash',
  'event.pole-crash',
  'event.windshield-splat',
  'event.grease-fire',
  'event.curb-plop',
  'event.short-stop-reach',
  'event.order-served',
  'speech.welcome',
  'speech.intercom-scramble',
  'speech.fire-alert',
  'speech.order-ready',
  'ambience.drive-thru-lane',
  'ambience.kitchen-chaos',
  'music.drive-thru-rush',
];

void test('Drive-Thru audio catalog is registered, unique, generatable and keeps every original cue', () => {
  const cues = getCatalog('drive-thru');
  assert.equal(cues, driveThruCatalog);
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
  for (const id of ORIGINAL_IDS)
    assert.ok(
      cues.some((c) => c.id === id),
      `${id} was removed`,
    );
  for (const cue of cues) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
    if (cue.category === 'event')
      assert.ok(cue.duration >= 0.5 && cue.duration <= 3, cue.id);
    if (cue.category === 'ambience')
      assert.ok(cue.loop && cue.duration >= 20 && cue.duration <= 28, cue.id);
    if (cue.category === 'speech') {
      assert.equal(cue.group, 'Chaos Commentator');
      assert.ok(cue.text.split(/\s+/).length <= 15, cue.id);
    }
  }
  const count = (category: string) =>
    cues.filter((c) => c.category === category).length;
  assert.ok(count('speech') >= 10);
  assert.ok(count('ambience') >= 3);
  assert.equal(count('music'), 5);
  const music = Object.fromEntries(
    cues.filter((c) => c.category === 'music').map((c) => [c.id, c]),
  );
  for (const id of ['music.menu', 'music.drive-thru-rush', 'music.tension']) {
    assert.equal(music[id]?.loop, true, id);
    assert.ok(music[id].duration >= 45 && music[id].duration <= 60, id);
  }
  for (const id of ['music.win', 'music.fail']) {
    assert.equal(music[id]?.loop, false, id);
    assert.ok(music[id].duration >= 6 && music[id].duration <= 10, id);
  }
  assert.ok(cues.some((c) => c.id === 'event.ui'));
});

void test('every Drive-Thru catalog cue is reachable from the planner, and the planner names only catalog cues', (t) => {
  // The bots and physics roll dice; a fixed sequence keeps the simulated
  // rounds below (which must end in a grease fire) the same on every run.
  let seed = 0x2f6e2b1;
  t.mock.method(Math, 'random', () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  const heard = new Set<string>(['event.ui']); // SiteAudio plays it on every button.
  const hear = (cues: DriveThruCue[]) => {
    for (const cue of cues) heard.add(cue.id);
    return ids(cues);
  };
  const expect = (cues: DriveThruCue[], ...wanted: string[]) => {
    const got = hear(cues);
    for (const id of wanted)
      assert.ok(got.includes(id), `${id} missing from ${got.join(', ')}`);
  };

  // Round start: a fresh round, and the lobby start button.
  expect(
    driveThruAudioEvents(null, freshDriveThruWorld(T0), LOCAL),
    'speech.welcome',
    'event.lane-chime',
    'event.speaker-crackle',
    'event.fryer-splash',
  );
  let w = shift();
  w.phase = 'lobby';
  expect(
    frame(w, (w) => act(w, { type: 'start' })),
    'speech.welcome',
    'event.lane-chime',
  );

  // The ticket clock.
  w = shift();
  w.phaseTimer = 10.01;
  expect(
    frame(w, (w) => advance(w)),
    'speech.ten-seconds',
  );
  w.phaseTimer = 5.005;
  expect(
    frame(w, (w) => advance(w)),
    'event.countdown-tick',
  );
  w.phaseTimer = 0.005;
  expect(
    frame(w, (w) => advance(w)),
    'event.ticket-print',
  );

  // The car at the speaker, on the lane and at the window.
  w = shift();
  w.clock = Math.ceil(w.clock / 3200) * 3200 - 5;
  expect(
    frame(w, (w) => advance(w)),
    'event.speaker-crackle',
  );
  w = shift();
  w.started = w.clock - MOMENTS.idleNudge + 10;
  expect(
    frame(w, (w) => advance(w)),
    'speech.intercom-scramble',
  );
  w = shift();
  w.car.z = 2;
  w.car.x = 0.4;
  w.started = w.clock - MOMENTS.encourage + 10;
  expect(
    frame(w, (w) => (w.clock += 20)),
    'speech.encourage',
  );
  expect(
    frame(shift(), (w) => act(w, { type: 'honk' })),
    'event.car-horn',
  );
  w = shift();
  expect(
    frame(w, (w) => {
      w.players[0].input = { ...w.players[0].input, action1: true };
      w.distractions.screechingBelt = false;
    }),
    'event.engine-rev',
  );
  w = shift();
  expect(
    frame(w, (w) => {
      w.players[0].input = { ...w.players[0].input, action1: true };
    }),
    'event.fan-belt',
  );
  w = shift();
  w.car.speed = 6;
  expect(
    frame(w, (w) => {
      w.players[0].input = { ...w.players[0].input, action2: true };
    }),
    'event.tyre-screech',
  );
  w = shift();
  w.car.x = 1.5;
  w.car.speed = 3;
  expect(
    frame(w, (w) => {
      w.car.x = 1.8;
    }),
    'event.curb-scrape',
  );
  w = shift();
  w.car.x = SPEAKER_POLE_POS.x;
  w.car.z = SPEAKER_POLE_POS.z + 1.7;
  w.car.speed = 3;
  expect(
    frame(w, (w) => stepCarPhysics(w.car, true, false, 0, 0.05)),
    'event.pole-bump',
  );
  w = shift('passenger');
  w.clock = Math.ceil(w.clock / 2600) * 2600 - 5;
  expect(
    frame(w, (w) => (w.clock += 16)),
    'event.toddler-toy',
  );
  expect(
    frame(w, (w) => act(w, { type: 'swatDistraction' })),
    'event.distraction-swat',
  );
  expect(
    frame(w, (w) => act(w, { type: 'toggleWipers' })),
    'event.wiper-sweep',
  );
  w.car.passengerReach = 0.4;
  expect(
    frame(w, (w) => act(w, { type: 'reachTray' })),
    'event.passenger-lean',
  );
  w.car.x = 0.2;
  w.car.z = 0;
  w.car.speed = 0;
  expect(
    frame(w, (w) => advance(w)),
    'event.window-slide',
    'event.short-stop-reach',
    'speech.short-stop',
  );
  w.car.balanceMeter = 0.55;
  expect(
    frame(w, (w) => (w.car.balanceMeter = 0.65)),
    'event.balance-wobble',
  );

  // The grill.
  w = shift('grill');
  const [p1, p2] = w.kitchen.patties;
  w.kitchen.spatulaX = p1.x;
  w.kitchen.spatulaZ = p1.z;
  expect(
    frame(w, (w) => act(w, { type: 'flipPatty' })),
    'event.patty-flip',
  );
  frame(w, (w) => advance(w, 0.1));
  assert.ok(p1.y > GRILL_BOUNDS.y, 'the patty is in the air');
  expect(
    frame(w, (w) => advance(w, 1)),
    'event.patty-land',
  );
  p2.sizzleProgress = 0.399;
  expect(
    frame(w, (w) => advance(w, 0.05)),
    'event.grill-sizzle',
  );
  Object.assign(p1, {
    state: 'cooked',
    sizzleProgress: 1,
    burnProgress: 0.849,
  });
  expect(
    frame(w, (w) => advance(w, 0.05)),
    'event.patty-burnt',
  );
  w.clock = Math.ceil(w.clock / 320) * 320 - 5;
  expect(
    frame(w, (w) => (w.kitchen.spatulaX += 0.05)),
    'event.spatula-scrape',
  );

  // The fryer, the shake machine and the drinks.
  w = shift('grill');
  w.kitchen.fryerTimer = 0.799;
  expect(
    frame(w, (w) => advance(w, 0.1)),
    'speech.fryer-warning',
  );
  expect(
    frame(w, (w) => act(w, { type: 'liftFryer' })),
    'event.fryer-lift',
  );
  w = shift('barista');
  w.kitchen.shakePressure = 60;
  expect(
    frame(w, (w) => act(w, { type: 'ventMilkshake' })),
    'event.shake-vent',
  );
  w.kitchen.shakePressure = 74.99;
  expect(
    frame(w, (w) => advance(w, 0.05)),
    'event.shake-strain',
    'speech.shake-warning',
  );
  expect(
    frame(w, (w) => (w.kitchen.sodasPoured += 1)),
    'event.soda-pour',
  );
  w.kitchen.shakePressure = 99.99;
  expect(
    frame(w, (w) => advance(w, 0.05)),
    'event.shake-explode',
    'event.windshield-splat',
    'speech.shake-explode',
  );

  // Building the order and passing it out.
  w = shift('grill');
  for (const [layer, cue] of [
    ['bottom_bun', 'event.stack-bun'],
    ['patty', 'event.stack-patty'],
    ['cheese', 'event.stack-topping'],
    ['lettuce', 'event.stack-topping'],
    ['top_bun', 'event.burger-wrap'],
  ] as const)
    expect(
      frame(w, (w) => act(w, { type: 'stackIngredient', layer })),
      cue,
    );
  expect(
    frame(w, (w) => act(w, { type: 'pushTray' })),
    'event.tray-slide',
    'speech.order-ready',
  );
  expect(
    frame(w, (w) => (w.kitchen.trayGrabbed = true)),
    'event.tray-grab',
  );

  // Results and disasters.
  const served = shift('passenger');
  Object.assign(served.car, { x: 0.6, z: 0, speed: 0, passengerReach: 0.9 });
  served.kitchen.trayAtWindow = true;
  expect(
    frame(served, (w) => advance(w)),
    'speech.win',
    'event.order-served',
    'event.tray-grab',
  );
  assert.equal(served.phase, 'completed');
  const fire = shift('grill');
  fire.kitchen.fryerTimer = 0.999;
  expect(
    frame(fire, (w) => advance(w, 0.1)),
    'speech.fire-alert',
    'event.grease-fire',
  );
  assert.equal(fire.failState, 'grease_fire');
  const crash = shift();
  Object.assign(crash.car, {
    x: SPEAKER_POLE_POS.x,
    z: SPEAKER_POLE_POS.z + 0.3,
    speed: -2.5,
  });
  expect(
    frame(crash, (w) => {
      stepCarPhysics(w.car, false, true, 0, 0.1);
      advance(w, 0.1);
    }),
    'speech.pole-crash',
    'event.pole-crash',
  );
  assert.equal(crash.failState, 'pole_crash');
  const plop = shift('passenger');
  Object.assign(plop.car, {
    x: 0.6,
    z: 0,
    speed: 0,
    passengerReach: 0.9,
    balanceMeter: 0.9,
  });
  plop.kitchen.trayAtWindow = true;
  expect(
    frame(plop, (w) => advance(w, 0.016)),
    'speech.curb-plop',
    'event.curb-plop',
  );
  assert.equal(plop.failState, 'curb_plop');
  w = shift();
  expect(
    frame(w, (w) => {
      w.failState = 'windshield_splat';
      w.phase = 'meltdown';
    }),
    'event.windshield-splat',
  );
  expect(
    driveThruResultCues(crash, VERDICT_DELAY_MS - 10, VERDICT_DELAY_MS + 10),
    'speech.fail',
  );
  assert.deepEqual(
    driveThruResultCues(served, VERDICT_DELAY_MS - 10, VERDICT_DELAY_MS + 10),
    [],
  );

  // Music follows the phase; ambience layers follow the state.
  const lobby = shift();
  lobby.phase = 'lobby';
  const tense = shift('barista');
  tense.kitchen.shakePressure = 80;
  assert.equal(driveThruDanger(tense), true);
  assert.equal(driveThruDanger(shift()), false);
  for (const [world, endedFor, isTense, music] of [
    [lobby, -1, false, 'music.menu'],
    [shift(), -1, false, 'music.drive-thru-rush'],
    [tense, -1, true, 'music.tension'],
    [served, 0, false, 'music.win'],
    [fire, 0, false, 'music.fail'],
    [crash, RESULT_MUSIC_MS, false, 'music.menu'],
  ] as const) {
    const id = driveThruMusic(world, endedFor, isTense);
    assert.equal(id, music);
    heard.add(id);
  }
  const atSpeaker = shift();
  const burning = shift('grill');
  burning.kitchen.patties[0].state = 'burnt';
  for (const world of [lobby, atSpeaker, burning, served, fire, crash])
    for (const loop of Object.values(driveThruAmbience(world, LOCAL)))
      if (loop) heard.add(loop.id);
  assert.ok(driveThruAmbience(atSpeaker, LOCAL).intercom);
  assert.equal(driveThruAmbience(crash, LOCAL).intercom, null);
  assert.ok(driveThruAmbience(fire, LOCAL).fire);
  assert.equal(driveThruAmbience(shift(), LOCAL).fire, null);

  // Full simulated shifts: bots only (their driver backs up, steers around
  // the speaker pole and gets the order served), and an idle driver whose
  // grill catches fire. Everything they produce must be in the catalog too.
  // Each plays on until its result music has finished, and rolls its own
  // dice: the fire comes 20 to 55 s in, depending on the sequence.
  for (const role of [null, 'driver'] as const) {
    seed = 0x2f6e2b1;
    const sim = freshDriveThruWorld(T0);
    sim.players = role ? [newDriveThruPlayer(LOCAL, 'Me', 0, role)] : [];
    reconcileDriveThruBots(sim);
    let previous = audioCopy(sim);
    let endedAt = -1;
    let endedFor = -1;
    for (let i = 0; i < 60 * 120 && endedFor < RESULT_MUSIC_MS; i++) {
      for (const p of sim.players) if (p.bot) stepDriveThruBot(p, sim, 1 / 60);
      advanceDriveThruWorld(sim, 1 / 60, sim.clock + 1000 / 60);
      const listener = role ? LOCAL : 'bot-driver';
      hear(driveThruAudioEvents(previous, sim, listener));
      const ended = sim.phase === 'completed' || sim.phase === 'meltdown';
      if (ended && endedAt < 0) endedAt = sim.clock;
      const nowEnded = endedAt < 0 ? -1 : sim.clock - endedAt;
      hear(driveThruResultCues(sim, endedFor, nowEnded));
      endedFor = nowEnded;
      heard.add(driveThruMusic(sim, endedFor, driveThruDanger(sim)));
      for (const loop of Object.values(driveThruAmbience(sim, listener)))
        if (loop) heard.add(loop.id);
      previous = audioCopy(sim);
    }
    if (role) {
      assert.equal(sim.failState, 'grease_fire');
      assert.ok(heard.has('speech.fail') && heard.has('music.fail'));
    } else {
      assert.equal(sim.phase, 'completed');
    }
  }

  const catalog = new Set(driveThruCatalog.map((cue) => baseId(cue.id)));
  const unknown = [...heard].filter((id) => !catalog.has(id));
  const unplayed = [...catalog].filter((id) => !heard.has(id));
  assert.deepEqual(unknown, [], 'the planner names cues the catalog lacks');
  assert.deepEqual(unplayed, [], 'catalog cues nothing plays');
});

void test('Drive-Thru audio never replays old events, skips history on a clock jump and restarts with a new round', () => {
  const w = shift();
  const before = audioCopy(w);
  act(w, { type: 'honk' });
  w.clock += 16;
  assert.ok(
    ids(driveThruAudioEvents(before, w, LOCAL)).includes('event.car-horn'),
  );
  // The same events seen again are not new.
  const again = audioCopy(w);
  w.clock += 16;
  assert.ok(
    !ids(driveThruAudioEvents(again, w, LOCAL)).includes('event.car-horn'),
  );
  // A long gap (a hidden tab) or a clock running backwards replays nothing.
  const gap = audioCopy(w);
  addDriveThruEvent(w, 'horn_honked', 'late');
  w.clock += 5000;
  assert.deepEqual(driveThruAudioEvents(gap, w, LOCAL), []);
  const back = audioCopy(w);
  back.clock += 100;
  assert.deepEqual(driveThruAudioEvents(back, w, LOCAL), []);
  // Joining a round already under way is silent; a new round starts afresh.
  assert.deepEqual(driveThruAudioEvents(null, w, LOCAL), []);
  const restarted = freshDriveThruWorld(w.clock + 100);
  restarted.players = w.players;
  assert.deepEqual(ids(driveThruAudioEvents(w, restarted, LOCAL)).slice(0, 2), [
    'speech.welcome',
    'event.lane-chime',
  ]);
  // A button held down re-sends lifts and vents every frame; only the first counts.
  const grill = shift('grill');
  act(grill, { type: 'liftFryer' });
  const held = audioCopy(grill);
  act(grill, { type: 'liftFryer' });
  grill.clock += 16;
  assert.ok(
    !ids(driveThruAudioEvents(held, grill, LOCAL)).includes('event.fryer-lift'),
  );
  grill.kitchen.shakePressure = 2;
  const empty = audioCopy(grill);
  act(grill, { type: 'ventMilkshake' });
  grill.clock += 16;
  assert.ok(
    !ids(driveThruAudioEvents(empty, grill, LOCAL)).includes(
      'event.shake-vent',
    ),
  );
});

void test('Drive-Thru listener sits in the car for the car crew and in the kitchen for the cooks', () => {
  const w = shift();
  assert.deepEqual(driveThruListener(w, LOCAL).position, {
    x: w.car.x,
    y: 1,
    z: w.car.z,
  });
  const cook = driveThruListener(shift('grill'), LOCAL);
  // SiteAudio pans by dx cos(yaw) - dz sin(yaw). The kitchen camera looks
  // down -x, so the fryer (+z) is on the left and the shake machine on the right.
  const pan = (p: { x: number; z: number }) =>
    (p.x - cook.position.x) * Math.cos(cook.yaw) -
    (p.z - cook.position.z) * Math.sin(cook.yaw);
  assert.ok(pan(SPOTS.fryer) < 0);
  assert.ok(pan(SPOTS.shake) > 0);
  // Behind the car, the pickup window (+x) is on the right.
  const car = driveThruListener(w, LOCAL);
  assert.ok(
    (SPOTS.window.x - car.position.x) * Math.cos(car.yaw) -
      (SPOTS.window.z - car.position.z) * Math.sin(car.yaw) >
      0,
  );
});

void test('DriveThruSound plays recordings, holds the opening for the first tap, rate-limits the narrator and follows the round', async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  let published = driveThruCatalog.map((cue) => cue.id);
  globalThis.fetch = async () =>
    Response.json({
      settings: DEFAULT_SETTINGS,
      cues: Object.fromEntries(
        driveThruCatalog
          .filter((cue) => published.includes(cue.id))
          .map((cue) => [
            cue.id,
            {
              url: `/api/audio/drive-thru/file/${cue.id}.mp3`,
              volume: cue.volume,
              loop: cue.loop,
              category: cue.category,
            },
          ]),
      ),
    } satisfies AudioManifest);
  const audio = new DriveThruSound();
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
    await audio.refresh();
    const w = freshDriveThruWorld(T0);
    w.players = [newDriveThruPlayer(LOCAL, 'Me', 0, 'driver')];
    reconcileDriveThruBots(w);
    const tick = (ms = 16) => {
      w.clock += ms;
      audio.update(w, LOCAL);
    };

    // Before the first tap the browser blocks audio: the opening waits.
    audio.update(w, LOCAL);
    assert.equal(played.length, 0);
    assert.equal(loops.get('music'), 'music.drive-thru-rush');
    assert.equal(loops.get('lane'), 'ambience.drive-thru-lane');
    assert.equal(loops.get('engine'), 'ambience.sedan-engine');
    assert.equal(loops.get('intercom'), 'ambience.intercom-static');
    audio.unlock();
    tick(100);
    assert.equal(played.length, 0);
    tick(400);
    assert.ok(played.includes('speech.welcome'));
    assert.ok(played.includes('event.lane-chime'));

    // A horn is played once, never again for the same event.
    played.length = 0;
    act(w, { type: 'honk' });
    tick();
    tick();
    assert.equal(played.filter((id) => id === 'event.car-horn').length, 1);

    // Incidental narration waits its turn; the sound effect still plays.
    played.length = 0;
    act(w, { type: 'pushTray' });
    tick();
    assert.ok(played.includes('event.tray-slide'));
    assert.ok(!played.includes('speech.order-ready'));

    // A stale frame is ignored.
    played.length = 0;
    const stale = audioCopy(w);
    stale.clock -= 1000;
    audio.update(stale, LOCAL);
    assert.equal(played.length, 0);

    // An urgent disaster line cuts in straight away, the fail stinger plays,
    // the verdict follows, then the menu loop under the result screen.
    for (let t = 0; t < SPEECH_GAP_MS; t += 250) tick(250);
    w.kitchen.fryerTimer = 0.999;
    advance(w, 0.1);
    audio.update(w, LOCAL);
    assert.ok(played.includes('speech.fire-alert'));
    assert.ok(played.includes('event.grease-fire'));
    assert.equal(loops.get('music'), 'music.fail');
    assert.equal(loops.get('fire'), 'ambience.grease-fire');
    for (let t = 0; t < RESULT_MUSIC_MS; t += 250) tick(250);
    assert.ok(played.includes('speech.fail'));
    assert.equal(loops.get('music'), 'music.menu');

    // A new shift starts over: the welcome is heard again at once.
    played.length = 0;
    const next = freshDriveThruWorld(w.clock + 50);
    next.players = w.players;
    audio.update(next, LOCAL);
    assert.ok(played.includes('speech.welcome'));
    assert.equal(loops.get('music'), 'music.drive-thru-rush');
    assert.equal(loops.get('fire'), null);

    // Without a recording the synthesized stand-in covers the horn instead;
    // with any published take the recording plays and the synth stays quiet.
    published = ['event.car-horn.2'];
    await audio.refresh();
    played.length = 0;
    const honk = () => {
      act(next, { type: 'honk' });
      next.clock += 500;
      audio.update(next, LOCAL);
    };
    honk();
    assert.deepEqual(played, ['event.car-horn']);
    published = [];
    await audio.refresh();
    played.length = 0;
    honk();
    assert.equal(played.length, 0);
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

void test('DriveThruSound stops the score for a result sting that is not recorded yet', async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  const rush = driveThruCatalog.find(
    (cue) => cue.id === 'music.drive-thru-rush',
  )!;
  globalThis.fetch = async () =>
    Response.json({
      settings: DEFAULT_SETTINGS,
      cues: {
        [rush.id]: {
          url: `/api/audio/drive-thru/file/${rush.id}.mp3`,
          volume: rush.volume,
          loop: rush.loop,
          category: rush.category,
        },
      },
    } satisfies AudioManifest);
  const audio = new DriveThruSound();
  const music: (string | null)[] = [];
  audio.setLoop = (channel, id) => {
    if (channel === 'music') music.push(id);
  };
  try {
    await audio.refresh();
    const w = freshDriveThruWorld(T0);
    w.players = [newDriveThruPlayer(LOCAL, 'Me', 0, 'driver')];
    audio.update(w, LOCAL);
    assert.equal(music.at(-1), 'music.drive-thru-rush');
    w.clock += 16;
    w.phase = 'meltdown';
    audio.update(w, LOCAL);
    assert.equal(
      music.at(-1),
      null,
      'the rush does not play on under the result',
    );
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});
