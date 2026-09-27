# Reel Problems 3 Full Visual Rebuild Implementation Plan

**Date:** 2026-09-27

**Design:** [2026-09-27-reel-problems-3-full-visual-rebuild-design.md](2026-09-27-reel-problems-3-full-visual-rebuild-design.md)

## Outcome

Replace Reel Problems 3's prototype 3D scene with a production-quality Jumbleyard world. The rebuilt game uses the shared Nico character for every player and bot, derives first-person presentation from the same proportions, keeps the camera at a consistent 1.56-metre eye height above the active surface, gives every visible solid object matching collision, and rebuilds the boat, harbor, ocean, equipment, fish, lighting, and weather as one coherent soft-clay scene.

The existing round rules, missions, bots, scoring, party rotation, networking, and serialized world remain authoritative and unchanged except where rendering needs a stable presentation field that can be derived without changing outcomes.

## Execution Rules

- Work from a clean branch synchronized with the latest `origin/main`; preserve unrelated work.
- Implement in test-first vertical slices. Each slice begins with an invariant or model-coverage test and ends with a browser checkpoint.
- Keep Three.js and Cannon instances outside `AdventureWorld`; snapshots and checkpoints remain structured-clone safe.
- Use the shared `dressedGameAvatar` Nico rig. Do not introduce a Reel Problems 3-specific substitute body.
- Keep one authored scale: `GAME_BODY_HEIGHT` is the reference and first-person standing eye height is exactly `1.56` world units above the current surface.
- Rendering may interpolate state but must not change simulation, scoring, mission, bot, or multiplayer decisions.
- Mobile quality reduction may affect decoration, particles, shadows, and distant detail only. It must not alter collision, interaction reach, character scale, or gameplay state.
- Do not publish a partially converted scene. Deployment remains a separate action after the complete validation gate and an explicit user request.

## Task 1 — Establish shared scale, surface, and scene-layout contracts

### Files

- Add `games/reel-problems-3/world-layout.ts`.
- Add `games/reel-problems-3/world-layout.test.ts`.
- Refactor `games/reel-problems-3/physics-layout.ts` to consume the layout.
- Extend `games/reel-problems-3/physics.test.ts`.
- Add `games/reel-problems-3/rendering/contracts.ts`.

### Work

Define the single source of truth for boat deck bounds, hull waterline, cabin, live well, engine housing, rails and openings, dock, gangway, shoreline, tower, bell, buildings, rocks, trees, and required interaction stations. Each authored element exposes a stable identifier, transform, visual dimensions, collision profile, interaction anchor when applicable, and mobile detail class.

Add `surfaceHeightAt(world, space, x, z)` and explicit boat/world transform helpers. The function identifies deck, gangway, dock, and shore surfaces without consulting rendered meshes. Define `NICO_EYE_HEIGHT = 1.56`, interaction reach, player radius, rail thickness, and navigation clearance from the shared character scale.

Replace duplicated hard-coded positions in `physics-layout.ts` with layout-derived colliders. Keep colliders serializable and independent from Three.js and Cannon. Add state-dependent colliders for large equipment and deployed mission objects.

Tests must prove that visual dimensions and collider dimensions share the same authored entries, all required stations have reachable anchors, boat and shore footprints do not overlap, the gangway connects the two valid walking surfaces, safe spawns do not intersect solids, and eye height is consistent across every surface.

### Exit gate

Layout tests pass, existing simulation tests still pass, and no visual or physics module owns a second copy of the main environment dimensions.

## Task 2 — Replace placeholder crew with the shared Nico rig

### Files

- Add `games/reel-problems-3/rendering/characters.ts`.
- Add `games/reel-problems-3/rendering/character-poses.ts`.
- Add `games/reel-problems-3/rendering/characters.test.ts`.
- Refactor the crew path in `games/reel-problems-3/scene.ts`.
- Reuse `shared/rendering/game-avatar.ts` and `shared/rendering/worker-pose.ts` without changing other games' appearance.

### Work

Create every crew member with `dressedGameAvatar`, using seat colour and a consistent nautical outfit. Preserve the shared rig's body, arm, leg, sleeve, and hand anchors. Add a small Reel Problems 3 pose adapter that maps snapshot state to idle, walk, sprint, carry-small, carry-long, carry-bulky, cast, reel, brace, helm, repair, bail, rescue, stumble, and celebrate poses.

Use distance travelled for walk-cycle phase so remote crew do not moonwalk. Blend upper-body activity with leg motion and reset unused joints on every pose update. Turn head and torso toward the active station or fishing target within restrained limits. Attach held models to the established hand anchors; define explicit two-hand anchors for rods, nets, timber, and the ice box.

