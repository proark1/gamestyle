import type { GameDatabase } from '../../../db/contract';
import type { AccountConfig } from '../../accounts/server/config';
import { readSession } from '../../accounts/server/session';
import { sha256 } from '../../accounts/server/crypto';
import { readJsonObject } from '../../http/json-request';
import { hasAllowedOrigin } from '../../http/request-origin';
import { RequestBudget } from '../../http/request-budget';
import { RoomError } from '../../rooms/types';
import { changeCrew, createCrew, CrewError, joinCrew, readCrew } from './store';
import { readCrewRecords } from './records';

export function createCrewRoutes(deps: {
  db: () => GameDatabase;
  config: () => AccountConfig;
  now?: () => number;
}) {
  const budget = new RequestBudget(16, 4096);
  const handle = (write: boolean) => async (request: Request) => {
    const reply = (body: unknown, status = 200) =>
      Response.json(body, {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    let release: (() => void) | undefined;
    try {
      release = budget.enter();
      const config = deps.config(),
        now = deps.now?.() ?? Date.now();
      if (write && !hasAllowedOrigin(request, config.publicOrigin))
        throw new CrewError('Open Jumbleyard to manage your crew.', 403);
      const db = deps.db(),
        session = await readSession(request, { db, config, now });
      if (!session)
        throw new CrewError('Sign in to keep a crew across parties.', 401);
      const id = session.account.id,
        ownerKey = await sha256(`crews-v1:${id}`);
      budget.take(id, 30, 1, now);
      let invite;
      if (write) {
        const body = await readJsonObject(request, 4096);
        if (body.ownerKey !== ownerKey)
          throw new CrewError(
            'Your account changed. Reload the clubhouse.',
            409,
          );
        if (body.op === 'create')
          await createCrew(db, id, body.name, body.emblem, now);
        else if (body.op === 'join') {
          budget.take(`join:${id}`, 6, 0.1, now);
          await joinCrew(db, id, body.code, now);
        } else invite = await changeCrew(db, id, body, now);
      }
      const crew = await readCrew(db, id);
      return reply({
        crew,
        ...(crew ? { records: await readCrewRecords(db, crew.id) } : {}),
        ownerKey,
        ...(invite ? { invite } : {}),
      });
    } catch (error) {
      if (error instanceof CrewError || error instanceof RoomError)
        return reply({ error: error.message }, error.status);
      console.error(
        'Crew request failed',
        error instanceof Error ? error.name : 'Unknown error',
      );
      return reply(
        { error: 'The clubhouse could not be saved. Please try again.' },
        500,
      );
    } finally {
      release?.();
    }
  };
  return { GET: handle(false), POST: handle(true) };
}
