# Bungee Doubles audit — 20 September 2026

**Verdict: desktop play works at a basic level, but the game is not ready for a claim of reliable mobile and desktop support.** The repeated NPC racket sound has a reproducible simulation cause. Touch movement, landscape layout, team switching, and frame-rate consistency need fixes.

Audited live URL: https://www.jumbleyard.com/bungee-doubles

## Evidence and limits

- Opened the production game in the Chromium-based in-app browser, started a rally, observed scoring reach 1–1, reset the match, and inspected help and action controls. No warnings or errors appeared in the console sample taken during desktop play.
- Inspected live layouts at 1440 × 900, 390 × 844 portrait, and 844 × 390 landscape.
- Reviewed local game simulation, physics, bots, rendering, input, CSS, audio, and peer adapter code, including shared renderer/audio integration.
- Ran `node --import tsx --test games/bungee-doubles/bungee-doubles.test.ts`: **22 passed, 0 failed**.
- Executed isolated local simulation probes for repeated NPC hits, event IDs, team switching, spawn positions, serve authorization, end-state behavior, collision ordering, and frame-rate dependence.
- Responsive viewport checks are not real-device tests. iOS Safari, Android touch/multitouch, mobile audio unlocking, hardware performance, and multiplayer were not end-to-end verified. Audio findings are based on the event/audio implementation, not a recording or listening test. Local source was not proven byte-identical to the deployed bundle; live observations are distinguished below.
- No gameplay code was changed or deployed. This report is the only added project file.

## Fix first

### 1. P1 — One NPC contact generates many hits and overlapping sounds

**Reproduced in local simulation.** With a blue NPC at `(0, 5)` and an incoming ball at `(0, 1, 4.5)`, six bot/physics steps at 60 Hz produced **six hit events in 100 ms**, rally count 6, and `swingCooldown` still 0.

`stepBungeeBot` attempts a hit every frame while the ball is nearby. `executeRacketHit` accepts every attempt based on distance/height, without enforcing a cooldown, contact separation, last hitter, or same-team return rule. The ball remains close after the first hit, so subsequent frames strike it again. Both teammates can also qualify to chase/hit the same ball. Each accepted hit becomes a fresh oscillator sound.

Sources: `games/bungee-doubles/bots.ts:109`, `simulation.ts:269`, `simulation.ts:73`, `audio.ts:195`.

**Fix:** enforce hit eligibility in the authoritative simulation, including a swing cooldown and a rule preventing the same team from returning its own outgoing shot. Track one contact until the ball separates; permit the next legitimate opponent return. Assign a single receiving NPC when both are nearby. Emit one audio event per accepted hit. An audio cooldown can be a final safeguard, but merely muting extra sounds would leave repeated velocity resets and inflated rally counts.

**Acceptance:** one NPC contact produces one hit, one velocity change, one rally increment, and one sound at 30/60/120/144 Hz. Include two nearby teammates and rapid human button presses.

### 2. P1 — Mobile has no normal movement control

**Confirmed by source; no movement control was visible in either phone layout.** Movement input comes exclusively from WASD/arrow keys. Canvas dragging orbits the camera; tapping hits. Touch buttons offer camera, smash, dive, and hit, but no directional movement or jump. Diving is a fixed forward impulse, not a substitute for court movement.

Sources: `scene.ts:391`, `scene.ts:298`, `Game.tsx:396`.

**Fix:** add a camera-relative movement joystick or directional pad and a reachable jump control. Keep movement, shot actions, and camera gestures independent using tracked pointer IDs. Verify simultaneous move-and-hit on real touch devices.

### 3. P1 — Landscape phone controls fall below the visible screen; portrait camera crops the court

**Observed live.** At 844 × 390, the action dock started at approximately **y=474** and the vertical touch dock extended to **y=576**. The page scrolled because `.bungee-game` forces `min-height: 600px`. At 390 × 844, substantial court areas and an opponent were outside the view; the camera retains its distance/FOV while only aspect ratio changes.

Sources: `style.css:5`, `scene.ts:623`, touch/dock media queries in `style.css`.

**Fix:** fit the game to available dynamic viewport height, add short-height landscape rules, account for safe-area insets, and fit the playable court to the camera's usable viewport. Avoid displaying two competing action docks. Phone portrait needs its own camera framing, rather than only smaller HUD text.

