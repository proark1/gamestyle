import type { GameDatabase } from '../../../db/contract';
import { FULL_GAME_ENTITLEMENT, hasGameAccess } from '../catalog';
import { CommerceError, type CommerceEnvironment } from '../types';

/** Callers supply identities resolved from sessions/room seats, never body account IDs. */
export async function accountCanPlay(
  db: GameDatabase,
  game: string,
  accountId: string | null,
  environment: CommerceEnvironment = 'live',
) {
  if (hasGameAccess(game, false)) return true;
  if (!accountId || !hasGameAccess(game, true)) return false;
  const grant = await db
    .prepare(
      "SELECT 1 FROM commerce_grants WHERE account_id = ? AND item_id = ? AND source = 'purchase' AND environment = ? LIMIT 1",
    )
    .bind(accountId, FULL_GAME_ENTITLEMENT, environment)
    .first();
  return !!grant;
}

/** Paid admission is prepared but remains open until a deliberate launch. */
export function paidAdmissionEnabled() {
  return process.env.PAID_GAME_ADMISSION_ENABLED === '1';
}

export async function assertGameEntry(
  db: GameDatabase,
  game: string,
  accountId: string | null,
  enabled = paidAdmissionEnabled(),
  environment: CommerceEnvironment = 'live',
) {
  if (!enabled) return;
  if (!(await accountCanPlay(db, game, accountId, environment)))
    throw new CommerceError('This game needs the full game pass.', 403);
}

/** Ready for admission integration; intentionally not activated on existing rooms yet. */
export async function assertPartyGameAccess(
  db: GameDatabase,
  game: string,
  accountIds: readonly (string | null)[],
  environment: CommerceEnvironment = 'live',
) {
  if (!accountIds.length || accountIds.length > 4)
    throw new CommerceError('A party needs one to four players.');
  const allowed = await Promise.all(
    accountIds.map((accountId) =>
      accountCanPlay(db, game, accountId, environment),
    ),
  );
  if (allowed.some((value) => !value))
    throw new CommerceError(
      'Every player needs the full game to enter this game.',
      403,
    );
}
