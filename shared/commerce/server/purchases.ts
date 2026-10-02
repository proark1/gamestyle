import type { GameDatabase } from '../../../db/contract';
import { COMMERCE_OFFERS, type CommerceOffer } from '../catalog';
import { CommerceError, type CommerceEnvironment } from '../types';

/** Produced only by a trusted server adapter after consulting the storefront. */
export type VerifiedPurchase = {
  provider: string;
  transactionId: string;
  accountId: string;
  offerId: string;
  environment: CommerceEnvironment;
  status: 'paid' | 'revoked';
};

export type PurchaseVerifier = (
  proof: string,
  accountId: string,
) => Promise<VerifiedPurchase>;

/**
 * Provider adapters must verify app/product identity, settlement, the account
 * binding and the environment. Client-supplied purchase fields are never used.
 */
export async function verifyAndRecordPurchase(
  db: GameDatabase,
  accountId: string,
  proof: unknown,
  verifier: PurchaseVerifier | undefined,
  environment: CommerceEnvironment,
  now: number,
  offers: readonly CommerceOffer[] = COMMERCE_OFFERS,
) {
  if (!verifier)
    throw new CommerceError('Purchases are not available yet.', 503);
  if (typeof proof !== 'string' || !proof.length || proof.length > 16_384)
    throw new CommerceError('Invalid purchase proof.');
  const purchase = await verifier(proof, accountId);
  if (purchase.accountId !== accountId || purchase.environment !== environment)
    throw new CommerceError(
      'Purchase does not belong to this account or environment.',
      403,
    );
  const offer = offers.find((candidate) => candidate.id === purchase.offerId);
  if (!offer || !offer.grants.length || offer.grants.some((id) => !id))
    throw new CommerceError('Unknown purchase product.');
  if (
    typeof purchase.provider !== 'string' ||
    !/^[a-z0-9-]{1,40}$/.test(purchase.provider) ||
    typeof purchase.transactionId !== 'string' ||
    !purchase.transactionId ||
    purchase.transactionId.length > 256 ||
    !['paid', 'revoked'].includes(purchase.status)
  )
    throw new CommerceError('Invalid verified purchase.');
  const { provider, transactionId, status } = purchase;
  const reference = JSON.stringify([provider, transactionId]);
  const match =
    'provider = ? AND transaction_id = ? AND environment = ? AND owner_id = ? AND offer_id = ?';
  const values = [provider, transactionId, environment, accountId, offer.id];
  await db.batch([
    db
      .prepare(`INSERT INTO commerce_transactions (provider, transaction_id, environment, owner_id, offer_id, status, created, grants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, transaction_id, environment) DO UPDATE SET status = 'revoked'
      WHERE excluded.status = 'revoked' AND commerce_transactions.owner_id = excluded.owner_id AND commerce_transactions.offer_id = excluded.offer_id`)
      .bind(...values, status, now, JSON.stringify(offer.grants)),
    // Restore the exact purchased contents, even after a catalog update.
    db
      .prepare(`INSERT OR IGNORE INTO commerce_grants (account_id, item_id, source, reference, environment, created)
      SELECT owner_id, contents.value, 'purchase', ?, environment, ? FROM commerce_transactions, json_each(commerce_transactions.grants) AS contents
      WHERE ${match} AND status = 'paid'`)
      .bind(reference, now, ...values),
    db
      .prepare(`DELETE FROM commerce_grants WHERE account_id = ? AND source = 'purchase' AND reference = ? AND environment = ?
      AND EXISTS (SELECT 1 FROM commerce_transactions WHERE ${match} AND status = 'revoked')`)
      .bind(accountId, reference, environment, ...values),
  ]);
  const recorded = await db
    .prepare(
      `SELECT owner_id, offer_id FROM commerce_transactions WHERE provider = ? AND transaction_id = ? AND environment = ?`,
    )
    .bind(provider, transactionId, environment)
    .first<{ owner_id: string | null; offer_id: string }>();
  if (
    !recorded ||
    recorded.owner_id !== accountId ||
    recorded.offer_id !== offer.id
  )
    throw new CommerceError('Purchase has already been claimed.', 409);
}
