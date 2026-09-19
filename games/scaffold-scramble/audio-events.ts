import type { Point } from '../../shared/audio/world';
import {
  CRADLE_WIDTH,
  GROUND_ALTITUDE,
  MAX_TILT_DEG,
  ROOF_ALTITUDE,
  ROUND_TIME_MS,
  TARGET_CLEANED_WINDOWS,
  TILT_SLIP_DEG,
  WINCH_CRANK_SPEED,
  timeLeft,
  type Pigeon,
  type Player,
  type ScaffoldScrambleWorld,
  type SoapBucket,
} from './types';

type World = ScaffoldScrambleWorld;

export type ScaffoldCue = {
  id: string;
  position?: Point;
  strength?: number;
  /** Pick one of the recorded takes (`id`, `id.2`, `id.3`), never the same twice. */
  variant?: boolean;
  sourceId?: string;
  /** Urgent narrator lines cut off whatever the narrator is saying. */
  urgent?: boolean;
};

/** Metres of cable per ratchet tooth: one crank press is exactly one click. */
export const RATCHET_TOOTH = WINCH_CRANK_SPEED;
/** Metres of deck per footstep at a brisk walk. */
export const STRIDE = 1;
/** A perched pigeon coos this often, in seconds. */
export const COO_EVERY = 5;
/** The last stretch of the shift switches to the tension score. */
export const TENSION_MS = 30_000;
/** A gust this strong earns a word from the narrator. */
export const STRONG_GUST = 1.15;

const DECK_Z = 1.2;
const ON_FEET = new Set<Player['state']>([
  'standing',
  'cranking',
  'cleaning',
  'shooing',
]);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function playerPoint(world: World, player: Player): Point {
  return {
    x: player.deckX,
    y: world.cradle.centerHeight + player.deckY,
    z: DECK_Z,
  };
}

const bucketPoint = (world: World, bucket: SoapBucket): Point => ({
  x: bucket.x,
  y: world.cradle.centerHeight,
  z: DECK_Z,
});

const pigeonPoint = (pigeon: Pigeon): Point => ({
  x: pigeon.x,
  y: pigeon.y,
  z: DECK_Z,
});

/** A new round, a rejoin or a stalled tab: nothing from before may replay. */
export function scaffoldAudioDiscontinuity(previous: World, next: World) {
  return (
    previous.started !== next.started ||
    previous.seed !== next.seed ||
    next.clock < previous.clock ||
    next.clock - previous.clock > 2500
  );
}

/**
 * Turns two consecutive worlds into the one-shot cues the change deserves.
 * Simulation events count only when newer than the last one already seen;
 * everything else is read from confirmed state changes (cable paid out, feet
 * moved, a pigeon perched), so it never depends on how often it is called.
 */
