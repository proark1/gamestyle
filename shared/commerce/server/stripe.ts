import Stripe from 'stripe';
import { COMMERCE_OFFERS, type CommerceOffer } from '../catalog';
import { CommerceError, type CommerceEnvironment } from '../types';
import type { VerifiedPurchase } from './purchases';

const API_VERSION = '2026-07-29.dahlia';

export function commerceEnvironment(): CommerceEnvironment {
  return process.env.COMMERCE_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'live';
}

export function stripeEnvironment(
  key = process.env.STRIPE_SECRET_KEY,
): CommerceEnvironment {
  return key?.startsWith('sk_test_') || key?.startsWith('rk_test_')
    ? 'sandbox'
    : 'live';
}

export function stripeReady() {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!(
    process.env.STRIPE_CHECKOUT_ENABLED === '1' &&
    process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') &&
    key &&
    /^(sk|rk)_(live|test)_/.test(key) &&
    stripeEnvironment(key) === commerceEnvironment()
  );
}

export function stripeClient() {
  if (!stripeReady())
    throw new CommerceError('Checkout is not available yet.', 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: API_VERSION,
  });
}

function identifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `jumbleyard_${Array.from(bytes, (byte) => String.fromCharCode(97 + (byte % 26))).join('')}`;
}

export async function createStripeCheckout(
  accountId: string,
  offer: CommerceOffer,
  origin: string,
) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: accountId,
    metadata: { app: 'jumbleyard', account_id: accountId, offer_id: offer.id },
    payment_intent_data: {
      metadata: {
        app: 'jumbleyard',
        account_id: accountId,
        offer_id: offer.id,
      },
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: offer.usdCents,
          product_data: { name: offer.name },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/purchase/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/party`,
    integration_identifier: identifier(),
  } as Stripe.Checkout.SessionCreateParams & {
    integration_identifier: string;
  });
  if (!session.url) throw new CommerceError('Checkout could not start.', 503);
  return session.url;
}

export async function verifyStripePurchase(
  sessionId: string,
  accountId: string,
): Promise<VerifiedPurchase> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId))
    throw new CommerceError('Invalid checkout session.');
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  return verifiedStripeSession(session, accountId, commerceEnvironment());
}

/** Pure validation boundary: no client-provided price, owner or status is trusted. */
export function verifiedStripeSession(
  session: Stripe.Checkout.Session,
  accountId: string,
  environment: CommerceEnvironment,
): VerifiedPurchase {
  const offer = COMMERCE_OFFERS.find(
    (entry) => entry.id === session.metadata?.offer_id,
  );
  if (
    !offer ||
    session.mode !== 'payment' ||
    session.metadata?.app !== 'jumbleyard' ||
    session.client_reference_id !== accountId ||
    session.metadata.account_id !== accountId ||
    session.currency?.toLowerCase() !== 'usd' ||
    session.amount_total !== offer.usdCents ||
    session.livemode !== (environment === 'live')
  )
    throw new CommerceError(
      'Checkout does not match this account or offer.',
      403,
    );
  if (session.status !== 'complete' || session.payment_status !== 'paid')
    throw new CommerceError('Payment is still processing.', 409);
  const intent = session.payment_intent;
  if (!intent || typeof intent === 'string')
    throw new CommerceError('Payment verification is incomplete.', 503);
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string')
    throw new CommerceError('Payment verification is incomplete.', 503);
  return {
    provider: 'stripe',
    transactionId: session.id,
    accountId,
    offerId: offer.id,
    environment,
    status: charge.amount_refunded > 0 || charge.disputed ? 'revoked' : 'paid',
  };
}
