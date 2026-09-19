import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import {
  CARRY_ON_SYNTH_CUES,
  CarryOnSound,
  carryOnCarnageCatalog,
} from './audio';
import {
  CarryOnCueGate,
  FINAL_CALL_MS,
  ITEM_MATERIAL,
  RESULT_STING_MS,
  carryOnAmbience,
  carryOnAudioEvents,
  carryOnMovement,
  carryOnMusic,
} from './audio-events';
import { SIZER_X, SIZER_Z, STEP, TSA_GATE_X } from './physics';
import {
  advanceCarryOn,
  carryOnAction,
  freshCarryOnWorld,
  newTraveler,
} from './simulation';
import {
  ITEM_CONFIGS,
  ROUND_MS,
  type CarryOnWorld,
  type ItemKind,
} from './types';

const ME = 'me';
const PAL = 'pal';
const take = (id: string) => id.replace(/\.[23]$/, '');
const copy = (world: CarryOnWorld) => structuredClone(world);

function round(now = 10_000) {
  const world = freshCarryOnWorld(now);
  world.players.push(
    newTraveler(ME, 'Me', 0, now),
    newTraveler(PAL, 'Pal', 1, now),
  );
  return world;
}

/** Every cue the planner, the movement helper and the loop helpers produced. */
const heard = new Set<string>();
const note = (cues: readonly AudioEvent[]) => {
  for (const cue of cues) heard.add(cue.id);
  return cues.map((cue) => cue.id);
};
const listen = (world: CarryOnWorld) => {
  heard.add(carryOnMusic(world));
  for (const loop of Object.values(carryOnAmbience(world, ME)))
    if (loop.id) heard.add(loop.id);
};

const ref = { current: 100 };
function step(world: CarryOnWorld, change: () => void) {
  const before = copy(world);
  change();
  const after = copy(world);
  listen(after);
  return note(carryOnAudioEvents(before, after, ME));
}
const act = (
  world: CarryOnWorld,
  action: 'grab' | 'compress' | 'zip' | 'drop',
  who = ME,
) =>
  step(world, () =>
    carryOnAction(world, who, { type: 'interact', action }, ref),
  );
function run(world: CarryOnWorld, seconds: number) {
  const ids: string[] = [];
  for (let t = 0; t < seconds; t += STEP)
    ids.push(...step(world, () => advanceCarryOn(world, STEP, ref)));
  return ids;
}
const player = (world: CarryOnWorld, id = ME) =>
  world.players.find((p) => p.id === id)!;
const place = (world: CarryOnWorld, x: number, z: number, id = ME) =>
  Object.assign(player(world, id), { x, z });
/** One item of a kind, alone at a spot away from the rest of the junk. */
function lone(world: CarryOnWorld, kind: ItemKind) {
  const item = world.items.find((it) => it.kind === kind)!;
  for (const other of world.items)
    if (other !== item) Object.assign(other, { x: -9, z: 4.5 });
  Object.assign(item, { x: 0.3, y: 0.15, z: 0 });
  return item;
}
function packInto(
  world: CarryOnWorld,
  suitcase: number,
  kinds: readonly ItemKind[],
) {
  const sc = world.suitcases[suitcase];
  const used = new Set<string>();
  for (const kind of kinds) {
    const item = world.items.find(
      (it) => it.kind === kind && !it.packedIn && !used.has(it.id),
    )!;
    used.add(item.id);
    item.packedIn = sc.id;
    sc.items.push(item.id);
  }
  return sc;
}

