# Reel Problems 3 — Real-Time Look Development Plan

**Design:** `docs/superpowers/specs/2026-09-26-reel-problems-3-lookdev-design.md`

## Guardrails

- Build only the isolated `/reel-problems-3/lookdev` comparison route.
- Do not alter the Reel Problems 3 adventure simulation or Reel Problems 2.
- Keep geometry, camera, interaction state, animation timing, and HUD identical across A/B/C.
- Keep high-frequency render, camera, input, and performance data outside React state.
- Dynamically load the Three.js client so the main application bundle does not absorb the renderer.
- Preserve unrelated changes in the existing dirty working tree.

## Task 1 — Define the comparison contract

1. Add `games/reel-problems-3/lookdev/types.ts` with style identifiers, semantic scene-material roles, quality information, controller state, scene state, and the runtime interface.
2. Add `styles.ts` with complete A/B/C tokens for palette, materials, lights, fog, water, outlines, wind, particles, and animation character.
3. Add pure helpers for style selection, keyboard shortcuts, bounded movement, and performance sampling.
4. Add `lookdev.test.ts` covering preset completeness, shortcut selection, movement bounds, and stable performance aggregation.

## Task 2 — Build the shared beacon-island geometry

1. Add `scene.ts` around the shared renderer utility with a single owned animation loop, resize observer, quality profile, and deterministic disposal.
2. Author rounded, layered geometry for the boat, dock, shoreline, beacon tower, fishing shed, bridge, trees, rocks, tide pools, props, distant islands, first-person hands, and the underwater fish.
3. Tag material-bearing objects by semantic role so presets can update the scene in place without rebuilding geometry.
4. Use instanced or shared geometry for repeated grass, stones, foam, rope, and small props.
5. Add the animated water surface, shoreline foam, clouds, birds, vegetation movement, fish movement and light, and beacon lens/beam.

## Task 3 — Implement first-person comparison controls

1. Add `controller.ts` with WASD movement, pointer-lock mouse look, drag look fallback, touch movement/look, camera limits, and collision bounds.
2. Add forgiving beacon targeting and `E`/touch activation.
3. Preserve position, look direction, and beacon state when switching styles or resizing.
4. Respect reduced motion by removing sway and suppressing nonessential environmental motion.

## Task 4 — Apply the three live visual treatments

1. Implement the Handmade Storybook preset with warm golden-hour lighting, tactile clay breakup, layered vegetation, translucent water, soft depth, and turquoise reflected fish light.
2. Implement the Cinematic Stormlight preset with incoming weather, wet highlights, fog banks, rain, stronger water motion, beacon shafts, and turquoise/amber contrast.
3. Implement the Graphic Toy preset with saturated materials, dark edge accents, simpler shadows, bold silhouettes, and snappier movement.
4. Add supported-effect fallbacks so every preset retains its visual hierarchy on touch and lower-quality renderers.

## Task 5 — Build the isolated React route

1. Add `Lookdev.tsx` as a small client shell that initializes the runtime once and stores only low-frequency UI state.
2. Add A/B/C tabs with `1`/`2`/`3` shortcuts, reset, full-screen, a collapsible evaluation checklist, and a compact sampled FPS/frame-time display.
3. Reuse the Reel Problems 3 objective, compass, prompt, and crew-status visual language without importing multiplayer state.
4. Add `style.css` for a restrained responsive overlay with keyboard focus, safe-area handling, and mobile controls.
5. Add `app/reel-problems-3/lookdev/page.tsx` with a static dynamic import of the heavy client module and no server-rendered Three.js dependency.

## Task 6 — Verify the real comparison

1. Run the focused look-development tests, TypeScript, scoped lint/format checks, and the production build.
2. Add a browser smoke script that loads desktop and mobile viewports, moves the player, activates the beacon, switches A/B/C, resizes, and checks for runtime errors or overflow.
3. Capture A/B/C screenshots from the same camera transform before and after activation.
4. Confirm style switching does not reset camera position or beacon state.
5. Inspect performance readouts and visual output; optimize repeated geometry, particles, shadows, or resolution if a preset misses the stated desktop/mobile expectations.
6. Document limitations that require a physical-device or human visual review.
