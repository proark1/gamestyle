# Persistent crews — implementation slice

Continuation of the approved monetization/retention plan. One primary crew per account, eight members, four players per party. Implement persistent name/preset emblem, members, expiring reusable invitations, owner edits/removal/leadership transfer, leaving and automatic succession on account deletion. Crew membership never changes personal inventory. Last-member departure archives the identity for future records.

Use the existing lobby palette and Fredoka/DM Sans. An inline clubhouse card has a large preset badge, roster, and equivalent keyboard/touch controls; no extra renderer. Crew codes join a persistent group; a separate copy-party-link action gathers that group into the current room. No automatic messaging or public crew directory.

Server owns membership: unique account membership, eight unique bounded seat numbers, hashed 60-bit invitation codes with seven-day expiry and owner rotation. Mutations validate origin/session, account scope and expected crew. SQL predicates recheck permission during writes. Account IDs, identity hints and invitation hashes never leave the server. Account deletion removes membership and promotes the oldest remaining member; empty crews archive. Client ignores stale requests after account switches and preserves forms on network errors.

Implement additive migration, store/routes and authenticated API; client panel; trusted party crew badges; real SQLite race/permission/deletion tests and browser QA. Mastery, trophies, weekly goals, ranked results and reward issuance follow separately after trusted game-result validation; do not fabricate records or grant items from client claims. Existing purchases and game access remain unchanged.

## Completed verification

- 118 scoped crew, account, commerce and party tests pass, including six new crew tests.
- TypeScript, scoped lint, formatting, architecture checks and the production Node build pass.
- `node --import tsx scripts/crew-browser-smoke.mjs` passed against a local production build and an isolated SQLite database: two-account creation/invite/join, reload persistence, leadership transfer, failed save and retry, renaming, party crew-name refresh, leaving, and desktop/mobile layouts.
- The test refuses non-local servers, requires `CREW_TEST_DATABASE`, and deletes its test accounts and leaves its temporary party seats afterward. Set `CREW_TEST_ORIGIN` for a port other than 5198.
- Screenshots: `docs/crew-qa/desktop.png` and `docs/crew-qa/mobile.png`.
- Release validation repeated on an isolated checkout based on production main `501d24d`, preserving Cage Clash and the existing party plaza. All 118 tests, TypeScript, scoped lint/formatting, architecture checks, production build and the two-account browser flow passed. Migration `0006_crews.sql` was validated against an isolated database before release. No real charges or external invitations were sent.

Crew membership changes invalidate existing invitations; leaders can generate a new seven-day code. The server supplies party crew badges and refreshes them through lobby presence even when an avatar is idle. Guest browsing remains available, while persistent crew management requires sign-in.
