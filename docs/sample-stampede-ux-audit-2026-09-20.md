# Sample Stampede: desktop and mobile audit

Date: 20 September 2026  
Live target: https://www.jumbleyard.com/sample-stampede  
Verdict: **Not ready for a polished cross-device release.** The underlying shopping simulation has useful coverage, but layout, camera visibility, onboarding and input lifecycle need work.

This is an audit report, not a claim that the game has been fixed. No application code or production deployment was changed. Existing unrelated workspace changes were preserved. Local source findings describe the current checkout; production/source parity was not established.

## Coverage and evidence

Live browser inspection used these CSS viewport sizes:

| Viewport | Result |
| --- | --- |
| 1280 × 720 desktop | Initial warehouse and HUD render. Movement controls are not explained on entry. A rack upright obstructs part of the cart/view. |
| 1024 × 768 small desktop | Receipt overlaps red score; action dock overlaps speed HUD. |
| 768 × 1024 tablet portrait | Toolbar extends past the right edge; help is not visibly available in the captured layout. |
| 844 × 390 phone landscape | Receipt covers score/announcement and overlaps joystick; radar intrudes into toolbar/restart area. |
| 390 × 844 phone portrait | Initial render works after reload; large receipt and HUD consume substantial play space; receipt text is very small. |
| 320 × 568 compact phone | Scores clip horizontally as rival score grows; radar overlaps cockpit; most of the screen is occupied by HUD. |

Also inspected help, Escape/focus behavior, language switching, sign-in opening/dismissal, wardrobe opening/closing, voice availability, mute state, joystick drag, keyboard movement, grab button, timed round completion, Restart and Play Again. A joystick drag produced movement (15 MPH shown), then deceleration; a carried kibble item updated the receipt to 1/1 and mass to 90 kg during play. The AI partner may have performed the pickup, so this does not independently prove a manual grab hit.

Local automated command:

```text
node --import tsx --test games/sample-stampede/sample-stampede.test.ts games/sample-stampede/sample-stampede-audio.test.ts
```

**26 passed, 0 failed.** Coverage includes mass, wheel wobble, slipping, sample boost, checkout approval/rejection, solo grab with a bot rider, cooldown handling, events, bot shopping, kiosk rotation, manifest feasibility and audio planning. These tests do not certify responsive layout or physical-device interaction.

## Findings, in fix order

### 1. P1 — HUD collisions across multiple supported sizes

**Reproduced live.** At 844 × 390, the receipt occupies approximately x29–281/y91–342 and the joystick x24–138/y246–360. They visibly overlap. The receipt also masks part of the score and announcement. At 1024 × 768, the action dock ends at x403 while the cockpit starts at x378, creating roughly 25 px of overlap. Receipt/score overlap also occurs there. At 320 × 568, longer score content extends outside the screen, and radar covers the right side of the cockpit. At 768 px width, the toolbar does not fit.

Source: `games/sample-stampede/style.css:76`, `:230`, `:844`, `:902`. The layout uses independent absolute positions, fixed-width content and width-based breakpoints. It lacks a coordinated short-landscape layout. Keyboard labels remain visible at 844 px despite the touch layout activating below 900 px.

Fix: use separate compact portrait, short landscape and desktop arrangements. Make the receipt collapsible to a compact progress indicator; shrink or collapse secondary radar/speed information before sacrificing the play area. Allow scores to fit growing numbers. Put secondary toolbar items in an overflow menu when necessary. Size touch controls for thumbs without overlaying the objective.

Acceptance: no overlap, clipped controls, clipped score text or horizontal overflow at every tested size; repeat with long German labels, large scores, announcements and active boost.

### 2. P1 — Camera can lose useful visibility of the game

**Observed live; exact trigger not isolated.** During the idle/help/resize sequence the 3D view became almost entirely a flat dark wall with a strip of floor, while timer, bots and HUD continued. Restart did not immediately restore a useful view; reload did. A later isolated desktop-to-phone resize kept the scene visible, so resize alone is not established as the cause. Initial views also show warehouse uprights obstructing the cart.

Source review: `games/sample-stampede/scene.ts:510` follows the cart at fixed distance/height with no collision-aware camera positioning in this block. Wall/rack occlusion is a plausible cause, not a proven diagnosis.

Fix: reproduce using wall proximity, bot impacts, steering and orientation changes; add collision-aware camera distance and/or occluder fading. Reframe for portrait aspect ratios and reset camera state deliberately on replay.