export function scaffoldAudioEvents(
  previous: World | null,
  next: World,
  localId?: string,
): ScaffoldCue[] {
  if (!previous || scaffoldAudioDiscontinuity(previous, next))
    return next.phase === 'playing' &&
      Math.abs(next.clock - next.started) < 1500
      ? [{ id: 'speech.start', urgent: true }, { id: 'event.start' }]
      : [];

  const old = previous;
  const w = next;
  const cues: ScaffoldCue[] = [];
  const add = (cue: ScaffoldCue) => cues.push(cue);
  const center: Point = { x: 0, y: w.cradle.centerHeight, z: DECK_Z };
  const at = (playerId?: string) => {
    const player = w.players.find((p) => p.id === playerId);
    return player ? playerPoint(w, player) : center;
  };
  const reach = (playerId?: string): Point => {
    const point = at(playerId);
    return { ...point, y: (point.y ?? 0) + 1.2 };
  };
  const loudness = (playerId?: string, own = 1, others = 0.6) =>
    playerId === localId ? own : others;

  const seen = old.events.length ? old.events[old.events.length - 1].id : 0;
  for (const event of w.events) {
    if (event.id <= seen) continue;
    const who = event.playerId;
    const source = who ?? `event-${event.id}`;
    switch (event.type) {
      case 'crank':
        // The ratchet follows the cable itself (below), so a held crank clicks
        // steadily instead of whenever the event log lets a crank through.
        break;
      case 'tilt_warning':
        add({ id: 'hazard.tilt_warning' });
        add({ id: 'speech.tilt' });
        break;
      case 'slip':
        if (event.detail?.includes('bucket'))
          add({ id: 'bucket.bonk', position: at(who), sourceId: source });
        add({
          id: 'hazard.slip',
          variant: true,
          position: at(who),
          strength: loudness(who, 1, 0.75),
          sourceId: source,
        });
        break;
      case 'dangle':
        add({ id: 'hazard.dangle', position: at(who), sourceId: source });
        add({ id: 'speech.dangle' });
        break;
      case 'climb_up':
        add({
          id: 'crew.climbed',
          position: at(who),
          strength: loudness(who, 0.9, 0.6),
          sourceId: source,
        });
        break;
      case 'bucket_slide': {
        const bucket = [...w.buckets]
          .filter((b) => !b.spilled)
          .sort((a, b) => Math.abs(b.vx) - Math.abs(a.vx))[0];
        add({
          id: 'bucket.slide',
          variant: true,
          position: bucket ? bucketPoint(w, bucket) : center,
          strength: bucket
            ? 0.55 + clamp01(Math.abs(bucket.vx) / 3) * 0.45
            : 0.8,
          sourceId: bucket?.id ?? source,
        });
        break;
      }
      case 'bucket_spill': {
        const bucket =
          w.buckets.find(
            (b) =>
              b.spilled && !old.buckets.find((o) => o.id === b.id)?.spilled,
          ) ?? w.buckets.find((b) => b.spilled);
        add({
          id: 'bucket.spill',
          position: bucket ? bucketPoint(w, bucket) : center,
          sourceId: bucket?.id ?? source,
        });
        add({ id: 'speech.spill' });
        break;
      }
      case 'soap_apply':
        add({
          id: 'soap.foam',
          variant: true,
          position: reach(who),
          strength: loudness(who, 0.9, 0.6),
          sourceId: source,
        });
        break;
      case 'window_clean':
        add({
          id: 'squeegee.wipe',
          variant: true,
          position: reach(who),
          strength: loudness(who, 1, 0.65),
          sourceId: source,
        });
        add({
          id: 'window.clean',
          position: reach(who),
          strength: loudness(who, 0.9, 0.7),
          sourceId: source,
        });
        break;
      case 'pigeon_land': {
        const pigeon = w.pigeons.find(
          (p) => p.perched && !old.pigeons.find((o) => o.id === p.id)?.perched,
        );
        add({
          id: 'pigeon.land',
          position: pigeon ? pigeonPoint(pigeon) : center,
          sourceId: pigeon?.id ?? source,
        });
        add({ id: 'speech.pigeon' });
        break;
      }
      case 'pigeon_shoo': {
        const pigeon = w.pigeons.find(
          (p) => !p.perched && old.pigeons.find((o) => o.id === p.id)?.perched,
        );
        const position = pigeon ? pigeonPoint(pigeon) : at(who);
        // A worker swatting it away is a burst; leaving of its own accord is calm.
        add(
          who
            ? { id: 'hazard.pigeon', position, sourceId: source }
            : {
                id: 'pigeon.flyoff',
                position,
                strength: 0.7,
                sourceId: pigeon?.id ?? source,
              },
        );
        break;
      }
      case 'wind_gust': {
        const strength = Math.abs(w.wind.strength);
        add({
          id: 'hazard.wind',
          // The gust arrives from the side it pushes away from.
          position: {
            x: w.wind.strength > 0 ? -14 : 14,
            y: w.cradle.centerHeight + 2,
            z: 2,
          },
          strength: 0.6 + clamp01(strength / 1.4) * 0.4,
          sourceId: source,
        });
        if (strength >= STRONG_GUST) add({ id: 'speech.wind' });
        break;
      }
      case 'win':
        add({ id: 'speech.win', urgent: true });
        add({ id: 'event.win' });
        break;
      case 'timeout':
        add({ id: 'speech.fail', urgent: true });
        add({ id: 'event.fail' });
        add({ id: 'helicopter.land' });
        break;
    }
  }

  if (old.phase === 'playing' && w.phase === 'playing') {
    const before = timeLeft(old);
    const after = timeLeft(w);
    const crossed = (mark: number) => before > mark && after <= mark;
    if (crossed(ROUND_TIME_MS / 2)) add({ id: 'speech.halfway' });
    if (crossed(60_000)) {
      add({ id: 'speech.minute', urgent: true });
      add({ id: 'helicopter.flyby' });
    }
    if (crossed(10_000)) add({ id: 'speech.ten', urgent: true });
    const second = Math.ceil(after / 1000);
    if (second < Math.ceil(before / 1000) && second >= 1 && second <= 10)
      add({ id: 'event.tick', strength: second <= 3 ? 1 : 0.7 });
  }

  if (w.cleanedCount > old.cleanedCount) {
    const crossed = (mark: number) =>
      old.cleanedCount < mark && w.cleanedCount >= mark;
    if (crossed(1)) add({ id: 'speech.first-clean' });
    if (crossed(TARGET_CLEANED_WINDOWS - 5)) add({ id: 'speech.almost' });
    if (
      w.cleanedCount < TARGET_CLEANED_WINDOWS &&
      Math.floor(w.cleanedCount / 5) > Math.floor(old.cleanedCount / 5)
    )
      add({ id: 'event.milestone', strength: 0.9 });
  }

  for (const side of ['left', 'right'] as const) {
    const before =
      side === 'left' ? old.cradle.leftHeight : old.cradle.rightHeight;
    const after = side === 'left' ? w.cradle.leftHeight : w.cradle.rightHeight;
    if (
      Math.floor(before / RATCHET_TOOTH) !== Math.floor(after / RATCHET_TOOTH)
    )
      add({
        id: after > before ? 'crank.ratchet' : 'crank.lower',
        variant: true,
        position: {
          x: ((side === 'left' ? -1 : 1) * CRADLE_WIDTH) / 2,
          y: after + 1,
          z: DECK_Z,
        },
        strength: after > before ? 0.8 : 0.7,
        sourceId: `winch-${side}`,
      });
  }

  if (
    Math.abs(old.cradle.tiltDeg) < TILT_SLIP_DEG &&
    Math.abs(w.cradle.tiltDeg) >= TILT_SLIP_DEG
  )
    add({ id: 'cradle.lurch' });

  const surface = w.cradle.deckSuds > 0.3 ? 'suds' : 'deck';
  for (const player of w.players) {
    const before = old.players.find((p) => p.id === player.id);
    if (!before) continue;
    const position = playerPoint(w, player);
    const mine = player.id === localId;
    if (
      ON_FEET.has(player.state) &&
      ON_FEET.has(before.state) &&
      Math.abs(player.deckX - before.deckX) < 1 &&
      Math.floor(player.deckX / STRIDE) !== Math.floor(before.deckX / STRIDE)
    )
      add({
        id: `step.${surface}`,
        variant: true,
        position,
        // Everyone else's boots stay underneath your own.
        strength: mine ? 0.75 : 0.3,
        sourceId: player.id,
      });
    if (before.state === 'sliding' && player.state === 'standing')
      add({
        id: 'crew.recover',
        position,
        strength: mine ? 0.8 : 0.5,
        sourceId: player.id,
      });
    if (before.tool !== player.tool && player.tool !== 'none')
      add({
        id: `tool.${player.tool}`,
        position,
        strength: mine ? 0.75 : 0.35,
        sourceId: player.id,
      });
  }

  const rail = CRADLE_WIDTH / 2 - 0.65;
  for (const bucket of w.buckets) {
    const before = old.buckets.find((b) => b.id === bucket.id);
    if (!before) continue;
    if (before.spilled && !bucket.spilled)
      add({
        id: 'bucket.refill',
        position: bucketPoint(w, bucket),
        strength: 0.8,
        sourceId: bucket.id,
      });
    else if (
      !before.spilled &&
      !bucket.spilled &&
      Math.abs(before.vx) > 0.8 &&
      Math.sign(before.vx) !== Math.sign(bucket.vx) &&
      Math.abs(bucket.x) >= rail
    )
      add({
        id: 'bucket.bump',
        position: bucketPoint(w, bucket),
        strength: 0.5 + clamp01(Math.abs(before.vx) / 2) * 0.5,
        sourceId: bucket.id,
      });
  }

  for (const pigeon of w.pigeons) {
    const before = old.pigeons.find((p) => p.id === pigeon.id);
    if (
      before?.perched &&
      pigeon.perched &&
      Math.floor(before.flapTimer / COO_EVERY) !==
        Math.floor(pigeon.flapTimer / COO_EVERY)
    )
      add({
        id: 'pigeon.coo',
        position: pigeonPoint(pigeon),
        strength: 0.6,
        sourceId: pigeon.id,
      });
  }

  return cues;
}

