import { getBinding } from '@/db/index';
import { verifyAndRecordPurchase } from '@/shared/commerce/server/purchases';
import {
  commerceEnvironment,
  stripeClient,
  verifyStripePurchase,
} from '@/shared/commerce/server/stripe';

async function readWebhook(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 262_144) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (
    !signature ||
    !secret ||
    Number(request.headers.get('content-length') ?? 0) > 262_144
  )
    return new Response('Invalid webhook', { status: 400 });
  const raw = await readWebhook(request);
  if (raw === null) return new Response('Invalid webhook', { status: 400 });
  let stripe;
  try {
    stripe = stripeClient();
  } catch {
    return new Response('Checkout unavailable', { status: 503 });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new Response('Invalid webhook', { status: 400 });
  }
  try {
    let sessionId: string | undefined;
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      sessionId = event.data.object.id;
    } else if (
      event.type === 'charge.refunded' ||
      event.type === 'charge.dispute.created'
    ) {
      const intent = event.data.object.payment_intent;
      if (typeof intent === 'string') {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent,
          limit: 1,
        });
        sessionId = sessions.data[0]?.id;
      }
    }
    if (!sessionId) return new Response('OK');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const accountId = session.client_reference_id;
    if (!accountId || session.metadata?.app !== 'jumbleyard')
      return new Response('Ignored');
    // Some payment methods complete Checkout before the funds settle.
    if (session.payment_status !== 'paid') return new Response('Pending');
    const db = getBinding();
    const account = await db
      .prepare('SELECT 1 FROM accounts WHERE id = ?')
      .bind(accountId)
      .first();
    if (!account) return new Response('Account removed');
    await verifyAndRecordPurchase(
      db,
      accountId,
      sessionId,
      verifyStripePurchase,
      commerceEnvironment(),
      Date.now(),
    );
    return new Response('OK');
  } catch (error) {
    // A retry is safer than silently losing a paid entitlement.
    console.error(
      'Checkout webhook fulfillment failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return new Response('Retry later', { status: 503 });
  }
}
