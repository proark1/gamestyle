import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { playerName, hashToken as hash } from '../../../shared/rooms/identity';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import {
  DISASTER_RULES,
  invalidateChallengeRun,
} from '@/games/chaos/disaster-challenge';
import { setDaily } from '@/games/chaos/daily';
import { readBuild, BUILD_ID } from '@/games/chaos/build-storage';
import { restoreBuild } from '@/games/chaos/build-snapshot';
import { configureInspection, makeInspection } from '@/games/chaos/inspection';
import { getBinding } from '@/db/index';
import type { GameDatabase, WriteResult } from '@/db/contract';
import {
  applyAction,
  clamp,
  event,
  freshWorld,
  tickWorld,
  JOBS,
  type Action,
  type Player,
  type World,
} from '@/games/chaos/model';
import { mapBounds, validMap } from '@/games/chaos/maps';
import {
  enableParty,
  publicWorld,
  privateCard,
  CREW_JOBS,
  type CrewJob,
} from '@/games/chaos/party';
import { leaveVoice } from '@/games/chaos/voice/server';
import { withRoomLock } from '@/games/chaos/room-lock';

type RoomRow = {
  code: string;
  host: string;
  world: string;
  version: number;
  updated: number;
};
type PlayerRow = Player & { token_hash: string; room: string; slot: number };
const ACTIVE_MS = 60000;
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const safeName = (value: unknown) => playerName(value, 'Apprentice');
function publicPlayer(p: PlayerRow): Player {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    z: p.z,
    angle: p.angle,
    jump: p.jump,
    seen: p.seen,
  };
}
async function readPlayers(db: GameDatabase, code: string, now: number) {
  const rows = await db
    .prepare(
      'SELECT * FROM handwerker_players WHERE room = ? AND seen > ? ORDER BY slot',
    )
    .bind(code, now - ACTIVE_MS)
    .all<PlayerRow>();
  return rows.results.map(publicPlayer);
}
async function snapshot(
  db: GameDatabase,
  code: string,
  now: number,
  viewer?: string,
) {
  const [room, players] = await Promise.all([
    db
      .prepare('SELECT * FROM handwerker_rooms WHERE code = ?')
      .bind(code)
      .first<RoomRow>(),
    readPlayers(db, code, now),
  ]);
  if (!room)
    throw new Error('This building site does not exist. Check the room code.');
  const world = JSON.parse(room.world) as World;
  return {
    recordingEnabled: process.env.PARTY_RECORDING_ENABLED !== 'false',
    world: publicWorld(world),
    mission: privateCard(world, viewer),
    actionSeq: viewer ? (world.partyPrivate?.receipts[viewer]?.seq ?? 0) : 0,
    players: players.map((p) => ({ ...p, y: world.actors?.[p.id]?.y ?? 0.43 })),
    host: room.host,
    code,
    now,
    version: room.version,
  };
}
function insertPlayer(
  db: GameDatabase,
  p: {
    id: string;
    room: string;
    tokenHash: string;
    name: string;
    color: number;
    slot: number;
    now: number;
  },
) {
  return db
    .prepare(
      'INSERT INTO handwerker_players (id, room, token_hash, name, color, slot, x, z, angle, jump, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    )
    .bind(
      p.id,
      p.room,
      p.tokenHash,
      p.name,
      p.color,
      p.slot,
      -1.5 + p.slot * 1.5,
      5.8,
      Math.PI,
      p.now,
    );
}
async function handleRequest(request: Request) {
  try {
    if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
      return json(
        { error: 'This request did not come from the building site.' },
        403,
      );
    const body = await readRoomRequest(request, 5000);
    const db = getBinding(),
      now = Date.now();
    if (body.op === 'create') {
      if (body.map !== undefined && !validMap(body.map))
        return json({ error: 'Unknown map.' }, 400);
      if (
        body.buildId !== undefined &&
        (typeof body.buildId !== 'string' ||
          !BUILD_ID.test(body.buildId) ||
          !['try', 'explore', 'remix'].includes(String(body.buildMode)))
      )
        return json({ error: 'Invalid saved build.' }, 400);
      const saved =
        typeof body.buildId === 'string'
          ? await readBuild(db, body.buildId)
          : null;
      if (
        saved?.build.challenge &&
        body.buildMode === 'try' &&
        saved.build.challenge.rulesVersion !== DISASTER_RULES
      )
        return json(
          {
            error:
              'This challenge uses older game rules. You can still explore or remix its build.',
          },
          400,
        );
      if (
        saved?.build.challenge &&
        body.buildMode === 'try' &&
        process.env.PARTY_ENABLED === 'false'
      )
        return json(
          { error: 'Crew challenges are temporarily unavailable.' },
          503,
        );
      if (body.buildId && !saved)
        return json({ error: 'Saved build not found.' }, 404);
      const mode = saved
        ? body.buildMode === 'try'
          ? 'job'
          : 'sandbox'
        : body.mode === 'sandbox'
          ? 'sandbox'
          : 'job';
      const token = crypto.randomUUID() + crypto.randomUUID(),
        tokenHash = await hash(token),
        id = crypto.randomUUID();
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = Array.from(
          crypto.getRandomValues(new Uint8Array(6)),
          (v) => alphabet[v % alphabet.length],
        ).join('');
        const world = freshWorld(
          mode,
          now,
          0,
          saved?.build.map || (validMap(body.map) ? body.map : 'small'),
        );
        if (
          body.challenge !== undefined &&
          (body.challenge !== 1 ||
            typeof body.seed !== 'number' ||
            !Number.isInteger(body.seed) ||
            body.seed < 0 ||
            body.seed > 0xffffffff ||
            !CREW_JOBS.some((v) => v.id === body.job))
        )
          return json({ error: 'Invalid challenge.' }, 400);
        if (process.env.PARTY_ENABLED !== 'false')
          enableParty(
            world,
            now,
            saved?.build.seed ??
              (body.challenge === 1 ? (body.seed as number) : undefined),
            saved?.build.job ??
              (body.challenge === 1 ? (body.job as CrewJob) : 'sofa'),
          );
        else if (body.challenge !== undefined)
          return json(
            { error: 'Crew challenges are temporarily unavailable.' },
            503,
          );
        if (body.challenge === 1) {
          const brief = body.brief ?? 0;
          if (
            typeof brief !== 'number' ||
            !Number.isInteger(brief) ||
            brief < 0 ||
            brief >= JOBS.length
          )
            return json({ error: 'Invalid customer brief.' }, 400);
          world.round = brief;
        }
        if (!saved && world.party && body.format !== undefined) {
          if (
            typeof body.format !== 'string' ||
            !['classic', 'inspection', 'swap'].includes(body.format)
          )
            return json({ error: 'Unknown round format.' }, 400);
          world.party.format = body.format as 'classic' | 'inspection' | 'swap';
          configureInspection(world);
        }
        if (!saved && world.party && body.daily !== undefined) {
          if (typeof body.daily !== 'string')
            return json({ error: 'Invalid daily challenge.' }, 400);
          setDaily(world, body.daily, now);
        }
        if (saved) {
          if (world.party) {
            world.party.job = saved.build.job;
            world.party.task.kind = saved.build.job;
          }
          restoreBuild(
            world,
            saved.build,
            saved.id,
            body.buildMode as 'try' | 'explore' | 'remix',
          );
          if (world.party) {
            if (saved.build.target)
              world.party.inspection = makeInspection(saved.build.target);
            configureInspection(world);
            if (body.buildMode !== 'try' && saved.build.delivery)
              Object.assign(world.party.task, saved.build.delivery, {
                phase: saved.build.delivery.done ? 'done' : 'waiting',
              });
          }
        }
        event(
          world,
          'join',
          `${safeName(body.name)} opened the building site.`,
          now,
          { x: 0, z: 5.8 },
        );
        try {
          await db.batch([
            db
              .prepare(
                'INSERT INTO handwerker_rooms (code, host, world, version, updated) VALUES (?, ?, ?, 0, ?)',
              )
              .bind(code, id, JSON.stringify(world), now),
            insertPlayer(db, {
              id,
              room: code,
              tokenHash,
              name: safeName(body.name),
              color: clamp(Number(body.color) || 0, 0, 3) | 0,
              slot: 0,
              now,
            }),
          ]);
          return json({
            session: { code, id, token },
            snapshot: await snapshot(db, code, now, id),
          });
        } catch (err) {
          if (!String(err).includes('UNIQUE')) throw err;
        }
      }
      return json({ error: 'The site is busy. Try again.' }, 503);
    }
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    if (!/^[A-Z2-9]{6}$/.test(code))
      return json(
        { error: 'The room code contains 6 letters or digits.' },
        400,
      );
    return await withRoomLock(code, async () => {
      const now = Date.now();
      const room = await db
        .prepare('SELECT * FROM handwerker_rooms WHERE code = ?')
        .bind(code)
        .first<RoomRow>();
      if (!room)
        return json(
          { error: 'Building site not found. Check the room code.' },
          404,
        );
      if (body.op === 'join') {
        const token = crypto.randomUUID() + crypto.randomUUID(),
          tokenHash = await hash(token),
          id = crypto.randomUUID();
        await db
          .prepare(
            'DELETE FROM handwerker_players WHERE room = ? AND seen <= ?',
          )
          .bind(code, now - ACTIVE_MS)
          .run();
        let joined = false;
        for (let slot = 0; slot < 4; slot++) {
          try {
            await insertPlayer(db, {
              id,
              room: code,
              tokenHash,
              name: safeName(body.name),
              color: clamp(Number(body.color) || 0, 0, 3) | 0,
              slot,
              now,
            }).run();
            joined = true;
            break;
          } catch (err) {
            if (!String(err).includes('UNIQUE')) throw err;
          }
        }
        if (!joined)
          return json(
            { error: 'All four hard hats are taken. This site is full.' },
            409,
          );
        const joinedWorld = JSON.parse(room.world) as World;
        invalidateChallengeRun(
          joinedWorld,
          'A builder joined during the attempt. Retry with the whole crew to set a time.',
        );
        await db
          .prepare(
            'UPDATE handwerker_rooms SET world = ?, version = version + 1 WHERE code = ?',
          )
          .bind(JSON.stringify(joinedWorld), code)
          .run();
        // If the host left, transfer leadership atomically to the oldest active player.
        await db
          .prepare(
            'UPDATE handwerker_rooms SET host = (SELECT id FROM handwerker_players WHERE room = ? AND seen > ? ORDER BY slot LIMIT 1) WHERE code = ? AND NOT EXISTS (SELECT 1 FROM handwerker_players WHERE id = handwerker_rooms.host AND seen > ?)',
          )
          .bind(code, now - ACTIVE_MS, code, now - ACTIVE_MS)
          .run();
        return json({
          session: { code, id, token },
          snapshot: await snapshot(db, code, now, id),
        });
      }
      if (
        typeof body.id !== 'string' ||
        typeof body.token !== 'string' ||
        body.token.length > 100
      )
        return json(
          { error: 'Your site pass is missing. Please rejoin.' },
          401,
        );
      const tokenHash = await hash(body.token);
      const player = await db
        .prepare(
          'SELECT * FROM handwerker_players WHERE id = ? AND room = ? AND token_hash = ?',
        )
        .bind(body.id, code, tokenHash)
        .first<PlayerRow>();
      if (!player)
        return json(
          { error: 'Your site pass has expired. Please rejoin.' },
          401,
        );
      if (body.op === 'leave') {
        const leavingWorld = JSON.parse(room.world) as World;
        invalidateChallengeRun(
          leavingWorld,
          'A builder left during the attempt. Retry together to set a time.',
        );
        await db
          .prepare(
            'UPDATE handwerker_rooms SET world = ?, version = version + 1 WHERE code = ?',
          )
          .bind(JSON.stringify(leavingWorld), code)
          .run();
        await db
          .prepare(
            'DELETE FROM handwerker_players WHERE id = ? AND token_hash = ?',
          )
          .bind(body.id, tokenHash)
          .run();
        await leaveVoice(code, player.id);
        await db
          .prepare(
            'UPDATE handwerker_rooms SET host = COALESCE((SELECT id FROM handwerker_players WHERE room = ? AND seen > ? ORDER BY slot LIMIT 1), host) WHERE code = ? AND host = ?',
          )
          .bind(code, now - ACTIVE_MS, code, body.id)
          .run();
        return json({ ok: true });
      }
      if (body.op !== 'sync' && body.op !== 'action')
        return json({ error: 'Unknown site action.' }, 400);
      const WALK_BOUNDS = mapBounds((JSON.parse(room.world) as World).map);
      const pos = body.position as Record<string, unknown> | undefined;
      const previousPosition = {
        x: player.x,
        z: player.z,
        angle: player.angle,
        jump: player.jump,
      };
      if (
        pos &&
        [pos.x, pos.z, pos.angle].every(
          (v) => typeof v === 'number' && Number.isFinite(v),
        )
      ) {
        player.x = clamp(pos.x as number, -WALK_BOUNDS.x, WALK_BOUNDS.x);
        player.z = clamp(pos.z as number, WALK_BOUNDS.back, WALK_BOUNDS.front);
        player.angle = (pos.angle as number) % (Math.PI * 2);
        player.jump =
          typeof pos.jump === 'number' && Number.isFinite(pos.jump)
            ? clamp(pos.jump, 0, now)
            : 0;
        player.y =
          typeof pos.y === 'number' && Number.isFinite(pos.y)
            ? clamp(pos.y, 0.05, 12)
            : undefined;
      }
      const presence =
        now - player.seen >= 1000 ||
        player.x !== previousPosition.x ||
        player.z !== previousPosition.z ||
        player.angle !== previousPosition.angle ||
        player.jump !== previousPosition.jump
          ? db
              .prepare(
                'UPDATE handwerker_players SET x = ?, z = ?, angle = ?, jump = ?, seen = ? WHERE id = ? AND token_hash = ?',
              )
              .bind(
                player.x,
                player.z,
                player.angle,
                player.jump || 0,
                now,
                body.id,
                tokenHash,
              )
          : undefined;
      const players = await readPlayers(db, code, now);
      const own = players.findIndex((p) => p.id === player.id),
        updatedPlayer = { ...publicPlayer(player), seen: now };
      if (own >= 0) players[own] = updatedPlayer;
      else players.push(updatedPlayer);
      if (!players.some((p) => p.id === room.host)) {
        await db
          .prepare(
            'UPDATE handwerker_rooms SET host = ? WHERE code = ? AND host = ?',
          )
          .bind(players[0]?.id || body.id, code, room.host)
          .run();
        room.host = players[0]?.id || String(body.id);
      }
      const action = body.action as Action | undefined;
      if (
        action?.type === 'party' &&
        action.op === 'recording' &&
        action.enabled &&
        process.env.PARTY_RECORDING_ENABLED === 'false'
      )
        return json(
          {
            error:
              'Clips are unavailable on this site. Save a postcard instead.',
          },
          400,
        );
      if (
        body.op === 'action' &&
        (!action ||
          ![
            'party',
            'use',
            'paint',
            'build',
            'grab',
            'throw',
            'drop',
            'remove',
            'emote',
            'reset',
            'crane-pick',
            'crane-place',
            'crane-cancel',
          ].includes(action.type))
      )
        return json({ error: 'Unknown action.' }, 400);
      if (action?.type === 'reset' && !['job', 'sandbox'].includes(action.mode))
        return json({ error: 'Unknown game mode.' }, 400);
      for (let attempt = 0; attempt < 7; attempt++) {
        const current =
          attempt === 0
            ? room
            : await db
                .prepare('SELECT * FROM handwerker_rooms WHERE code = ?')
                .bind(code)
                .first<RoomRow>();
        if (!current) return json({ error: 'Building site not found.' }, 404);
        let world = JSON.parse(current.world) as World;
        if (body.op === 'action' && world.party) {
          if (body.roundId !== world.party.roundId)
            return json(
              {
                error: 'The round has changed. Try again in the current round.',
              },
              409,
            );
          if (
            typeof body.actionId !== 'string' ||
            body.actionId.length > 80 ||
            !Number.isSafeInteger(body.seq) ||
            Number(body.seq) < 1
          )
            return json({ error: 'Missing action identity.' }, 400);
          const receipt = world.partyPrivate?.receipts[player.id];
          if (receipt && Number(body.seq) <= receipt.seq) {
            if (receipt.id === body.actionId)
              return json({
                snapshot: await snapshot(db, code, now, player.id),
              });
            return json(
              { error: 'This action sequence has already passed.' },
              409,
            );
          }
        }
        const before = JSON.stringify(world);
        const physicalPlayers = players.map((p) => ({
          ...p,
          y:
            p.id === player.id
              ? (player.y ?? world.actors?.[p.id]?.y ?? 0.43)
              : (world.actors?.[p.id]?.y ?? 0.43),
        }));
        world = tickWorld(world, physicalPlayers, now);
        if (body.op === 'action' && action)
          world = applyAction(
            world,
            action,
            {
              ...publicPlayer(player),
              y: player.y ?? world.actors?.[player.id]?.y ?? 0.43,
            },
            physicalPlayers,
            current.host,
            now,
          );
        if (body.op === 'action' && world.partyPrivate)
          world.partyPrivate.receipts[player.id] = {
            seq: Number(body.seq),
            id: String(body.actionId),
          };
        const serialized = JSON.stringify(world);
        if (serialized === before) {
          if (presence) await presence.run();
          break;
        }
        const [result] = await db.batch([
          db
            .prepare(
              'UPDATE handwerker_rooms SET world = ?, version = version + 1, updated = ? WHERE code = ? AND version = ?',
            )
            .bind(serialized, now, code, current.version),
          ...(presence ? [presence] : []),
        ]);
        if ((result as WriteResult).meta.changes > 0) break;
        if (attempt === 6)
          return json(
            { error: 'Someone got there first. Please try again.' },
            409,
          );
      }
      return json({ snapshot: await snapshot(db, code, now, player.id) });
    });
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    const text = error instanceof Error ? error.message : '';
    if (/D1_|SQLITE|database|binding|fetch failed/i.test(text))
      return json(
        {
          error: 'The site cabin is unavailable right now. Try again shortly.',
        },
        503,
      );
    return json({ error: text || 'That did not work. Try again.' }, 400);
  }
}

export const POST = withRequestBudget(handleRequest);
