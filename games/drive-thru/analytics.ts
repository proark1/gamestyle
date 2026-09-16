import {
  modeOf,
  type GameAnalytics,
  type PlayState,
} from '../../shared/analytics/protocol';
import type { DriveThruSnapshot } from './types';

export const driveThruAnalytics: GameAnalytics = {
  game: 'drive-thru',
  milestones: [
    { key: 'order-received', label: 'Deciphered crackly intercom order' },
    { key: 'patty-flipped', label: 'Flipped sizzling patty with spatula' },
    { key: 'shake-vented', label: 'Vented milkshake pressure relief valve' },
    { key: 'fryer-saved', label: 'Lifted fryer basket before grease fire' },
    {
      key: 'short-stop-reached',
      label: 'Ragdoll leaned across curb gap to grab tray',
    },
    { key: 'order-served', label: 'Successfully served full fast-food order' },
    {
      key: 'pole-smashed',
      label: 'Reversed sedan into drive-thru speaker pole',
    },
    {
      key: 'shake-splatted',
      label: 'Blinded by milkshake exploding on windshield',
    },
    { key: 'grease-fire', label: 'Triggered kitchen grease fire disaster' },
  ],
  reasons: {
    'shift-survived': 'Survived the fast-food rush with happy customers',
    'pole-demolished': 'Sedan completely destroyed the speaker box pole',
    'kitchen-burned': 'Restaurant closed due to catastrophic grease fire',
    'curb-disaster':
      'Order dropped into the sewer drain between car and window',
  },
  actions: {
    start: 'Started drive-thru shift',
    restart: 'Restarted shift',
    'switch-role': 'Switched crew role',
    honk: 'Honked erratic car horn',
    'flip-patty': 'Flipped burger patty',
    'stack-ingredient': 'Stacked burger ingredient',
    'vent-milkshake': 'Vented milkshake machine',
    'lift-fryer': 'Lifted fryer basket',
    'push-tray': 'Pushed food tray to window',
    'reach-tray': 'Leaned out window for handoff',
    'toggle-wipers': 'Activated windshield wipers',
    'swat-distraction': 'Quieted cabin toddler distraction',
  },
};

export function driveThruPlayState(
  snapshot: DriveThruSnapshot,
  session: { code: string; id: string },
): PlayState {
  const bots = snapshot.players.filter((p) => p.bot).length;
  const base = {
    mode: modeOf(session, snapshot.isHost ? session.id : ''),
    room: session.code,
    humans: snapshot.players.length - bots,
    npcs: bots,
    round: 1,
  };

  if (snapshot.phase === 'lobby') return { stage: 'lobby', ...base };

  const milestones: string[] = [];
  if (snapshot.ticket) milestones.push('order-received');
  if (snapshot.kitchen.patties.some((p) => p.state === 'cooked'))
    milestones.push('patty-flipped');
  if (snapshot.ordersServed > 0) milestones.push('order-served');

  if (snapshot.phase === 'completed') {
    return {
      stage: 'finished',
      ...base,
      result: {
        outcome: 'won',
        reason: 'shift-survived',
        score: snapshot.score,
      },
      milestones,
    };
  }

  if (snapshot.phase === 'meltdown') {
    let reason = 'curb-disaster';
    if (snapshot.failState === 'pole_crash') reason = 'pole-demolished';
    if (snapshot.failState === 'grease_fire') reason = 'kitchen-burned';
    return {
      stage: 'finished',
      ...base,
      result: {
        outcome: 'ended',
        reason,
        score: snapshot.score,
      },
      milestones,
    };
  }

  return {
    stage: 'playing',
    ...base,
    milestones,
  };
}
