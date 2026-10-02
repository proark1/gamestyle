# Carry-On Carnage — QA report

Date: 20 September 2026  
Live game: https://www.jumbleyard.com/carry-on-carnage

## Current delivery status

Fixes are committed and pushed to main as `7d75b42` (rebased from `19e2512`). The final merged release passes all **1,508 tests**, type checking, lint, architecture checks and the production build. Desktop/mobile Chromium viewport checks and the repair details appear at the end of this report. The user explicitly approved bringing the fixes live. The final release `4360965` is live: Railway deployment `fb96d2ad-63e3-49fb-86a0-ce3f83d4b5e9` reports SUCCESS.

## Original live-site audit verdict

**Not ready for mobile sign-off. Desktop also needs usability fixes.** The live game renders and its underlying automated tests pass, but mobile movement is missing, important UI clips or overlaps at several sizes, and Help is nonfunctional. A claim that everything works perfectly would not be supported by this audit.

At the time of the original audit, no game source had been changed. The repair section below supersedes this implementation status. The workspace already contains extensive uncommitted changes, including this game's scene and physics files; local test results do not certify the exact deployed build.

## Method and coverage

Live Chrome browser interaction, screenshots, DOM measurements, browser console inspection, and targeted local source review. Sizes checked: default desktop 1533×936, laptop 1366×768, tablet portrait 768×1024, phone portrait 390×844 and 320×568, phone landscape 844×390. These are browser viewport overrides, **not real iOS/Android device tests or touch-hardware emulation**.

Tested: loading/rendering, bot progression, pickup/drop UI, Help, mute/unmute state, music toggle state, language switching, wardrobe opening/closing, sign-in dialog and guest dismissal, and voice menu availability. Sound output was not listened to; toggle state alone is not audio playback certification. No sign-in, purchase, microphone grant, or account change was performed.

## Findings

### QA-01 — P1: No touch movement controls

At phone sizes the screen offers Grab Item, Sit & Compress, Pull Zipper, and Drop / Release, but no joystick, directional buttons, or movement guidance. The inspected scene registers only keyboard down/up for movement; it has no touch or pointer movement implementation. A touch-only player cannot navigate to baggage or the sizer to complete the core loop.

Source: `games/carry-on-carnage/scene.ts:103–166`; action-only dock in `Game.tsx`.

Fix: implement a thumb joystick or clear tap-to-move interaction, with cancellation on pointer release, blur and orientation change. Provide a usable touch action layout. Acceptance: on actual iOS and Android, complete a bag from collection through packing, compression, zipping and sizing without a keyboard.

### QA-02 — P1: Portrait camera crops essential play space

At 390×844, a large portion of the terminal and the right-hand sizer are outside the view. Initial screenshots also cut characters off at the left edge. The scene keeps its 45-degree perspective field of view and changes aspect ratio on resize; no portrait fit strategy is present. This substantially impairs navigation and understanding of the task.

Evidence: [phone portrait](carry-on-carnage-qa-2026-09-20/mobile-de.png), [tablet portrait](carry-on-carnage-qa-2026-09-20/tablet.png). The phone screenshot uses German after the language test; framing is the same issue in English.

Fix: adapt camera distance/framing to aspect ratio and reserve space for HUD and controls. Keep the local player visible and communicate the route to off-screen objectives.

### QA-03 — P1: Landscape boarding panel overlaps bag counter

At 844×390, the central boarding pass overlays the right side of the Bags Approved counter, obscuring the quota. This width receives desktop HUD positioning despite being a short phone landscape viewport.

Evidence: [landscape overlap](carry-on-carnage-qa-2026-09-20/landscape-844.png).

Fix: use a collision-free HUD grid and a short-height layout, rather than independent absolute positions and width-only breakpoints. Acceptance: full timer, bag quota and score remain readable together at 844×390 and nearby landscape sizes.

### QA-04 — P1: Countdown clipped on narrow phones

