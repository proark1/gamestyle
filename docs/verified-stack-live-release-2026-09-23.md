# Verified Stack or Sink release — 23 September 2026

Release commit: `a6230f3` (feature commit `cf81767`). Includes production main `52ccd56` and subsequent mobile-settings fix `c17bb96`. Prepared in `.tmp/challenge-release`; unrelated root edits were preserved.

Status: LIVE. Railway deployment `a47def58-5df7-48c8-8270-22fdf3c287bd` reports SUCCESS. The persistent volume mounted, migrations completed and the production server started successfully.

Player entry: https://www.jumbleyard.com/stack-or-sink?challenge=verified — sign in, choose **Create verified crew**, then invite up to three signed-in friends. A challenge card also appears in the party lobby.

Rewards: 100 coins for the weekly target, once per account/week; permanent 50/100/200-coin mastery milestones for a settled 3-metre tower, settled 6-metre tower and rescue. Four targets rotate Monday at 00:00 UTC. A run keeps its starting target. Server physics, account-bound room membership and atomic result/ledger writes determine awards. Held or airborne cargo does not qualify as settled tower height.

Verification: 275 related tests passed; TypeScript, scoped lint/formatting, architecture checks and the production build passed. Two-account local browser scenarios verified creation, invitation join and reload, host reconnect, persistent progress, result UI and balances on desktop/mobile. Winning-result UI tests explicitly use isolated server-state fixtures; real server ticks also exercised a complete losing round. Authenticated testing did not use production customer accounts or grant production test rewards.

Live verification passed: health, party and Cage Clash return 200; anonymous challenge reads and attempted writes return 401. The public challenge page displays the weekly target, mastery rewards and sign-in requirement on desktop/mobile, with no horizontal overflow or browser exceptions. Screenshots: `docs/challenge-qa/live-menu-desktop.png` and `docs/challenge-qa/live-menu-mobile.png`.

Limits: this is the first free, opt-in standalone challenge. Ordinary party results do not earn these rewards. Verified-room voice, ranked boards, cosmetic trophies, other mastery tracks and paid weekly challenges are not part of this release. Real-money checkout remains disabled.
