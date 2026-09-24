# Course Correction implementation plan

Approved direction: `2026-09-24-course-correction-design.md`.

The `writing-plans` skill is not installed in the listed local skill roots, so this document provides the implementation sequence directly.

## 1. Establish reusable physics and source assets

- Read the completed `codex/flip-happens` implementation without changing the current dirty working tree.
- Add `shared/physics/damped-motion.ts` with finite clamps, damped spring stepping, impulse accumulation, and stable-rest helpers.
- Add focused unit tests for the shared helpers.
- Adapt Flip Happens to consume those helpers only where doing so can be applied without overwriting unrelated work. Keep Course Correction independent of Flip Happens modules.

## 2. Implement the deterministic game model

- Add `games/course-correction/types.ts` for serializable players, balls, moving course parts, events, inputs, phases, and snapshots.
- Add `games/course-correction/courses.ts` with the three authored course layouts and collision primitives.
- Add `games/course-correction/physics.ts` for fixed-step ball motion, ball-ball response, walls, bridges, cup platform, cup capture, safe lies, and recovery.
- Add `games/course-correction/simulation.ts` for match phases, synchronized opening shots, hybrid follow-up play, scoring, assists, bots, timeouts, and rematches.
- Add simulation and regression tests before UI integration.

## 3. Connect authoritative multiplayer

- Add `games/course-correction/peer.ts` using the shared peer engine and a complete serializable checkpoint.
- Validate and clamp all shot intents; make actions idempotent through the engine contract.
- Add peer tests for join/leave bot replacement, checkpoint recovery, simultaneous launch, and host migration while balls and obstacles are moving.
- Register the adapter in platform peer composition and invariants.

## 4. Build the playable scene and interface

- Add a Three.js scene that renders the three courses, four balls, rotating walls, tipping bridge, moving cup platform, reused household obstacles, trajectory preview, impact feedback, and cup celebrations.
- Add the responsive React game shell, lobby, HUD, scorecards, aim/power controls, help, hole transitions, results, rematch, room/voice controls, toolbar, and Party Mode reporting.
- Support pointer pull-back, touch, keyboard, and controller through shared input conventions.
- Apply the approved roadside-maintenance palette, Fredoka/DM Sans type roles, reduced-motion behavior, and safe-area layouts.

## 5. Add collection services and metadata

- Add Course Correction audio, analytics, avatar metadata, English/German copy, route, collection card, installed-client route, Party Mode guide/playlist entry, and required catalogs.
- Reuse only existing checked-in audio/assets for the initial build; add generated or licensed media only through a separately authorized asset pass.
- Add a representative local card image after browser verification.

## 6. Verify and harden

- Run focused shared-physics, simulation, and peer tests while iterating.
- Run architecture checks, typecheck, lint, the complete test suite, production web build, and installed-client build.
- Run desktop and emulated-touch browser checks plus the four-client peer scenario.
- Fix regressions within Course Correction and its explicit shared helpers; do not rewrite or discard unrelated dirty-tree changes.
- Document final verification and any environmental limitations. Deployment remains out of scope.