**Acceptance:** ball, court, and essential controls remain usable without page scrolling at 360 × 640, 390 × 844, and 844 × 390, including browser bars and rotation.

### 4. P1 — Switch Team breaks 2v2 and can strand the opening serve

**Reproduced locally.** Switching the solo human from red to blue leaves **one red player and three blue players**. The action flips only the team field; bots are not reconciled. The human may be absent from the blue tether because tether selection uses the first two teammates. At the opening serve, `servingPlayerId` is null: the human can no longer serve for red, and the remaining red NPC only auto-serves when explicitly named.

Sources: `simulation.ts:218`, `simulation.ts:450`, `bots.ts:55`, `Game.tsx:132`.

**Fix:** make switching an atomic operation: rebalance bots, place players in valid distinct slots, rebuild tethers, and prepare a valid serve. Either restrict switching to between points or deliberately reset the point. Bot identity allocation should also avoid reusing an existing bot ID when filling a partially occupied team.

## Other confirmed defects

### 5. P2 — Physics and NPC behavior depend on display frame rate

**Reproduced locally.** With identical starting horizontal ball speed of 10 and one second of collision-free motion, remaining speed was **8.10 at 30 Hz, 6.56 at 60 Hz, 4.30 at 120 Hz, and 3.64 at 144 Hz**. Air drag multiplies by 0.993 per frame. Player smoothing, stun damping, and NPC random decisions also run per frame. The solo loop uses variable requestAnimationFrame steps.

Sources: `physics.ts:158`, `simulation.ts:414`, `bots.ts:64`, `Game.tsx:150`.

**Fix:** use a fixed simulation timestep with a bounded accumulator and rendering interpolation; otherwise convert damping and random decision rates to elapsed-time-based formulas. Test equivalent match scenarios at multiple rendering rates and after tab suspension.

### 6. P2 — Scoring can reuse event IDs and suppress audio/visual effects

**Reproduced locally.** A direct wall fault emitted point event ID 1, but `world.eventId` ended at 0. The next serve reused ID 1. `scorePoint` increments `world.eventId`, while `advanceBungee` later overwrites it from an older `eventIdRef`. Audio and visual effects discard IDs they have already processed. A same-step bounce/wall case also produced two events with ID 1.

Sources: `simulation.ts:390`, `simulation.ts:491`, `simulation.ts:532`, `audio.ts:197`.

**Fix:** use one event-ID allocator throughout actions, physics, and scoring. Assert strictly increasing, unique IDs across point transitions and restarts.

### 7. P2 — A floor bounce followed by glass contact in one step is judged incorrectly

**Reproduced locally.** Ball `(x=0,y=0.23,z=10.7)`, velocity `(0,-2,12)`, blue side, no previous bounce, last hit red: a 1/60-second step emitted a floor bounce and then awarded blue a point for a direct glass hit. Physics handles the floor before the wall, but scoring checks the wall before updating the bounce count.

Sources: `physics.ts` floor/wall handling; `simulation.ts:485` and `simulation.ts:505`.

**Fix:** resolve contacts in chronological order, using substeps or swept collision times where necessary. A legal floor-then-wall rebound must stay live; wall-before-floor must fault.

### 8. P2 — Scored/ended phases do not consistently stop play; score pause is UI-dependent

**Reproduced/source-confirmed.** A racket action after `phase='ended'` still incremented the rally and emitted a hit. Physics continues moving the ball after match end. Calling `scorePoint` twice while already scored awards two points. The UI clears `scoreBanner` on the next frame, so the simulation immediately prepares another serve even though the banner remains displayed for 1.8 seconds. The peer adapter does not clear this banner itself.

Sources: `simulation.ts:161`, `simulation.ts:200`, `simulation.ts:383`, `simulation.ts:466`, `Game.tsx:186`, `peer.ts`.

**Fix:** freeze gameplay in scored/ended phases, mark the ball dead, make scoring idempotent per rally, and own the between-point deadline in simulation state rather than UI banner consumption. Restart should explicitly reset transient gameplay state.

### 9. P2 — Sound volume does not control procedural match effects; audio cleanup is missing

