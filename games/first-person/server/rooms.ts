import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { playerName, hashToken as hash } from '../../../shared/rooms/identity';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import { getBinding } from '@/db/index';
import type { GameDatabase } from '@/db/contract';
import {
  applyAction,
  clamp,
  freshWorld,
  START,
  type Action,
  type Builder,
  type World,
} from '@/games/first-person/model';

type Room = { code: string; host: string; world: string; version: number };
type Player = Builder & { token_hash: string; slot: number; room: string };
const ACTIVE = 60_000;
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const name = (value: unknown) => playerName(value, 'Builder');
function publicPlayer(p: Player): Builder {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    seen: p.seen,
  };
}
async function snapshot(db: GameDatabase, code: string, now: number) {
  const [room, players] = await Promise.all([
    db
      .prepare('SELECT * FROM handwerker_fp_rooms WHERE code = ?')
      .bind(code)
      .first<Room>(),
    db
      .prepare(
        'SELECT * FROM handwerker_fp_players WHERE room = ? AND seen > ? ORDER BY slot',
      )
      .bind(code, now - ACTIVE)
      .all<Player>(),
  ]);
  if (!room) throw new Error('This Brick by Hand site does not exist.');
  return {
    code,
    host: room.host,
    world: JSON.parse(room.world),
    version: room.version,
    players: players.results.map(publicPlayer),
    now,
  };
}
function insertPlayer(
  db: GameDatabase,
  code: string,
  id: string,
  tokenHash: string,
  playerName: string,
  slot: number,
  now: number,
) {
  return db
    .prepare(
      'INSERT INTO handwerker_fp_players (id, room, token_hash, name, color, slot, x, y, z, yaw, pitch, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      code,
      tokenHash,
      playerName,
      slot,
      slot,
      START.x + slot * 0.8,
      START.y,
      START.z,
      START.yaw,
      START.pitch,
      now,
    );
}
async function handleRequest(request: Request) {
  try {
    if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
      return json(
        { error: 'This request did not come from Brick by Hand.' },
        403,
      );
    const body = await readRoomRequest(request, 4000);
    const db = getBinding(),
      now = Date.now();
    if (body.op === 'create') {
      const id = crypto.randomUUID(),
        token = crypto.randomUUID() + crypto.randomUUID(),
        tokenHash = await hash(token);
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let i = 0; i < 5; i++) {
        const code = Array.from(
          crypto.getRandomValues(new Uint8Array(6)),
          (n) => alphabet[n % alphabet.length],
        ).join('');
        try {
          await db.batch([
            db
              .prepare(
                'INSERT INTO handwerker_fp_rooms (code, host, world, version, updated) VALUES (?, ?, ?, 0, ?)',
              )
              .bind(code, id, JSON.stringify(freshWorld()), now),
            insertPlayer(db, code, id, tokenHash, name(body.name), 0, now),
          ]);
          return json({
            session: { code, id, token },
            snapshot: await snapshot(db, code, now),
          });
        } catch (e) {
          if (!String(e).includes('UNIQUE')) throw e;
        }
      }
      return json({ error: 'Please try again in a moment.' }, 503);
    }
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    if (!/^[A-Z2-9]{6}$/.test(code))
      return json(
        { error: 'A room code contains six letters or digits.' },
        400,
      );
    const room = await db
      .prepare('SELECT * FROM handwerker_fp_rooms WHERE code = ?')
      .bind(code)
      .first<Room>();
    if (!room)
      return json(
        {
          error:
            'Brick by Hand site not found. Permit Pending room codes do not work here.',
        },
        404,
      );
    if (body.op === 'join') {
      const id = crypto.randomUUID(),
        token = crypto.randomUUID() + crypto.randomUUID(),
        tokenHash = await hash(token);
      // Release an inactive slot while keeping its token and personal inventory resumable.
      await db
        .prepare(
          'UPDATE handwerker_fp_players SET slot = -rowid WHERE room = ? AND seen <= ? AND slot >= 0',
        )
        .bind(code, now - ACTIVE)
        .run();
      let joined = false;
      for (let slot = 0; slot < 4; slot++) {
        try {
          await insertPlayer(
            db,
            code,
            id,
            tokenHash,
            name(body.name),
            slot,
            now,
          ).run();
          joined = true;
          break;
        } catch (e) {
          if (!String(e).includes('UNIQUE')) throw e;
        }
      }
      if (!joined)
        return json(
          { error: 'All four hard hats are taken. The site is full.' },
          409,
        );
      await db
        .prepare(
          'UPDATE handwerker_fp_rooms SET host = (SELECT id FROM handwerker_fp_players WHERE room = ? AND seen > ? ORDER BY slot LIMIT 1) WHERE code = ? AND NOT EXISTS (SELECT 1 FROM handwerker_fp_players WHERE id = handwerker_fp_rooms.host AND seen > ?)',
        )
        .bind(code, now - ACTIVE, code, now - ACTIVE)
        .run();
      return json({
        session: { code, id, token },
        snapshot: await snapshot(db, code, now),
      });
    }
    if (
      typeof body.id !== 'string' ||
      typeof body.token !== 'string' ||
      body.token.length > 100
    )
      return json({ error: 'Please rejoin the building site.' }, 401);
    const tokenHash = await hash(body.token);
    const player = await db
      .prepare(
        'SELECT * FROM handwerker_fp_players WHERE room = ? AND id = ? AND token_hash = ?',
      )
      .bind(code, body.id, tokenHash)
      .first<Player>();
    if (!player)
      return json({ error: 'Your session has expired. Please rejoin.' }, 401);
    if (body.op === 'leave') {
      await db
        .prepare(
          'DELETE FROM handwerker_fp_players WHERE id = ? AND token_hash = ?',
        )
        .bind(body.id, tokenHash)
        .run();
      return json({ ok: true });
    }
    if (body.op !== 'sync' && body.op !== 'action')
      return json({ error: 'Unknown action.' }, 400);
    if (player.slot < 0) {
      await db
        .prepare(
          'UPDATE handwerker_fp_players SET slot = -rowid WHERE room = ? AND seen <= ? AND slot >= 0',
        )
        .bind(code, now - ACTIVE)
        .run();
      let reclaimed = false;
      for (let slot = 0; slot < 4; slot++) {
        try {
          await db
            .prepare('UPDATE handwerker_fp_players SET slot = ? WHERE id = ?')
            .bind(slot, player.id)
            .run();
          reclaimed = true;
          break;
        } catch (e) {
          if (!String(e).includes('UNIQUE')) throw e;
        }
      }
      if (!reclaimed)
        return json(
          {
            error: 'The site is currently full. Your inventory is still saved.',
          },
          409,
        );
    }
    const pos = body.position as Record<string, unknown> | undefined;
    if (
      pos &&
      [pos.x, pos.y, pos.z, pos.yaw, pos.pitch].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      )
    ) {
      player.x = clamp(pos.x as number, -10, 10);
      player.z = clamp(pos.z as number, -9, 9);
      player.y = clamp(pos.y as number, 1.6, 7);
      player.yaw = (pos.yaw as number) % (Math.PI * 2);
      player.pitch = clamp(pos.pitch as number, -1.45, 1.45);
    }
    await db
      .prepare(
        'UPDATE handwerker_fp_players SET x = ?, y = ?, z = ?, yaw = ?, pitch = ?, seen = ? WHERE id = ?',
      )
      .bind(
        player.x,
        player.y,
        player.z,
        player.yaw,
        player.pitch,
        now,
        player.id,
      )
      .run();
    await db
      .prepare(
        'UPDATE handwerker_fp_rooms SET host = (SELECT id FROM handwerker_fp_players WHERE room = ? AND seen > ? ORDER BY slot LIMIT 1) WHERE code = ? AND NOT EXISTS (SELECT 1 FROM handwerker_fp_players WHERE id = handwerker_fp_rooms.host AND seen > ?)',
      )
      .bind(code, now - ACTIVE, code, now - ACTIVE)
      .run();
    if (body.op === 'action') {
      const action = body.action as Action | undefined;
      if (
        !action ||
        ![
          'supply',
          'mixer',
          'empty-mixer',
          'place',
          'mortar',
          'remove',
          'race',
          'shout',
          'horn',
        ].includes(action.type) ||
        typeof body.actionId !== 'string' ||
        body.actionId.length > 100
      )
        return json({ error: 'Invalid building action.' }, 400);
      for (let i = 0; i < 8; i++) {
        const current = await db
          .prepare('SELECT * FROM handwerker_fp_rooms WHERE code = ?')
          .bind(code)
          .first<Room>();
        if (!current) return json({ error: 'Building site not found.' }, 404);
        const world = JSON.parse(current.world) as World;
        const updated = applyAction(
          world,
          action,
          publicPlayer(player),
          now,
          `${player.id}:${body.actionId}`,
        );
        if (updated === world) break;
        const result = await db
          .prepare(
            'UPDATE handwerker_fp_rooms SET world = ?, version = version + 1, updated = ? WHERE code = ? AND version = ?',
          )
          .bind(JSON.stringify(updated), now, code, current.version)
          .run();
        if (result.meta.changes) break;
        if (i === 7)
          return json(
            { error: 'Another builder got there first. Try the action again.' },
            409,
          );
      }
    }
    return json({ snapshot: await snapshot(db, code, now) });
  } catch (e) {
    if (e instanceof RoomError) return budgetError(e);
    const message = e instanceof Error ? e.message : '';
    if (/SQLITE|D1_|database|binding|fetch failed/i.test(message))
      return json(
        {
          error:
            'The building site is unavailable right now. Please try again shortly.',
        },
        503,
      );
    return json({ error: message || 'The action did not work.' }, 400);
  }
}

export const POST = withRequestBudget(handleRequest);
