# One More Button validation — 8 September 2026

Implemented `/one-more-button` and its sound workshop, collection card and illustration in the existing Jumbleyard application. The game owns its rules, level, models, renderer, interface, styles, audio, peer adapter and tests. Shared registration changes preserve Four Brain Cells, Wrong Floor and the other games being edited in parallel. No database migration, external service provisioning, production publish or source commit was performed.

## Checks

- All 14 focused rules/checkpoint/audio tests pass. They exercise increasing prizes, persistent hazards, recharge and door lock, permissions/proximity, an input-driven solo route to cash-out, stable banked shares, early escape and late greed, all four teammates launched by one glove, one-life impact/fall accounting, conveyor movement, soap traction, sofa collisions/jumps, helping, STOP, jackpot cap, timeouts, disconnects, rematches, frame-rate independence, bounded catch-up, checkpoint recovery and action idempotency.
- Four real local WebRTC clients pass guest and host presses, shared money/hazards, crew STOP, direct audio, abrupt host recovery, preserved prizes/hazards, surviving voice links, and graceful handover. Run with the isolated in-memory coordinator and again with `PEER_TEST_URL=http://127.0.0.1:3016` against the running Node preview and real room API. Live graceful handover completed in 795 ms.
- TypeScript, scoped lint and the final repository-wide lint check pass. Architecture boundaries pass (494 files at the time of checking).
- Full repository suite passes: 697 tests, zero failures. An initial unrelated giant narrator inheritance failure was fixed by its active task before the passing run.
- Node/Railway and Worker/Sites production builds pass, including One More Button's page, workshop, lazy scene, peer and audio registrations.
- Collection HTTP smoke check passes for ten cards, matching toolbar labels/order, workshop links, invites, game/admin routes, image assets, audio namespaces and origin checks.
- The new page, workshop and 1536×1024 illustration return HTTP 200. The generated illustration was inspected before integration.
- All One More Button files pass formatting. The only issue in the repository formatting run was a concurrently edited Giant presentation document; its task subsequently formatted and checked it. The Wrong Floor task fixed its three initial lint errors, and the final global lint run passes.

The preview is `http://127.0.0.1:3016/one-more-button`. Its existing server belongs to the shared checkout and remains running. Browser screenshots/interaction QA and a four-person internet/device playtest were not performed. Automated local WebRTC checks do not verify restrictive networks or microphone permissions on physical devices.

The project was already linked to Sites and Railway. This request adds a game to an existing application; it does not publish the shared in-progress checkout. The source and implementation are ready for the established deployment workflow.
