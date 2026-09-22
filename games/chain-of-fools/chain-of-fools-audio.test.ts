import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../../platform/audio/catalog';
import { parseCue } from '../../platform/audio/service';
import { promptLimit } from '../../shared/audio/limits';
import { generationRequest } from '../../shared/audio/provider';
import { DEFAULT_SETTINGS, type AudioManifest } from '../../shared/audio/types';
import { ChainOfFoolsSound, chainOfFoolsCatalog } from './audio';
import {
  EARSHOT,
  LINE_GAP_MS,
  REPEAT_GAP_MS,
  admitLine,
  chainAmbience,
  chainAudioStep,
  chainMusic,
  chainSurface,
  type ChainAudioFrame,
  type ChainCue,
} from './audio-events';
import { reconcileChainBots, stepChainBot } from './bots';
import { FINISH_X, PENDULUM, pendulumBall } from './course';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  freshChainWorld,
  newPlayer,
} from './simulation';
import {
  CREW_SIZE,
  PLAYER_HEIGHT,
  ROUND_TIME_MS,
  chainOrder,
  type ChainWorld,
  type GameEvent,
} from './types';

const game = 'chain-of-fools';
const LOCAL = 'p0';

function crew(count = CREW_SIZE): ChainWorld {
  const world = freshChainWorld(1_000_000);
  for (let i = 0; i < count; i++)
    world.players.push(newPlayer(`p${i}`, `Worker ${i}`, i, i, false));
  return world;
}

