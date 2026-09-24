# Course Correction Character Integration Plan

## Objective

Add the shared Jumbleyard character layer to Course Correction so every player visibly aims, putts, watches, walks to the next lie, and celebrates while the existing simulation remains authoritative.

## Task 1: Pure character presentation model

Create `games/course-correction/character-presentation.ts` and its test file.

- Define the visual states `ready`, `swing`, `watch`, `walk`, and `celebrate`.
- Calculate a behind-ball staging target from ball position and player aim.
- Clamp targets inside the course and bias crowded targets toward the nearest edge.
- Calculate four safe celebration slots around the cup.
- Add an event tracker that deduplicates shot, cup, assist, and multi-cup reactions.
- Test state derivation, target clamping, behind-ball placement, cup slots, and event replay.

## Task 2: Three.js character manager

Create `games/course-correction/characters.ts`.

- Construct one `dressedGameAvatar` per player using seat colors and course-crew clothing.
- Apply `getEquippedLook()` to the local player and subscribe to wardrobe updates.
- Add a correctly scaled putter to the avatar hand, a floor shadow, and a restrained seat-color marker.
- Smooth visual position and facing independently from the authoritative world.
- Drive worker poses plus golf-specific arm and torso overrides.
- Dispose replaced and disconnected character resources safely.

## Task 3: Scene integration

Update `games/course-correction/scene.ts`.

- Own one character manager and forward snapshots, new events, time, and reduced-motion settings.
- Keep characters outside physics and checkpoint data.
- Slightly widen the camera framing to include start and cup staging areas.
- Reset character reactions on hole rebuild and preserve local-player identity changes.
- Keep all four figures visible on mobile with simplified marker detail.

## Task 4: Gameplay presentation refinement

Update the scene event handling where necessary.

- Synchronize the putter contact pose to each `shot` event.
- Keep the golfer at the previous lie while the ball rolls, then walk to the next lie.
- Place holed players beside the cup and trigger celebration poses.
- React to assists and Everybody In without changing simulation time or ball behavior.

## Task 5: Verification

- Run character-presentation tests and existing Course Correction/physics tests.
- Run formatter, focused lint, typecheck, and production build.
- Browser-test lobby, opening volley, follow-up shot, wall impact, and cup reaction.
- Inspect desktop and 390×844 mobile layouts and verify reduced-motion fallbacks.
- Restart the local port 4174 preview with the final build.

## Constraints

- No physics, scoring, course geometry, checkpoint, or peer protocol changes.
- No new avatar system or wardrobe content.
- Character collisions are intentionally disabled.
- Preserve the current Course Correction art direction and HUD.
