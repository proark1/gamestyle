# Reel Problems 3 — Sculpted Storybook Water

## Goal

Polish the water in the approved Handmade Storybook direction for Reel Problems 3. The sea should read as a moving clay sculpture: rounded, weighty, imperfect, and visually integrated with the island, dock, boat, beacon, and legendary fish.

This pass applies to the isolated `/reel-problems-3/lookdev` build first. It does not yet replace the water in the full Reel Problems 3 adventure. The look-development route retains the two rejected visual treatments as temporary references while clearly marking Handmade Storybook as the selected direction.

## Visual direction

The water uses medium-adventure motion. It should feel alive and physical without making island exploration uncomfortable.

- Three broad, intersecting swell directions create rounded waves with varied spacing and speed.
- Soft ridge highlights make wave tops read like hand-shaped rolls of clay rather than flat sine ripples.
- Color moves from deep Harbor Ink teal to Sea Glass green, with Moon Foam highlights.
- The surface remains mostly opaque. It does not use realistic mirror reflections or tropical transparency.
- Surface shading includes enough directional response to describe the wave form without leaving the project's matte clay language.
- Small asymmetries and slowly changing wave relationships keep the movement from feeling mechanically tiled.

## Shoreline and object contact

Water contact must make the island feel grounded in the sea.

- Irregular cream-colored foam ribbons wrap the island shoreline.
- Smaller broken foam blobs gather around rocks, dock posts, and the moored boat.
- Foam motion drifts, compresses, and relaxes with the swell instead of rotating as a rigid ring.
- Shoreline rocks and dock posts receive a darker wet band at the waterline.
- Foam density and segment count scale down on touch devices without removing the shoreline silhouette.

The foam is intentionally stylized. It should resemble thin clay or painted paper laid over the water, not a particle simulation.

## Legendary fish response

The legendary fish remains readable beneath the more opaque surface through light rather than transparency.

- A soft turquoise subsurface bloom follows the fish beneath the water.
- Nearby wave ridges pick up a restrained turquoise edge as the fish passes.
- The glow expands slightly when the fish approaches the surface and softens with depth.
- The glow must not flatten the surrounding water to a single emissive patch.

## Motion and comfort

Normal motion uses medium-height swells and a steady rhythm. First-person camera height remains independent from wave displacement while the player is on land or the dock.

Reduced-motion mode:

- Reduces swell height substantially.
- Slows wave phase changes.
- Preserves static ridge shading, foam layering, wet bands, and fish-light response.
- Avoids removing visual depth or progression-relevant lighting.

## Architecture

Water moves out of the large look-development scene module into `games/reel-problems-3/lookdev/water.ts`.

`water.ts` owns:

- Water mesh and shader creation.
- Wave, color, ridge, and fish-glow uniforms.
- Shoreline foam ribbons and contact foam pieces.
- Wet waterline bands.
- Desktop and touch geometry density.
- Per-frame water and foam animation.
- Style fallback parameters.
- Reduced-motion scaling.
- Resource disposal.

The module exposes a small runtime interface:

- `group`: the object added to the world.
- `setStyle(style)`: applies the selected look's water parameters.
- `setReducedMotion(reduced)`: changes motion while preserving depth cues.
- `setFish(position, depth)`: updates subsurface glow placement and intensity.
- `update(seconds, delta)`: advances waves and foam.
- `dispose()`: releases all owned geometry, materials, and textures.

`scene.ts` positions the water, forwards style and motion changes, supplies the fish position, advances the water runtime, and disposes it. The scene does not know shader details.

## Rendering approach

The vertex shader combines three directional waves with different wavelengths, phases, and speeds. The fragment shader reconstructs a stylized surface response from the displaced shape, using broad light-facing bands and a narrow ridge term rather than physically based reflection.

Desktop receives a denser subdivided plane and more shoreline/contact foam segments. Touch devices use fewer subdivisions and pieces while preserving the same wave silhouette and palette. All animation remains on the GPU except the small number of foam transforms and fish-glow uniforms.

The two reference styles reuse the same water runtime with their own compatible amplitude, speed, palette, and ridge settings. Handmade Storybook receives the full sculpted-water treatment and remains the default selected style.

## Failure and fallback behavior

- If the custom shader cannot compile, the water runtime falls back to a matte standard material using the selected sea colors.
- Reduced quality lowers subdivision and foam density before removing any major visual cue.
- Resizing, full-screen changes, beacon activation, and style switching preserve water time and fish position.
- Water resources are disposed when the route unmounts.

## Verification

Automated validation covers:

- Complete water parameters for every retained look-development style.
- Reduced-motion amplitude and speed scaling.
- Touch and desktop density selection.
- Bounded fish-glow intensity from depth.
- Type checking, linting, formatting, and production compilation.

Browser validation covers:

- Desktop and mobile route loading without runtime errors or overflow.
- Storybook shoreline, open-water, and activated-beacon screenshots.
- Visible animation across separate frames.
- Preserved beacon state and camera position while switching styles.
- Stable reset, resize, and reduced-motion behavior.

Human review judges whether the water feels sculpted, whether contact foam grounds the island and props, whether the fish remains legible, and whether movement stays comfortable in first person.

## Completion criteria

The pass is complete when the Handmade Storybook scene presents rounded sculpted swells, layered shoreline and contact foam, dark wet waterlines, and responsive fish illumination on desktop and mobile, without changing the shared island composition or interaction state.

## Out of scope

- Realistic planar reflections, screen-space reflections, refraction, or ray tracing.
- Fluid simulation or buoyancy physics.
- Camera bob driven by water while the player is on land.
- Applying the selected water system to every Reel Problems 3 adventure zone.
- Removing the two reference styles before the polished water is reviewed.