function shift(count = CREW_SIZE): ChainWorld {
  const world = crew(count);
  chainOfFoolsAction(world, LOCAL, { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;
  return world;
}

/** Runs the planner the way the game does: once per simulation tick. */
class Ears {
  frame: ChainAudioFrame | null = null;
  heard: ChainCue[] = [];
  constructor(
    readonly world: ChainWorld,
    readonly local = LOCAL,
  ) {
    this.hear();
  }
  hear() {
    const step = chainAudioStep(this.frame, this.world, this.local);
    this.frame = step.frame;
    this.heard.push(...step.cues);
    return step.cues.map((cue) => cue.id);
  }
  run(seconds: number, step = 1 / 60) {
    const ids: string[] = [];
    for (let i = 0; i < Math.round(seconds / step); i++) {
      for (const player of this.world.players)
        if (player.bot) stepChainBot(player, this.world, step);
      advanceChainOfFools(this.world, this.world.clock + step * 1000, step);
      ids.push(...this.hear());
    }
    return ids;
  }
  /** Fast-forwards the shift clock in one-second hops without moving anyone. */
  wait(seconds: number) {
    const ids: string[] = [];
    for (let i = 0; i < seconds; i++) {
      advanceChainOfFools(this.world, this.world.clock + 1000, 1 / 60);
      ids.push(...this.hear());
    }
    return ids;
  }
  ids() {
    return this.heard.map((cue) => cue.id);
  }
}

const pushEvent = (
  world: ChainWorld,
  type: GameEvent['type'],
  extra: Partial<GameEvent> = {},
) => world.events.push({ id: ++world.eventId, type, ...extra });

/** A single worker standing on a deck, facing along the course. */
function standing(x: number, y: number, z = 0) {
  const world = shift(1);
  Object.assign(world.players[0], { x, y, z, grounded: true, supportY: y });
  return world;
}

const base = (id: string) => id.replace(/\.[23]$/, '');

// ---------------------------------------------------------------- catalog

void test('the workshop catalog is rich, keeps every original cue and fits the provider', () => {
  const cues = getCatalog(game);
  assert.equal(cues, chainOfFoolsCatalog, 'the registry still finds it');
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
  assert.equal(new Set(cues.map((c) => c.prompt + c.text)).size, cues.length);
  for (const cue of cues) {
    assert.ok(
      cue.prompt.length <= promptLimit(cue.category),
      `${cue.id}: ${cue.prompt.length}`,
    );
    assert.deepEqual(parseCue(cue, cue), cue, cue.id);
    assert.ok(
      generationRequest(cue, { ...DEFAULT_SETTINGS, voiceId: 'shared_voice' }),
    );
    if (cue.category === 'speech') {
      assert.equal(cue.group, 'Chaos Commentator');
      assert.ok(cue.text.split(/\s+/).length <= 15, cue.id);
    }
    assert.equal(
      cue.loop,
      cue.category === 'ambience' ||
        (cue.category === 'music' && !/\.(win|fail)$/.test(cue.id)),
      cue.id,
    );
  }
  const count = (category: string) =>
    cues.filter((c) => c.category === category).length;
  assert.ok(count('speech') >= 10 && count('speech') <= 16);
  assert.equal(count('music'), 5);
  assert.ok(count('ambience') >= 3);
  assert.ok(cues.length >= 50 && cues.length <= 70, `${cues.length} cues`);
  for (const id of [
    'music.menu',
    'music.play',
    'music.tension',
    'music.win',
    'music.fail',
    'event.ui',
  ])
    assert.ok(
      cues.some((c) => c.id === id),
      id,
    );
  // Saved workshop edits are keyed by id, so none of the originals may vanish.
  for (const id of [
    'event.start',
    'move.jump',
    'move.land',
    'chain.yank',
    'chain.dangle',
    'chain.haul',
    'chain.saved',
    'chain.clip',
    'hazard.limp',
    'hazard.wrecking',
    'hazard.plank',
    'event.checkpoint',
    'event.wipe',
    'event.ping',
    'event.win',
    'event.fail',
    'ambience.site',
  ])
    assert.ok(
      cues.some((c) => c.id === id),
      `kept ${id}`,
    );
  for (const surface of ['dirt', 'steel', 'timber', 'concrete', 'pipe'])
    for (const id of [
      `step.${surface}`,
      `step.${surface}.2`,
      `step.${surface}.3`,
    ])
      assert.ok(
        cues.some((c) => c.id === id),
        id,
      );
});

void test('every deck on the course has its own footstep', () => {
  assert.equal(chainSurface(2, 0, 0, 0), 'dirt');
  assert.equal(chainSurface(20, 0, 0, 0), 'steel');
  assert.equal(chainSurface(30, -2.4, 0.5, 0), 'steel', 'catwalk grating');
  assert.equal(chainSurface(6.8, 0.9, -2.4, 0), 'timber', 'crate');
  assert.equal(chainSurface(67, 8, 0, 0), 'timber', 'scaffold');
  assert.equal(chainSurface(73, 8, 0, 0), 'timber', 'the plank');
  assert.equal(chainSurface(80, 8, 0, 0), 'concrete', 'wrecking ledge');
  assert.equal(chainSurface(100, 8, 0, 0), 'pipe');
  assert.equal(chainSurface(100, 10.05, 0, 0), 'steel', 'pipe roof');
  assert.equal(chainSurface(125, 0, 0, 0), 'dirt', 'lower pad');
  assert.equal(chainSurface(145, 0, 0, 0), 'concrete', 'office pad');
});

// ---------------------------------------------------------------- scenarios

const scenarios: Record<string, () => string[]> = {
  'the shift starts'() {
    const ears = new Ears(crew());
    chainOfFoolsAction(ears.world, LOCAL, { type: 'start' });
    const ids = ears.hear();
    assert.deepEqual(ids, ['speech.start', 'event.start']);
    return ears.ids();
  },

  'a bot crew works the whole course'() {
    const world = freshChainWorld(1_000_000);
    reconcileChainBots(world);
    chainOfFoolsAction(world, 'bot-1', { type: 'start' });
    for (const player of world.players) player.respawnAt = 0;
    const ears = new Ears(world, 'bot-1');
    ears.run(230);
    assert.equal(world.winner, 'crew');
    const ids = ears.ids();
    for (const id of [
      'move.jump',
      'move.land',
      'step.dirt',
      'step.steel',
      'step.timber',
      'event.checkpoint',
      'event.clockin',
      'hazard.swing',
      'event.win',
      'speech.win',
    ])
      assert.ok(ids.includes(id), `a full run is heard: ${id}`);
    return ids;
  },

  'the shift clock runs out'() {
    const ears = new Ears(shift());
    const ids = ears.wait(ROUND_TIME_MS / 1000 + 1);
    assert.equal(ears.world.winner, 'failed');
    assert.equal(ids.filter((id) => id === 'event.tick').length, 10);
    for (const id of [
      'speech.encourage',
      'speech.minute',
      'speech.ten',
      'event.fail',
      'speech.fail',
    ])
      assert.equal(ids.filter((c) => c === id).length, 1, id);
    return ids;
  },

  'workers call, clip, unclip and grab the hook'() {
    const world = shift();
    const ears = new Ears(world);
    const me = world.players[0];
    chainOfFoolsAction(world, LOCAL, { type: 'ping' });
    const ping = ears.heard.length;
    assert.deepEqual(ears.hear(), ['event.ping']);
    assert.equal(ears.heard[ping].position, undefined, 'your own whistle');

    Object.assign(me, { x: 23.4, y: 0.1, z: 0 });
    chainOfFoolsAction(world, LOCAL, { type: 'clip' });
    assert.ok(ears.hear().includes('chain.clip'));
    chainOfFoolsAction(world, LOCAL, { type: 'clip' });
    assert.ok(ears.hear().includes('chain.unclip'));

    world.pendulumAngle = 0;
    const [bx, by, bz] = pendulumBall(0);
    Object.assign(me, { x: bx, y: by - PLAYER_HEIGHT * 0.6, z: bz });
    chainOfFoolsAction(world, LOCAL, { type: 'clip' });
    const hook = ears.hear();
    assert.ok(hook.includes('hazard.hook') && !hook.includes('chain.clip'));
    return ears.ids();
  },

  'the wrecking load hits someone'() {
    const world = shift();
    const [, target] = world.players;
    world.pendulumAngle = 0;
    world.pendulumVel = 0.6;
    const [bx, by, bz] = pendulumBall(0);
    Object.assign(target, {
      x: bx,
      y: by - PLAYER_HEIGHT * 0.6,
      z: bz,
      grounded: false,
    });
    const ears = new Ears(world);
    const ids = ears.run(1 / 60);
    assert.ok(ids.includes('hazard.wrecking'));
    assert.equal(ids[0], 'speech.wrecking');
    return ears.ids();
  },

  'the plank tips'() {
    const world = shift();
    for (const player of world.players)
      Object.assign(player, { x: 75.6, y: 8, z: 0, grounded: true });
    const ears = new Ears(world);
    const ids = ears.run(3);
    assert.ok(ids.includes('hazard.plank') && ids.includes('speech.plank'));
    return ears.ids();
  },

  'a lone worker is dragged over and the crew wipes'() {
    const world = shift();
    const [a, b, c, d] = chainOrder(world);
    Object.assign(a, { x: 79, y: 8, z: 0, grounded: true });
    for (const [faller, [x, y, z]] of [
      [b, [80, 5, 3.5]],
      [c, [80.5, 3.5, 4.5]],
      [d, [81, 2, 5.5]],
    ] as const)
      Object.assign(faller, { x, y, z, grounded: false, vy: -6 });
    const ears = new Ears(world);
    const ids = ears.run(3);
    for (const id of [
      'chain.dangle',
      'speech.dangle',
      'event.wipe',
      'speech.wipe',
    ])
      assert.ok(ids.includes(id), id);
    return ids;
  },

  'a worker is dragged off their feet'() {
    const world = shift(2);
    const [me, faller] = world.players;
    Object.assign(me, { x: 2, y: 0, z: 0, grounded: true });
    Object.assign(faller, { x: 8.5, y: 0.5, z: 0, grounded: false });
    const ears = new Ears(world);
    const ids = ears.run(1 / 60);
    assert.ok(ids.includes('chain.yank'), ids.join());
    assert.ok(!ids.includes('chain.taut'), 'the yank already says it');
    return ids;
  },

  'a dangling worker is hauled back up'() {
    const world = shift();
    const [hauler, second, third, dangler] = chainOrder(world);
    Object.assign(hauler, { x: 80, y: 8, z: 0, grounded: true });
    Object.assign(dangler, {
      x: 79.8,
      y: 5.5,
      z: 2.2,
      grounded: false,
      state: 'dangling',
      airTime: 1,
    });
    Object.assign(second, { x: 78, y: 8, z: 0, grounded: true });
    Object.assign(third, { x: 78.9, y: 8, z: 0, grounded: true });
    const ears = new Ears(world);
    for (let i = 0; i < 300 && dangler.state !== 'standing'; i++) {
      hauler.input.haul = true;
      advanceChainOfFools(world, world.clock + 16, 1 / 60);
      ears.hear();
    }
    const ids = ears.ids();
    for (const id of ['chain.haul', 'chain.saved', 'speech.haul'])
      assert.ok(ids.includes(id), id);
    return ids;
  },

  'a hard landing, a revive and a clean landing'() {
    const world = shift();
    const [me, helper] = world.players;
    Object.assign(me, { x: 2, y: 9, z: 0, vy: -15, grounded: false });
    const ears = new Ears(world);
    const fall = ears.run(0.4);
    assert.ok(fall.includes('hazard.limp') && fall.includes('speech.limp'));
    Object.assign(helper, { x: me.x + 1, y: 0, z: me.z, grounded: true });
    for (let i = 0; i < 180 && me.state === 'limp'; i++) {
      helper.input.haul = true;
      advanceChainOfFools(world, world.clock + 16, 1 / 60);
      ears.hear();
    }
    assert.ok(ears.ids().includes('chain.saved'), 'revived');
    const hop = new Ears(standing(2, 0));
    hop.world.players[0].input.jump = true;
    const jumped = hop.run(1.2);
    assert.ok(jumped.includes('move.jump') && jumped.includes('move.land'));
    assert.ok(jumped.includes('step.dirt'), 'a landing names its surface');
    return [...ears.ids(), ...jumped];
  },

  'bracing, then the grip giving out'() {
    const ears = new Ears(shift());
    ears.world.players[0].input.brace = true;
    const ids = ears.run(4.5);
    assert.equal(ids.filter((id) => id === 'crew.brace').length, 1);
    assert.equal(ids.filter((id) => id === 'crew.exhausted').length, 1);
    return ids;
  },

  'walking on every deck and climbing the net'() {
    const ids: string[] = [];
    for (const [surface, x, y] of [
      ['dirt', 2, 0],
      ['steel', 17, 0],
      ['timber', 65.5, 8],
      ['concrete', 77, 8],
      ['pipe', 94, 8],
    ] as const) {
      const ears = new Ears(standing(x, y));
      ears.world.players[0].input.x = 1;
      const steps = ears.run(1).filter((id) => id.startsWith('step.'));
      assert.ok(steps.length >= 4, `${surface}: ${steps.length} steps`);
      assert.ok(
        steps.every((id) => id === `step.${surface}`),
        `${surface}: ${steps.join()}`,
      );
      ids.push(...steps);
    }
    const net = shift(1);
    Object.assign(net.players[0], {
      x: 118.2,
      y: 7,
      z: 0,
      grounded: false,
      state: 'airborne',
    });
    const climber = new Ears(net);
    net.players[0].input.x = 1;
    const climbed = climber.run(1.2);
    assert.ok(climbed.filter((id) => id === 'step.net').length >= 3);
    return [...ids, ...climbed];
  },

  'the line snaps tight'() {
    const world = shift(2);
    const [anchor, runner] = world.players;
    Object.assign(anchor, { x: 2, y: 0, z: 0, grounded: true, braced: true });
    anchor.input.brace = true;
    Object.assign(runner, { x: 3, y: 0, z: 0, grounded: true });
    const ears = new Ears(world);
    ears.run(0.1);
    Object.assign(runner, { x: 7.2, y: 0.6, grounded: false });
    const snapped = ears.run(1 / 60);
    assert.deepEqual(
      snapped.filter((id) => id.startsWith('chain.')),
      ['chain.taut'],
    );
    // Still taut next tick: heard once until it goes slack again.
    Object.assign(runner, { x: 7.2, y: 0.6, grounded: false });
    assert.ok(!ears.run(1 / 60).includes('chain.taut'));
    pushEvent(world, 'chain_taut', { playerId: runner.id });
    assert.ok(ears.hear().includes('chain.taut'));
    return ears.ids();
  },

  'the crew banks a checkpoint and clocks in'() {
    const world = shift();
    world.players.forEach((player, i) =>
      Object.assign(player, { x: [50, 48, 47, 20][i], y: 0, grounded: true }),
    );
    const ears = new Ears(world);
    const banked = ears.run(0.2);
    assert.ok(banked.includes('event.checkpoint'));
    assert.ok(
      !banked.includes('speech.checkpoint'),
      'no voice claims a checkpoint was saved',
    );
    const office = shift(1);
    Object.assign(office.players[0], { x: FINISH_X + 1, y: 0, grounded: true });
    const clock = new Ears(office);
    const done = clock.run(0.1);
    assert.ok(done.includes('event.clockin') && done.includes('event.win'));
    assert.equal(done[0], 'speech.win');
    return [...ears.ids(), ...done];
  },
};

/** Everything the scenarios made the planner say; SiteAudio clicks the buttons. */
const heard = new Set<string>(['event.ui']);
for (const [name, scenario] of Object.entries(scenarios))
  void test(`sound: ${name}`, () => {
    for (const id of scenario()) heard.add(id);
  });

void test('every catalog cue is played by the game, and nothing else is', () => {
  const lobby = crew();
  const playing = shift();
  const ended = shift();
  heard.add(chainMusic(lobby));
  heard.add(chainMusic(playing));
  playing.clock = playing.endsAt - 30_000;
  heard.add(chainMusic(playing));
  ended.phase = 'ended';
  ended.winner = 'crew';
  heard.add(chainMusic(ended));
  ended.winner = 'failed';
  heard.add(chainMusic(ended));
  for (const world of [lobby, playing, ended])
    for (const layer of chainAmbience(world, LOCAL))
      if (layer.id) heard.add(layer.id);

  const catalog = new Set(getCatalog(game).map((cue) => base(cue.id)));
  const played = new Set([...heard].map(base));
  assert.deepEqual(
    [...played].filter((id) => !catalog.has(id)).sort(),
    [],
    'the game never names a cue the workshop lacks',
  );
  assert.deepEqual(
    [...catalog].filter((id) => !played.has(id)).sort(),
    [],
    'no workshop cue goes unplayed',
  );
});

// ---------------------------------------------------------------- history

void test('old and replayed events never sound twice, and a new shift starts afresh', () => {
  const world = shift();
  const ears = new Ears(world);
  pushEvent(world, 'wipe');
  world.clock += 16;
  assert.deepEqual(ears.hear(), ['speech.wipe', 'event.wipe']);
  assert.deepEqual(ears.hear(), [], 'the same world twice is silent');

  // Joining late, a new room and a long gap all start from the present.
  const late = shift();
  late.clock += 5000;
  pushEvent(late, 'dangle', { playerId: 'p1' });
  assert.deepEqual(chainAudioStep(null, late, LOCAL).cues, []);
  const before = new Ears(shift()).frame!;
  const room = shift();
  room.started = before.started + 1;
  room.clock += 1000;
  pushEvent(room, 'wipe');
  assert.equal(chainAudioStep(before, room, LOCAL).fresh, true);
  assert.deepEqual(chainAudioStep(before, room, LOCAL).cues, []);
  const gap = structuredClone(world);
  gap.clock += 3000;
  pushEvent(gap, 'limp', { playerId: 'p1' });
  assert.deepEqual(chainAudioStep(ears.frame, gap, LOCAL).cues, []);
  const rewound = structuredClone(world);
  rewound.eventId = 0;
  assert.equal(chainAudioStep(ears.frame, rewound, LOCAL).fresh, true);
  // Joining just as the whistle goes still hears the start.
  assert.deepEqual(
    chainAudioStep(null, shift(), LOCAL).cues.map((cue) => cue.id),
    ['speech.start', 'event.start'],
  );

  // The horn, then another shift in the same world.
  const round = new Ears(shift());
  round.wait(ROUND_TIME_MS / 1000 + 1);
  assert.equal(round.world.phase, 'ended');
  chainOfFoolsAction(round.world, LOCAL, { type: 'restart' });
  const again = round.hear();
  assert.deepEqual(again, ['speech.start', 'event.start']);
  assert.ok(
    round.world.events.some((event) => event.type === 'timeout'),
    'the old horn is still in the log',
  );
  const second = round.wait(ROUND_TIME_MS / 2000 + 1);
  assert.ok(!second.includes('event.fail'), 'and is not replayed');
  assert.ok(second.includes('speech.encourage'), 'warnings reset per shift');
});

void test('one line per moment, the most important first, and far workers stay quiet', () => {
  const world = shift();
  const ears = new Ears(world);
  pushEvent(world, 'dangle', { playerId: 'p1' });
  pushEvent(world, 'wipe');
  const ids = ears.hear();
  assert.deepEqual(
    ids.filter((id) => id.startsWith('speech.')),
    ['speech.wipe'],
  );
  assert.equal(ids[0], 'speech.wipe');

  assert.equal(admitLine('speech.dangle', 10_000, -Infinity), 'incidental');
  assert.equal(admitLine('speech.dangle', 10_000, 10_000 - 1000), null);
  assert.equal(
    admitLine('speech.dangle', 10_000, 10_000 - LINE_GAP_MS),
    'incidental',
  );
  assert.equal(
    admitLine('speech.dangle', 60_000, 40_000, 30_000),
    null,
    'the same joke waits longer',
  );
  assert.equal(
    admitLine('speech.dangle', 60_000, 40_000, 60_000 - REPEAT_GAP_MS),
    'incidental',
  );
  assert.equal(admitLine('speech.ten', 10_000, 9_999, 9_999), 'urgent');

  // Another worker hopping across the site is not in your ears.
  const far = shift();
  far.players[1].x = far.players[0].x + EARSHOT + 5;
  const quiet = new Ears(far);
  pushEvent(far, 'jump', { playerId: 'p1', pos: [far.players[1].x, 0, 0] });
  assert.deepEqual(quiet.hear(), []);
  pushEvent(far, 'jump', { playerId: LOCAL, pos: [far.players[0].x, 0, 0] });
  assert.deepEqual(quiet.hear(), ['move.jump']);
});

void test('the score and the beds follow the shift', () => {
  const world = shift();
  assert.equal(chainMusic(crew()), 'music.menu');
  assert.equal(chainMusic(world), 'music.play');
  world.clock = world.endsAt - 59_000;
  assert.equal(chainMusic(world), 'music.tension');

  const level = (w: ChainWorld, channel: string) =>
    chainAmbience(w, LOCAL).find((layer) => layer.channel === channel)!;
  const ground = level(world, 'wind').level;
  world.players[0].y = 8;
  assert.ok(level(world, 'wind').level > ground + 0.5, 'windier up high');
  world.players[0].x = PENDULUM.pivotX;
  const crane = level(world, 'crane').level;
  world.players[0].x = 0;
  assert.ok(crane > level(world, 'crane').level, 'the crane is loud nearby');
  assert.equal(level(world, 'chain').level, 0, 'a still crew is quiet');
  world.players[0].vx = 4.6;
  assert.ok(level(world, 'chain').level > 0.5, 'a moving crew rattles');
  world.links = [{ a: 'p0', b: 'p1', distance: 4.6, tension: 1, taut: true }];
  world.players[1].state = 'dangling';
  assert.equal(level(world, 'strain').level, 1, 'the line groans under load');
  assert.equal(level(crew(), 'chain').id, null, 'no chain in the lobby');
});

// ---------------------------------------------------------------- runtime

void test('the site audio plays recordings, gates lines and falls back when a take is missing', async () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch;
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  const missing = new Set(['chain.clip', 'music.tension']);
  const cues: AudioManifest['cues'] = {};
  for (const cue of chainOfFoolsCatalog)
    if (!missing.has(cue.id))
      cues[cue.id] = {
        url: `/test/${cue.id}.mp3`,
        volume: cue.volume,
        loop: cue.loop,
        category: cue.category,
      };
  globalThis.fetch = async () =>
    Response.json({ settings: DEFAULT_SETTINGS, cues });

  class Probe extends ChainOfFoolsSound {
    interrupts = 0;
    protected override interruptSpeech() {
      this.interrupts++;
      super.interruptSpeech();
    }
  }
  const audio = new Probe();
  const played: string[] = [];
  const loops = new Map<string, string | null>();
  audio.play = (id) => {
    played.push(id);
  };
  audio.variant = (id) => {
    played.push(`${id}*`);
  };
  audio.setLoop = (channel, id) => {
    loops.set(channel, id);
  };
  try {
    await audio.refresh();
    const world = crew();
    audio.update(world, LOCAL);
    assert.equal(loops.get('music'), 'music.menu');
    assert.equal(loops.get('site'), 'ambience.site');
    assert.equal(loops.get('chain'), null);

    const interrupts = audio.interrupts;
    chainOfFoolsAction(world, LOCAL, { type: 'start' });
    audio.update(world, LOCAL);
    assert.deepEqual([...played], ['speech.start', 'event.start']);
    assert.equal(audio.interrupts, interrupts + 1, 'the start line is urgent');
    assert.equal(loops.get('music'), 'music.play');
    assert.equal(loops.get('chain'), 'ambience.chain');

    // A missing recording is left to the synthesized stand-in.
    played.length = 0;
    Object.assign(world.players[0], { x: 23.4, y: 0.1, z: 0 });
    chainOfFoolsAction(world, LOCAL, { type: 'clip' });
    world.clock += 16;
    audio.update(world, LOCAL);
    assert.equal(played.length, 0);
    chainOfFoolsAction(world, LOCAL, { type: 'clip' });
    world.clock += 16;
    audio.update(world, LOCAL);
    assert.deepEqual([...played], ['chain.unclip']);

    // Incidental lines wait their turn; a stale packet changes nothing.
    for (let i = 0; i < 4; i++) {
      world.clock += 2000;
      audio.update(world, LOCAL);
    }
    played.length = 0;
    pushEvent(world, 'dangle', { playerId: 'p1' });
    world.clock += 16;
    audio.update(world, LOCAL);
    pushEvent(world, 'haul_done', { playerId: 'p1' });
    world.clock += 1000;
    audio.update(world, LOCAL);
    assert.deepEqual(
      played.filter((id) => id.startsWith('speech.')),
      ['speech.dangle'],
    );
    // Later, a fresh joke is welcome but the same one is not.
    for (let i = 0; i < 4; i++) {
      world.clock += 2000;
      audio.update(world, LOCAL);
    }
    pushEvent(world, 'dangle', { playerId: 'p2' });
    world.clock += 16;
    audio.update(world, LOCAL);
    pushEvent(world, 'limp', { playerId: 'p2' });
    world.clock += 16;
    audio.update(world, LOCAL);
    assert.deepEqual(
      played.filter((id) => id.startsWith('speech.')),
      ['speech.dangle', 'speech.limp'],
    );
    const stale = structuredClone(world);
    stale.clock -= 500;
    pushEvent(stale, 'wipe');
    played.length = 0;
    audio.update(stale, LOCAL);
    assert.equal(played.length, 0);

    // No tension track yet: the gameplay score carries on.
    world.clock = world.endsAt - 30_000;
    audio.update(world, LOCAL);
    assert.equal(loops.get('music'), 'music.play');
    while (world.phase === 'playing') {
      advanceChainOfFools(world, world.clock + 1000, 1 / 60);
      audio.update(world, LOCAL);
    }
    assert.equal(loops.get('music'), 'music.fail');
    assert.equal(played.filter((id) => id === 'event.tick').length, 10);
    assert.ok(played.includes('speech.fail') && played.includes('event.fail'));
  } finally {
    audio.dispose();
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});
