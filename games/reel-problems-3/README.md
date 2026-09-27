# Reel Problems 3

An 8-minute first-person party-fishing round for one to four players. Empty crew
slots are filled by autonomous deckhand bots that use the same helm, equipment,
fishing, repair, storage, rescue, and docking rules as human players.

The round has four beats:

1. Physically carry the fishing and safety loadout from the dock onto the boat.
2. Share one moving boat and complete three deterministic fishing contracts.
3. Handle arcade line tension, physical catches, incidents, repairs, and rescues.
4. Return the catch to harbor and dock before the bell.

The ocean is a seeded 3×3 streamed cell grid around the boat. Only nearby rocks,
islets, fish, items, and active incidents are represented in the synchronized
world, keeping the mobile payload bounded while preserving deterministic rounds.

Play at `/reel-problems-3`. Reel Problems 2 remains unchanged at `/reel-problems-2`.

## Controls

- WASD or arrows: move.
- Mouse: click the world, then look around.
- Shift: move faster.
- E: use, carry, or place the centered object.
- F: cast, hook a bite, or clear a tangle.
- Hold R: reel while line tension is safe.
- Q: drop the held item; Space jumps; B braces against a deck wave.
- Escape: release the mouse cursor.
- Touch: directional pad, drag the right side to look, and tap Use.

The shared room layer provides invitations, four-player peer hosting, voice, durable checkpoints, reconnects, and host migration. Solo play runs the same deterministic adventure rules locally.

## Validation

- `node scripts/test.mjs games/reel-problems-3 platform/games/registry.test.ts shared/games/identity.test.ts platform/peer/invariants.test.ts`
- `node games/reel-problems-3/scripts/browser-check.mjs` against a local production preview.
- `npm run typecheck`
- `npm run build`