void test('Carry-On Carnage catalog is rich, valid for generation and registered for Admin', () => {
  const cues = carryOnCarnageCatalog;
  assert.equal(getCatalog('carry-on-carnage'), cues);
  assert.equal(new Set(cues.map((cue) => cue.id)).size, cues.length);
  for (const cue of cues) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
    if (cue.category === 'speech') {
      assert.equal(cue.group, 'Chaos Commentator');
      assert.ok(cue.text.split(/\s+/).length <= 15, cue.id);
    } else assert.equal(cue.text, '', `${cue.id} carries junk text`);
    // Each take has its base cue.
    if (take(cue.id) !== cue.id)
      assert.ok(
        cues.some((other) => other.id === take(cue.id)),
        cue.id,
      );
  }
  const count = (category: string) =>
    cues.filter((cue) => cue.category === category).length;
  assert.ok(cues.length >= 50 && cues.length <= 70, `${cues.length} cues`);
  assert.ok(count('speech') >= 10);
  assert.equal(count('music'), 5);
  assert.ok(count('ambience') >= 3);
  for (const id of ['menu', 'play', 'tension', 'win', 'fail'])
    assert.ok(cues.some((cue) => cue.id === `music.${id}`));
  for (const cue of cues)
    if (cue.category === 'ambience' || cue.category === 'music')
      assert.equal(
        cue.loop,
        !['music.win', 'music.fail'].includes(cue.id),
        cue.id,
      );
  // Saved workshop edits survive: the original ids are all still here.
  for (const id of [
    'carryon.airport_chime',
    'carryon.zipper_pull',
    'carryon.compress_groan',
    'carryon.burst_pinata',
    'carryon.tsa_alarm',
    'carryon.sizer_reject',
    'carryon.sizer_pass',
    'carryon.lobster_pinch',
  ])
    assert.ok(
      cues.some((cue) => cue.id === id),
      id,
    );
  // Synthesized stand-ins only exist for cues the workshop can record.
  for (const id of CARRY_ON_SYNTH_CUES)
    assert.ok(
      cues.some((cue) => cue.id === id),
      id,
    );
  for (const kind of Object.keys(ITEM_CONFIGS) as ItemKind[]) {
    assert.ok(cues.some((cue) => cue.id === `item.${kind}.pack`));
    assert.ok(
      cues.some((cue) => cue.id === `item.land.${ITEM_MATERIAL[kind]}`),
    );
  }
});

