# Reel Problems 3 — Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-26-reel-problems-3-design.md`

## Guardrails

- Add a separate `/reel-problems-3` game and leave Reel Problems 2 behavior unchanged.
- Build new simulation, adventure, interaction, and scene modules; reuse only platform-level room, voice, wardrobe, audio, UI, math, and rendering infrastructure.
- Preserve unrelated changes in the existing dirty working tree.
- Keep the first playable release one continuous, completable voyage. Favor authored interactions and recoverable state over general-purpose physics.
- Keep transient render and input state outside React to avoid frame-rate rerenders.

## Task 1 — Register the new game shell

1. Add `reel-problems-3` to the canonical game identity and mark it excluded from the short party rotation.
2. Add Next.js and installed-client routes, collection card copy, README entry, audio name/catalog, analytics catalog, and sound workshop route.
3. Add a lightweight route that dynamically loads the client game without pulling Three.js into the collection page bundle.
4. Run registry and identity tests.

## Task 2 — Build the adventure model first

1. Define compact serializable types for stages, players, boat state, beacons, equipment, hazards, fish, events, and snapshots.
2. Implement a deterministic adventure state machine covering harbor preparation, three beacon visits, storm pursuit, sanctuary sequence, homecoming, and replay.
3. Implement movement inputs, wheel and sail contributions, contextual actions, repairs, rescues, joint carrying, scaling requirements, recovery, checkpoints, and late-player reconciliation.
4. Wrap the model in the shared peer engine adapter with durable action identifiers and host migration support.
5. Add focused unit tests for the happy path and every recovery rule before rendering work.

## Task 3 — Create the first-person runtime

1. Build a scene runtime that owns the renderer, animation loop, pointer lock, resize handling, adaptive quality, input collection, and disposal.
2. Implement a grounded first-person controller with mouse/touch look, moving-boat coordinates, swimming, simple mantling, comfort settings, and visible clay hands.
3. Build the boat as a stable moving local space with helm, sail, chart, repair points, rope, lantern sockets, and equipment stations.
4. Render remote crew through the shared clay avatar system, interpolating snapshots independently from the local camera.
5. Keep all high-frequency input, camera, and animation values in runtime objects and refs rather than React state.

## Task 4 — Author the connected world and signature fish

1. Build the harbor, three islands, open-water storm corridor, sanctuary passage, and sunrise return as authored clay scenery zones.
2. Add water, foam, rain, mist, clouds, gulls, shoreline life, foliage, cave light, and layered landmarks with quality-aware density.
3. Author the legendary fish as a spline-driven creature with emissive body segments, underwater light, surface breaches, and stage-specific behavior.
4. Add visual interactable states, world-space pings, route markers, beacon mechanisms, repair damage, ropes, and lost-item recovery points.
5. Ensure the full route remains visually navigable when reduced effects are enabled.

## Task 5 — Build the React game shell and interface

1. Create the live harbor menu, create/join lobby, crew list, invite code flow, captain start control, and reconnect states.
2. Add the restrained objective banner, contextual prompt, crosshair, wrist compass, physical-chart overlay, crew status, stage transitions, and results photograph.
3. Add keyboard, controller, and touch controls plus look sensitivity, reduced motion, camera sway, contrast, and audio preferences.
4. Integrate shared game toolbar, voice, wardrobe, analytics, public invite URLs, and session persistence.
5. Make the interface responsive, keyboard accessible, and safe around mobile browser controls.

## Task 6 — Audio and feedback

1. Define a compact audio catalog for harbor, ocean, storm, boat, equipment, beacon, rescue, fish, and music cues.
2. Provide synthesized or procedural runtime feedback where recordings are absent so every major action has audible confirmation.
3. Layer ambience and musical intensity by adventure stage, with the three beacon tones resolving in the sanctuary.
4. Keep directional subtitles and visual equivalents for audio-dependent cues.

## Task 7 — Verify and polish

1. Run all Reel Problems 3 unit tests, registry tests, TypeScript, lint, format checks for changed files, architecture checks, and the production build.
2. Browser-test menu, solo start, room creation/joining, keyboard/mouse controls, pointer lock, touch layout, every adventure stage, results, and replay.
3. Exercise peer host migration, late join, essential-item recovery, scaled objectives, and completion after disconnect.
4. Capture desktop and narrow mobile screenshots at harbor, storm, sanctuary, and results; refine lighting, density, hierarchy, and HUD collisions.
5. Record any environment-limited multiplayer or device validation explicitly.
