import { getBinding } from '@/db/index';
import {
  accountConfig,
  publicOriginFor,
} from '@/shared/accounts/server/config';
import { readSession } from '@/shared/accounts/server/session';
import { COMMERCE_OFFERS } from '@/shared/commerce/catalog';
import {
  initializeInventory,
  readInventory,
} from '@/shared/commerce/server/inventory';
import {
  commerceEnvironment,
  createStripeCheckout,
} from '@/shared/commerce/server/stripe';
import { CommerceError } from '@/shared/commerce/types';
import { readJsonObject } from '@/shared/http/json-request';
import { hasAllowedOrigin } from '@/shared/http/request-origin';

export async function POST(request: Request) {
  try {
    const config = accountConfig();
    if (!hasAllowedOrigin(request, config.publicOrigin))
      throw new CommerceError('Open Jumbleyard to start checkout.', 403);
    const db = getBinding();
    const session = await readSession(request, { db, config, now: Date.now() });
    if (!session)
      throw new CommerceError('Sign in before buying an item.', 401);
    const body = await readJsonObject(request, 1024);
    const offer = COMMERCE_OFFERS.find((entry) => entry.id === body.offerId);
    if (!offer) throw new CommerceError('Unknown store item.');
    // The paid-game gate is not active yet; never charge for the pass prematurely.
    if (offer.id === 'full-game')
      throw new CommerceError('The full game pass is not on sale yet.', 409);
    await initializeInventory(db, session.account.id, Date.now());
    const inventory = await readInventory(
      db,
      session.account.id,
      commerceEnvironment(),
    );
    if (offer.grants.some((id) => inventory.items.includes(id)))
      throw new CommerceError('You already own an item in this offer.', 409);
    const url = await createStripeCheckout(
      session.account.id,
      offer,
      publicOriginFor(request, config.publicOrigin),
    );
    return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CommerceError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('Checkout creation failed');
    return Response.json(
      { error: 'Checkout is unavailable. Try again.' },
      { status: 503 },
    );
  }
}
