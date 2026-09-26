# Reel Problems 3 — Real-Time 3D Look Development

## Goal

Build an isolated, playable look-development route at `/reel-problems-3/lookdev` that renders one identical beacon-island scene in three distinct visual treatments. The prototype will let the team judge the real Three.js result—materials, lighting, water, atmosphere, geometry, motion, first-person presence, readability, and performance—before applying a visual direction across Reel Problems 3.

The prototype must not replace existing game assets, alter the adventure simulation, or change Reel Problems 2. Its purpose is to produce an honest, like-for-like visual comparison.

## Comparison principles

- All three styles use the same geometry, object placement, camera, controls, interaction, animation timing, and HUD.
- Style changes are instant and do not reset the player position or scene state.
- Each style may change materials, lighting, post-processing, atmosphere, edge treatment, prop presentation, and animation character.
- The comparison includes desktop and mobile quality profiles.
- Performance is visible so a visually attractive direction cannot conceal an unacceptable rendering cost.

## Shared scene

The prototype is a compact beacon island at golden hour. It contains enough varied subject matter to expose the strengths and weaknesses of every direction without building a second game level.

The scene includes:

- A small fishing boat and timber dock in the foreground.
- A walkable shoreline with sand, sculpted rocks, dense grass, tide pools, and a crooked path.
- A weathered beacon tower as the primary landmark.
- A fishing shed, short rope bridge, nets, buoys, crates, lanterns, mooring posts, and wind-shaped trees.
- Layered distant islands, animated water and foam, clouds, birds, vegetation movement, and a legendary glowing fish below the surface.
- Visible first-person clay hands and restrained camera motion.
- One functioning beacon mechanism that the player can activate.
- The real Reel Problems 3 objective, compass, interaction prompt, and crew-status visual language.

The beacon activation is the signature comparison moment. Its lens, light beam, nearby surfaces, water, vegetation, fish glow, and atmosphere must respond in a way characteristic of the selected style.

## Visual treatments

### A — Handmade storybook

This is the recommended direction because it most directly develops the established Reel Problems identity.

- Rounded, irregular sculpted geometry with readable handmade silhouettes.
- Subtle fingerprints, tool marks, edge wear, paint variation, and material breakup.
- Layered shoreline vegetation and environmental storytelling props.
- Warm golden-hour illumination, soft contact shadows, and painted atmospheric depth.
- Translucent stylized water with foam, shallow-water color variation, and reflected fish light.
- Warm lantern and window life balanced against cool sea-glass shadows.
- Gentle, slightly imperfect ambient movement.

The result should feel like a premium handcrafted miniature world at first-person scale, not generic low-poly scenery.

### B — Cinematic stormlight

- The same clay geometry presented beneath incoming coastal weather.
- Deeper shadows, wet surface highlights, heavier water motion, rain curtains, and moving fog banks.
- Strong beacon shafts and a pronounced turquoise-fish-versus-amber-lantern lighting contrast.
- Larger tonal transitions and more dramatic silhouettes.
- Atmospheric motion that communicates danger while preserving navigation and interactable readability.

The result should remain stylized and clay-like rather than approaching photorealism.

### C — Graphic toy adventure

- Cleaner saturated materials and simplified surface variation.
- Chunkier silhouettes, dark illustrated edge accents, and crisp separation between objects.
- Simpler shadows, brighter environmental colors, and strong interaction readability.
- Snappier vegetation, water, and beacon animation.
- A cheerful, deliberately game-like presentation with less atmospheric subtlety.

The result should feel authored and playful rather than like a default cel-shading filter.

## Interaction and controls

Desktop uses the existing Reel Problems 3 first-person conventions: WASD movement, mouse look, and `E` for the contextual beacon interaction. Touch uses the existing movement controls, look region, and action button.

The look-development overlay provides:

- A persistent A/B/C style switcher with keyboard shortcuts `1`, `2`, and `3`.
- A reset-position control.
- Full-screen control.
- A compact FPS and frame-time readout.
- A collapsible evaluation checklist covering water, materials, lighting, distance, interaction, first-person hands, and performance.

