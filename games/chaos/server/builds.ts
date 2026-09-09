import { readJsonObject } from '@/shared/http/json-request';
import { withRequestBudget, budgetError } from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import { challengeSnapshot } from '@/games/chaos/disaster-challenge';
import { getBinding } from '@/db/index';
import { buildSnapshot } from '@/games/chaos/build-snapshot';
import { hashIdentity } from '@/games/chaos/build-storage';
import { withRoomLock } from '@/games/chaos/room-lock';
import type { World } from '@/games/chaos/model';
const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
const profile = (request: Request) =>
  /(?:^|;\s*)bodge_build_shelf=([a-f0-9]{64})(?:;|$)/.exec(
    request.headers.get('cookie') || '',
  )?.[1];
export async function GET(request: Request) {
  const token = profile(request);
  if (!token) return json({ builds: [] });
  const rows = await getBinding()
    .prepare(
      'SELECT id, title, author, source_id, created FROM handwerker_saved_builds WHERE owner_hash = ? ORDER BY created DESC LIMIT 40',
    )
    .bind(await hashIdentity(token))
    .all();
  return json({ builds: rows.results });
}
async function handleRequest(request: Request) {
  try {
    if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
      return json({ error: 'Save builds from the game itself.' }, 403);
    const body = await readJsonObject(request, 1500);
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.code !== 'string' ||
      !/^[A-Z2-9]{6}$/.test(body.code) ||
      typeof body.id !== 'string' ||
      typeof body.token !== 'string' ||
      body.token.length > 100
    )
      return json({ error: 'Join a site before saving a build.' }, 400);
    const title =
      typeof body.title === 'string'
        ? body.title
            .replace(/[\p{C}<>]/gu, '')
            .trim()
            .slice(0, 60)
        : '';
    if (!title) return json({ error: 'Give this build a title.' }, 400);
    const db = getBinding(),
      now = Date.now();
    const session = { code: body.code, id: body.id, token: body.token };
    return await withRoomLock(body.code, async () => {
      const player = await db
        .prepare(
          'SELECT name FROM handwerker_players WHERE room = ? AND id = ? AND token_hash = ? AND seen > ?',
        )
        .bind(
          session.code,
          session.id,
          await hashIdentity(session.token),
          now - 60000,
        )
        .first<{ name: string }>();
      if (!player)
        return json(
          { error: 'Your site pass has expired. Rejoin to save.' },
          401,
        );
      const room = await db
        .prepare('SELECT world FROM handwerker_rooms WHERE code = ?')
        .bind(session.code)
        .first<{ world: string }>();
      if (!room) return json({ error: 'This site no longer exists.' }, 404);
      const token =
        profile(request) ||
        crypto.randomUUID().replaceAll('-', '') +
          crypto.randomUUID().replaceAll('-', '');
      const owner = await hashIdentity(token);
      const count = await db
        .prepare(
          'SELECT COUNT(*) AS count FROM handwerker_saved_builds WHERE owner_hash = ? AND created > ?',
        )
        .bind(owner, now - 60000)
        .first<{ count: number }>();
      if ((count?.count || 0) >= 5)
        return json(
          {
            error: 'You saved several builds just now. Try again in a minute.',
          },
          429,
        );
      const world = JSON.parse(room.world) as World,
        id = crypto.randomUUID().replaceAll('-', '');
      if (body.kind === 'challenge' && body.roundId !== world.party?.roundId)
        return json(
          {
            error: 'The round changed. Share the result of your current round.',
          },
          409,
        );
      const saved =
        body.kind === 'challenge'
          ? challengeSnapshot(world)
          : buildSnapshot(world);
      await db
        .prepare(
          'INSERT INTO handwerker_saved_builds (id, owner_hash, title, author, source_id, snapshot, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          owner,
          title,
          player.name,
          world.sharedFrom || null,
          JSON.stringify(saved),
          now,
        )
        .run();
      return json({ id, url: `/build/${id}` }, 201, {
        'Set-Cookie': `bodge_build_shelf=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
      });
    });
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    return json(
      {
        error:
          error instanceof Error &&
          error.message.startsWith('Finish a successful')
            ? error.message
            : 'The build could not be saved. Try again.',
      },
      400,
    );
  }
}

export const POST = withRequestBudget(handleRequest);
