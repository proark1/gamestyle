import type { GameDatabase, WriteResult } from '../../db/contract';
import type { Row, RoomStore } from '../../shared/rooms/types';
import { RoomError } from '../../shared/rooms/types';
import { type StoredRoom, handleRoom } from './rooms';
import { randomId } from '../../shared/accounts/server/crypto';
import { stackWeek } from '../../shared/challenges/catalog';
import { stackRewardStatements } from '../../shared/challenges/server/progress';
import {
  RANKED_LIMIT,
  rankedSettleStatement,
  rankedStartStatements,
} from '../../shared/challenges/server/ranked';
import type { Session } from '../../shared/rooms/session';
import type { Snapshot, World } from './types';
import { topOf } from './physics';
import { FLOOR } from './geometry';

type VerifiedRoom = StoredRoom & {
  ranked?: true;
  challengeRun?: { id: string; week: number };
  challengeCommit?: string;
  challengeSettled?: true;
  challengeHeight?: number;
};
const prefix = 'verified-stack:';

/** A tossed object's apex is not a tower. The solver must have put it to sleep. */
export function settledStackHeight(world: World) {
  return Math.max(
    0,
    ...world.pieces
      .filter((piece) => !piece.heldBy && piece.sleeping === true)
      .map((piece) => topOf(piece) - FLOOR),
  );
}

