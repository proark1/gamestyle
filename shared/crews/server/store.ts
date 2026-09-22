import type { GameDatabase } from '../../../db/contract';
import { randomId, sha256 } from '../../accounts/server/crypto';
import {
  CREW_EMBLEMS,
  type CrewBadge,
  type CrewEmblem,
  type CrewSnapshot,
} from '../types';

export class CrewError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export const INVITE_TTL = 7 * 86_400_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function cleanName(value: unknown) {
  if (typeof value !== 'string') throw new CrewError('Choose a crew name.');
  const name = value
    .normalize('NFKC')
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const length = Array.from(name).length;
  if (length < 3 || length > 28)
    throw new CrewError('Use 3–28 characters for your crew name.');
  return name;
}
function emblem(value: unknown): CrewEmblem {
  if (!CREW_EMBLEMS.includes(value as CrewEmblem))
    throw new CrewError('Choose one of the crew emblems.');
  return value as CrewEmblem;
}

export async function crewBadge(
  db: GameDatabase,
  accountId: string,
): Promise<CrewBadge | null> {
  return db
    .prepare(
      `SELECT c.id, c.name, c.emblem FROM crews c JOIN crew_members m ON m.crew_id = c.id WHERE m.account_id = ? AND c.archived IS NULL`,
    )
    .bind(accountId)
    .first<CrewBadge>();
}
export async function readCrew(
  db: GameDatabase,
  accountId: string,
): Promise<CrewSnapshot | null> {
  // One snapshot prevents a concurrent leave/transfer from mixing membership views.
  const row = await db
    .prepare(`SELECT c.id, c.name, c.emblem, c.owner_member_id AS owner, m.public_id AS self,
    (SELECT json_group_array(json_object('id', public_id, 'name', name, 'joined', joined)) FROM
      (SELECT p.public_id, COALESCE(NULLIF(a.display_name, ''), 'Crew mate') AS name, p.joined FROM crew_members p JOIN accounts a ON a.id = p.account_id WHERE p.crew_id = c.id ORDER BY p.joined, p.seat)) AS members
    FROM crews c JOIN crew_members m ON m.crew_id = c.id WHERE m.account_id = ? AND c.archived IS NULL`)
    .bind(accountId)
    .first<Omit<CrewSnapshot, 'members'> & { members: string }>();
  return row
    ? { ...row, members: JSON.parse(row.members) as CrewSnapshot['members'] }
    : null;
}

