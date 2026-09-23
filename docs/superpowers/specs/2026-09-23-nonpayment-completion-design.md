# Nonpayment monetization completion

Date: 23 September 2026. This is the implementation continuation of the approved 22 September monetization and returning-player plan. Checkout configuration, live charges and paid admission activation are deferred at the user's request.

## Sequence

1. Finish a dormant access boundary for direct game rooms and party rounds. The default stays open for every game. A later explicit launch switch can require the selected free-game list or each participant's verified full-game grant. The server derives account identity from sessions and party seat bindings, checks ownership again at entry and round start, and never trusts lobby presence flags or browser claims. A guest in a mixed party retains access to shared free games. In-flight rounds survive revocation; later paid rounds do not.
2. Complete the shop and crew presentation around the existing account inventory, fitting plaza, membership and ranked Stack or Sink records. The shop displays actual ownership and preview state; all essential actions retain direct button access. Persisted results and awards are read from the server.
3. Expand progression game by game only where the server can verify a run. The existing Stack or Sink simulation is the first supported source. Other games require their own authoritative runner or replay verifier before they can grant account rewards or ranked prizes. Player reports and peer checkpoints remain ineligible.
4. Finish weekly competition operations for verified games: scheduled targets, free and full-game lanes when a paid-game verifier exists, fixed rules, bounded attempts, review, idempotent settlement, crew attribution, and failure handling. Existing Stack rankings remain free during this work.
5. Validate game selection and launch claims with new player groups and real devices before declaring the three free games final or enabling paid admission. Game-wide mastery requires each game's verified predicates and evidence.

## Safety and rollout

Access enforcement is off unless explicitly configured. The full-game product stays off sale. No local progress, browser result or peer-hosted state can create a paid entitlement or reward. Existing accounts, crews, inventory and rooms keep their current behavior while dormant checks are added. Test route bypasses, mixed parties, retries, refunds, account changes and direct game access before activating a gate. Keep the shared dirty checkout untouched by using an isolated worktree.
