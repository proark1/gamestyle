import {
  stepLabel,
  type GameAnalytics,
  type WireEvent,
} from '../../shared/analytics/protocol';
import type { CrewKey, GameReport, SessionRow } from '../analytics/types';

export const DAY_MS = 86_400_000;

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const grouped = new Intl.NumberFormat('en');
export const count = (value: number) =>
  value >= 10_000 ? compact.format(value) : grouped.format(value);
export const percent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '—';

export function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 10) return `${minutes} min ${seconds % 60} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
export const hours = (ms: number) =>
  ms < 3_600_000
    ? duration(ms)
    : `${(ms / 3_600_000).toFixed(ms < 36_000_000 ? 1 : 0)} h`;

/** A timeline offset such as `4:07` or `1:02:30`. */
export function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}:${pad(seconds % 60)}`
    : `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

const moment = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
export const when = (time: number) => moment.format(time);
// Report days are already shifted to the viewer's time zone.
const calendar = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
export const dayLabel = (day: number) => calendar.format(day * DAY_MS);

export const MODE_LABELS: Record<string, string> = {
  solo: 'Solo',
  host: 'Hosted a room',
  join: 'Joined a room',
  '': 'Never chose',
};
export const CREW_LABELS: Record<CrewKey, string> = {
  alone: 'Alone',
  npcs: 'Alone with NPCs',
  friends: 'With real players',
  mixed: 'Real players and NPCs',
};
export const ENTRY_LABELS: Record<string, string> = {
  direct: 'Direct or bookmark',
  invite: 'Invite link',
  home: 'From the game shelf',
  game: 'From another game',
  external: 'From another website',
  reload: 'Reloaded the page',
};
const ENDINGS: Record<string, string> = {
  left: 'Left mid-round',
  abandoned: 'Round called off',
  restarted: 'Restarted mid-round',
};

export function resultLabel(definition: GameAnalytics, key: string) {
  const [outcome, reason] = key.split(':');
  const head =
    outcome === 'won' ? 'Won' : outcome === 'lost' ? 'Lost' : 'No result';
  if (!reason) return head;
  return `${head} · ${definition.reasons?.[reason] ?? ENDINGS[reason] ?? reason}`;
}

export const actionLabel = (definition: GameAnalytics, key: string) =>
  definition.actions?.[key] ?? key.replaceAll('-', ' ');

export function exitLabel(session: Pick<SessionRow, 'exit' | 'live'>) {
  if (session.live) return 'Still here';
  if (session.exit === 'closed') return 'Closed the page';
  if (session.exit === 'left') return 'Left the page';
  return 'Went quiet';
}

export function crewText(humans: number, npcs: number) {
  const people = `${humans} ${humans === 1 ? 'person' : 'people'}`;
  return npcs ? `${people} + ${npcs} NPC${npcs === 1 ? '' : 's'}` : people;
}

export function eventText(definition: GameAnalytics, event: WireEvent) {
  const data = event.data ?? {};
  switch (event.type) {
    case 'opened':
      return `Opened the page · ${ENTRY_LABELS[String(data.entry)] ?? 'Direct or bookmark'} · ${
        data.device === 'touch' ? 'touch screen' : 'mouse and keyboard'
      }`;
    case 'mode':
      return `Chose: ${MODE_LABELS[String(data.mode)] ?? data.mode}`;
    case 'step':
      return stepLabel(definition, String(data.step));
    case 'round':
      return `Round ${data.n} started · ${crewText(Number(data.humans), Number(data.npcs))}`;
    case 'crew':
      return `Crew is now ${crewText(Number(data.humans), Number(data.npcs))}`;
    case 'end': {
      const key = data.reason ? `${data.outcome}:${data.reason}` : data.outcome;
      const score = data.score === undefined ? '' : ` · score ${data.score}`;
      return `Round ended · ${resultLabel(definition, String(key))}${score}`;
    }
    case 'leave':
      return 'Went back to the menu';
    case 'hidden':
      return 'Switched to another tab or app';
    case 'visible':
      return 'Came back to the page';
    case 'exit':
      return data.how === 'left' ? 'Left the page' : 'Closed the page';
    case 'return':
      return 'Came back to the page from history';
  }
}

export type Insight = { tone: 'warning' | 'info' | 'good'; text: string };

/** Plain-language hints about where a game loses or confuses its players. */
export function insights(
  report: GameReport,
  definition: GameAnalytics,
): Insight[] {
  const { totals } = report;
  if (totals.sessions < 5)
    return [
      {
        tone: 'info',
        text: 'Fewer than five visits in this period, too few to read much into.',
      },
    ];
  const found: Insight[] = [];
  const share = (part: number, total: number) =>
    `${Math.round((part / total) * 100)}%`;

  if (totals.played / totals.sessions < 0.5)
    found.push({
      tone: 'warning',
      text: `${share(totals.sessions - totals.played, totals.sessions)} of visitors never start a round. The menu or the first screen may be losing them.`,
    });

  const reached = new Map(report.funnel.map((row) => [row.step, row.sessions]));
  const path = [
    'playing',
    ...definition.milestones.map((milestone) => milestone.key),
    'finished',
  ];
  let worst: { from: string; to: string; lost: number } | undefined;
  for (let i = 1; i < path.length; i++) {
    const before = reached.get(path[i - 1]) ?? 0;
    const after = reached.get(path[i]) ?? 0;
    if (before < 5 || after >= before) continue;
    const lost = (before - after) / before;
    if (!worst || lost > worst.lost)
      worst = { from: path[i - 1], to: path[i], lost };
  }
  if (worst && worst.lost >= 0.3)
    found.push({
      tone: 'warning',
      text: `Biggest drop in a round: ${Math.round(worst.lost * 100)}% of sessions that reached “${stepLabel(definition, worst.from)}” never reached “${stepLabel(definition, worst.to)}”.`,
    });

  if (totals.hosted >= 5 && totals.hostedAlone / totals.hosted >= 0.5)
    found.push({
      tone: 'warning',
      text: `${share(totals.hostedAlone, totals.hosted)} of hosted rooms never got a second person. Inviting friends may need to be easier.`,
    });

  const decided = totals.wins + totals.losses;
  if (decided >= 10 && totals.wins / decided < 0.2)
    found.push({
      tone: 'warning',
      text: `Only ${share(totals.wins, decided)} of decided rounds are won. The game may be too hard.`,
    });
  else if (decided >= 10 && totals.wins / decided > 0.9)
    found.push({
      tone: 'info',
      text: `${share(totals.wins, decided)} of decided rounds are won. The game may be too easy.`,
    });

  const unfinished = report.results
    .filter((row) => /^ended:(left|abandoned|restarted)$/.test(row.key))
    .reduce((sum, row) => sum + row.rounds, 0);
  if (totals.rounds >= 10 && unfinished / totals.rounds >= 0.3)
    found.push({
      tone: 'warning',
      text: `${share(unfinished, totals.rounds)} of rounds end without a result: players leave, restart or the round is called off.`,
    });

  const pointer = totals.sessions - totals.touch;
  if (totals.touch >= 5 && pointer >= 5) {
    const touchRate = totals.touchPlayed / totals.touch;
    const pointerRate = (totals.played - totals.touchPlayed) / pointer;
    if (touchRate + 0.15 < pointerRate)
      found.push({
        tone: 'warning',
        text: `Touch-screen visitors start rounds less often (${Math.round(touchRate * 100)}% against ${Math.round(pointerRate * 100)}% with a mouse). Check the phone controls.`,
      });
  }

  if (totals.medianElapsed < 30_000)
    found.push({
      tone: 'warning',
      text: 'Half of all visits last under 30 seconds.',
    });

  if (totals.played >= 10) {
    const withNpcs = totals.crew.npcs + totals.crew.mixed;
    if (withNpcs / totals.played >= 0.3)
      found.push({
        tone: 'info',
        text: `${share(withNpcs, totals.played)} of sessions that played had NPCs in the crew.`,
      });
    const used = new Set(
      report.actions.filter((row) => row.total > 0).map((row) => row.action),
    );
    const unused = Object.keys(definition.actions ?? {}).filter(
      (key) => !used.has(key),
    );
    if (unused.length)
      found.push({
        tone: 'info',
        text: `Nobody used these in this period: ${unused
          .map((key) => actionLabel(definition, key).toLowerCase())
          .join(', ')}.`,
      });
  }

  return found.length
    ? found
    : [{ tone: 'good', text: 'Nothing stands out in this period.' }];
}
