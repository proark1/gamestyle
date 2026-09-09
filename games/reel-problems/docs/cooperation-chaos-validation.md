# Shared catches and rough water — 8 September 2026

Implemented from the user's request for shared fish pulling, real falls from tilted boats, and more weather and creature encounters. The design is in `docs/superpowers/specs/2026-09-08-reel-problems-cooperation-chaos-design.md`.

## Changes

- Fish attachment is derived from independent player lines. Multiple anglers add physical pulling force and stamina depletion; cuts, snaps, falls and departures detach only their own line. Shared endpoints do not cause tangles. Landing scores once and credits everyone still attached.
- Sliding velocity accumulates with boat roll and pitch. Tilted rims allow actual falls, normal rails retain players on level water, rain reduces grip, and bracing helps until extreme tilt. Rescued anglers regain stable footing and brief protection.
- Checkpointed weather cycles through calm, gusts, rain and thunderstorms, with variable durations and directions, physical boat forces and thunder waves. A shark periodically circles and bumps the hull; glowing jellyfish drift past and snag hooks.
- The scene adds rain, wind streaks, darker water and sky, lightning, creature models and a fall transition. Weather and creature event sounds have immediate synthesized fallbacks. The HUD and help explain team pulling and conditions. Lightning is suppressed for reduced motion.
- Old host checkpoints receive defaults for the new weather, wildlife and sliding fields. Existing fish lines remain intact without the former exclusive owner field.

## Validation

- All 28 Reel Problems rules and checkpoint tests pass, including 12 new cooperation, falling and chaos tests. Every original catch remains possible solo.
- Four real local WebRTC clients attach to and land the same monster. All clients observe one 100-point team score, one haul entry and catch credit for all four anglers.
- A second shared catch retains the surviving three lines after abrupt host loss. Direct generated voice samples continue through election; graceful second handover also passes.
- Repository test run: 745 passed, none failed. Architecture boundaries pass through the test precheck. TypeScript passes.
- Formatting and lint pass for the Reel Problems files and the updated peer integration script.
- The repository-wide aggregate check stops on existing formatting issues in five Wrong Floor files. A separate full lint run reports `jsx-a11y/no-autofocus` in `games/shelf-control/Game.tsx:771`. These unrelated game edits were preserved.
- Worker and Node/Railway production builds pass. Build logs and complete test output are under ignored `work/reel-coop-chaos-*` files.
- The existing development server serves `/reel-problems` with HTTP 200 at `http://127.0.0.1:3033/reel-problems`. A preview-opening request was queued in Codex. No screenshot, browser-interaction or physical-device visual QA was performed.

The initial delivery was local. The later audio expansion release included these changes; production was verified on 9 September as recorded below.

## ResizeObserver follow-up

The user reported repeated `ResizeObserver loop completed with undelivered notifications` overlays in the narrow preview. The scene called `renderer.setSize` during observer delivery and allowed Three.js to write inline canvas dimensions. The observer now only marks the size as dirty. The existing animation loop applies changed drawing-buffer dimensions with `setSize(width, height, false)`, leaving CSS in charge of layout. The canvas is positioned absolutely within its host to prevent its intrinsic dimensions from affecting page overflow.

An isolated Chrome browser completed nine desktop, narrow, portrait and landscape size checks across the menu and running solo game, with zero window errors or unhandled rejections. Canvas layout stayed matched to its host and drawing-buffer dimensions matched the selected 1.5 pixel ratio. The built-in browser tool could not start in its sandbox; the successful check used a separate headless profile outside the sandbox, without changing the user's existing browser session. Evidence is in ignored `work/reel-resize-browser-check.log`.

All 28 game tests, TypeScript, game lint, changed-file formatting and the Node/Railway production build pass. The running preview includes the fix; an existing error overlay may need one reload to clear its old messages.

## Production confirmation — 9 September 2026

After the user authorized publication, Railway's current production state showed deployment `816f36f8-3869-48e4-afc0-498f24f2f0d9` already serving the complete fixes as part of the later audio expansion release. All Reel Problems application and game sources matched that release's verified source manifest, including the resize correction. No additional upload was needed.

At 03:30 UTC, `/api/health` and `/reel-problems` returned HTTP 200. Public `Game-TL-4Hy_r.js`, `scene-BkdqaFZo.js` and `Game.ffMia1Oy.css` passed checks for shared pulling, accumulated sliding, weather, shark and jellyfish events, deferred resize handling, drawing-buffer-only resizing and absolute canvas layout. Evidence is retained in `.tmp/reel-cooperation-live-20260909/verification.json`.

Live game: https://jumbleyard.up.railway.app/reel-problems
