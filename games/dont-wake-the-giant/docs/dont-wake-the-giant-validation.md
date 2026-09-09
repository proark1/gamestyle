# Tiptoe Thieves validation — 2026-09-06

Implemented the fourth collection game, `/dont-wake-the-giant`, its cottage scene, procedural audio, keyboard/touch controls, solo and shared room flows, optional voice membership, and the illustrated collection card. The collection uses a two-column desktop shelf for the four games and a single column on small screens.

## Checks completed

- `npm test`: 128 tests passed, including 17 new giant game tests and the existing three games, audio, voice and database regressions.
- `npm run typecheck`: passed.
- Targeted Oxlint on the new game, routes, tests and integration script: passed.
- `npm run build`: Cloudflare/Sites production build passed.
- `npm run build:railway`: Node/Railway production build passed.
- `node games/dont-wake-the-giant/scripts/giant-integration.mjs`: passed against the retained development server on port 3003.
- The same four-client integration passed against a separately started production server on port 3004. It verified all four collection links and game routes, image availability, four concurrent members, shared movement, collecting/banking/escaping, replay protection, host controls, capacity, origin validation, token privacy and stale input rejection.

## Gameplay verification

The necklace route is traversed with ordinary movement and jumps through the books, stool, bed, knees, belly and chest, then back down the steps to bank the necklace. The silver cup route through both drawers to the nightstand also passes. Other cases verify breathing support through room serialization, pillows on moving surfaces, arm displacement, a warned foot tickle launching a belly passenger onto the chandelier, pillow cushioning, recovery from dazed falls, teaspoon rotation and support, banked treasure preservation, real-time sunrise and escape deadlines, quiet movement, concurrent ownership and departing-player recovery.

## Review and publishing

The local route returned HTTP 200 and a preview handoff was queued in Codex for `http://localhost:3003/dont-wake-the-giant`. The temporary production verification server was stopped after the checks.

After the user approved public publication, Railway deployment `72d017b3-4137-4ece-a4ec-67131832a978` reached `SUCCESS` on 2026-09-06. The game is live at https://stack-or-sink-production.up.railway.app/dont-wake-the-giant on the existing production service and database volume.

Live verification passed:

- `/api/health` returned `status: ok`.
- `games/dont-wake-the-giant/scripts/giant-integration.mjs` passed against the public origin: all four collection routes, artwork, four concurrent thieves, shared movement, collecting/banking/escaping, action replay protection, host controls, capacity, origin validation, token privacy and stale input rejection.
- `games/uphill-delivery/scripts/uphill-delivery-integration.mjs` passed against the same origin: four concurrent players, shared carrying, release replay protection, capacity and authentication.
- Both integration scripts left their temporary rooms after verification.

Browser visual/device QA, real microphone tests and a human internet multiplayer playtest were not performed; automated route and simulation checks do not replace them. The new illustration is promotional artwork, not a gameplay screenshot. No paid audio was generated.

## Larger giant, more treasure and full waking revision — 2026-09-06

The giant now has a broader rounded body, distinct limbs, hands and toes, a shirt collar and buttons, a rounded face with eyes, cheeks, nose, moustache and beard, and a larger bed. The shared escape clock drives a 2.6-second sit-up animation and matching rotated collision bounds. Eyes open and the character looks toward the thieves and reaches during the escape. Torso passengers, including passengers on placed pillows, are tossed onto the bed margins before the body rises; carried loot remains held unless subsequently dropped by an ordinary hard fall. Loose torso treasure and tools are dislodged. The escape camera widens to include the upright giant. This remains a timed escape with reaching gestures, not a walking pursuit simulation.

Treasure increased from 7 to 22 pickups, including gems, pouches and a 100-gold crown. Floor treasure alone is below the unchanged 120-gold target. New treasure has visible ground rings and can be found on the existing climbing routes.

- `npm test`: 132 passed. New cases verify treasure placement, retrieving and banking the crown through normal movement, escaping after a wake-up toss with carried treasure, nested pillow passengers, and the visible upright pose and eyes across serialized state and restart.
- Type checking and targeted Oxlint passed. The Node/Railway production build passed.
- Giant and Uphill Delivery four-client integrations passed on a local production server and again on the live public origin. The Giant integration verifies all 22 treasure pickups and the crown in addition to shared movement, banking, room capacity and authentication. Live `/api/health` returned `ok`.
- Railway deployment `691af442-b36f-4652-9947-ae557b918855` reached `SUCCESS`. The URL remains https://stack-or-sink-production.up.railway.app/dont-wake-the-giant.
- Refresh the game and start a new heist to use the new initial treasure layout. Existing rounds retain their saved loot.

No browser visual/device QA or human multiplayer playtest was performed for this revision.

## Mobile joystick and viewport revision — 2026-09-06

Gameplay now uses a fixed viewport with no inherited 620/640-pixel minimum height or page overscroll. The mobile HUD has safe-area spacing, larger controls, and separate short-portrait and landscape rules. Portalled dialogs retain their own scrolling. Canvas focus uses `preventScroll`.

The shared TouchControls component now starts neutral at the thumb's actual touch-down position, keeps that origin throughout the drag, rescales its dead zone continuously, and moves the thumb graphic directly without React renders for each pointer event. Explicit pointer ownership and capture, propagation suppression, native touch-move cancellation, and cancel/release cleanup keep movement separate from scrolling, camera input and a second thumb's jump. Toolbar-only height changes no longer reset a drag. Width/orientation changes, app switching, disabled controls and lost capture stop movement. The joystick also supports arrow keys when focused. Giant movement input is published immediately on touch changes.

- Full regression suite: 143 tests passed, including five new joystick cases for neutral touch-down, smooth dead-zone response, independent second-thumb input, release beyond the pad, and interrupted drags.
- Final targeted gesture/game tests: 30 passed. Type checking and targeted Oxlint passed.
- Node/Railway production build passed. Local and live four-client HTTP integrations passed for Giant, Uphill Delivery and Stack or Sink. The game page successfully loaded both the new viewport and joystick styles, and live server health was `ok`.
- Railway deployment `c479cb95-2e0d-4d85-8cfa-47e577c8c757` reached `SUCCESS` at the existing public URL.

The optional clarification about whether the page or only the 3D camera moved received no reply during this work. This revision addresses page motion, unstable joystick origins, control cancellation and focus scrolling. It retains the game's intended camera follow behavior. No browser visual QA or physical iOS/Android multi-touch playtest was performed; automated gesture tests and HTTP checks do not verify hardware touch behavior.
