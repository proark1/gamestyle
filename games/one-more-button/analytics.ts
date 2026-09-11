import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { ButtonSnapshot } from './types';

export const buttonAnalytics: GameAnalytics = {
  game: 'one-more-button',
  milestones: [
    { key: 'press-1', label: 'Pressed the button' },
    { key: 'press-4', label: 'Four presses' },
    { key: 'press-8', label: 'Eight presses' },
    { key: 'press-12', label: 'Twelve presses' },
    { key: 'jackpot', label: 'All sixteen presses' },
    { key: 'escape', label: 'The final escape started' },
    { key: 'banked', label: 'Someone cashed out' },
  ],
  reasons: {
    'cashed-out': 'The crew banked winnings',
    'empty-handed': 'Nobody banked anything',
  },
  actions: {
    press: 'Pressed the button',
    exit: 'Cashed out at the exit',
    stop: 'Shouted stop',
    help: 'Helped a dazed friend',
    jump: 'Jumped',
    start: 'Started the show',
    restart: 'Started another show',
  },
};

export function buttonPlayState(
  snapshot: ButtonSnapshot,
  session: { code: string; id: string },
): PlayState {
  const { world } = snapshot;
  const base = {
    mode: modeOf(session, snapshot.host),
    room: session.code,
    humans: world.players.length,
    round: world.started,
  };
  if (world.phase === 'lobby') return { stage: 'lobby', ...base };
  const milestones: string[] = [];
  for (const presses of [1, 4, 8, 12])
    if (world.presses >= presses) milestones.push(`press-${presses}`);
  if (world.presses >= 16) milestones.push('jackpot');
  if (world.escapeAt > 0) milestones.push('escape');
  if (world.banked > 0) milestones.push('banked');
  if (world.phase === 'playing' || world.phase === 'escape')
    return { stage: 'playing', ...base, milestones };
  return {
    stage: 'finished',
    ...base,
    milestones,
    result:
      world.phase === 'won'
        ? { outcome: 'won', reason: 'cashed-out', score: world.banked }
        : { outcome: 'lost', reason: 'empty-handed', score: 0 },
  };
}
