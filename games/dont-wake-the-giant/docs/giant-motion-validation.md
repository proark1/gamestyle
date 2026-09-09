# Giant motion validation — 2026-09-06

Implemented a shared deterministic joint solver and staged sit-to-stand motion, fixed-length legs and arms, staggered foot placement, planted soles, supporting/reaching hands, smaller head proportions, smooth character materials, tapered limbs and a continuous shirt surface. The existing game stays at `/dont-wake-the-giant`.

- Full regression suite: 216 tests passed. Four new motion cases sample both arm crossings across the full 25-second escape, check every bone length and frame continuity, check planted visual and collision soles, verify serialization/restart, and exercise unreachable/coincident IK targets.
- TypeScript checking and targeted Oxlint passed.
- Node/Railway production build passed. Existing chunk-size and Vite configuration warnings remain.
- Four-client Giant integration passed against the retained local development server, including shared movement, 22 treasures, the crown, banking, quiet handoffs, replay protection, origin checks and private credentials.
- The same four-client integration passed against a separate local production server on port 3004.
- Offline geometry renders reviewed at 0, 1.6, 2.8 and 6 seconds. The render review identified and corrected shirt surface orientation, overlapping chest geometry and a one-centimetre instep penetration. Run `node --import tsx games/dont-wake-the-giant/scripts/giant-pose-preview.mjs` to recreate the SVG pose sheet under ignored `outputs/giant-motion/`.

Bent-arm collision boxes initially scooped fleeing players back onto the giant. Awake arms now stop serving as climbing platforms after their passengers are released; the sleeping bridge keeps its existing behavior. Awake legs have separate collision bounds, preserving the space between them. The existing nested-pillow passenger/held-treasure escape regression passes.

These offline renders do not validate actual browser lighting, frame rate, touch controls or physical devices. No browser interaction test or human multiplayer playtest was performed for this revision.

The user explicitly approved publication with “Okay, bring it live.” on 2026-09-06. Pre-publication validation of the current shared workspace passed: 220 tests, TypeScript checking and the Node/Railway build. A 20 ms timer assertion in the unrelated delivery connection test failed during concurrent build load, passed in isolation, and the complete suite passed with test concurrency limited to one. No production code was changed for that test.

Railway deployment `2322ae36-4965-49e6-a62f-e5c8d4a30d1e` reached `SUCCESS` on 2026-09-06. The existing public URL is https://stack-or-sink-production.up.railway.app/dont-wake-the-giant. Live `/api/health` returned `status: ok`; the deployed `scene-DXe2lmDS.js` asset contains the new articulated rig; and the complete Giant four-client HTTP integration passed against the public origin. The integration left its temporary rooms afterward.

## Raised ceiling lamp — 2026-09-06

The requested follow-up keeps the hanging lamp, raises its platform from 6.6 to 17 world units, and shortens the suspension rod from 4.4 to 2.2. A shared position keeps the visible fixture, collision surface and its two treasures aligned. The belly sneeze now derives its launch speed from the platform height, preserving access with a safe landing. Supported treasure and players in existing active rooms move to the new height too.

Validation: all 42 Giant gameplay, motion, chaos and audio tests passed, including the updated sneeze landing regression. TypeScript, targeted Oxlint and the Railway production build passed. An offline geometry sweep at 40 ms intervals through the six-second wake animation, with left/center/right gaze targets, found at least 1.32 world units of clearance beneath the lamp over its footprint. A legacy-room check confirmed supported players and treasure relocate correctly. No browser visual test was performed.

Lamp deployment `06dd5b91-9093-4824-b97b-c4d6de66eac3` reached `SUCCESS`. The live health endpoint, updated `scene-CtXbZjUx.js` bundle and complete four-client Giant integration passed against the existing public origin; temporary integration rooms were cleaned up.
