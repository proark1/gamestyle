import { getBinding } from '@/db/index';
import { audioAccess } from '@/shared/audio/access';
import { RequestBudget, budgetError } from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { ANALYTICS_GAMES, analyticsGame } from '../catalog';
import { isGame } from '@/shared/games/identity';
import {
  PLATFORMS,
  ENGINES,
  type DiagnosticPlatform,
  type DiagnosticEngine,
} from '@/shared/diagnostics/protocol';
import { healthReport } from './diagnostics-store';
import {
  gameReport,
  listSessions,
  overview,
  sessionDetail,
  type Range,
} from './store';

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const budget = new RequestBudget(8, 256);
const number = (value: string | null, fallback: number) => {
  const parsed = value === null || value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value: string | null) =>
  value && value.length <= 80 ? value : undefined;

/** Reports for the admin page, behind the same password as the sound workshops. */
export async function GET(request: Request) {
  let release: (() => void) | undefined;
  try {
    release = budget.enter();
    // One shared bucket bounds both password guesses and report load.
    if (request.headers.get('x-audio-admin')) budget.take('admin', 120, 2);
    const query = new URL(request.url).searchParams;
    const access = await audioAccess(request);
    if (query.has('access')) return json(access);
    if (!access.configured)
      return json(
        { error: 'Administrator access has not been configured.' },
        503,
      );
    if (!access.authorized)
      return json({ error: 'Sign in with the administrator password.' }, 401);

    const now = Date.now();
    const range: Range = {
      from: Math.max(0, number(query.get('from'), 0)),
      to: number(query.get('to'), now + 60_000),
      tz: Math.max(-900, Math.min(900, number(query.get('tz'), 0))),
      now,
    };
    const db = getBinding();
    switch (query.get('view')) {
      case 'health': {
        const game = query.get('game') || undefined;
        const platform = query.get('platform') || undefined;
        const engine = query.get('engine') || undefined;
        const release = query.get('release') || undefined;
        if (
          (game && !isGame(game)) ||
          (platform && !PLATFORMS.includes(platform as DiagnosticPlatform)) ||
          (engine && !ENGINES.includes(engine as DiagnosticEngine)) ||
          (release && !/^[a-zA-Z0-9._-]{1,64}$/.test(release))
        )
          return json({ error: 'Invalid health filter.' }, 400);
        return json(
          await healthReport(db, range, {
            game: game as import('@/shared/games/identity').Game | undefined,
            platform: platform as DiagnosticPlatform | undefined,
            engine: engine as DiagnosticEngine | undefined,
            release,
          }),
        );
      }
      case 'overview':
        return json(await overview(db, ANALYTICS_GAMES, range));
      case 'game': {
        const definition = analyticsGame(query.get('game') ?? '');
        if (!definition) return json({ error: 'Game not found.' }, 404);
        return json(await gameReport(db, definition, range));
      }
      case 'sessions':
        return json(
          await listSessions(db, range, {
            game: analyticsGame(query.get('game') ?? '')?.game,
            crew: text(query.get('crew')),
            mode: text(query.get('mode')),
            outcome: text(query.get('outcome')),
            device: text(query.get('device')),
            step: text(query.get('step')),
            cursor: text(query.get('cursor')),
            limit: number(query.get('limit'), 50),
          }),
        );
      case 'session': {
        const detail = await sessionDetail(db, query.get('id') ?? '', now);
        return detail
          ? json(detail)
          : json({ error: 'Session not found.' }, 404);
      }
      default:
        return json({ error: 'Choose a report.' }, 400);
    }
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    console.error('Admin report failed', error);
    return json({ error: 'Reports are unavailable. Try again shortly.' }, 503);
  } finally {
    release?.();
  }
}
