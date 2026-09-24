# Course Correction Polish — Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-24-course-correction-polish-design.md`  
**Goal:** Add production-quality detail and event-scaled feedback without changing deterministic simulation behavior, peer formats, course rules, or the established visual identity.

## Guardrails

- Treat `CourseWorld` as authoritative and read-only from presentation code.
- Do not change shot forces, collision response, timers, scoring, course dimensions, or checkpoint fields.
- Keep presentation aggregation local; never delay `advanceWorld` or peer snapshots.
- Bound every visual pool and drop low-priority effects when full.
- Preserve current pointer, touch, keyboard, Party Mode, audio, and reconnect behavior.
- Respect reduced motion and reduce effect counts on mobile.

## Task 1 — Add pure presentation classification

**Files**

- Create: `games/course-correction/presentation.ts`
- Create: `games/course-correction/presentation.test.ts`
- Read only: `games/course-correction/types.ts`

**Steps**

1. Write failing tests for `feedbackTier(event)`:
   - `impact` maps to `minor`.
   - `wall` and `bridge` map to `course`.
   - `platform` maps to `major`.
   - `cup`, `assist`, and `multi-cup` map to celebration tiers.
2. Write failing tests for a bounded cup-event aggregator:
   - It groups unique player cup events within 1,200 ms.
   - Two cups remain an ordinary sequence.
   - Three cups produce `chain`.
   - Four cups produce `everybody`.
   - Duplicate/replayed event IDs do not count twice.
   - Events outside the window start a new group.
3. Write failing tests for presentation settings:
   - Reduced motion returns zero shake, zero slow-motion factor, and no strong trails.
   - Mobile settings use lower particle and camera amplitudes.
   - Desktop settings remain inside fixed maximums.
4. Implement small pure functions and exported types only; do not import Three.js or React.
5. Run:
   - `node scripts/test.mjs games/course-correction/presentation.test.ts`
   - `npx oxlint games/course-correction/presentation.ts games/course-correction/presentation.test.ts`

## Task 2 — Build bounded effect and camera controllers

**Files**

- Create: `games/course-correction/effects.ts`
- Create: `games/course-correction/effects.test.ts`
- Modify: `games/course-correction/scene.ts`
- Use: `games/course-correction/presentation.ts`

**Steps**

1. Write failing tests around controller state rather than WebGL rendering:
   - Effect requests are capped by type and total count.
   - Major effects can replace the oldest minor effect when full.
   - Replayed event IDs are ignored.
   - Camera impulses decay and never exceed configured position/FOV limits.
   - Calling `settle()` immediately clears camera offsets for reduced motion.
2. Implement an effect manager with fixed pools for:
   - Contact puffs/sparks.
   - Expanding impact rings.
   - Short ball trails.
   - Cup bursts and confetti.
   - World-space attribution labels.
3. Implement one camera controller that composes low-amplitude bumps, zoom punches, and the bounded multi-cup focus move.
4. Keep all effect time local to `scene.ts`; do not alter world clock or render snapshot data.
5. Integrate event ingestion in `CourseCorrectionScene.render` using event IDs, tier classification, and current viewport/reduced-motion settings.
6. Catch presentation update errors at the effect boundary so rendering can continue with effects disabled.
7. Run focused tests and TypeScript.

## Task 3 — Add course material and construction detail

**Files**

- Create: `games/course-correction/scenery.ts`
- Modify: `games/course-correction/scene.ts`

**Steps**

1. Move static decorative construction into focused scenery helpers so `scene.ts` remains responsible for lifecycle and animation.
2. Add shared material helpers with the existing palette:
   - Turf base plus low-contrast mowing bands.
   - Chalk rails with bevel-like trim and seams.
   - Navy metal hardware.
   - Orange painted obstacle faces with restrained scuff panels.
3. Add instanced or shared-geometry rail fasteners and boundary details.
4. Add readable mechanism detail:
   - Hinge cap, base plate, and impact marks for pivot walls.
   - Axle, warning stripes, and underside shadow for bridges.
   - Guide track and rollers for moving platforms.
   - Deeper cup socket, rim highlight, flag cloth, and target ring.
5. Improve existing obstacle models without changing collision sizes:
   - Cone base and reflective band.
   - Pan rim, inner surface, and handle connector.
   - Washer door, control panel, feet, and edge trim.
6. Add hole-specific edge dressing:
   - Pivot Alley directional signs and gate scuffs.
   - Tipping Point balance markings and workshop clutter.
   - Moving Target rail arrows, cable guides, and final-green framing.
7. Keep the central shot corridor clear and reuse geometry/materials to bound draw calls.
8. Run TypeScript, lint, and a production build before proceeding.

## Task 4 — Animate movable course parts and cup entry

**Files**