void test('every catalog cue is played by the game and the game names no other cue', () => {
  // Round start.
  const start = round();
  assert.deepEqual(note(carryOnAudioEvents(null, copy(start), ME)), [
    'carryon.airport_chime',
    'speech.start',
  ]);

  // Grab and pack every item kind: each sounds like itself.
  for (const kind of Object.keys(ITEM_CONFIGS) as ItemKind[]) {
    const world = round();
    place(world, 0, 0);
    lone(world, kind);
    const grab = act(world, 'grab');
    assert.ok(grab.includes('item.grab'), kind);
    assert.equal(grab.includes('carryon.lobster_pinch'), kind === 'lobster');
    place(world, world.suitcases[0].x + 0.6, world.suitcases[0].z);
    assert.deepEqual(act(world, 'grab'), [`item.${kind}.pack`]);
  }

  // Dropped items land by material, once, on the tile floor.
  for (const kind of ['duck', 'shampoo', 'snowglobe'] as const) {
    const world = round();
    place(world, 0, 0);
    const item = lone(world, kind);
    act(world, 'grab');
    item.y = 1;
    act(world, 'drop');
    const landed = run(world, 1.2).filter((id) => id.startsWith('item.land.'));
    assert.deepEqual(landed, [`item.land.${ITEM_MATERIAL[kind]}`], kind);
  }

  // Unpacking an item back out is a grab, not a pack.
  {
    const world = round();
    const sc = packInto(world, 0, ['clothes']);
    place(world, sc.x + 0.6, sc.z);
    const unpacked = act(world, 'grab');
    assert.ok(unpacked.includes('item.grab'));
    assert.ok(!unpacked.some((id) => id.endsWith('.pack')));
  }

  // Sit, zip three times, jam, then burst an overstuffed bag. The nearest bag
  // in reach is the one acted on, so each scene stands right by bag 0.
  {
    const world = round();
    const sc = world.suitcases[0];
    place(world, sc.x + 0.6, sc.z);
    assert.deepEqual(act(world, 'compress'), ['carryon.compress_groan']);
    assert.deepEqual(act(world, 'compress'), []); // hop off again
    assert.deepEqual(act(world, 'zip'), ['carryon.zipper_pull']);
    assert.deepEqual(act(world, 'zip'), ['carryon.zipper_pull']);
    assert.deepEqual(act(world, 'zip'), ['luggage.zip_closed']);
  }
  {
    const world = round();
    const stuffed = packInto(world, 0, ['flamingo', 'racket', 'lobster']);
    place(world, stuffed.x + 0.6, stuffed.z);
    assert.deepEqual(act(world, 'zip'), ['luggage.zip_jam', 'speech.jam']);
    // A bot's jammed zipper across the hall gets the sound, not the hint.
    place(world, 8, 3);
    place(world, stuffed.x + 0.6, stuffed.z, PAL);
    assert.deepEqual(act(world, 'zip', PAL), ['luggage.zip_jam']);

    place(world, 8, 3, PAL);
    const burst = run(world, 2);
    assert.deepEqual(burst.slice(0, 2), [
      'carryon.burst_pinata',
      'speech.burst',
    ]);
    // Everything that flew out comes down again.
    for (const id of ['item.land.soft', 'item.land.hard'])
      assert.ok(burst.includes(id), id);
  }
  {
    const world = round();
    packInto(world, 0, ['flamingo', 'snowglobe', 'shampoo']);
    const burst = run(world, 2);
    assert.ok(burst.includes('carryon.burst_pinata'));
    assert.ok(burst.includes('item.land.glass'));
  }

  // Lift a zipped bag, set it down, then size three bags at the gate.
  {
    const world = round();
    const sc = world.suitcases[0];
    sc.zipped = 1;
    sc.open = false;
    place(world, sc.x + 0.6, sc.z);
    assert.deepEqual(act(world, 'grab'), ['luggage.pickup']);
    assert.deepEqual(act(world, 'drop'), ['luggage.set_down']);

    const size = (index: number, kinds: ItemKind[]) => {
      const bag = packInto(world, index, kinds);
      bag.zipped = 1;
      bag.open = false;
      place(world, bag.x + 0.6, bag.z);
      act(world, 'grab');
      place(world, SIZER_X - 1.2, SIZER_Z);
      const inserted = act(world, 'grab');
      assert.deepEqual(inserted, ['gate.sizer_insert', 'gate.sizer_scan']);
      const verdict = run(world, 1.4);
      world.sizer.insertedSuitcase = null;
      world.sizer.status = 'idle';
      return verdict;
    };
    // Each sized bag stays in the cage, so the next free bag is the next one.
    assert.deepEqual(size(0, []), ['carryon.sizer_pass', 'speech.approved']);
    assert.deepEqual(size(1, ['lobster']), [
      'carryon.sizer_pass',
      'speech.contraband',
    ]);
    assert.deepEqual(size(2, ['flamingo', 'shampoo']), [
      'carryon.sizer_reject',
      'gate.fee',
      'speech.rejected',
    ]);
    // The fourth approval is the big moment, not just another approval.
    world.approvedCount = world.targetBags - 1;
    const target = size(3, []);
    assert.deepEqual(target, [
      'speech.target',
      'gate.cheer',
      'carryon.sizer_pass',
    ]);
  }

  // Security: tin foil sets off the arch, a sneak while distracted, a seizure.
  {
    const world = round();
    player(world).wearingTinFoil = true;
    place(world, TSA_GATE_X, 0);
    assert.deepEqual(run(world, STEP), [
      'carryon.tsa_alarm',
      'speech.tsa-distracted',
    ]);
    place(world, 0, 0);
    lone(world, 'lobster');
    act(world, 'grab');
    place(world, TSA_GATE_X, 0);
    const random = Math.random;
    Math.random = () => 0;
    try {
      assert.deepEqual(run(world, STEP), ['security.sneak']);
    } finally {
      Math.random = random;
    }
    world.tsa.distractedUntil = 0;
    player(world).wearingTinFoil = false;
    assert.deepEqual(run(world, STEP), [
      'security.whistle',
      'speech.tsa-caught',
    ]);
  }

  // The clock: halfway, one minute, final call, the last ten seconds, departure.
  for (const won of [false, true]) {
    const world = round();
    world.approvedCount = won ? world.targetBags : 1;
    const at = (left: number) => {
      world.clock = world.deadline - left - 1;
      return run(world, STEP);
    };
    assert.deepEqual(at(ROUND_MS / 2), [
      'carryon.airport_chime',
      'speech.halfway',
    ]);
    assert.deepEqual(at(60_000), [
      'carryon.airport_chime',
      'speech.one-minute',
    ]);
    assert.deepEqual(at(FINAL_CALL_MS), ['carryon.airport_chime']);
    assert.equal(carryOnMusic(world), 'music.tension');
    world.clock = world.deadline - 10_050;
    const finale = run(world, 10.2);
    assert.equal(finale[0], 'speech.ten-seconds');
    assert.equal(
      finale.filter((id) => id === 'terminal.board_flap').length,
      10,
    );
    assert.equal(world.phase, 'flight_departed');
    assert.ok(finale.includes(won ? 'speech.win' : 'speech.fail'));
    assert.ok(finale.includes('terminal.takeoff'));
    assert.equal(finale.includes('gate.cheer'), won);
    assert.equal(carryOnMusic(world), won ? 'music.win' : 'music.fail');
    world.clock = world.deadline + RESULT_STING_MS;
    listen(world);
    assert.equal(carryOnMusic(world), 'music.menu');
  }
  {
    const lobby = round();
    lobby.phase = 'lobby';
    listen(lobby);
    assert.equal(carryOnMusic(lobby), 'music.menu');
  }

  // Walking on tile, in tin foil shoes, jumping and landing.
  {
    const world = round();
    const footsteps = new Footsteps();
    const walk = (frames: number) => {
      const ids: string[] = [];
      for (let frame = 0; frame < frames; frame++) {
        advanceCarryOn(world, STEP, ref);
        ids.push(...note(carryOnMovement(footsteps, copy(world), ME)));
        player(world).input = { ...player(world).input, jump: false };
      }
      return ids;
    };
    place(world, 0, 0);
    player(world).input = { ...player(world).input, x: 1 };
    assert.ok(walk(40).includes('step.tile'));
    player(world).wearingTinFoil = true;
    const foil = walk(40);
    assert.ok(foil.includes('step.foil') && !foil.includes('step.tile'));
    player(world).input = { ...player(world).input, x: 0, jump: true };
    const hop = walk(60);
    assert.ok(hop.includes('event.jump') && hop.includes('event.land'));
  }

  // Carrying a bag rolls its wheels; a straining bag creaks.
  {
    const world = round();
    const sc = world.suitcases[0];
    sc.zipped = 1;
    place(world, sc.x + 0.6, sc.z);
    act(world, 'grab');
    player(world).input = { ...player(world).input, x: 1 };
    advanceCarryOn(world, STEP, ref);
    assert.ok(carryOnAmbience(world, ME).wheels.level > 0.5);
    const stuffed = packInto(world, 1, ['flamingo', 'lobster']);
    stuffed.strain = 1.5;
    place(world, stuffed.x + 1, stuffed.z);
    const loops = carryOnAmbience(world, ME);
    assert.ok(loops.strain.level > 0.5);
    for (const loop of Object.values(loops)) assert.ok(loop.id);
    listen(world);
  }

  const catalog = new Set(carryOnCarnageCatalog.map((cue) => take(cue.id)));
  // SiteAudio plays the button click on every button press.
  heard.add('event.ui');
  assert.deepEqual(
    [...heard].filter((id) => !catalog.has(id)),
    [],
    'the game names cues the catalog lacks',
  );
  assert.deepEqual(
    [...catalog].filter((id) => !heard.has(id)),
    [],
    'catalog cues the game never plays',
  );
});

