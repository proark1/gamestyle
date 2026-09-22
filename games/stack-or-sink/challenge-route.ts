import type { GameDatabase } from '../../db/contract';
import type { AccountConfig } from '../../shared/accounts/server/config';
import { readSession } from '../../shared/accounts/server/session';
import { initializeInventory } from '../../shared/commerce/server/inventory';
import { readStackProgress } from '../../shared/challenges/server/progress';
import { readRankedStack } from '../../shared/challenges/server/ranked';
import { RequestBudget } from '../../shared/http/request-budget';
import { readJsonObject } from '../../shared/http/json-request';
import { hasAllowedOrigin } from '../../shared/http/request-origin';
import { RoomError } from '../../shared/rooms/types';
import { verifiedStackRoom } from './challenge-server';

export function createStackChallengeRoutes(deps: {
  db: () => GameDatabase;
  config: () => AccountConfig;
  now?: () => number;
}) {
  const budget = new RequestBudget(16, 4096);
  const handle = (write: boolean) => async (request: Request) => {
    const json = (value: unknown, status = 200) =>
      Response.json(value, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      });
    let release: (() => void) | undefined;
    try {
      release = budget.enter();
      const config = deps.config(),
        db = deps.db(),
        now = deps.now?.() ?? Date.now();
      if (write && !hasAllowedOrigin(request, config.publicOrigin))
        throw new RoomError(
          'Open Jumbleyard to play a verified challenge.',
          403,
        );
      const session = await readSession(request, { db, config, now });
      if (!session)
        throw new RoomError(
          'Sign in to play verified challenges and keep your rewards.',
          401,
        );
      const accountId = session.account.id;
      budget.take(accountId, 80, 25, now);
      if (!write)
        return json(
          new URL(request.url).searchParams.has('board')
            ? await readRankedStack(db, accountId, now)
            : await readStackProgress(db, accountId, now),
        );
      const body = await readJsonObject(request, 8192);
      if (body.op === 'create' || body.op === 'join') {
        budget.take(`entry:${accountId}`, 6, 0.1, now);
        await initializeInventory(db, accountId, now);
      }
      return json(await verifiedStackRoom(db, accountId, body, now));
    } catch (error) {
      if (error instanceof RoomError)
        return json({ error: error.message }, error.status);
      console.error(
        'Verified challenge failed',
        error instanceof Error ? error.name : 'Unknown',
      );
      return json(
        { error: 'Could not save your challenge. Reconnect and try again.' },
        500,
      );
    } finally {
      release?.();
    }
  };
  return { GET: handle(false), POST: handle(true) };
}