At 320×568, the boarding panel shows only the leading portion of the timer. Its flight/status text does not wrap, while the containing panel clips overflow.

Evidence: [320px clipping](carry-on-carnage-qa-2026-09-20/mobile-320.png). Source: `games/carry-on-carnage/style.css`, `.carryon-fids`, flight text and timer rules.

Fix: reserve nonshrinking width for the timer, shorten or wrap flight/status copy, and test both supported languages. Acceptance: all countdown digits remain visible through every timer state.

### QA-05 — P1: How to play does nothing; movement is undiscoverable

Clicking the question-mark Help button on desktop opens nothing. Local source explicitly supplies `onHelp={() => {}}` at `games/carry-on-carnage/Game.tsx:248`. The visible dock explains E/R/F/Q, but not WASD/arrows or the full packing-to-sizer sequence. The round begins immediately while a newcomer is still trying to learn.

Fix: implement concise instructions with desktop and touch controls, explain the player and bot roles, and provide an introductory ready/start state or a solo pause while reading help. Acceptance: a new player can identify their character and complete the first bag using only instructions exposed by the game.

### QA-06 — P2: Tablet toolbar is clipped

At 768×1024, the full wordmark plus toolbar exceeds the available row width; the Help control at the far right is clipped/off-screen. Phone toolbar compression occurs at a different breakpoint from the game HUD.

Evidence: [tablet toolbar](carry-on-carnage-qa-2026-09-20/tablet.png).

Fix: coordinate breakpoints across wordmark and toolbar, or collapse secondary controls into a menu. Acceptance: every toolbar function is fully visible and reachable at tablet widths.

### QA-07 — P2: Primary mobile actions are too small and tightly packed

Measured action buttons at 390×844 are only **29.5px high**; four text actions occupy one narrow strip. The 40px toolbar icons are larger than the main gameplay actions. Longer German labels make the strip more crowded.

Fix: aim for at least 44×44 CSS px for primary touch targets, preferably a two-row thumb-accessible arrangement. Verify dynamic labels such as Pack into Bag, Pick up suitcase and Insert in Sizer in both languages.

### QA-08 — P2: Solo timer keeps running while wardrobe is open

The timer visibly continued behind the wardrobe (1:47 when opened, 1:41 after closing). The game offers a substantial customization interface during a timed solo round without a pause affordance.

Fix: pause solo gameplay while blocking dialogs are open, or make the ongoing timer and consequences explicit. Multiplayer should have a deliberate, separate policy.

### QA-09 — P2: German localization is incomplete (source-supported)

Switching language updates the HUD and gameplay action labels. However, event strings in the simulation are literal English, including packing and sizer feedback, and several toolbar accessible labels remain English. The missing event localization is established from source rather than a captured German event toast.

Fix: represent events with translation keys and parameters; translate toolbar labels consistently. Acceptance: trigger packing, zipper jam, approval, rejection and round end while German is selected.

## Additional source-review risks needing reproduction

- Global key handlers do not filter editable inputs/dialogs or reset held keys on blur. Typing in sign-in or changing focus while moving may affect gameplay; reproduce before treating this as a confirmed live defect.
- End-of-round UI uses generic divs instead of dialog semantics; focus management and keyboard trapping need checking.
- End card has no explicit short-height scrolling rule in the game stylesheet. Check the complete result and restart action on landscape phones.
- The direct route initializes solo practice; the inspected component does not establish a peer connection. Multiplayer and voice across participants were not tested.

## Passing checks

- Game loads with a rendered 3D terminal and visible HUD in Chrome.
- Desktop layout is visually coherent at the inspected large size; no overlap was observed in that sampled state.
- Bots progress the quota to 3/4, consistent with the tested design that leaves the last bag for the player.
- Clicking Grab Item changed the label to Pack into Bag; dropping later returned it to Grab Item.
- Mute changes its label to Enable game sound and disables the volume/music controls; re-enabling restores them. Music state toggles separately.
- Wardrobe opens and closes. Sign-in opens and Keep playing as a guest returns to the game.
- Voice menu explains that a multiplayer room is required, without requesting a microphone in this solo check.
- English/German switching updates HUD and action labels, and English was restored afterward.
- No application-origin errors were seen in the sampled console log. Observed warnings were from an installed browser extension and are excluded from game defects.

