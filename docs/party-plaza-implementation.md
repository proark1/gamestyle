# Account wardrobe and party plaza

Approved continuation, 22 September 2026. Implement the account wardrobe bridge, shared lobby outfits and movement, and the first walkable shop plaza. Real checkout and paid admission remain disabled during preview.

Use the existing clay palette: sky #A8DDF0, teal #287C80, coral #D96846, sunshine #F5C451, paper #FFF6DF, ink #244943. Retain Fredoka headings and DM Sans controls. The signature is a miniature shopping street with physical clothing displays around the shared party gathering space. Direct buttons provide equivalent access.

The inventory bridge keeps guest storage separate from account inventory, ignores outdated responses across sign-in changes, and routes authenticated purchases/equipment to the server. The party route derives account outfits and ownership from the current authenticated session; guest outfits remain limited to the legacy catalog. Private account bindings never appear in room responses.

The plaza uses the shared avatar and item models, lazy-loads its renderer, suspends while shopping/backgrounded, and disposes owned resources. Movement is bounded, local movement is smooth, remote movement interpolates, and network updates are limited. Shopping removes readiness until the player closes the fitting dialog. Existing invitation, voice, readiness, game launch and recovery flows remain in place.

Verify account-switch races, offline saves, source-of-truth ownership, unauthorized presence, bounds, browsing/readiness and existing party rules. Inspect a two-player browser session and narrow mobile layout; run type, lint, architecture and relevant regressions.

Implemented: account inventory bridge, coin purchases and equipping, account switch protection, one-time legacy cosmetic import, shared lobby avatars and movement, hat/outfit displays, direct try-on dialogs, touch/keyboard controls, and server readiness while browsing. No account inventory is persisted into guest local storage. Failed writes leave the previous inventory intact.

Validation: 112 account, commerce and party tests; TypeScript; scoped lint; architecture checks; Railway production build. The two-player browser smoke test passed for guests on the local development server and a signed-in host against an isolated SQLite database on the production build. Verified movement, browsing, preview without ownership, purchase/equip, reload persistence, and desktop/mobile layouts. Screenshots are in `docs/plaza-qa`.

Run `node scripts/plaza-browser-smoke.mjs` against the existing development server, or set `PLAZA_TEST_ORIGIN` to a local server URL. For authenticated QA, run with `node --import tsx` and set `PLAZA_TEST_DATABASE` to that server's **isolated test database**; it creates a test account/session there. It never sends email or charges money.

Remaining rollout: real platform checkout and restore flows, paid-exclusive catalog and bundles, paid-game admission, persistent crews, authoritative gameplay rewards/mastery, weekly challenges and leaderboards. Signed-in local progress grants are disabled until trusted gameplay rewards exist; guest progress remains available. The current plaza sells existing coin items only. Existing individual game avatar initialization has not been migrated to this party presence protocol.