The overlay must not duplicate the production HUD or obscure the scene's primary interaction.

## Architecture

The prototype lives under `games/reel-problems-3/lookdev` and is exposed only through `app/reel-problems-3/lookdev/page.tsx`.

It is divided into focused units:

- `scene.ts` builds the shared beacon-island geometry, owns the renderer and animation loop, and exposes scene-state controls.
- `styles.ts` defines the three visual presets, including palette, material parameters, lights, fog, water, edge treatment, and motion tuning.
- `controller.ts` owns first-person movement, mouse/touch look, collision bounds, and beacon targeting.
- `Lookdev.tsx` owns the comparison UI, selected style, full-screen behavior, evaluation checklist, and performance readout.
- `style.css` contains only look-development interface styling and responsive behavior.

Scene objects use stable semantic tags such as `water`, `rock`, `wood`, `foliage`, `cloth`, `beacon`, and `fish`. Applying a visual preset updates those tagged materials and scene systems in place. Style switching must not reconstruct the world, move the player, or reset beacon activation.

The renderer uses the project's shared renderer utility and respects its desktop and touch quality profiles. Geometry, textures, and materials are disposed when the route unmounts.

## Materials and rendering

The shared geometry is deliberately more resolved than the current production placeholder scene. Rounded bevels, tapered forms, layered assemblies, and silhouette variation supply most of the perceived quality. Procedural canvas textures and lightweight shader or material variation may add clay grain, brush variation, wetness, foam, and edge accents without adding external asset dependencies.

The implementation may use:

- Shared and instanced geometry for repeated grass, stones, rope segments, and props.
- A bounded shadow budget with the beacon, nearby props, hands, and major landscape forms prioritized.
- One style-specific water material at a time.
- Lightweight full-scene post-processing only when it remains compatible with the supported renderer and mobile fallback.
- A mobile profile that reduces particles, reflection detail, foliage density, and shadow range without removing key landmarks or the beacon response.

## State and failure behavior

The route stores only the selected style and checklist visibility in local component state. It does not create multiplayer rooms or mutate adventure progress.

- If pointer lock is unavailable, drag-look remains usable.
- If a higher-cost material or effect is unsupported, the style falls back to its standard material treatment while preserving its palette and lighting hierarchy.
- Resizing or entering full screen preserves camera position, selected style, and beacon state.
- Reduced-motion preference disables camera sway, vigorous foliage movement, and nonessential particles.

## Verification

Automated validation covers:

- Type checking and production compilation.
- Loading the look-development route on desktop and mobile viewports.
- First-person movement and bounded collision.
- Beacon targeting and activation.
- A/B/C switching without camera-position or beacon-state resets.
- Resize and full-screen-safe layout behavior.
- Reduced-motion behavior.
- Renderer disposal on unmount.

Browser validation captures all three treatments from the same camera transform before and after beacon activation. It also records representative FPS and frame time for desktop and mobile quality profiles.

Human review judges:

- Whether the scene feels handcrafted rather than primitive.
- Whether water, distance, lighting, and surrounding detail create a convincing place.
- Whether first-person scale and hands feel natural.
- Whether the beacon activation is visually memorable.
- Whether interaction targets remain legible.
- Whether the chosen visual gain justifies its performance cost.

## Completion criteria

The look-development prototype is complete when a reviewer can open `/reel-problems-3/lookdev`, walk through the beacon-island scene, activate the beacon, switch instantly among A, B, and C without changing the comparison state, inspect performance, and make an informed visual-direction choice from the real rendered result.

## Out of scope

- Applying the winning style to the full Reel Problems 3 adventure.
- Replacing or deleting existing Reel Problems 3 scene assets.
- Multiplayer synchronization, voice, matchmaking, or persistent adventure state.
- Building additional islands, harbor, storm, sanctuary, or ending scenes.
- Importing a third-party asset pack or adding an external texture pipeline.