## Automated tests

Command: `node scripts/test.mjs games/carry-on-carnage`

**25 passed, 0 failed.** Includes packing, compression, bursting, sizer acceptance/rejection, collisions, nearest-object targeting, duplicate-score prevention, bot behavior, restart state reset, audio event planning and catalog coverage. These are logic/source tests; they do not validate real touch input, layout, audible playback, GPU performance or a full browser playthrough.

## Release acceptance checklist

1. Resolve QA-01 through QA-06 before desktop/mobile sign-off.
2. Complete a player-controlled round and restart on physical iOS Safari and Android Chrome, portrait and landscape.
3. Check 320, 360, 390, 430, 768, 844, 1024 and 1366px layouts, both languages, all dynamic action labels, near-bag gauges, toast, final call and result states.
4. Verify keyboard movement and all actions, focus loss, dialogs, resize/orientation and accessible focus order.
5. Verify actual music/SFX and autoplay recovery; measure frame pacing on a representative lower-end phone.
6. If multiplayer is intended, test room creation, joining, disconnect/reconnect, synchronized scoring and voice with multiple clients.

The audit does not certify Safari, Firefox, real mobile hardware, sustained FPS, network recovery, multiplayer, or a successful player-controlled full round.

## Final round-end verification

The countdown reached zero and displayed Flight Departed with 3/4 bags, 1 contraband, -$0 fees and 2500 points. Clicking Catch Next Flight reset the round to 3:00, 0/4 bags, 0 points and Grab Item. **Failure-to-restart flow passes functionally.** Success-path browser playthrough remains unverified.

### QA-10 — P1: Result card and restart button clip in landscape

At 844×390, the result card extends beyond the viewport at both ends. The restart button's measured bounds were y=361.19 to 406.52, beyond the viewport bottom of 390px. The visible part was clickable, and restart worked, but the control is partially cut off. This confirms the short-height concern noted above.

Evidence: [landscape result](carry-on-carnage-qa-2026-09-20/result-landscape.png).

Fix: constrain the result dialog to available height with internal scrolling and safe-area padding. Keep its title and full restart control reachable at short heights.

### QA-11 — P2: Result penalty description disagrees with score

The failure screen says any unapproved luggage received a $150 penalty, but a round ending at 3/4 approved bags displays Gate Fees Charged -$0. The local departure code changes phase and emits an event without applying a departure penalty (`simulation.ts:790` onward). Either the stated rule or the scoring implementation is wrong.

Evidence: [result text and zero fees](carry-on-carnage-qa-2026-09-20/result-landscape.png).

Fix: agree on the rule, then apply any departure fee exactly once or correct the description. Add a meaningful test for a round ending with one or more unapproved bags.

Also observed: behind the result overlay, the HUD returns from FINAL CALL to NOW BOARDING at 0:00. It should show a departed/closed state (low-priority consistency issue).

Release sign-off must additionally resolve QA-10 and reconcile QA-11. Temporary browser sizing and language/music changes were restored after testing. The report and screenshot files are the only artifacts created by this audit.

## Repair and verification update — 20 September 2026

The fixes are committed as `19e2512` in the isolated `codex/carry-on-release` checkout, based on latest main `8a3a84e`. Publishing was subsequently authorized by the user; see the current delivery status above. Earlier findings remain above as the live-site audit baseline.

