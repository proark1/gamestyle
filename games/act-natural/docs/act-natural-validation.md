# Collection and Blend Business validation

Completed 2026-09-06 in the existing working checkout:

- `npm test`: 53 passing tests, including 14 Blend Business tests and the existing game/storage regressions.
- `npm run typecheck`: passes.
- Focused Oxlint check of all new TypeScript/React files, the collection route, metadata, API route and integration script: passes.
- `npm run build`: Worker/client production build passes with all three page routes and both game APIs.
- `npm run build:railway`: Node production build passes.
- `node games/act-natural/scripts/act-natural-integration.mjs`: passes against the running Node development server. Checks four authenticated players, one farmer and three distinct privately assigned cows, hidden server fields, invalid-token rejection, all page and illustration routes, and legacy Stack or Sink invite redirects. Test players leave their room afterward.
- Generated illustrations were visually inspected before integration.

Repository-wide lint still reports pre-existing findings in shared UI, original game files and existing tests. The new files pass the focused check. Existing unrelated physics work was present and continued changing during this task; it was preserved.

No browser interaction/screenshot test or real four-person internet playtest was performed. The local preview is at `http://localhost:3001/`.

## Public release

Published on 2026-09-06 after the user requested the collection go live. Railway deployment `25424767-257d-49ec-8a3f-1f261cc889d4` reached `SUCCESS` with a running instance at https://stack-or-sink-production.up.railway.app. The existing persistent database and public address were retained.

The production release passed the Blend Business four-client integration check, the existing Stack or Sink four-client integration check, and the shared placement physics integration check. The collection, both game routes, both illustrations, legacy invite redirects and private farm roles were verified over HTTPS. The health endpoint returned `ok`. Temporary test players left their rooms afterward.

## Independent herd update

Published on 2026-09-06 as Railway deployment `47dd8315-3e0c-4087-ad24-1947f246c6e0`, which reached `SUCCESS`. Each cow now chooses its own grazing, resting and walking schedule, direction and speed. Practice mode tolerates ordinary mixed activity while the computer farmer still reacts to visible stolen equipment and sabotage.

- The isolated release passed all 57 tests, including 18 Blend Business tests, TypeScript checks, focused Oxlint and the Node production build.
- Seeded full-round simulations verified simultaneous grazing and divergent walking, staggered activity changes, field bounds, saved-room compatibility and private behavior state. Additional tests verified practice-mode suspicion for normal behavior and visible loot.
- Both games' HTTP integration checks passed against the isolated production build and the public HTTPS deployment. The live Blend Business check verified independent NPC herd movement with four authenticated players, along with collection routes, images, legacy invites and role privacy.
- The release excluded concurrent, unfinished Stack or Sink mobile-control changes in the shared checkout. No browser playtest or human balance playtest was performed.