void test('old events never replay: same state, late join, clock jump, and a new round resets', () => {
  const world = round();
  place(world, 0, 0);
  lone(world, 'duck');
  act(world, 'grab');
  place(world, world.suitcases[0].x + 0.6, world.suitcases[0].z);
  const before = copy(world);
  carryOnAction(world, ME, { type: 'interact', action: 'grab' }, ref);
  const after = copy(world);
  assert.deepEqual(
    carryOnAudioEvents(before, after, ME).map((cue) => cue.id),
    ['item.duck.pack'],
  );
  // The same snapshot again, or the next frame, does not repeat the pack.
  assert.deepEqual(carryOnAudioEvents(after, after, ME), []);
  advanceCarryOn(world, STEP, ref);
  assert.deepEqual(carryOnAudioEvents(after, copy(world), ME), []);

  // Joining (or reconnecting) mid-round hears nothing from history.
  world.clock += 5_000;
  const late = copy(world);
  assert.deepEqual(carryOnAudioEvents(null, late, ME), []);
  // A clock jump drops whatever happened across it.
  const jumped = copy(late);
  jumped.clock += 3_000;
  jumped.events.push({ id: 9_999, type: 'burst', text: '', pos: [0, 0, 0] });
  jumped.approvedCount = jumped.targetBags;
  assert.deepEqual(carryOnAudioEvents(late, jumped, ME), []);

  // A restart is a new round: its boarding call plays, nothing older does.
  world.phase = 'flight_departed';
  const ended = copy(world);
  world.clock += 1_000;
  carryOnAction(world, ME, { type: 'restart' }, ref);
  assert.deepEqual(
    carryOnAudioEvents(ended, copy(world), ME).map((cue) => cue.id),
    ['carryon.airport_chime', 'speech.start'],
  );
});

