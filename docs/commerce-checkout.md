# Web checkout launch

The wardrobe offers two $0.99 purchase-only cosmetics, two $1.99 purchase-only cosmetics, and a $4.99 bundle containing all four. The server creates a Stripe-hosted Checkout Session from the fixed catalog. A signed webhook fulfills paid sessions; the return page verifies the same session for the signed-in account. Refunds and disputes revoke their purchase grants. Coin and challenge rewards remain separate.

The $4.99 full-game pass remains **off sale** until the paid-game access gate is enabled on every route and in mixed-owner parties. The three proposed free games and all currently open games remain playable. Native App Store, Google Play, and Steam clients do not use this web checkout.

## Configure Stripe

1. Connect a Stripe account and finish its live-mode business setup. Review the applicable tax registrations before enabling any tax collection; this integration does not set `automatic_tax`.
2. Create a restricted server API key with permission to create/list/retrieve Checkout Sessions and retrieve PaymentIntents and Charges. Save it as `STRIPE_SECRET_KEY` in Railway's production secrets. Never commit it or put it in a client build.
3. Register `https://www.jumbleyard.com/api/commerce/webhook` in Stripe Workbench for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Save its signing secret as `STRIPE_WEBHOOK_SECRET` in Railway.
4. Set `STRIPE_CHECKOUT_ENABLED=1` only after the key, webhook, and payment/refund test are ready. Production defaults to `COMMERCE_ENVIRONMENT=live` and requires a live key. A separate staging deployment can set `COMMERCE_ENVIRONMENT=sandbox` with a test key; its receipts never unlock live purchases.

If any of those three variables is absent, checkout buttons stay disabled. The Checkout server rejects client-supplied prices, grants, account IDs and payment status. The $4.99 full-game offer is also rejected explicitly while its gate is inactive.

To verify the rollout, sign in on the web, try on an exclusive item, buy it through Stripe Checkout, and confirm it appears in the wardrobe on another signed-in browser. Replay the same session and check that no duplicate grant appears. Refund it and confirm the item is removed; a separately earned or purchased item should remain owned. Repeat with a bundle and with a delayed payment method if enabled in Stripe. Confirm that an unsigned webhook fails with HTTP 400.
