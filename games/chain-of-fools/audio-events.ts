import {
  PENDULUM,
  PLANK,
  SURFACES,
  nearNet,
  onPlank,
  pendulumBall,
  plankSurfaceY,
  type SurfaceKind,
} from './course';
import {
  PLAYER_RADIUS,
  ROUND_TIME_MS,
  WALK_SPEED,
  clamp,
  timeLeft,
  type ChainWorld,
  type GameEvent,
  type Player,
} from './types';

/**
 * What Chain of Fools sounds like, worked out from the world alone. Pure: the
 * previous audio frame and the next world go in, one-shot cues come out, so
 * every rule here can be tested without a browser.
 */

type Point = { x: number; y: number; z: number };

export type ChainCue = {
  id: string;
  position?: Point;
  strength?: number;
  /** Pick among the recorded takes `id`, `id.2`, `id.3`. */
  variant?: boolean;
  /** Keeps one worker's repeats from blocking another worker's. */
  source?: string;
};

export type ChainSurface = 'dirt' | 'steel' | 'timber' | 'concrete' | 'pipe';

const SURFACE_SOUND: Record<SurfaceKind, ChainSurface> = {
  yard: 'dirt',
  pad: 'dirt',
  girder: 'steel',
  catwalk: 'steel',
  'pipe-roof': 'steel',
  crate: 'timber',
  scaffold: 'timber',
  ledge: 'concrete',
  office: 'concrete',
  pipe: 'pipe',
};

/** Metres walked per footstep. */
export const STRIDE = 0.85;
/** Metres climbed on the cargo net per hand-over-hand grab. */
export const NET_RUNG = 0.7;
/** Other workers' small sounds (steps, hops, bracing) only within this range. */
export const EARSHOT = 12;
/** Incidental commentary waits this long after the previous line. */
export const LINE_GAP_MS = 7000;
/** And the same incidental line waits this long before it comes round again. */
export const REPEAT_GAP_MS = 45_000;
/** The score turns tense for the last minute of the shift. */
export const TENSION_MS = 60_000;
/** Where the tower crane stands (see `wreckingLoad` in models.ts). */
export const CRANE = { x: PENDULUM.pivotX + 3, z: -9 };
/** A link this loose counts as slack, so its next pull tight is heard. */
const SLACK_TENSION = 0.35;
/** Further than this in one frame is a respawn or correction, not a walk. */
const TELEPORT = 1.5;
/** The wrecking load only whooshes when it is really moving. */
const SWING_SPEED = 0.3;
const PEAK_SWING = 0.66;
const DISCONTINUITY_MS = 2500;

/** Lines that interrupt whatever the commentator is saying and skip the queue. */
export const URGENT_LINES: ReadonlySet<string> = new Set([
  'speech.start',
  'speech.minute',
  'speech.ten',
  'speech.win',
  'speech.fail',
]);

/** When two lines are due in one frame, only the first of these is spoken. */
const LINE_PRIORITY = [
  'speech.win',
  'speech.fail',
  'speech.ten',
  'speech.minute',
  'speech.start',
  'speech.wipe',
  'speech.wrecking',
  'speech.limp',
  'speech.haul',
  'speech.dangle',
  'speech.plank',
  'speech.checkpoint',
  'speech.encourage',
];

/** What a worker's boots are on: the plank, or the deck level with their feet. */
export function chainSurface(
  x: number,
  y: number,
  z: number,
  plankTilt: number,
): ChainSurface {
  if (onPlank(x, z) && Math.abs(plankSurfaceY(x, plankTilt) - y) < 0.3)
    return 'timber';
  let top = -Infinity;
  let kind: SurfaceKind | null = null;
  for (const b of SURFACES) {
    if (Math.abs(b.maxY - y) > 0.15 || b.maxY <= top) continue;
    const dx = x - clamp(x, b.minX, b.maxX);
    const dz = z - clamp(z, b.minZ, b.maxZ);
    if (dx * dx + dz * dz > PLAYER_RADIUS * PLAYER_RADIUS) continue;
    top = b.maxY;
    kind = b.kind;
  }
  return kind ? SURFACE_SOUND[kind] : 'dirt';
}

type Body = {
  id: string;
  x: number;
  y: number;
  z: number;
  state: Player['state'];
  grounded: boolean;
  /** Braced with boots on the ground. */
  braced: boolean;
  braceCooldown: number;
  climbing: boolean;
  /** Metres walked or climbed since this worker's last footstep. */
  stride: number;
};

/** The little the planner remembers between two worlds. */
export type ChainAudioFrame = {
  started: number;
  startedAt: number;
  phase: ChainWorld['phase'];
  clock: number;
  endsAt: number;
  eventId: number;
  pendulumAngle: number;
  bodies: Body[];
  /** Links that have gone slack since they were last pulled tight. */
  slack: string[];
};

