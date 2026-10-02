import type {
  CourseEvent,
  CourseEventKind,
  CoursePlayer,
  CourseWorld,
} from './types';

export type FeedbackTier = 'minor' | 'course' | 'major' | 'celebration';
export type CupCelebration = {
  kind: 'chain' | 'everybody';
  count: number;
  at: number;
  players: string[];
};

const COURSE_EVENTS = new Set<CourseEventKind>(['wall', 'bridge']);
const MAJOR_EVENTS = new Set<CourseEventKind>(['platform', 'cup', 'assist']);

export function feedbackTier(event: CourseEvent): FeedbackTier {
  if (event.kind === 'multi-cup' || event.kind === 'match')
    return 'celebration';
  if (MAJOR_EVENTS.has(event.kind)) return 'major';
  if (COURSE_EVENTS.has(event.kind)) return 'course';
  return 'minor';
}

export function presentationProfile(reducedMotion: boolean, mobile: boolean) {
  if (reducedMotion)
    return { particles: 4, camera: 0, trails: false, timeScale: 1 };
  return {
    particles: mobile ? 12 : 24,
    camera: mobile ? 0.65 : 1,
    trails: true,
    timeScale: 1,
  };
}

export class CupSequenceTracker {
  private seen = new Set<number>();
  private cups: CourseEvent[] = [];
  private announced = 0;

  ingest(events: readonly CourseEvent[]): CupCelebration | null {
    let newest: CourseEvent | undefined;
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (event.kind === 'cup' && event.player) {
        this.cups.push(event);
        newest = event;
      }
    }
    if (!newest) return null;
    const cutoff = newest.at - 1_200;
    this.cups = this.cups.filter((event) => event.at >= cutoff);
    const players = [...new Set(this.cups.map((event) => event.player!))];
    if (players.length < 3 || players.length <= this.announced) return null;
    this.announced = players.length;
    return {
      kind: players.length >= 4 ? 'everybody' : 'chain',
      count: players.length,
      at: newest.at,
      players,
    };
  }

  reset() {
    this.seen.clear();
    this.cups = [];
    this.announced = 0;
  }
}

export function playerStatus(world: CourseWorld, playerId: string) {
  const ball = world.balls.find((candidate) => candidate.owner === playerId);
  const player = world.players.find((candidate) => candidate.id === playerId);
  if (ball?.holed || player?.finishedAt) return 'holed' as const;
  if (ball?.moving) return 'moving' as const;
  if (world.phase === 'opening' && player?.openingReady)
    return 'locked' as const;
  return 'aiming' as const;
}

export function latestCourseMessage(
  world: CourseWorld,
  de: boolean,
): string | null {
  const event = world.events.at(-1);
  if (!event || world.clock - event.at > 1_900) return null;
  const player = world.players.find(
    (candidate) => candidate.id === event.player,
  );
  const name = player?.name ?? (de ? 'Jemand' : 'Someone');
  const messages: Partial<Record<CourseEventKind, [string, string]>> = {
    wall: ['Wall rotated — new bank open', 'Wand gedreht — neue Bande offen'],
    bridge: [
      'Bridge tipped — mind the slope',
      'Brücke gekippt — Vorsicht Gefälle',
    ],
    platform: ['The cup moved!', 'Das Loch ist gewandert!'],
    assist: [
      `${name} earns an assist star`,
      `${name} erhält einen Assist-Stern`,
    ],
    recover: ['Ball recovered · +1 stroke', 'Ball zurückgesetzt · +1 Schlag'],
    cup: [`${name} is in!`, `${name} ist drin!`],
  };
  return messages[event.kind]?.[de ? 1 : 0] ?? null;
}

export type CourseAward = {
  key: 'best-bank' | 'biggest-assist' | 'course-changer';
  player?: CoursePlayer;
};

export function courseAwards(world: CourseWorld): CourseAward[] {
  const ranked = [...world.players].sort(
    (a, b) => a.totalStrokes - b.totalStrokes || b.assists - a.assists,
  );
  const assisted = [...world.players].sort(
    (a, b) => b.assists - a.assists || a.totalStrokes - b.totalStrokes,
  );
  const changes = new Map<string, number>();
  for (const event of world.events)
    if (
      event.player &&
      (event.kind === 'wall' ||
        event.kind === 'bridge' ||
        event.kind === 'platform')
    )
      changes.set(event.player, (changes.get(event.player) ?? 0) + 1);
  const changerId = [...changes].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    { key: 'best-bank', player: ranked[0] },
    { key: 'biggest-assist', player: assisted[0] },
    {
      key: 'course-changer',
      player:
        world.players.find((player) => player.id === changerId) ?? ranked[0],
    },
  ];
}