| Findings | Correction |
| --- | --- |
| QA-01 | Pointer-capture movement pad, keyboard support, blur/orientation resets and dialog input gating. Local movement-pad drag verified. |
| QA-02 | Camera fits terminal width; canvas excludes HUD and input regions; gold ring identifies the player. |
| QA-03 / QA-04 / QA-06 | Responsive grid HUD, wrapping flight text, fixed-width clock, wrapping toolbar and measured HUD height. |
| QA-05 | Working Help and initial instructions explaining controls, bot roles, fees and the bag workflow. Dialog opens at the top and scrolls on small screens. |
| QA-07 | Actions at least 44px tall; narrow mobile controls measured at 50px. |
| QA-08 | Solo simulation pauses for dialogs/hidden pages. Wardrobe held the clock at 2:45; closing resumed to 2:44. |
| QA-09 | English/German game events, item names, instructions and accessible toolbar labels. Custom labels from other games preserved. |
| QA-10 | Native result dialog, bounded viewport height, internal scrolling and focus containment. |
| QA-11 | $150 per unapproved bag at departure, applied once. Finished rounds ignore item interactions. Regression tests cover fees and restart. |

The HUD now says departed at zero. Resize-observer updates are deferred to the next animation frame to avoid a browser observer-loop warning. Frame-rate damping and resource disposal are preserved.

### Checks completed

- Final full suite after integrating latest main: **1,508 passed, 0 failed**.
- Final merged Carry-On/input suite: **37 passed, 0 failed**.
- Type checking, lint and architecture checks passed; production Railway build passed, including after merging latest main.
- Browser: ready/start, touch-pad movement, compression feedback, working Help, wardrobe pause/resume and German text verified.
- Visual responsive checks: 320×568 and 390×844 portrait, 768×1024 tablet, 844×390 landscape and 1533×880 desktop. Countdown, toolbar and actions fit the checked states; no horizontal overflow at tablet/landscape. Final browser error log was empty before integration; transient development reload errors during rebase were cleared by reload.
- [Final narrow German layout](carry-on-carnage-qa-2026-09-20/final-320-de.png) and [final German landscape](carry-on-carnage-qa-2026-09-20/final-landscape-de.png).

### Limits

These are Chromium browser viewport checks, not physical iOS/Android certification. A full player-controlled successful round, Safari/Firefox, lower-end device frame pacing, audible sound playback, and multi-client networking/voice were not verified. No claim of universal perfection is made. Production smoke testing passed; see the release section below.
### Final departure and restart check

At 844×390 in German, the round finished at 3/4 approved bags with the correct **$150 departure fee and 2,350 points**. The HUD displayed `ABGEFLOGEN · GATE ZU` at zero. The result dialog stayed inside the viewport; internal scrolling exposed the entire restart button. Clicking it reset to **3:00, 0/4 bags and 0 points**, with no fee badge. Temporary viewport override was reset successfully.

Evidence: [result dialog](carry-on-carnage-qa-2026-09-20/final-result-landscape.png), [fully reachable restart](carry-on-carnage-qa-2026-09-20/final-result-restart.png).
## Production release — 20 September 2026

The user explicitly authorized publishing. Commit `7d75b42` was pushed to main and deployed successfully as Railway deployment `1c735877-0ba6-43cd-9eda-e16c27e8ce04`. Latest upstream runtime changes were retained; typecheck, all 38 targeted tests, and the production build passed after rebase.

Production browser checks confirmed the new instructions, ready/start flow and movement pad. The 320×568 check found a remaining long-event grid width issue; commit `4360965` adds shrinkable, wrapping, border-box event messages. Its follow-up deployment is `fb96d2ad-63e3-49fb-86a0-ce3f83d4b5e9`.
Final deployment `fb96d2ad-63e3-49fb-86a0-ce3f83d4b5e9` reported **SUCCESS**. Live Chromium smoke testing confirmed instructions, ready/start, advancing gameplay, touch controls and an empty browser error log. At 320×568, the long message “Zipper closed! Hop off and carry the bag to the sizer.” wrapped within bounds x=12..308, matching the flight HUD bounds, with no overlap. [Live mobile screenshot](carry-on-carnage-qa-2026-09-20/live-mobile.png). Temporary viewport sizing was restored.