import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { verifiedStripeSession } from './stripe';

const session = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'cs_test_valid',
    mode: 'payment',
    client_reference_id: 'player-a',
    metadata: {
      app: 'jumbleyard',
      account_id: 'player-a',
      offer_id: 'neon-visor',
    },
    currency: 'usd',
    amount_total: 99,
    livemode: false,
    status: 'complete',
    payment_status: 'paid',
    payment_intent: { latest_charge: { amount_refunded: 0, disputed: false } },
    ...overrides,
  }) as unknown as Stripe.Checkout.Session;

void test('checkout validation binds price, product, account and environment', () => {
  assert.equal(
    verifiedStripeSession(session(), 'player-a', 'sandbox').status,
    'paid',
  );
  for (const wrong of [
    { amount_total: 1 },
    { currency: 'eur' },
    { client_reference_id: 'player-b' },
    {
      metadata: {
        app: 'other',
        account_id: 'player-a',
        offer_id: 'neon-visor',
      },
    },
    {
      metadata: {
        app: 'jumbleyard',
        account_id: 'player-b',
        offer_id: 'neon-visor',
      },
    },
    { livemode: true },
    { mode: 'subscription' },
  ])
    assert.throws(() =>
      verifiedStripeSession(session(wrong), 'player-a', 'sandbox'),
    );
  assert.throws(() =>
    verifiedStripeSession(
      session({ payment_status: 'unpaid' }),
      'player-a',
      'sandbox',
    ),
  );
});

void test('refunded or disputed checkout revokes the grant', () => {
  for (const charge of [
    { amount_refunded: 1, disputed: false },
    { amount_refunded: 0, disputed: true },
  ]) {
    const purchase = verifiedStripeSession(
      session({ payment_intent: { latest_charge: charge } }),
      'player-a',
      'sandbox',
    );
    assert.equal(purchase.status, 'revoked');
  }
});
