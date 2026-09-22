# Monetization foundation implementation

The user approved implementation on 22 September 2026. Source product plan: commit `0361e9f`, `docs/superpowers/specs/2026-09-22-monetization-retention-plan.md`. That file is currently deleted in the shared working tree; preserve the deletion.

This first implementation slice establishes server-owned inventory and purchase records before connecting the 3D lobby or activating paid admission.

1. Add a shared price/access catalog: $4.99 full game, $0.99 standard items, $1.99 special items, $4.99 bundles; provisional three-game free selection.
2. Add additive SQLite/D1-compatible migrations and schema for profiles, coin ledger, grants and transaction tombstones. Keep coin purchases atomic; retain anonymized transaction IDs after account deletion so receipts cannot be reused.
3. Add authenticated inventory, migration, coin purchase and outfit endpoints. Import existing catalog cosmetics once, without trusting local coins, playtime, new premium ownership or achievements. Existing guest wardrobe remains intact.
4. Add a provider-verification boundary for transaction ingestion. The browser never supplies authoritative product, amount, status or account ownership. No real storefront adapter is enabled until its receipt integration is implemented and tested. Keep sandbox grants separate from live grants.
5. Add access policy functions for the three free games and individual full-game ownership. Do not enable production paywalls before storefront checkout, party admission integration and migration are ready.
6. Test real SQLite transactions, duplicate/concurrent purchases, cross-account replay, refund ordering, account deletion, migration, authorization, outfit ownership and API failures. Run TypeScript, lint and architecture checks.

Next slices connect the saved wardrobe to the client, bind licenses to room/party admission, integrate a selected storefront and restore flow, then implement the social plaza. This document records implementation scope, not completion of the entire roadmap.

## Implemented interface

`GET /api/account/inventory` returns the authenticated account's saved inventory, full-game entitlement, reference prices, provisional free-game list and whether purchases are available. `POST` on the same route accepts:

- `import_legacy`: an `items` array and `look`; only frozen legacy IDs import, once. The server initializes a 500-coin welcome balance; browser balances and statistics are never uploaded as trusted values.
- `buy_coins`: an `itemId`; price and available balance come from the server.
- `equip`: a `look` object; every item must belong to the account and its declared slot.
- `verify_purchase`: a bounded `proof` string; the registered server adapter must verify ownership, settlement, product and environment. There is deliberately no adapter registered in production, so this currently returns 503 and grants nothing.

All writes require an allowed Origin and a valid session. Responses are not cacheable. The new `0005_commerce.sql` migration runs with the existing migration runner on deployment; it has only been exercised against isolated test databases in this task.

Receipts are idempotent across retries. Revocation is terminal for a transaction, regardless of notification order. Repurchasing requires a new transaction ID. Original bundle contents are stored with the receipt. Sandbox purchase grants never supply live ownership. Deleting an account removes inventory and anonymizes receipt ownership while retaining consumed receipt identifiers to prevent replay.

The shared access policy and database-backed account/party checks are implemented and tested but not wired into live admission yet. No paid items have been fabricated or existing coin items converted into paid products. Existing wardrobe screens and game access continue to work as before. Verified game rewards and a client inventory bridge belong to the next integration slice.

## Verification completed

- 64 scoped commerce/account/database tests passed, including 14 new commerce tests.
- TypeScript, scoped lint, formatting and repository architecture checks passed.
- Production Node build passed and includes `/api/account/inventory`.
- The build reports existing large-chunk and Vite configuration warnings; no build failure.
- No deployment, real charges, production database migration or storefront receipt integration was performed. Cloudflare D1 execution has not been exercised; transaction/migration tests used the repository's actual SQLite adapter.