export type ChainAudioStep = {
  frame: ChainAudioFrame;
  cues: ChainCue[];
  /** Nothing before this world may be compared with it: a join, a new room or a gap. */
  fresh: boolean;
};

/** A world that cannot be the next frame of the one before it. */
export function chainAudioDiscontinuity(
  previous: ChainAudioFrame,
  world: ChainWorld,
) {
  return (
    previous.started !== world.started ||
    world.eventId < previous.eventId ||
    world.clock < previous.clock ||
    world.clock - previous.clock > DISCONTINUITY_MS
  );
}

const linkKey = (link: { a: string; b: string }) => `${link.a}|${link.b}`;
const point = (p: { x: number; y: number; z: number }): Point => ({
  x: p.x,
  y: p.y,
  z: p.z,
});
const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function body(player: Player, stride: number): Body {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    z: player.z,
    state: player.state,
    grounded: player.grounded,
    // Boots only dig in on something solid; a brace held mid-hop is not one.
    braced: player.braced && player.grounded,
    braceCooldown: player.braceCooldown,
    climbing:
      player.state === 'airborne' &&
      !player.grounded &&
      nearNet(player.x, player.y, player.z),
    stride,
  };
}

function header(world: ChainWorld) {
  return {
    started: world.started,
    startedAt: world.startedAt,
    phase: world.phase,
    clock: world.clock,
    endsAt: world.endsAt,
    eventId: world.eventId,
    pendulumAngle: world.pendulumAngle,
  };
}

/** One speech line at most, the most important first, then the effects. */
function ordered(lines: string[], cues: ChainCue[]): ChainCue[] {
  const line = LINE_PRIORITY.find((id) => lines.includes(id));
  return line ? [{ id: line }, ...cues] : cues;
}

/**
 * The cues between two worlds. Only confirmed changes sound: events newer than
 * the last one heard, and state that actually changed. A first frame, a new
 * room, a rejoin or a clock jump is a fresh start that replays nothing.
 */