Tests inspect each created avatar for the shared Nico height, expected rig anchors, correct seat outfit, stable hand attachments, and finite transforms for every pose. A regression test ensures the old capsule-and-sphere crew factory is no longer referenced.

### Exit gate

Four populated crew seats visibly use Nico, all required activity states have deterministic poses, held equipment follows hands, and shared character tests for other games remain unchanged.

## Task 3 — Rebuild first-person scale, limbs, and camera motion

### Files

- Add `games/reel-problems-3/rendering/first-person.ts`.
- Add `games/reel-problems-3/rendering/camera.ts`.
- Add `games/reel-problems-3/rendering/camera.test.ts`.
- Refactor camera and view-model code out of `games/reel-problems-3/scene.ts`.
- Extend `games/reel-problems-3/scripts/browser-check.mjs` with first-person checkpoints.

### Work

Build a first-person rig from a dedicated shared Nico instance, retaining the existing left and right sleeve/hand subtrees and hiding unrelated body meshes. Do not build extra hand spheres. Add pose definitions for empty hands, small item, bulky item, rod cast, rod fight, landing net, hammer, bailer, helm, bell rope, and rescue line. Held items attach to the same proportional grip anchors as the world avatar.

Create a camera controller that queries `surfaceHeightAt`, adds exactly 1.56 units, transforms boat-local points through boat pitch, roll, and yaw, and dampens only presentation movement. Use a human-scale field of view and near plane that keep the hands visible without exaggerating nearby props. Walking bob stays below three centimetres, boat sway is damped, and reduced-motion mode disables bob and action recoil.

Unit tests cover deck, dock, shore, gangway, pitched boat, and rotated boat camera transforms. Browser checks measure the camera relative to known rail and Nico heights, confirm only two hands are rendered, and capture empty-hand and held-item views at desktop and touch viewports.

### Exit gate

The player no longer feels child-sized, the same eye-height rule applies everywhere, two connected arms read naturally, and no pose clips the camera or creates a duplicate pair of hands.

## Task 4 — Make collision match all rebuilt solid geometry

### Files

- Extend `games/reel-problems-3/world-layout.ts`.
- Refactor `games/reel-problems-3/physics-layout.ts`.
- Refactor `games/reel-problems-3/physics.ts` where compound or rounded colliders are required.
- Expand `games/reel-problems-3/physics.test.ts`.
- Add `games/reel-problems-3/navigation.test.ts`.

### Work

Generate static box, cylinder, and compound colliders for boat rails, wheelhouse, engine housing, live well, storage, racks, dock edges, pilings, gangway rails, sheds, bell frame, tower, rocks, trees, and the shore boundary. Add state-dependent profiles for every large loose or secured equipment item. Keep small hand tools non-blocking unless their deployed state requires collision.

Tune the upright player body and fixed-step integration for smooth sliding. Add bounded substeps for long frames, depenetration to the nearest safe point after layout changes, and deterministic recovery for invalid restored positions. Preserve authored rail openings and required approaches rather than filling them with broad blockers.

Navigation tests sample paths from every safe spawn to each required station, the bell, the gangway, and the shore. Physics tests sprint into thin barriers, move diagonally along corners, circle curved obstacles, and verify that collision remains stable while the boat rotates.

### Exit gate

Players cannot pass through visible solid gameplay geometry, do not snag on ordinary corners, and can reach every objective needed to complete a full round.

## Task 5 — Build the polished equipment and fish model library

### Files

- Add `games/reel-problems-3/rendering/materials.ts`.
- Add `games/reel-problems-3/rendering/primitives.ts`.
- Add `games/reel-problems-3/rendering/items.ts`.
- Add `games/reel-problems-3/rendering/fish.ts`.
- Add `games/reel-problems-3/rendering/models.test.ts`.
- Refactor item and fish creation out of `games/reel-problems-3/scene.ts`.

### Work

Create cached soft-clay materials and reusable rounded primitives. Rebuild rope, rods, bait bucket, lantern, timber, hammer, bailer, fuel can, ice box, landing net, chart, compass, and physical catches with recognizable construction, layered detail, and strong silhouettes. Give each item named ground, rack, single-hand, two-hand, and first-person anchors as required by its definition.

Create species-specific fish with different proportions, fins, tails, markings, eyes, and scale limits. Add pooled lightweight animation for swim, hooked struggle, landed flop, carried, and stored states. Model creation must not allocate new materials per item instance.

Coverage tests require one model factory and all required anchors for every item definition and fish species. Validate bounding boxes against authored physical profiles and fail when a model is effectively a generic unlabeled box.

### Exit gate

Every gameplay object is visually recognizable in world, rack, and hand states; model bounds agree with interaction and collision profiles; and repeated instances reuse geometry and materials.

