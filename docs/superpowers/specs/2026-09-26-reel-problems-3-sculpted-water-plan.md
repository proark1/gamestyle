# Reel Problems 3 — Sculpted Storybook Water Plan

**Design:** `docs/superpowers/specs/2026-09-26-reel-problems-3-sculpted-water-design.md`

## Guardrails

- Polish the isolated `/reel-problems-3/lookdev` water first.
- Keep Handmade Storybook as the default and clearly selected direction.
- Preserve the shared scene geometry, camera, beacon state, controls, and reference styles.
- Keep shader details and water-owned geometry out of the already large scene module.
- Preserve reduced-motion behavior and touch quality scaling.
- Do not change Reel Problems 2 or the Reel Problems 3 adventure simulation.

## Task 1 — Define and test water tuning

1. Add water-specific types for style parameters, quality density, fish-light response, and reduced-motion values.
2. Add pure helpers that resolve desktop/touch density, scale motion safely, and convert fish depth into bounded glow strength.
3. Extend the focused look-development tests to cover complete presets, reduced-motion scaling, density selection, and fish-glow bounds.

## Task 2 — Build the isolated sculpted-water runtime

1. Add `games/reel-problems-3/lookdev/water.ts` with the water mesh, shader, fallback material, foam geometry, wet bands, update loop, and disposal.
2. Replace the single-axis ripple shader with three directional swells and shader-derived stylized ridge lighting.
3. Add storybook shoreline ribbons, broken contact-foam pieces around dock posts and rocks, and dark waterline bands.
4. Feed the legendary fish position and depth into a bounded subsurface glow that affects nearby ridges.
5. Provide compatible fallback parameters for the two retained reference styles.

## Task 3 — Integrate without rebuilding scene state

1. Remove water shader and foam ownership from `scene.ts`.
2. Construct one water runtime, add its group to the world, and forward style, reduced motion, fish position, and frame updates.
3. Preserve wave time, camera position, and beacon state during live style changes.
4. Mark Handmade Storybook as the selected direction in the comparison interface while retaining B/C reference switching.

## Task 4 — Verify and present the result

1. Run focused tests, TypeScript, scoped lint/format checks, and the production build.
2. Extend browser validation to toggle reduced motion and capture Storybook shoreline and activated-beacon views on desktop and mobile.
3. Confirm movement, beacon interaction, style switching, reset, resizing, and mobile controls remain functional.
4. Inspect screenshots for wave shape, foam contact, wet bands, fish glow, HUD collisions, and narrow-screen behavior.
5. Restart the local production preview on the existing look-development route for user review.