async function requireMember(
  db: GameDatabase,
  accountId: string,
  crewId: unknown,
  owner = false,
) {
  const row = await db
    .prepare(
      `SELECT m.public_id AS member, c.owner_member_id AS owner FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.account_id = ? AND c.id = ? AND c.archived IS NULL`,
    )
    .bind(accountId, typeof crewId === 'string' ? crewId : '')
    .first<{ member: string; owner: string }>();
  if (!row)
    throw new CrewError('Your crew changed. Reload the clubhouse.', 409);
  if (owner && row.member !== row.owner)
    throw new CrewError('Only the crew leader can do that.', 403);
  return row.member;
}
function changed(count: number) {
  if (!count)
    throw new CrewError('Your crew changed. Reload the clubhouse.', 409);
}
export async function createCrew(
  db: GameDatabase,
  accountId: string,
  name: unknown,
  badge: unknown,
  now: number,
) {
  const title = cleanName(name),
    mark = emblem(badge);
  if (await crewBadge(db, accountId))
    throw new CrewError(
      'Leave your current crew before creating another.',
      409,
    );
  const id = randomId(),
    member = randomId();
  try {
    await db.batch([
      db
        .prepare(
          'INSERT INTO crews (id, name, emblem, owner_member_id, created) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(id, title, mark, member, now),
      db
        .prepare(
          'INSERT INTO crew_members (account_id, crew_id, public_id, seat, joined) VALUES (?, ?, ?, 0, ?)',
        )
        .bind(accountId, id, member, now),
    ]);
  } catch (error) {
    if (await crewBadge(db, accountId))
      throw new CrewError(
        'You already belong to a crew. Reload the clubhouse.',
        409,
      );
    throw error;
  }
}
export async function joinCrew(
  db: GameDatabase,
  accountId: string,
  rawCode: unknown,
  now: number,
) {
  if (typeof rawCode !== 'string' || rawCode.length > 24)
    throw new CrewError('Enter a valid crew invite code.');
  const code = rawCode.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code))
    throw new CrewError('Enter a valid crew invite code.');
  const hash = await sha256(code);
  const target = await db
    .prepare(
      'SELECT id FROM crews WHERE invite_hash = ? AND invite_expires > ? AND archived IS NULL',
    )
    .bind(hash, now)
    .first<{ id: string }>();
  if (!target)
    throw new CrewError(
      'That crew invite expired or was replaced. Ask the leader for a new code.',
      404,
    );
  const current = await crewBadge(db, accountId);
  if (current?.id === target.id) return;
  if (current)
    throw new CrewError('Leave your current crew before joining another.', 409);
  // Choose and reserve a free seat within the same statement. Eight bounded,
  // unique slots prevent concurrent joins from exceeding the membership limit.
  try {
    const result = await db
      .prepare(`INSERT INTO crew_members (account_id, crew_id, public_id, seat, joined)
      SELECT ?, c.id, ?, s.seat, ? FROM crews c CROSS JOIN
      (SELECT 0 AS seat UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) s
      WHERE c.id = ? AND c.invite_hash = ? AND c.invite_expires > ? AND c.archived IS NULL
      AND NOT EXISTS (SELECT 1 FROM crew_members WHERE crew_id = c.id AND seat = s.seat)
      ORDER BY s.seat LIMIT 1`)
      .bind(accountId, randomId(), now, target.id, hash, now)
      .run();
    if (!result.meta.changes)
      throw new CrewError(
        'This crew is full or its invite changed. Ask the leader for help.',
        409,
      );
  } catch (error) {
    const member = await crewBadge(db, accountId);
    if (member?.id === target.id) return;
    if (member) throw new CrewError('You already belong to another crew.', 409);
    throw error;
  }
}
export async function changeCrew(
  db: GameDatabase,
  accountId: string,
  body: Record<string, unknown>,
  now: number,
) {
  const ownerOnly = ['edit', 'invite', 'transfer', 'remove'].includes(
    String(body.op),
  );
  const member = await requireMember(db, accountId, body.crewId, ownerOnly);
  const crewId = body.crewId as string;
  if (body.op === 'leave') {
    changed(
      (
        await db
          .prepare(
            'DELETE FROM crew_members WHERE account_id = ? AND crew_id = ? AND public_id = ?',
          )
          .bind(accountId, crewId, member)
          .run()
      ).meta.changes,
    );
  } else if (body.op === 'edit') {
    changed(
      (
        await db
          .prepare(
            'UPDATE crews SET name = ?, emblem = ? WHERE id = ? AND owner_member_id = ? AND archived IS NULL',
          )
          .bind(cleanName(body.name), emblem(body.emblem), crewId, member)
          .run()
      ).meta.changes,
    );
  } else if (body.op === 'invite') {
    const code = Array.from(
      crypto.getRandomValues(new Uint8Array(12)),
      (b) => ALPHABET[b % 32],
    ).join('');
    const expires = now + INVITE_TTL;
    changed(
      (
        await db
          .prepare(
            'UPDATE crews SET invite_hash = ?, invite_expires = ? WHERE id = ? AND owner_member_id = ? AND archived IS NULL',
          )
          .bind(await sha256(code), expires, crewId, member)
          .run()
      ).meta.changes,
    );
    return { code: code.match(/.{4}/g)!.join('-'), expires };
  } else if (body.op === 'transfer' || body.op === 'remove') {
    if (typeof body.memberId !== 'string' || body.memberId === member)
      throw new CrewError('Choose another crew member.');
    if (body.op === 'transfer') {
      changed(
        (
          await db
            .prepare(
              `UPDATE crews SET owner_member_id = ?, invite_hash = NULL, invite_expires = NULL WHERE id = ? AND owner_member_id = ? AND archived IS NULL AND EXISTS (SELECT 1 FROM crew_members WHERE crew_id = ? AND public_id = ?)`,
            )
            .bind(body.memberId, crewId, member, crewId, body.memberId)
            .run()
        ).meta.changes,
      );
    } else {
      changed(
        (
          await db
            .prepare(
              `DELETE FROM crew_members WHERE crew_id = ? AND public_id = ? AND EXISTS (SELECT 1 FROM crews WHERE id = ? AND owner_member_id = ? AND archived IS NULL)`,
            )
            .bind(crewId, body.memberId, crewId, member)
            .run()
        ).meta.changes,
      );
    }
  } else throw new CrewError('Unknown crew action.');
}