- Modify: `games/course-correction/scene.ts`
- Modify: `games/course-correction/effects.ts`

**Steps**

1. Track previous wall, bridge, platform, and ball states locally in the scene.
2. Add presentation-only secondary motion:
   - Hinge recoil proportional to wall velocity.
   - Bridge spring settling and shifting underside shadow.
   - Roller motion and guide-track vibration on platform hits.
3. Replace immediate visual ball hiding with a short local cup-drop animation triggered by a new cup event.
4. Animate the flag and rim on cup entry.
5. Add short color-coded contact flashes and trails for ball impacts.
6. Ensure reconnect snapshots initialize directly to current state without replaying old transitions.
7. Verify that all authoritative ball/world data remains untouched.

## Task 5 — Polish HUD state and messaging

**Files**

- Modify: `games/course-correction/Game.tsx`
- Modify: `games/course-correction/style.css`
- Modify: `games/course-correction/presentation.ts`
- Modify: `games/course-correction/presentation.test.ts`

**Steps**

1. Add pure helpers for:
   - Player status labels: aiming, moving, holed.
   - Latest contextual event message.
   - Hole award selection: Best Bank, Biggest Assist, or Course Changer.
2. Test deterministic selection and EN/DE message coverage.
3. Update scoreboard rows to show strokes, assists, and state with a one-time numeric pulse when values change.
4. Add an optimal power band and clearer charge/release states without altering power values.
5. Replace generic status copy with short event-specific messages sourced from unseen events.
6. Add a two-second hole mechanic intro using current phase/hole state:
   - Pivot Alley: walls rotate on impact.
   - Tipping Point: the bridge tips.
   - Moving Target: hard hits move the cup.
7. Add contextual award copy to hole results.
8. Add multi-cup overlay variants:
   - Three balls: chain-reaction callout.
   - Four balls: `EVERYBODY IN!` / German equivalent.
9. Keep the existing layout positions and palette; refine depth, spacing, state clarity, and responsive behavior only.
10. Add `prefers-reduced-motion` CSS for all new HUD animations.

## Task 6 — Expand event-scaled audio

**Files**

- Modify: `games/course-correction/catalog.ts`
- Modify: `games/course-correction/audio.ts`
- Modify or create focused audio tests beside the existing game tests

**Steps**

1. Add catalog cues for rail/static impact, hinge, bridge, platform, cup drop, assist, three-cup chain, and four-cup celebration.
2. Reuse bundled recordings first and keep all cue IDs unique and within platform catalog rules.
3. Update playback intensity and rate limiting:
   - Minor collisions are quiet and aggressively rate-limited.
   - Course-changing impacts remain distinct.
   - Major/multi-cup cues temporarily win over minor collision chatter.
4. Test that reconnects and old snapshots do not replay cues.
5. Run catalog and game audio tests.

## Task 7 — Verify deterministic boundaries and regressions

**Files**

- Modify: `games/course-correction/course-correction.test.ts`
- Modify if needed: `platform/peer/invariants.test.ts`

**Steps**

1. Add a regression proving presentation aggregation does not change `world.clock`, `tick`, ball state, scoring, or serialized checkpoints.
2. Retain and run the existing wall, obstacle, assist, recovery, and peer-checkpoint tests.
3. Run focused verification:
   - `node scripts/test.mjs shared/physics/damped-motion.test.ts games/course-correction/*.test.ts platform/peer/invariants.test.ts`
   - `npm run typecheck`
   - `npx oxlint games/course-correction shared/physics/damped-motion.ts shared/physics/damped-motion.test.ts`
   - `npm run check:architecture`
4. Run `npm run build` and confirm `/course-correction` and `/course-correction/admin` remain present.
5. Treat unrelated existing repository failures separately; do not change other games merely to make this focused polish pass green.

## Task 8 — Desktop, mobile, and reduced-motion QA

**Files**

- No required source changes unless QA reveals a Course Correction defect.

**Steps**

1. Start the final production build locally.
2. Verify at desktop and portrait mobile sizes:
   - Lobby and hole intro.
   - Opening volley.
   - Static prop and rail impacts.
   - Wall, bridge, and platform reactions.
   - Ball-to-ball attribution and assist.
   - Single cup, three-cup chain, and four-cup celebration.
   - Hole and match results.
3. Verify reduced-motion mode:
   - No camera shake or presentation slow motion.
   - Status text and flashes still communicate every important event.
4. Inspect console errors and confirm stable HUD readability with four active balls.
5. Compare final screenshots with the current baseline to confirm the style stayed intact while depth and detail increased.

## Delivery

- Keep implementation commits scoped by task where the dirty working tree permits safe staging.
- Do not deploy until all Course Correction checks and visual QA pass.
- After approval to publish, use the existing Sites project and preserve its current audience.