## Task 6 — Rebuild the fishing boat as a cohesive playable vessel

### Files

- Add `games/reel-problems-3/rendering/boat.ts`.
- Add `games/reel-problems-3/rendering/boat-effects.ts`.
- Add `games/reel-problems-3/rendering/boat.test.ts`.
- Remove the legacy boat factory from `games/reel-problems-3/scene.ts`.

### Work

Construct the boat from `world-layout.ts`: shaped hull and waterline, raised bow, deck planks and drainage, cabin, helm, throttle, engine housing, live well, storage hatches, rails and openings, lights, cleats, ropes, fenders, rigging, safety equipment, and physical racks. Preserve uncluttered circulation around required stations.

Replace floor rings with integrated station feedback: moving controls, indicator lamps, painted symbols, gauges, and restrained material highlighting on the actual target. Use named anchors for fishing line origins, wake emitters, prop wash, lamp positions, rack slots, and interaction targets.

Add pooled wake ribbons, prop wash, bow foam, limited spray, engine vibration, and damped fixture motion driven entirely from boat snapshot state. Mobile quality reduces particle count and shadow receivers without removing feedback.

Tests validate station anchors, open navigation corridors, line origins, physical-rack mapping, shared layout dimensions, and absence of unnamed interaction targets.

### Exit gate

The boat reads as one finished fishing vessel, remains easy to navigate, exposes every gameplay station physically, and stays aligned with its collision and interaction layout.

## Task 7 — Rebuild the harbor, shore, lighthouse, and bell

### Files

- Add `games/reel-problems-3/rendering/harbor.ts`.
- Add `games/reel-problems-3/rendering/scenery.ts`.
- Add `games/reel-problems-3/rendering/harbor.test.ts`.
- Remove the legacy harbor factory from `games/reel-problems-3/scene.ts`.

### Work

Build the supported dock, pilings, gangway, fishing sheds, lighthouse or harbor tower, freestanding bell, ropes, buoys, signs, crates, rocks, vegetation, shaped shore, and distant composition from shared layout entries. Use instancing for repeated planks, posts, trees, rocks, and small decoration when it reduces draw cost without complicating interaction.

Give the bell a lathed bronze shell, dark mouth, crown, yoke, clapper, pull rope, and sufficient swing clearance. Its interaction anchor belongs to the rope or bell assembly rather than the full tower. Keep the tower collider and bell collider separate.

Add shallow-water colour and shore foam at the walking boundary. Keep distant scenery outside the playable collider set and use it only to frame the harbor. Verify the boat floats beyond land and the supported gangway reaches both valid surfaces.

### Exit gate

The harbor reads as a handcrafted location, all visible nearby solids block correctly, the bell is unmistakable and unobstructed, and the boarding route is visually clear and physically continuous.

## Task 8 — Upgrade procedural ocean, weather, lighting, and streamed scenery

### Files

- Add `games/reel-problems-3/rendering/ocean.ts`.
- Add `games/reel-problems-3/rendering/weather.ts`.
- Add `games/reel-problems-3/rendering/lighting.ts`.
- Add `games/reel-problems-3/rendering/ocean.test.ts`.
- Refactor `games/reel-problems-3/world-stream.ts` only if stable visual descriptors are missing.
- Remove the legacy ocean and cell factories from `games/reel-problems-3/scene.ts`.

### Work

Preserve the deterministic 3-by-3 active ocean neighborhood. Create near and far tile detail levels with broad swells, small wind waves, directionally moving highlights, depth colour, foam masks, fog integration, and stable tile-edge continuity. Pool tile meshes and update shader uniforms instead of recreating geometry.

Render streamed rocks, islets, markers, and distant silhouettes from seeded descriptors. Reuse geometry and instance repeated scenery. Weather maps existing fog and chaos state to wave amplitude, sky and fog colour, light warmth, visibility, spray, and local practical lights without changing authoritative rules.

Use one primary shadow-casting sun, environmental fill, and bounded practical lights. Cap pixel ratio and expose desktop, mobile, and reduced quality tiers selected from existing device capability helpers. Add instrumentation for frame time, draw calls, triangles, pooled-effect counts, and active tiles in development builds.

Tests prove deterministic descriptors, fixed active-tile bounds, tile-edge wave continuity, material reuse, effect-pool limits, and quality-tier invariants.

### Exit gate

Open water has depth and motion, weather visibly changes the scene, streaming remains bounded, and the mobile tier preserves at least the required character, interaction, and collision presentation.

## Task 9 — Reassemble the scene orchestrator and interaction feedback

### Files

