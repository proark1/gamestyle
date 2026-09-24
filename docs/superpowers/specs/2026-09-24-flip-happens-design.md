# Flip Happens

The user selected concept 10 and explicitly requested implementation after publishing Bouncy Castle Royale. This carries forward the approved four-player unstable-table concept and the requirement to reuse existing items and infrastructure.

## Play

One shared tabletop, four seats, two-minute rounds. Empty seats are bots. Aim with pointer/touch or WASD/arrows. Hold Space or the Flip button; release in the highlighted band for an upright landing. Six objects get progressively heavier: bottle, top hat, cone, boots, pan, washing machine. Existing wardrobe models supply the hat, cone and boots; shared primitives supply the other three.

A successful landing adds the item's points times the current combo. Bank secures the pending points and resets the combo. A failed throw or a knocked-off unbanked object loses the pending combo. Banked points survive. Heavy impacts tilt the table and kick nearby objects into the air. Players may select any object; the washing machine is available immediately for experimentation. The clock banks stable pending points, but an unresolved throw does not score. Highest banked score wins; equal top scores draw. Rematches reset the complete simulation.

The daily challenge is a 60-second solo variant with a UTC-date seed, a fixed six-item sequence and repeatable table nudges. No bots interfere. Its personal best is stored on this device; the same challenge is available to anyone on that date. There is no global leaderboard. Multiplayer and party mode use the competitive round.

## Approach and reuse

A small serializable simulation is preferable to introducing a new physics dependency: it checkpoints cleanly through the existing peer engine and can be tested without WebGL. Reusing another game's simulation would couple unrelated rules; copying an entire game would duplicate platform features. The implementation therefore owns its physics, scoring, scene and UI while composing shared primitives, Nico, wardrobe, house lighting, renderer lifecycle, existing sound recordings, room/voice controls, analytics, gamepad keys, admission guard and party result reporting.

Airborne objects use ballistic motion and angular rotation; upright contact becomes a settled prop. The table uses bounded damped angular springs. Impacts apply distance-based kicks. Entities and event history are capped and old props expire. Inputs are finite and clamped; scoring and charge timing are host-authoritative. Checkpoints preserve active objects, scores, table motion and random state. Replacing a bot or disconnected player changes ownership consistently without moving seats.

## Integration and verification

Register the game in the existing identity, audio, analytics, avatar, collection, installed app and party catalogs. Include English and German instructions, keyboard/touch controls, help, a real scene thumbnail and the existing commerce admission boundary.

Test valid/invalid landings, bank versus bust, heavy impacts, timer resolution, deterministic daily setup, input sanitization, bounded long-running physics, four players, idempotent actions and host recovery. Verify desktop and emulated touch play, daily/rematch flow, WebRTC and voice. Run the complete repository check and production build. Build on the isolated current-main checkout; preserve unrelated root edits. The requested Castle release is already live. Flip Happens is prepared as the next playable game; publishing it is a separate step.

## Implementation sequence

1. Implement types, objects, simulation, controls and peer adapter with focused rule tests.
2. Compose the shared visual/audio building blocks into the scene and responsive game UI.
3. Register the route, card, party, installed app and admin metadata.
4. Run rule checks, browser play, four-peer integration, full check and production build; fix findings and capture the card.

Self-review: scope matches the selected concept; the daily mode, risk rules, item reuse and deployment boundary are explicit. No unresolved design placeholders.
