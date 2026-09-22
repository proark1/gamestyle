import type { GameDatabase } from '../../../db/contract';
import type { AccountConfig } from '../../accounts/server/config';
import { readSession } from '../../accounts/server/session';
import { sha256 } from '../../accounts/server/crypto';
import { readJsonObject } from '../../http/json-request';
import { RequestBudget, budgetError } from '../../http/request-budget';
import { hasAllowedOrigin } from '../../http/request-origin';
import { RoomError } from '../../rooms/types';
import { COMMERCE_PRICES, FREE_GAME_IDS } from '../catalog';
import { CommerceError, type CommerceEnvironment } from '../types';
import {
  buyCoinItem,
  importLegacyInventory,
  initializeInventory,
  readInventory,
  saveInventoryLook,
} from './inventory';
import { verifyAndRecordPurchase, type PurchaseVerifier } from './purchases';

type Dependencies = {
  db: () => GameDatabase;
  config: () => AccountConfig;
  now?: () => number;
  environment?: CommerceEnvironment;
  verifyPurchase?: PurchaseVerifier;
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export function createCommerceRoutes(deps: Dependencies) {
  const budget = new RequestBudget(16, 4096);
  const clock = deps.now ?? Date.now;
  const environment = deps.environment ?? 'live';

  const handle = (write: boolean) => async (request: Request) => {
    let release: (() => void) | undefined;
    try {
      release = budget.enter();
      const config = deps.config();
      if (write && !hasAllowedOrigin(request, config.publicOrigin))
        throw new CommerceError(
          'Open Jumbleyard to change your inventory.',
          403,
        );
      const db = deps.db();
      const now = clock();
      const session = await readSession(request, { db, config, now });
      if (!session)
        throw new CommerceError('Sign in to save your inventory.', 401);
      const accountId = session.account.id;
      const ownerKey = await sha256(`inventory-v1:${accountId}`);
      budget.take(accountId, 30, 2, now);
      // Once per account. Read endpoints may initialize the new account's welcome grant.
      await initializeInventory(db, accountId, now);
      if (write) {
        const body = await readJsonObject(request, 24_576);
        if (body.ownerKey !== undefined && body.ownerKey !== ownerKey)
          throw new CommerceError(
            'Your account changed. Reload your wardrobe before saving.',
            409,
          );
        switch (body.op) {
          case 'import_legacy':
            await importLegacyInventory(
              db,
              accountId,
              body.items,
              body.look,
              now,
            );
            break;
          case 'buy_coins':
            await buyCoinItem(db, accountId, body.itemId, now);
            break;
          case 'equip':
            await saveInventoryLook(db, accountId, body.look, environment);
            break;
          case 'verify_purchase':
            await verifyAndRecordPurchase(
              db,
              accountId,
              body.proof,
              deps.verifyPurchase,
              environment,
              now,
            );
            break;
          default:
            throw new CommerceError('Unknown inventory operation.');
        }
      }
      return reply({
        ownerKey,
        inventory: await readInventory(db, accountId, environment),
        purchasesAvailable: !!deps.verifyPurchase,
        referencePrices: COMMERCE_PRICES,
        freeGames: FREE_GAME_IDS,
      });
    } catch (error) {
      if (error instanceof CommerceError)
        return reply({ error: error.message }, error.status);
      if (error instanceof RoomError) return budgetError(error);
      // Provider failures may contain receipt material; never log their payloads.
      console.error('Inventory request failed');
      return reply(
        { error: 'Inventory is unavailable. Please try again.' },
        503,
      );
    } finally {
      release?.();
    }
  };
  return { GET: handle(false), POST: handle(true) };
}