- Reduce `games/reel-problems-3/scene.ts` to orchestration, synchronization, picking, and lifecycle.
- Add `games/reel-problems-3/rendering/interactions.ts`.
- Add `games/reel-problems-3/rendering/pools.ts`.
- Add `games/reel-problems-3/rendering/scene.test.ts`.
- Update `games/reel-problems-3/Game.tsx` only where renderer lifecycle or reduced-motion input requires it.
- Update `games/reel-problems-3/style.css` only for canvas, crosshair, accessibility, and HUD integration affected by the rebuild.

### Work

Make `scene.ts` own renderer lifecycle, snapshot dispatch, module synchronization, raycasting, resizing, and cleanup. Boat, harbor, ocean, characters, items, fish, camera, and effects remain isolated modules with explicit `update`, `setQuality`, and `dispose` boundaries.

Replace broad scene raycasts and floating floor rings with a dedicated interaction registry containing target object, anchor, maximum reach, occlusion policy, and feedback state. Use warm rim lighting, moving physical controls, lamp changes, and small diegetic signs. Do not highlight through walls or select an object hidden behind a nearer solid.

Dispose only module-owned resources; shared cached materials and geometry remain reference-managed. Do not allocate line geometry, materials, or repeated temporary vectors each frame. Reuse fishing-line buffers and pooled effects.

Tests cover target occlusion, reach, station registration, module cleanup, stable resource counts over repeated snapshots, reduced-motion propagation, and renderer fallback behavior.

### Exit gate

The monolithic legacy factories are gone, module ownership is clear, interaction feedback belongs to physical objects, and repeated play/restart cycles do not leak render resources.

## Task 10 — Complete browser, performance, gameplay, and release validation

### Files

- Expand `games/reel-problems-3/scripts/browser-check.mjs`.
- Add `games/reel-problems-3/scripts/visual-checkpoints.mjs` if keeping screenshot concerns separate makes the browser check clearer.
- Update `games/reel-problems-3/README.md` with final architecture, controls, quality behavior, and validation commands.
- Update focused tests from Tasks 1–9.

### Work

Run a production-mode local build and drive a complete one-human/three-bot round. Exercise preparation, equipment loading, bell departure, gangway traversal, sailing, fishing, held objects, a repair or rescue incident, mission completion, return, docking, and results. Preserve current mission and scoring assertions.

At desktop and 390-by-844 touch viewports, capture the harbor overview, populated Nico crew, boat deck, empty first-person hands, representative held items, open-water fishing, fog or storm, chaos response, and return to harbor. Record console errors, same-origin request failures, overflow, missing WebGL, and accessibility regressions.

Add active collision probes for the tower, trees, rocks, sheds, bell frame, dock posts, boat cabin, engine, live well, rails, racks, and large equipment. Verify navigation to every required station after the full visual scene is assembled.

Measure rendered frames for at least ten seconds after a five-second warm-up in the mobile validation scene. The median must remain at or above 30 frames per second on the existing test machine. Record draw calls, triangles, active tiles, particle counts, and live Three.js resource counts before and after a round restart.

Run the release gate:

```text
node scripts/test.mjs games/reel-problems-3 shared/rendering/game-avatar.test.ts shared/rendering/worker-pose.test.ts platform/games/registry.test.ts platform/party/party.test.ts platform/peer/invariants.test.ts shared/games/identity.test.ts
npx oxlint games/reel-problems-3 app/reel-problems-3
npm run typecheck
npm run build:railway
git diff --check
```

Review the captured checkpoints at full size. Any remaining placeholder character, disconnected hand, generic-box item, visible collider mismatch, navigable clipping, unreachable objective, camera-scale inconsistency, console error, or failed local request blocks completion.

### Exit gate

All automated checks pass, the complete round works with bots and existing multiplayer state, all visual checkpoints meet the approved direction, collision and scale checks pass, mobile sustains the defined performance floor, and the branch is clean and release-ready.

## Recommended Commit Sequence

1. `refactor(reel-problems-3): unify world scale and scene layout`
2. `feat(reel-problems-3): use shared Nico crew characters`
3. `feat(reel-problems-3): rebuild first-person camera and hands`
4. `fix(reel-problems-3): match collision to solid scenery`
5. `feat(reel-problems-3): rebuild equipment and fish models`
6. `feat(reel-problems-3): rebuild the fishing boat`
7. `feat(reel-problems-3): rebuild harbor and lighthouse`
8. `feat(reel-problems-3): polish ocean weather and lighting`
9. `refactor(reel-problems-3): modularize scene presentation`
10. `test(reel-problems-3): validate visual rebuild`

Each commit must pass its focused tests. The combined branch must pass Task 10 before the work is described as complete or offered for deployment.
