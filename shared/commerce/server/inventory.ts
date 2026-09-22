import type { GameDatabase } from '../../../db/contract';
import { randomId } from '../../accounts/server/crypto';
import { ITEMS, SLOTS } from '../../wardrobe/catalog';
import { parseLook, type Look } from '../../wardrobe/look';
import { FULL_GAME_ENTITLEMENT } from '../catalog';
import {
  CommerceError,
  type CommerceEnvironment,
  type InventorySnapshot,
} from '../types';
import { LEGACY_ITEMS, STARTER_ITEMS } from './legacy-items';

export async function initializeInventory(
  db: GameDatabase,
  accountId: string,
  now: number,
) {
  if (
    await db
      .prepare('SELECT 1 FROM commerce_profiles WHERE account_id = ?')
      .bind(accountId)
      .first()
  )
    return;
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO commerce_profiles (account_id, created) VALUES (?, ?)',
      )
      .bind(accountId, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO commerce_coin_ledger (account_id, reference, delta, created) VALUES (?, 'welcome', 500, ?)",
      )
      .bind(accountId, now),
    ...STARTER_ITEMS.map((id) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO commerce_grants (account_id, item_id, source, reference, environment, created) VALUES (?, ?, 'starter', 'welcome', 'live', ?)",
        )
        .bind(accountId, id, now),
    ),
  ]);
}

export async function readInventory(
  db: GameDatabase,
  accountId: string,
  environment: CommerceEnvironment = 'live',
): Promise<InventorySnapshot> {
  // One SELECT gives the outfit, balance and grants the same database snapshot.
  const row = await db
    .prepare(`SELECT p.coins, p.look, p.import_key,
    (SELECT json_group_array(DISTINCT item_id) FROM commerce_grants g
     WHERE g.account_id = p.account_id AND (g.source != 'purchase' OR g.environment = ?)) AS items
    FROM commerce_profiles p WHERE p.account_id = ?`)
    .bind(environment, accountId)
    .first<{
      coins: number;
      look: string;
      import_key: string | null;
      items: string;
    }>();
  if (!row) throw new CommerceError('Inventory is not initialized.', 409);
  const allItems = JSON.parse(row.items) as string[];
  const items = allItems.filter((id) => ITEMS.some((item) => item.id === id));
  const owned = new Set(items);
  const look = parseLook(JSON.parse(row.look)) ?? {};
  for (const slot of SLOTS)
    if (look[slot] && !owned.has(look[slot]!)) delete look[slot];
  return {
    coins: row.coins,
    items,
    look,
    fullGame: allItems.includes(FULL_GAME_ENTITLEMENT),
    legacyImported: row.import_key !== null,
    environment,
  };
}

/** Import only the frozen pre-commerce catalog. Local coins and statistics are not authority. */
export async function importLegacyInventory(
  db: GameDatabase,
  accountId: string,
  rawItems: unknown,
  rawLook: unknown,
  now: number,
) {
  if (!Array.isArray(rawItems) || rawItems.length > 256)
    throw new CommerceError('Invalid legacy wardrobe.');
  const items = [
    ...new Set(
      rawItems.filter(
        (id): id is string => typeof id === 'string' && LEGACY_ITEMS.has(id),
      ),
    ),
  ];
  const owned = new Set([...STARTER_ITEMS, ...items]);
  const look = parseLook(rawLook) ?? {};
  for (const slot of SLOTS)
    if (look[slot] && !owned.has(look[slot]!)) delete look[slot];
  const key = randomId();
  await db.batch([
    db
      .prepare(
        'UPDATE commerce_profiles SET import_key = ?, look = ? WHERE account_id = ? AND import_key IS NULL',
      )
      .bind(key, JSON.stringify(look), accountId),
    ...items.map((id) =>
      db
        .prepare(`INSERT OR IGNORE INTO commerce_grants (account_id, item_id, source, reference, environment, created)
      SELECT account_id, ?, 'legacy', 'legacy-v1', 'live', ? FROM commerce_profiles WHERE account_id = ? AND import_key = ?`)
        .bind(id, now, accountId, key),
    ),
  ]);
}

export async function buyCoinItem(
  db: GameDatabase,
  accountId: string,
  itemId: unknown,
  now: number,
) {
  const item = ITEMS.find((candidate) => candidate.id === itemId);
  if (!item || !item.price || !Number.isSafeInteger(item.price))
    throw new CommerceError('This item cannot be bought with coins.');
  const reference = `item:${item.id}`;
  await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO commerce_coin_ledger (account_id, reference, delta, created)
      SELECT account_id, ?, ?, ? FROM commerce_profiles WHERE account_id = ? AND coins >= ?
      AND NOT EXISTS (SELECT 1 FROM commerce_grants WHERE account_id = ? AND item_id = ? AND environment = 'live')`)
      .bind(
        reference,
        -item.price,
        now,
        accountId,
        item.price,
        accountId,
        item.id,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO commerce_grants (account_id, item_id, source, reference, environment, created)
      SELECT account_id, ?, 'coins', reference, 'live', ? FROM commerce_coin_ledger WHERE account_id = ? AND reference = ?`)
      .bind(item.id, now, accountId, reference),
  ]);
  const owned = await db
    .prepare(
      "SELECT 1 AS owned FROM commerce_grants WHERE account_id = ? AND item_id = ? AND environment = 'live' LIMIT 1",
    )
    .bind(accountId, item.id)
    .first();
  if (!owned) throw new CommerceError('Not enough coins.', 409);
}

export async function saveInventoryLook(
  db: GameDatabase,
  accountId: string,
  raw: unknown,
  environment: CommerceEnvironment,
) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new CommerceError('Invalid outfit.');
  const look: Look = {};
  for (const [slot, id] of Object.entries(raw)) {
    const item = ITEMS.find(
      (candidate) => candidate.id === id && candidate.slot === slot,
    );
    if (!item) throw new CommerceError('Invalid outfit item.');
    look[item.slot] = item.id;
  }
  const ids = Object.values(look);
  const conditions = ids.map(
    () =>
      `EXISTS (SELECT 1 FROM commerce_grants g WHERE g.account_id = commerce_profiles.account_id AND g.item_id = ? AND (g.source != 'purchase' OR g.environment = ?))`,
  );
  const result = await db
    .prepare(
      `UPDATE commerce_profiles SET look = ? WHERE account_id = ? ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}`,
    )
    .bind(
      JSON.stringify(look),
      accountId,
      ...ids.flatMap((id) => [id, environment]),
    )
    .run();
  if (!result.meta.changes)
    throw new CommerceError('Own an item before equipping it.', 403);
}