export function chainAudioStep(
  previous: ChainAudioFrame | null,
  world: ChainWorld,
  localId: string,
): ChainAudioStep {
  const me = world.players.find((p) => p.id === localId);
  const near = (at?: Point) => !at || !me || distance(at, me) <= EARSHOT;
  const cues: ChainCue[] = [];
  const lines: string[] = [];

  if (!previous || chainAudioDiscontinuity(previous, world)) {
    // Joining right as the whistle goes still hears it; anything older is history.
    if (world.phase === 'playing' && world.clock - world.startedAt < 750) {
      lines.push('speech.start');
      cues.push({ id: 'event.start' });
    }
    return {
      frame: {
        ...header(world),
        bodies: world.players.map((p) => body(p, 0)),
        slack: world.links
          .filter((link) => link.tension < SLACK_TENSION)
          .map(linkKey),
      },
      cues: ordered(lines, cues),
      fresh: true,
    };
  }

  const playing = world.phase === 'playing' && previous.phase === 'playing';
  const newRound =
    world.phase === 'playing' &&
    (previous.phase !== 'playing' || previous.startedAt !== world.startedAt);
  if (newRound) {
    lines.push('speech.start');
    cues.push({ id: 'event.start' });
  }

  // The shift clock: halfway, the last minute, and a tick for each final second.
  if (playing && previous.startedAt === world.startedAt) {
    const before = previous.endsAt - previous.clock;
    const after = timeLeft(world);
    const crossed = (ms: number) => before > ms && after <= ms;
    if (crossed(ROUND_TIME_MS / 2)) lines.push('speech.encourage');
    if (crossed(TENSION_MS)) lines.push('speech.minute');
    if (crossed(10_000)) lines.push('speech.ten');
    for (let second = 10; second >= 1; second--)
      if (crossed(second * 1000))
        cues.push({ id: 'event.tick', strength: 0.55 + (10 - second) * 0.045 });
  }

  const events = world.events
    .filter((event) => event.id > previous.eventId)
    .sort((a, b) => a.id - b.id);
  const yanked = new Set(
    events.filter((e) => e.type === 'chain_yank').map((e) => e.playerId),
  );
  for (const event of events)
    eventCues(event, world, localId, near, cues, lines);

  // Bracing, grip failing, footsteps and the cargo net, from each worker's state.
  const bodies: Body[] = [];
  for (const player of world.players) {
    const before = previous.bodies.find((b) => b.id === player.id);
    const next = body(player, 0);
    bodies.push(next);
    if (!before || !playing) continue;
    const at = point(player);
    const mine = player.id === localId;
    const loud = mine ? 1 : near(at) ? 0.5 : 0;
    const say = (id: string, strength: number, variant = false) => {
      if (loud > 0)
        cues.push({
          id,
          position: at,
          strength: strength * loud,
          variant,
          source: player.id,
        });
    };
    if (next.braced && !before.braced) say('crew.brace', 0.8);
    if (player.braceCooldown > 0 && before.braceCooldown <= 0)
      say('crew.exhausted', 1);

    const moved = Math.hypot(player.x - before.x, player.z - before.z);
    if (
      moved <= TELEPORT &&
      player.grounded &&
      before.grounded &&
      player.state === 'standing' &&
      !player.braced
    ) {
      next.stride = before.stride + moved;
      if (next.stride >= STRIDE) {
        next.stride = 0;
        say(
          `step.${chainSurface(player.x, player.y, player.z, world.plankTilt)}`,
          0.7,
          true,
        );
      }
    } else if (next.climbing && before.climbing) {
      const climbed =
        Math.abs(player.y - before.y) + Math.abs(player.z - before.z);
      if (climbed <= TELEPORT) {
        next.stride = before.stride + climbed;
        if (next.stride >= NET_RUNG) {
          next.stride = 0;
          say('step.net', 0.7, true);
        }
      }
    }
  }

  // A slack line snapping straight. A yank already says it more loudly.
  const slack: string[] = [];
  for (const link of world.links) {
    const key = linkKey(link);
    const wasSlack = previous.slack.includes(key);
    if (!link.taut) {
      if (wasSlack || link.tension < SLACK_TENSION) slack.push(key);
      continue;
    }
    if (!wasSlack || !playing || yanked.has(link.a) || yanked.has(link.b))
      continue;
    const a = world.players.find((p) => p.id === link.a);
    const b = world.players.find((p) => p.id === link.b);
    if (!a || !b) continue;
    const middle = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 + 1,
      z: (a.z + b.z) / 2,
    };
    const mine = link.a === localId || link.b === localId;
    if (mine || near(middle))
      cues.push({
        id: 'chain.taut',
        position: middle,
        strength: mine ? 0.8 : 0.5,
        source: key,
      });
  }

  // The wrecking load whooshes through the bottom of every swing.
  if (
    playing &&
    !world.pendulumRider &&
    Math.sign(world.pendulumAngle) !== Math.sign(previous.pendulumAngle) &&
    Math.abs(world.pendulumVel) > SWING_SPEED
  ) {
    const [x, y, z] = pendulumBall(world.pendulumAngle);
    cues.push({
      id: 'hazard.swing',
      position: { x, y, z },
      strength: clamp(Math.abs(world.pendulumVel) / PEAK_SWING, 0.4, 1),
    });
  }

  return {
    frame: { ...header(world), bodies, slack },
    cues: ordered(lines, cues),
    fresh: false,
  };
}

function eventCues(
  event: GameEvent,
  world: ChainWorld,
  localId: string,
  near: (at?: Point) => boolean,
  cues: ChainCue[],
  lines: string[],
) {
  const player = event.playerId
    ? world.players.find((p) => p.id === event.playerId)
    : undefined;
  const at: Point | undefined = event.pos
    ? { x: event.pos[0], y: event.pos[1], z: event.pos[2] }
    : player
      ? point(player)
      : undefined;
  const mine = !!event.playerId && event.playerId === localId;
  const source = event.playerId;
  const add = (id: string, strength = 1, variant = false) =>
    cues.push({ id, position: at, strength, variant, source });

  switch (event.type) {
    case 'jump':
      if (mine || near(at)) add('move.jump', mine ? 0.8 : 0.4, true);
      break;
    case 'land':
      if (mine || near(at)) {
        add('move.land', mine ? 0.85 : 0.4, true);
        if (at)
          add(
            `step.${chainSurface(at.x, at.y, at.z, world.plankTilt)}`,
            mine ? 0.9 : 0.45,
            true,
          );
      }
      break;
    case 'chain_yank':
      add('chain.yank', mine ? 1 : 0.75, true);
      break;
    case 'chain_taut':
      add('chain.taut', mine ? 0.8 : 0.5);
      break;
    case 'brace':
      // The crew call: your own whistle is in your ears, not somewhere on the site.
      cues.push({
        id: 'event.ping',
        position: mine ? undefined : at,
        strength: 0.9,
        source,
      });
      break;
    case 'dangle':
      add('chain.dangle', mine ? 1 : 0.8);
      lines.push('speech.dangle');
      break;
    case 'haul_start':
      add('chain.haul', 0.85);
      break;
    case 'haul_done':
      add('chain.saved');
      lines.push('speech.haul');
      break;
    case 'revive':
      add('chain.saved', 0.8);
      break;
    case 'limp':
      add('hazard.limp');
      lines.push('speech.limp');
      break;
    case 'clip':
      // The same action clips onto a ring or grabs the wrecking load's hook.
      add(
        (!!event.playerId && world.pendulumRider === event.playerId) ||
          !!event.detail?.endsWith('the wrecking hook')
          ? 'hazard.hook'
          : 'chain.clip',
      );
      break;
    case 'unclip':
      add('chain.unclip');
      break;
    case 'checkpoint':
      // With a worker named it is one of them clocking in at the office.
      if (event.playerId) add('event.clockin', 0.9);
      else {
        cues.push({ id: 'event.checkpoint' });
        lines.push('speech.checkpoint');
      }
      break;
    case 'wipe':
      cues.push({ id: 'event.wipe' });
      lines.push('speech.wipe');
      break;
    case 'pendulum_swing':
      add('hazard.wrecking');
      lines.push('speech.wrecking');
      break;
    case 'plank_tip':
      cues.push({
        id: 'hazard.plank',
        position: { x: PLANK.pivotX, y: PLANK.y, z: 0 },
      });
      lines.push('speech.plank');
      break;
    case 'win':
      cues.push({ id: 'event.win' });
      lines.push('speech.win');
      break;
    case 'timeout':
      cues.push({ id: 'event.fail' });
      lines.push('speech.fail');
      break;
  }
}