/** Account-bound server rooms. This endpoint never accepts peer checkpoints or results. */
export async function verifiedStackRoom(
  db: GameDatabase,
  accountId: string,
  body: Record<string, unknown>,
  now: number,
): Promise<{ ok?: true; session?: Session; snapshot?: Snapshot }> {
  if (
    body.op === 'action' &&
    (body.action as { type?: string } | undefined)?.type === 'restart'
  )
    throw new RoomError(
      'Leave this room and create a new verified attempt.',
      409,
    );
  let previous: VerifiedRoom | undefined;
  let saved: VerifiedRoom | undefined;
  const store: RoomStore = {
    async get(code) {
      const row = await db
        .prepare(
          'SELECT code, state, version, updated FROM rooms WHERE code = ?',
        )
        .bind(prefix + code)
        .first<Row>();
      if (!row) return null;
      previous = JSON.parse(row.state) as VerifiedRoom;
      if (body.op === 'join') {
        if (previous.world.phase !== 'lobby')
          throw new RoomError(
            'Join a verified crew before its round starts.',
            409,
          );
        if (
          await db
            .prepare(
              'SELECT 1 FROM challenge_members WHERE room_code = ? AND account_id = ?',
            )
            .bind(row.code, accountId)
            .first()
        )
          throw new RoomError(
            'You already have a seat in this room. Reconnect from your original tab.',
            409,
          );
      } else if (
        !(await db
          .prepare(
            'SELECT 1 FROM challenge_members WHERE room_code = ? AND player_id = ? AND account_id = ?',
          )
          .bind(row.code, typeof body.id === 'string' ? body.id : '', accountId)
          .first())
      )
        throw new RoomError(
          'Sign in with the account that joined this verified room.',
          401,
        );
      return { ...row, code };
    },
    async insert(row) {
      const room = JSON.parse(row.state) as VerifiedRoom;
      if (body.ranked === true) room.ranked = true;
      const commit = randomId();
      room.challengeCommit = commit;
      const key = prefix + row.code;
      const result = (await db.batch([
        db
          .prepare(
            'INSERT OR IGNORE INTO rooms (code,state,version,updated) VALUES (?,?,?,?)',
          )
          .bind(key, JSON.stringify(room), row.version, now),
        db
          .prepare(
            `INSERT INTO challenge_members (room_code,player_id,account_id) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`,
          )
          .bind(key, room.host, accountId, key, commit),
      ])) as WriteResult[];
      if (result[0].meta.changes) saved = room;
      return result[0].meta.changes > 0;
    },
    async compareAndSwap(row, version) {
      const room = JSON.parse(row.state) as VerifiedRoom;
      const key = prefix + row.code,
        commit = randomId();
      room.challengeCommit = commit;
      const rankedStart =
        !!room.ranked &&
        previous?.world.phase === 'lobby' &&
        room.world.phase === 'playing';
      if (previous?.world.phase === 'lobby' && room.world.phase === 'playing')
        room.challengeRun = { id: randomId(), week: stackWeek(now).start };
      if (room.challengeRun && !room.challengeSettled)
        room.challengeHeight = Math.max(
          room.challengeHeight ?? 0,
          settledStackHeight(room.world),
        );
      const settle =
        !!room.challengeRun &&
        !room.challengeSettled &&
        ['won', 'lost'].includes(room.world.phase);
      if (settle) room.challengeSettled = true;
      const state = JSON.stringify(room);
      const statements = [
        db
          .prepare(
            `UPDATE rooms SET state = ?, version = ?, updated = ? WHERE code = ? AND version = ?
            ${
              rankedStart
                ? `AND (SELECT COUNT(*) FROM challenge_members m JOIN json_each(?, '$.world.players') p
              ON json_extract(p.value, '$.id') = m.player_id WHERE m.room_code = ?) = ?
              AND NOT EXISTS (SELECT 1 FROM challenge_members m JOIN json_each(?, '$.world.players') p
              ON json_extract(p.value, '$.id') = m.player_id WHERE m.room_code = ? AND
              (SELECT COUNT(*) FROM ranked_attempts a WHERE a.account_id = m.account_id AND a.week = ? AND a.service_voided = 0) >= ?)`
                : ''
            }`,
          )
          .bind(
            state,
            row.version,
            now,
            key,
            version,
            ...(rankedStart
              ? [
                  state,
                  key,
                  room.world.players.length,
                  state,
                  key,
                  room.challengeRun!.week,
                  RANKED_LIMIT,
                ]
              : []),
          ),
      ];
      if (rankedStart && room.challengeRun)
        statements.push(
          ...rankedStartStatements(
            db,
            key,
            commit,
            room.challengeRun,
            room.world.players.length,
            now,
            state,
          ),
        );
      if (body.op === 'join') {
        const entrant = room.world.players.find(
          (p) => !previous?.world.players.some((old) => old.id === p.id),
        );
        if (!entrant)
          throw new RoomError('Could not reserve your verified seat.', 409);
        statements.push(
          db
            .prepare(
              `INSERT INTO challenge_members (room_code, player_id, account_id) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`,
            )
            .bind(key, entrant.id, accountId, key, commit),
        );
      }
      statements.push(
        db
          .prepare(
            `DELETE FROM challenge_members WHERE room_code = ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?) AND player_id NOT IN (SELECT json_extract(value, '$.id') FROM json_each(?, '$.world.players'))`,
          )
          .bind(key, key, commit, JSON.stringify(room)),
      );
      if (room.challengeRun && settle) {
        const run = room.challengeRun;
        // Every award is derived from the server simulation, and stays in this CAS transaction.
        statements.push(
          db
            .prepare(`INSERT OR IGNORE INTO challenge_results (account_id,run_id,game,rules,week,height,rescued,completed)
          SELECT account_id,?,'stack-or-sink',1,?,?,?,? FROM challenge_members
          WHERE room_code = ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
            .bind(
              run.id,
              run.week,
              room.challengeHeight ?? 0,
              room.world.phase === 'won' ? 1 : 0,
              now,
              key,
              key,
              commit,
            ),
        );
        if (room.ranked)
          statements.push(
            rankedSettleStatement(
              db,
              key,
              commit,
              run,
              room.challengeHeight ?? 0,
              now,
            ),
          );
        statements.push(
          ...stackRewardStatements(db, key, commit, run.id, run.week, now),
        );
      }
      const result = (await db.batch(statements)) as WriteResult[];
      if (rankedStart && !result[0].meta.changes) {
        const exhausted = await db
          .prepare(`SELECT 1 FROM challenge_members m
          JOIN json_each(?, '$.world.players') p ON json_extract(p.value, '$.id') = m.player_id
          WHERE m.room_code = ? AND (SELECT COUNT(*) FROM ranked_attempts a
          WHERE a.account_id = m.account_id AND a.week = ? AND a.service_voided = 0) >= ? LIMIT 1`)
          .bind(state, key, room.challengeRun!.week, RANKED_LIMIT)
          .first();
        if (exhausted)
          throw new RoomError(
            'Someone in this crew has used all five ranked starts this week.',
            409,
          );
      }
      if (result[0].meta.changes) saved = room;
      return result[0].meta.changes > 0;
    },
  };
  const reply = await handleRoom(store, body, now);
  if (!('snapshot' in reply)) return reply;
  const week = stackWeek(saved?.challengeRun?.week ?? now);
  return {
    ...reply,
    ...(reply.session
      ? {
          session: {
            ...reply.session,
            verified: true as const,
            ...(saved?.ranked ? { ranked: true as const } : {}),
          },
        }
      : {}),
    ...(reply.snapshot
      ? {
          snapshot: {
            ...reply.snapshot,
            challenge: {
              week,
              verified: true as const,
              ...(saved?.ranked ? { ranked: true as const } : {}),
            },
          },
        }
      : {}),
  };
}
