# Persistent crews production release — 22 September 2026

Live URL: https://www.jumbleyard.com/party

Commit: `dd9f4f0`, based on production main `501d24d`; includes the existing Cage Clash release. Deployment: `1c04b2fa-c685-4249-9082-e22aa4bd1cbb`.

Released account-backed crews with names, six emblems, eight members, expiring invitations, leadership transfer, removal, leaving, automatic succession and lobby crew badges. Used an isolated checkout at `.tmp/crew-release`, a normal fast-forward push, and the deployment safety checks. Unrelated root changes were preserved.

Release validation: 118 account/commerce/crew/party tests, TypeScript, scoped lint/formatting, architecture checks and production build passed. The actual release build passed the two-account browser scenario against an isolated SQLite database: create, invite, join, reload, transfer, rename, offline retry, membership removal and responsive layouts. Authenticated tests did not use production customer accounts.

Production startup mounted the persistent volume and completed migrations. Live health, party and Cage Clash returned 200; anonymous crew access correctly returned 401. A temporary guest party confirmed the live clubhouse panel on desktop/mobile, no horizontal overflow and no browser exceptions. The guest seat was removed afterward. Screenshots are `docs/crew-qa/live-guest-desktop.png` and `docs/crew-qa/live-guest-mobile.png`.

Mastery, weekly challenges and leaderboard rewards remain unimplemented. Existing party results are browser reports (`shared/ui/party-round.ts`, `platform/party/coordinator.ts`), while peer checkpoints are host-authored recovery state. Neither is sufficient evidence for granting account rewards. The next increment needs a server-verified run boundary before those reports can grant items. Stack or Sink retains a server-run room implementation worth evaluating for the first verified pilot; its normal client connection path must also be checked before integration. Real-money checkout remains disabled.