/**
 * Whether a line may be spoken now, and whether it interrupts the current one.
 * Incidental lines keep a gap after any line, and a longer one after
 * themselves, so a crew that keeps falling off does not hear the same joke.
 */
export function admitLine(
  id: string,
  now: number,
  lastLine: number,
  lastSaid = -Infinity,
): 'urgent' | 'incidental' | null {
  if (URGENT_LINES.has(id)) return 'urgent';
  return now - lastLine >= LINE_GAP_MS && now - lastSaid >= REPEAT_GAP_MS
    ? 'incidental'
    : null;
}

/** The score for this moment of the shift. */
export function chainMusic(world: ChainWorld): string {
  if (world.phase === 'lobby') return 'music.menu';
  if (world.phase === 'ended')
    return world.winner === 'crew' ? 'music.win' : 'music.fail';
  return timeLeft(world) <= TENSION_MS ? 'music.tension' : 'music.play';
}

export type AmbienceLayer = {
  channel: string;
  /** Null while the layer has nothing to say, which stops its loop. */
  id: string | null;
  level: number;
};

/**
 * The site's layered beds: the site itself, wind that rises with the local
 * worker, the crane louder beside it, the chain rattling with the crew's pace
 * and the line groaning while it holds somebody.
 */
export function chainAmbience(
  world: ChainWorld,
  localId: string,
): AmbienceLayer[] {
  const me = world.players.find((p) => p.id === localId);
  const crew = world.players.filter((p) => p.state !== 'finished');
  const ear = me ?? crew[0] ?? world.players[0];
  const active = world.phase !== 'lobby';
  const roped = world.phase === 'playing' && world.players.length > 1;

  const height = ear ? clamp((ear.y - 0.5) / 7.5, 0, 1) : 0;
  const crane = ear
    ? clamp(1 - Math.hypot(ear.x - CRANE.x, ear.z - CRANE.z) / 45, 0, 1)
    : 0;
  const swing = clamp(Math.abs(world.pendulumVel) / PEAK_SWING, 0, 1);
  const speed = (p: Player) => Math.hypot(p.vx, p.vz) / WALK_SPEED;
  const pace = crew.length
    ? crew.reduce((sum, p) => sum + speed(p), 0) / crew.length
    : 0;
  const tension = world.links.reduce(
    (most, link) => Math.max(most, link.tension),
    0,
  );
  const hanging = world.players.some((p) => p.state === 'dangling');

  return [
    {
      channel: 'site',
      id: 'ambience.site',
      level: world.phase === 'playing' ? 0.8 : active ? 0.6 : 0.5,
    },
    {
      channel: 'wind',
      id: 'ambience.wind',
      level: active ? 0.15 + 0.85 * height : 0.15,
    },
    {
      channel: 'crane',
      id: 'ambience.crane',
      level: active ? 0.12 + 0.88 * crane * (0.6 + 0.4 * swing) : 0.12,
    },
    {
      channel: 'chain',
      id: roped ? 'ambience.chain' : null,
      level: 0.9 * clamp(Math.max(me ? speed(me) : 0, pace * 0.8), 0, 1),
    },
    {
      channel: 'strain',
      id: roped ? 'ambience.strain' : null,
      level: hanging
        ? 0.35 + 0.65 * tension
        : 0.5 * clamp((tension - 0.6) / 0.4, 0, 1),
    },
  ];
}