**Source-confirmed.** Procedural effects connect straight to `ctx.destination` and are always called with default volume 1. The toolbar's shared volume slider changes the separate `SiteAudio` master gain. Game mute is checked, but intermediate volume settings do not scale these effects. Unmount sets `sound.current = null` without calling `dispose()`, leaving the base class's refresh interval/listeners and audio context registered. The procedural context needs explicit disposal too.

Sources: `audio.ts:63`, `audio.ts:205`, `Game.tsx:195`, `shared/audio/player.ts` preference and disposal methods.

**Fix:** route all game effects through the shared mixer or one managed gain with the same preferences. Dispose both audio paths and unregister timers/listeners on exit. Suspend/resume both paths consistently. Verify volume 0/25/100, mute, tab hiding, and repeated enter/exit on real devices.

### 10. P2 — Some visible controls do nothing, and input can get stuck

**Observed live:** desktop mouse-clicking the visible circular HIT button did not start a serve. These circles only handle `onTouchStart`, yet CSS displays them on desktop. **Source-confirmed:** keyboard state is cleared on keyup only, so a missed keyup after focus loss can leave movement active. `pointercancel` shares the pointerup handler and can trigger a shot. Pointer state is not separated by pointer ID.

Sources: `Game.tsx:401`, `style.css` touch controls, `scene.ts:254–364`.

**Fix:** use consistent accessible click/pointer activation without double dispatch, show appropriate controls for input capabilities, clear input on blur/visibility changes, and treat cancellation as cancellation. Test keyboard activation, touch, mouse, focus loss, and simultaneous touches.

### 11. P2 — Opening positions and designated-server enforcement are inconsistent

**Reproduced locally.** The human and red NPC both spawn at `(-2.2,-3.5)` because the first bot takes slot 0 despite the human occupying it. The initial ball is at `(0,1.2,-7.5)` and no server is named. Also, a second red player can serve while the first red player is designated: serve authorization checks only team.

Sources: `bots.ts:16`, `simulation.ts:107`, `simulation.ts:280`, `Game.tsx:129`.

**Fix:** allocate unoccupied team slots, call `prepareServe` after initial roster creation, and require the designated server's ID. Build the launch from the actual ball contact position.

### 12. P2 — Event history grows indefinitely; help is incomplete

**Source-confirmed:** events accumulate for the life of the local match, survive restart, are copied into every snapshot, and are scanned by sound and visual consumers every frame. **Observed live:** How to play only toggles the camera hint. It does not explain movement, serving, scoring, or the hidden Alt+W jump/slingshot control.

Sources: `simulation.ts:209`, `simulation.ts:538`, `audio.ts:195`, `scene.ts` event loop, `Game.tsx:242`.

**Fix:** bound event retention while preserving monotonic IDs and consumer cursors. Add concise real help, including touch instructions and player identification. Audit scene geometry/material disposal as part of repeated-navigation testing; renderer disposal alone is not a complete scene-resource cleanup strategy.

## Recommended implementation order

1. Correct hit eligibility, event IDs, scoring phases, and ordered floor/wall collisions together; add focused regression tests for the reproductions above.
2. Fix roster switching, initial placement, and server assignment.
3. Add touch movement/jump and responsive camera/layout rules; unify input cancellation and button behavior.
4. Make simulation independent of rendering frequency; integrate procedural audio with shared volume and disposal; bound event history.
5. Run the release matrix below before claiming mobile/desktop support.

## Release validation matrix

| Area | Required checks |
| --- | --- |
| Desktop | Chrome/Edge, Firefox, Safari where available; mouse and keyboard; 30/60/120/144 Hz; serve, volley, smash, dive, jump, camera, reset, switch, and full match end |
| Touch | Real iPhone Safari and Android Chrome; portrait/landscape; two-finger move-and-hit; safe areas; browser bars; rotation and touch cancellation |
| Scoring | One point per rally; legal floor/glass rebound; direct-wall fault; double bounce; no play after match end; fresh restart; serve ownership |
| Audio | One sound per physical hit; no duplicate IDs; volume zero actually silent; graded volume; mute; audio unlock; tab suspend/resume |
| Stability | A long match and repeated enter/exit; bounded event history, listeners, audio contexts, and GPU resources; no console errors |
| Multiplayer | Separate validation if intended for this page: the inspected Game component holds a network ref but never establishes a connection or sends movement; having a peer adapter alone does not establish a working online flow |

Passing the existing 22 tests does not establish release readiness: they do not exercise the major regressions found here.