Acceptance: cart and immediate driving path remain readable against every warehouse boundary, after collisions and after repeated orientation changes. No reload should be needed to recover visibility.

### 3. P1 — The round starts before the player is ready and continues through help

**Reproduced live and confirmed in source.** The timer starts immediately on entry. Help explains drifting and shopping but not WASD/arrows, reverse, the joystick, or explicitly that the human controls the red driver with an AI partner. While help was open the timer dropped from 2:17 to 1:57 and further; the opponent scored while the player read instructions. No pause control is exposed.

Source: `Game.tsx:207`, `:289`, `:626`, `:656`. Only the joystick is disabled by `showHelp`; simulation continues.

Fix: add a short ready screen with objective and device-appropriate controls, then start the countdown on Play. Pause the solo simulation and neutralize controls for help/settings/account/wardrobe overlays and when backgrounded. Explain checkout location and how to recover from rejection.

Acceptance: reading instructions never consumes match time; returning from overlays never resumes stale input; first-time players can identify how to move, collect and score without guessing.

### 4. P1 — Input lifecycle is not robust

**Code-confirmed risk; interrupted physical gestures not reproduced.** Scene keyboard handlers accept every key globally, without editable-field/modal guards or keyboard-state clearing on blur/visibility loss. Drift uses mouse/touch down/up handlers without pointer capture, cancel, lost-capture or outside-release handling. A release outside the button can therefore leave drift engaged. Keyboard activation of the Drift button itself has no click handler. Keyboard events also overwrite the combined custom-input object, risking interference on hybrid devices.

Source: `scene.ts:806–847`; `Game.tsx:607–612`. The shared joystick already has much stronger cleanup in `shared/input/TouchControls.tsx`; the scene and drift control should follow the same lifecycle principles.

Fix: one input controller with separate keyboard and pointer state; neutralize on blur, hidden page, pause, end and restart; ignore input from text fields and dialogs. Use pointer capture and cancellation for drift and support keyboard activation deliberately.

Acceptance: hold movement/drift and release outside, switch tabs, open a dialog, rotate, or interrupt the pointer. Input must return to neutral. Typing in sign-in must never control the cart. Test simultaneous joystick plus drift/grab on real touch hardware.

### 5. P2 — Help/results dialogs lack proper modal focus behavior

**Reproduced live and confirmed in source.** Opening help left focus on the toolbar button. Pressing Escape there did not dismiss it. At round end focus remained on Your look instead of moving to results. The game uses `<dialog open>` without modal presentation, accessible title association or a focus trap. The Escape handler only works when the event reaches the help dialog.

Source: `Game.tsx:657`, `:698`. The shared sign-in dialog did move focus into its email field and dismissed with Escape, providing an existing pattern to reuse.

Fix: adopt the shared accessible modal primitive; label dialogs, move focus inside, contain Tab navigation, restore focus on close, and make background UI inert. Define Escape behavior separately for help and final results.

Acceptance: keyboard and screen-reader users encounter the dialog title and primary action; background controls cannot be activated through the modal.

### 6. P2 — Partial localization and incorrect speed units

**Live mixed-language UI; code-confirmed numerical bug.** Selecting German translated some actions and help paragraphs, but team names, shopping list, radar, timer caption, item names and the grabber instructions stayed English. The speed label changes to KM/H, but `cartSpeedMph` always multiplies by 2.236. A 10 m/s speed therefore displays about 22 KM/H instead of 36 KM/H.

Source: `Game.tsx:391`, `:451`, `:489`, `:572`, `:675`; `translations.ts` already contains unused grabber/radar translations.

Fix: route all visible and accessible strings through translations; convert the numeric speed with the selected unit or use one consistent unit. Keep units and item weights coherent in instructional text.

Acceptance: no accidental mixed English/German UI; correct conversion with a known simulated velocity; all long labels fit phone layouts.

### 7. P2 — Readability, safe areas and motion need a dedicated pass

**Observed small text; remaining items are source risks.** Phone receipt styling scales 12.5 px item text to approximately 9 px, making the central objective difficult to read. The viewport explicitly disables user scaling. The game root uses 100vh and the game's controls use fixed offsets without safe-area variables, exposing it to mobile browser chrome and notches. Animated effects and camera shake need a verified reduced-motion path.

Source: `style.css:8`, `:944`; `app/layout.tsx:30–31`; `scene.ts:532`. Shared styles contain some reduced-motion handling, but camera shake is not gated in the inspected scene block.

