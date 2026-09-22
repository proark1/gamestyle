# Crew jobs validation — 2026-09-22

Implemented the approved rope/fish, timber/leak, separate bucket bail, and cooperative harbour winch jobs in Last Boat Home. Deck stations, carried supplies, the flopping fish and raised gate have visible models. Contextual prompts explain the next destination and carrying prevents rowing. Solo gets a 14-second latch; a deckhand can walk to stations and work while the human rows.

Validation in the isolated `work/reel-problems-2-release` checkout:

- 104 Reel Problems 2 tests passed, including a complete normal-input solo mission, real deckhand movement between stations, interrupted work, duplicate repairs, supplies on checkpoint restore/disconnect, loose-fish disruption, solo and crew gate rules, raft rebuilding, and legacy mission behaviour.
- TypeScript, game lint and architecture checks passed.
- Production Railway build passed. The final visual adjustment attaches props to the boat so they follow its roll, enlarges station labels and lifts the fish above the well; the preview bundle and TypeScript/lint were checked again after it.
- Chrome keyboard tests passed: walk to rope, pick up, carry to fish, tie down, walk to winch, open, and row through. A separate damaged-boat fixture passed timber pickup, carrying, patching, and bailing at the bucket.
- Browser tests use the actual scene and mission panel with controlled starting states and a read-only state accessor. They do not set state to complete jobs. No JavaScript errors were observed. Phone-sized layout has no horizontal overflow; solo start was also exercised through the real game menu.

Preview: `http://127.0.0.1:3180/reel-problems-2`. QA captures are under `.tmp/reel2-qa/jobs-*.png`. This update has not been deployed. Multiplayer rules/checkpoint behaviour were covered in simulation; this pass did not repeat a live multi-device network test. Human cooperative playtesting is still needed to assess difficulty and fun.

The root workspace has unrelated concurrent changes. The isolated release copy excludes concurrent invite URL and peer adapter edits that require other shared infrastructure.
