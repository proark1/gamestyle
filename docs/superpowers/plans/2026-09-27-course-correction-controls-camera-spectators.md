# Course Correction Controls, Camera, and Spectators Implementation Plan

**Goal:** Make every stationary-ball shot freely aimable, add persistent manual camera control and presets, halve the ball size, and correct inward-facing benches with seated spectators.

**Architecture:** Keep the multiplayer simulation authoritative and add only local presentation state. Pure helpers own gesture classification and bounded camera offsets; `Game.tsx` translates pointer/keyboard input into that state; `CourseCorrectionScene` combines it with authoritative snapshots for camera, aim guide, and local golfer presentation.

## 1. Add pure input and camera behavior

- Add `input-presentation.ts` with tested screen-space shot-zone classification and preview-aim lifecycle helpers.
- Extend `camera-presentation.ts` with camera presets, bounded orbit/zoom offsets, preset cycling, and pose composition.
- Add focused tests for gesture classification, clamps, cycling, and preservation of manual offsets across automatic modes.

## 2. Connect local aim preview to scene presentation

- Store the local preview angle/power separately from snapshots in `Game.tsx`.
- Initialize and reset it only when player, hole, accepted shot, or authoritative aim genuinely changes.
- Pass preview values into the scene before rendering.
- Update `CourseCharacters` and the aim guide so the local golfer walks around the stopped ball and faces the preview line; remote players and bots remain snapshot-driven.

## 3. Implement pointer, touch, keyboard, and camera UI

- Classify a primary pointer starting near the projected local ball as a shot gesture; classify other single-pointer drags as orbit gestures.
- Track multiple touch pointers so two-finger movement orbits and pinch-zooms without dispatching a shot.
- Add wheel zoom, `V` preset cycling, a compact accessible View button, and revised bilingual help text.
- Ensure pointer cancellation never fires a shot and camera input remains available while balls move.

## 4. Correct physical scale and spectator staging

- Change the shared ball radius from `0.24` to `0.12` and update assertions that intentionally encode clearance.
- Give each bench an explicit inward-facing transform and export matching seat anchors.
- Build seated spectators from those anchors with lowered hips and bent legs; retain a smaller set of standing reaction fans beside the benches.
- Add pure tests for inward-facing anchors, seated/standing allocation, and mobile/reduced-motion budgets.

## 5. Verify the integrated experience

- Run the Course Correction test subset, TypeScript, formatter check, and focused lint.
- Run a production client/build check appropriate to the repository.
- Open the local game in a browser and verify follow-up re-aiming, camera drag/zoom/presets, ball size, both bench sides, seated spectators, and responsive HUD behavior.
- Record any deployment as a separate, explicitly authorized step.
