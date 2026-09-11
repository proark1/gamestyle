import type { GameAnalytics, PlayState } from '../../shared/analytics/protocol';
import type { Session, Snapshot } from './model';

export const siteAnalytics: GameAnalytics = {
  game: 'first-person',
  milestones: [
    { key: 'materials', label: 'Gathered materials' },
    { key: 'mortar', label: 'Mixed mortar or laid a brick' },
    { key: 'wall', label: 'Laid twelve bonded bricks' },
    { key: 'posts', label: 'Raised two posts' },
    { key: 'roof', label: 'Put up two roof panels' },
    { key: 'race', label: 'Started the roof-raising race' },
    { key: 'race-won', label: 'Won the roof-raising race' },
  ],
  labels: {
    lobby: 'Opened the building site',
    playing: 'Started building',
  },
  actions: {
    supply: 'Took supplies',
    mixer: 'Worked the mixer',
    'empty-mixer': 'Emptied the mixer',
    place: 'Placed a part',
    mortar: 'Spread mortar',
    remove: 'Removed a part',
    race: 'Started the race',
    shout: 'Shouted',
    horn: 'Sounded the horn',
  },
};

/** The tutorial steps and part counts the game already derives for its HUD. */
export type SiteProgress = {
  step: number;
  bricks: number;
  posts: number;
  roofs: number;
  racing: boolean;
  raceWon: boolean;
};

/** Building never ends; the whole visit to one site counts as one round. */
export function sitePlayState(
  snapshot: Snapshot,
  session: Session,
  playing: boolean,
  progress: SiteProgress,
): PlayState {
  const base = {
    mode: snapshot.host === session.id ? ('host' as const) : ('join' as const),
    room: session.code,
    humans: snapshot.players.length,
    round: 'site',
  };
  if (!playing) return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  if (progress.step >= 1) milestones.push('materials');
  if (progress.step >= 2) milestones.push('mortar');
  if (progress.bricks >= 12) milestones.push('wall');
  if (progress.posts >= 2) milestones.push('posts');
  if (progress.roofs >= 2) milestones.push('roof');
  if (progress.racing) milestones.push('race');
  if (progress.raceWon) milestones.push('race-won');
  return { stage: 'playing', ...base, milestones };
}
