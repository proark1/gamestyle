# Reel Problems 3 Comic Lookdev Design

## Purpose

Add three visibly different comic treatments to the existing real-time Beacon Island lookdev scene so the art direction can be judged in the same first-person composition. The current looks remain available and unchanged. The new comparison is selected with keys `4`, `5`, and `6`.

This work is a look-development comparison. It does not yet replace the rendering treatment in the full Reel Problems 3 game.

## Goals

- Make the entire scene read as a comic, not merely add an interface filter.
- Keep geometry, camera position, interaction, and scene composition consistent across all six looks.
- Give the three comic options distinct palettes, line work, shadows, atmosphere, water, and interface accents.
- Preserve first-person movement, beacon interaction, reduced-motion behavior, and touch controls.
- Keep the live comparison performant enough to switch styles without rebuilding the scene.

## Comic Treatments

### 4 — Bright Adventure Comic

- Clean, bold dark outlines around scenery, characters, props, hands, and the lighthouse.
- Saturated coastal colors with warm sand, turquoise water, bright foliage, and a coral accent.
- Three-to-four broad cel-lighting bands with crisp but friendly shadow transitions.
- Sparse cream halftone dots in shadow and sky areas.
- Energetic water streaks, bright broken foam, and graphic turquoise depth bands.
- A light comic-panel interface treatment with strong borders and small burst accents.

This is the recommended direction for readable, upbeat first-person adventure gameplay.

### 5 — Dark Graphic Novel

- Heavy charcoal ink and deeper silhouette shadows.
- A restrained navy, blue-green, stone, and amber palette.
- Two-to-three high-contrast light bands, emphasizing the beacon as the warm focal point.
- Fine crosshatching in darker screen regions without obscuring navigation.
- Darker water with narrow pale ridges, ink-like troughs, and restrained foam.
- A darker caption-box interface with off-white type and amber emphasis.

### 6 — Hand-Drawn Comic

- Warm brown-black outlines with slight doubled-line variation.
- Muted watercolor-like fills on a warm paper-colored atmosphere.
- Softer stepped lighting with intentionally uneven color transitions.
- Low-opacity paper grain and sketch marks rather than regular halftone dots.
- Hand-painted water bands, irregular foam, and gentler motion.
- A cream paper-panel interface with imperfect border accents.

## Interaction and Layout

- Existing looks remain on keys `1`, `2`, and `3`.
- Comic looks use keys `4`, `5`, and `6`, including number-pad equivalents.
- The desktop art-direction selector becomes a compact two-column grid so six named options do not obscure the world.
- The touch selector remains a compact three-column grid with two rows.
- The active option continues to show its full name and description.
- Switching is immediate and preserves player position, camera direction, beacon state, and review checklist state.

## Rendering Architecture

### Style data

The look style schema expands to include the three comic IDs and their keys. Each comic preset owns its palette, lighting, atmospheric settings, outline strength, water tuning, and comic-treatment parameters.

### Comic treatment layer

A focused comic-treatment module owns the rendering parameters shared by the scene and interface:

- cel-lighting band count and contrast;
- outline strength, color, and hand-drawn variation;
- overlay type and opacity for halftone, crosshatch, or paper grain;
- interface treatment metadata.

The scene applies these values to the existing material and outline system. Comic shading is attached to the current materials rather than rebuilding geometry or maintaining a parallel scene. If the optional shader customization is unavailable, the scene falls back to flat-shaded materials, palette changes, and geometry outlines.

### Water

The existing sculpted-water runtime remains the single water implementation. Its style table gains comic-specific motion, ridge, color-banding, ink, and foam values. This preserves fish glow, shoreline contact foam, reduced motion, and touch density while making the water match each comic treatment.

### Interface

The lookdev component exposes the active treatment through `data-look`. CSS uses that value for panel borders, fills, texture overlays, and comic-specific accents. Texture overlays are procedural CSS patterns, avoiding image downloads and keeping the preview self-contained.

## Performance and Accessibility

- Style changes reuse scene objects, materials, and water geometry.
- Procedural screen textures use lightweight CSS layers with no pointer interaction.
- Touch devices keep the lower-density water mesh.
- Reduced motion continues to lower water amplitude and speed and disables nonessential environmental motion.
- Text contrast and control hit targets remain readable in all comic palettes.

## Validation

- Unit tests verify the complete ordered preset list and shortcuts `1` through `6`.
- Every comic preset must provide a complete and distinct rendering configuration.
- Water tests verify reduced-motion scaling and comic-specific tuning.
- Browser checks switch through all three comic treatments and capture one desktop image for each.
- Browser checks verify the six-option mobile selector, first-person controls, beacon interaction, and absence of console or WebGL errors.
- Typecheck, focused lint, focused tests, and the production build must pass.

## Acceptance Criteria

- Pressing `4`, `5`, or `6` immediately changes the full scene and interface to the corresponding comic treatment.
- The three comic styles are unmistakably different in a still frame.
- The lighthouse, characters, props, first-person hands, atmosphere, and water all participate in each treatment.
- Existing looks `1`, `2`, and `3` still work.
- Desktop and mobile comparison layouts remain usable without covering the main focal area.
