# Reel Problems 3

Reel Problems 3 is a separate first-person cooperative voyage for one to four players. A crew loads its boat in the harbor, awakens three island beacons, follows a legendary glowing fish through a storm, places guiding lanterns, plays the beacon melody, and reaches a shared homecoming.

Play at `/reel-problems-3`. Reel Problems 2 remains unchanged at `/reel-problems-2`.

## Controls

- WASD or arrows: move.
- Mouse: click the world, then look around.
- Shift: move faster.
- E: use the centered amber interaction.
- Escape: release the mouse cursor.
- Touch: directional pad, drag the right side to look, and tap Use.

The shared room layer provides invitations, four-player peer hosting, voice, durable checkpoints, reconnects, and host migration. Solo play runs the same deterministic adventure rules locally.

## Validation

- `node scripts/test.mjs games/reel-problems-3 platform/games/registry.test.ts shared/games/identity.test.ts platform/peer/invariants.test.ts`
- `node games/reel-problems-3/scripts/browser-check.mjs` against a local production preview.
- `npm run typecheck`
- `npm run build`