/** Lobby, the shift, its last stretch, then one result stinger. */
export function scaffoldMusic(world: World | null): string {
  if (!world || world.phase === 'lobby') return 'music.menu';
  if (world.phase === 'ended')
    return world.winner === 'crew' ? 'music.win' : 'music.fail';
  return timeLeft(world) <= TENSION_MS ||
    world.cleanedCount >= TARGET_CLEANED_WINDOWS - 3
    ? 'music.tension'
    : 'music.play';
}

/** How many of the two winches someone is cranking right now. */
export function winchesTurning(world: World) {
  const sides = new Set<'left' | 'right'>();
  for (const p of world.players) {
    if (p.state === 'dangling' || p.state === 'climbing') continue;
    const station = (side: 'left' | 'right') =>
      p.input.action &&
      (side === 'left'
        ? p.deckX <= -CRADLE_WIDTH / 2 + 1.2
        : p.deckX >= CRADLE_WIDTH / 2 - 1.2) &&
      (p.role === `${side}-winch` || p.role === 'all-rounder');
    if (p.input.crankLeftUp || p.input.crankLeftDown || station('left'))
      sides.add('left');
    if (p.input.crankRightUp || p.input.crankRightDown || station('right'))
      sides.add('right');
  }
  return sides.size;
}

export type ScaffoldLoop = {
  channel: string;
  id: string | null;
  level: number;
};