void test('the narrator stays sparse, urgent lines interrupt, and repeated effects are throttled', () => {
  const gate = new CarryOnCueGate();
  assert.equal(gate.admit({ id: 'speech.burst' }, 0), 'play');
  assert.equal(gate.admit({ id: 'speech.approved' }, 3_000), null);
  assert.equal(gate.admit({ id: 'speech.ten-seconds' }, 3_500), 'interrupt');
  assert.equal(gate.admit({ id: 'speech.approved' }, 9_000), null);
  assert.equal(gate.admit({ id: 'speech.approved' }, 11_000), 'play');
  // The same line waits longer than a different one.
  assert.equal(gate.admit({ id: 'speech.approved' }, 19_000), null);
  assert.equal(gate.admit({ id: 'speech.rejected' }, 19_000), 'play');

  // Bots jamming a zipper every frame make one jam sound per 1.5 s.
  let jams = 0;
  for (let frame = 0; frame < 174; frame++)
    if (gate.admit({ id: 'luggage.zip_jam' }, 100_000 + (frame * 1_000) / 60))
      jams++;
  assert.equal(jams, 2);
  // Takes share a cooldown; footsteps from different travellers do not clash.
  assert.equal(gate.admit({ id: 'carryon.zipper_pull' }, 200_000), 'play');
  assert.equal(gate.admit({ id: 'carryon.zipper_pull.2' }, 200_050), null);
  for (const sourceId of [ME, PAL])
    assert.equal(gate.admit({ id: 'step.tile', sourceId }, 200_000), 'play');

  gate.reset();
  assert.equal(gate.admit({ id: 'speech.approved' }, 200_001), 'play');
});

void test('with a partly recorded library, missing lines never spend the turn and a missing score stops', async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  const recorded = ['speech.burst', 'music.play'];
  globalThis.fetch = async () =>
    Response.json({
      settings: DEFAULT_SETTINGS,
      cues: Object.fromEntries(
        carryOnCarnageCatalog
          .filter((cue) => recorded.includes(cue.id))
          .map((cue) => [
            cue.id,
            {
              url: `/api/audio/carry-on-carnage/file/${cue.id}.mp3`,
              volume: cue.volume,
              loop: cue.loop,
              category: cue.category,
            },
          ]),
      ),
    });
  const audio = new CarryOnSound();
  const played: string[] = [];
  const music: (string | null)[] = [];
  audio.play = (id) => void played.push(id);
  audio.variant = (id) => void played.push(id);
  audio.setLoop = (channel, id) => {
    if (channel === 'music') music.push(id);
  };
  const cue = (
    audio as unknown as {
      cue: (event: AudioEvent, clock: number) => void;
    }
  ).cue.bind(audio);
  try {
    await audio.refresh();
    // An urgent line with no recording must not silence a recorded one.
    cue({ id: 'speech.ten-seconds' }, 1_000);
    cue({ id: 'speech.burst' }, 1_001);
    assert.deepEqual(played, ['speech.burst']);

    const world = freshCarryOnWorld(1_000_000);
    world.players = [newTraveler('me', 'Me', 0, world.clock)];
    world.phase = 'packing';
    audio.update(structuredClone(world), 'me');
    assert.equal(music.at(-1), 'music.play');
    const late = structuredClone(world);
    late.clock = late.deadline - FINAL_CALL_MS + 1_000;
    audio.update(late, 'me');
    assert.equal(music.at(-1), 'music.play', 'tension falls back to play');
    const departed = structuredClone(late);
    departed.clock = departed.deadline + 100;
    departed.phase = 'flight_departed';
    audio.update(departed, 'me');
    assert.equal(music.at(-1), null, 'no sting recorded: the score stops');
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});