Fix: readable compact shopping-list text, dynamic viewport sizing, safe-area-aware controls and reduced-motion handling for camera shake/boost effects. Review zoom policy at the shared layout level without disrupting game gestures.

Acceptance: readable objective at normal scale; controls stay reachable on notched iPhone/Android devices with browser chrome expanded/collapsed; reduced-motion preference suppresses unnecessary motion.

### 8. P2 — Tie results are misleading

**Code-confirmed.** Winner selection starts with red and replaces it only for a strictly greater score. Equal scores therefore award red the win. The party result calculation separately uses `leadingSide`, so standalone and party outcomes can disagree.

Source: `simulation.ts:428–439`; `Game.tsx:420–429`, `:705`.

Fix: represent a draw explicitly or adopt and explain a genuine tie-break rule, consistently across standalone and party flows.

Acceptance: 0–0 and equal nonzero scores produce the agreed result and copy everywhere.

### 9. P2 — Wardrobe updates do not refresh existing cart avatars

**Code-level finding; equip persistence not exercised.** The scene reads `getEquippedLook()` only when creating a cart rig. Existing rigs are retained across round restart. No wardrobe subscription is present in this scene, so an outfit change made through the in-game toolbar has no evident path to refresh the current avatar.

Source: `scene.ts:298–315`; `Game.tsx:360`.

Fix: subscribe to equipped-look updates and rebuild only the relevant avatar, with proper disposal. Confirm the result live using an already-owned item.

Acceptance: equip an owned item, close wardrobe, and immediately see it on the player's avatar without reload.

### 10. P3 — Secondary features and feedback dilute the main task

**Live observation/design recommendation.** A prominent Voice control opens a notice saying voice is unavailable for this game. Help uses “Bulk Club Derby” while the game is named Sample Stampede. The minimap has no explicit legend or player-facing destination label, and the receipt emphasizes decoration over progress. Restart is immediate and icon-only during an active round.

Fix: move unavailable/secondary features into the overflow menu; use consistent naming; mark “You,” required pickup areas and checkout clearly; show a compact collection/progress acknowledgement. Protect meaningful progress from accidental restart, without slowing down post-match Play Again.

## What works

- Initial desktop and fresh phone render successfully; the cream/green/amber art direction is coherent.
- Keyboard movement and pointer joystick produce movement; releasing the joystick lets the cart decelerate.
- Inventory counts, completed-row styling and carried mass update during play.
- Opponent bots collect and score. Existing simulation tests cover successful checkout and contraband rejection.
- The full timer reached 0:00, displayed the winning team and scores, and Play Again reset the timer/scores.
- Mute changes its accessible state and disables the music toggle while muted. Audio quality and actual perceived loudness were not audited.
- Sign-in fits the compact screen and supports Escape/focus restoration. Wardrobe and voice dialogs open and close.
- No warning/error entries were returned by the sampled browser-console inspection after the fresh mobile reload; this is not a whole-session error guarantee.

## Recommended implementation approach

Prefer a focused repair of the current game: retain the art and simulation, rebuild the HUD layout rules, centralize pause/input lifecycle, and address camera occlusion. A CSS-only pass is cheaper but leaves input/camera/onboarding failures. A full visual redesign is broader than necessary and carries more regression risk.

Sequence:

1. Reproduce and fix camera visibility; coordinate responsive HUD and toolbar layouts.
2. Add Ready/Playing/Paused/Finished behavior and robust input reset, then reuse accessible dialogs.
3. Complete localization, unit conversion, tie results and live wardrobe updates.
4. Validate the full shopping → checkout → results → replay loop on desktop and physical phones.

Release acceptance should include the six viewport sizes above, plus representative large desktop, iPhone Safari and Android Chrome devices. Verify portrait/landscape switching during input, simultaneous two-thumb controls, interruptions, browser back/navigation, repeated replay, long translated text, zero/equal scores, failed WebGL initialization and context restoration. Measure frame time and memory on actual lower-end hardware over multiple full rounds; set a supported-device performance target before calling performance approved.

## Limits of this audit

Viewport emulation is not physical iOS/Android certification. No sustained multi-touch, mobile GPU/thermal, battery, network-throttling, screen-reader or multi-browser performance measurements were made. No account was created, authentication email sent, purchase made or voice permission granted. Multiplayer transport was not exercised through the live page; it initializes a solo world, although local peer-engine tests pass. Successful and rejected human checkouts were covered by local simulation tests rather than manually completed end-to-end in the live browser. These remain explicit follow-up tests, not implied passes.