/**
 * The layered ambience: wind that grows with height and gusts, the city that
 * fades as the cradle climbs, the CEO's helicopter closing in, cables that
 * groan with the tilt, and the winch drum while anyone cranks.
 */
export function scaffoldLoops(world: World | null): ScaffoldLoop[] {
  const loop = (channel: string, id: string | null, level: number) => ({
    channel,
    id,
    level: clamp01(level),
  });
  if (!world || world.phase === 'lobby')
    return [
      loop('sky', 'ambience.sky', 0.5),
      loop('city', 'ambience.city', 0.55),
      loop('creak', 'ambience.creak', 0.15),
      loop('helicopter', null, 0),
      loop('winch', null, 0),
    ];
  const { cradle, wind, helicopter } = world;
  const height = clamp01(
    (cradle.centerHeight - GROUND_ALTITUDE) /
      (ROOF_ALTITUDE - 2 - GROUND_ALTITUDE),
  );
  const nearness = clamp01(
    1.05 - Math.max(0, helicopter.y - cradle.centerHeight) / 80,
  );
  const dangling = world.players.some(
    (p) => p.state === 'dangling' || p.state === 'climbing',
  );
  const creak =
    0.12 +
    (Math.abs(cradle.tiltDeg) / MAX_TILT_DEG) * 1.4 +
    Math.min(0.3, Math.abs(cradle.swayX) * 0.15) +
    (dangling ? 0.2 : 0);
  if (world.phase === 'ended')
    return [
      loop('sky', 'ambience.sky', 0.45),
      loop('city', 'ambience.city', 0.5),
      loop('creak', 'ambience.creak', 0.12),
      loop(
        'helicopter',
        'ambience.helicopter',
        world.winner === 'failed' ? 0.75 : Math.max(0.12, nearness) * 0.7,
      ),
      loop('winch', null, 0),
    ];
  const turning = winchesTurning(world);
  return [
    loop(
      'sky',
      'ambience.sky',
      0.45 +
        height * 0.4 +
        (wind.active ? clamp01(Math.abs(wind.strength)) * 0.35 : 0),
    ),
    loop('city', 'ambience.city', Math.max(0.2, 0.9 - height * 0.65)),
    loop('creak', 'ambience.creak', creak),
    loop('helicopter', 'ambience.helicopter', Math.max(0.12, nearness)),
    loop('winch', 'ambience.winch', turning ? 0.45 + turning * 0.25 : 0),
  ];
}
