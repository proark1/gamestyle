# Citrus Jelly — Knife & Cookie Cutters Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-28-citrus-jelly-cutter-design.md`

## 1. Establish the Jumbleyard integration contract

- Add `games/citrus-jelly-cutter/` with a client wrapper, analytics definition, and focused integration tests.
- Add `app/citrus-jelly-cutter/page.tsx` with metadata and a full-viewport route.
- Register `citrus-jelly-cutter` in the game identity, collection order, collection card configuration, English/German card copy, analytics catalog, README table, and party exclusions.
- Introduce an explicit silent-game trait so a deliberately silent prototype does not require a fake sound workshop or unused audio catalog; update registry/admin handling and tests for that trait.
- Make the wrapper forward a small, validated `postMessage` event vocabulary from the self-contained frame into the shared anonymous analytics tracker.

## 2. Build the self-contained editorial shell

- Create `public/citrus-jelly-cutter.html` with all HTML, CSS, SVG icons, JavaScript, WGSL, and procedural assets inline.
- Implement the desktop editorial grid, lens-shift stage, right specimen panel, bottom readouts/notes, responsive stacking below 860 px, focus styles, and reduced-motion behavior.
- Implement tool, shape, variety, material, simulation, mesh, reset, nudge, pause, and keyboard controls.
- Implement the WebGPU status pill, disabled-state behavior, fallback card, toast layer, and diagnostics disclosure.

## 3. Implement WebGPU lifecycle and rendering foundations

- Acquire adapter/device/context, choose the canvas format, configure resize handling, and build shader modules with compilation diagnostics.
- Add two-attempt device-loss recovery while preserving serializable game state.
- Build shared vertex/index uploads, uniform buffers, depth, HDR, MSAA, thickness, height/shadow, and tone-map targets.
- Render the paper-matched floor, procedural softbox environment, translucent jelly, steel/wood tools, and optional topology lines using WGSL only.

## 4. Implement slice geometry and soft-body simulation

- Create the half-moon rest-space SDF and initial connected piece.
- Generate contour loops, bevelled caps/walls, material-zone attributes, a three-layer simulation lattice, and skinning weights.
- Implement a fixed 60 Hz accumulator with quarter speed and pause.
- Add XPBD-style distance, area, thickness, volume, shape-retention, strain-limit, damping, floor, speed-cap, finite-state recovery, and bounded piece-collision passes.
- Compute mass, volume, energy, and piece readouts without normal-frame allocations.

## 5. Implement persistent topology operations

- Implement boolean knife bands and cutter-ring gaps against per-piece rest-space masks.
- Add morphological cleanup, flood-fill components, crumb rejection, marching-squares loop extraction, hole preservation, triangulation, bevel-wall rebuilds, and the 14-piece cap.
- Transfer current pose and velocity from source pieces into rebuilt components and swap geometry atomically.
- Add deterministic planning APIs so misses and limit conditions are known before animation begins.

## 6. Implement hand, knife, cutters, and camera

- Add ray picking with forgiving fallback and soft-patch Hand attachments, bounded camera-plane dragging, floor safety, twist input, and velocity-preserving release.
- Procedurally model and render the nakiri; add the SVG stroke guide and align/press/break/wedge/lift choreography.
- Build Star, Heart, Flower, and Round ring meshes; add flatness checks and align/press/break/pop/lift choreography followed by automatic Hand selection.
- Add empty-space orbit, click-versus-drag discrimination, zoom limits, double-click reset, camera easing after throws, touch gestures, and reduced-motion timing.

## 7. Add the collection artwork and platform polish

- Create a local Citrus Jelly collection illustration using repository-native SVG/procedural artwork, with no dependency from the standalone game file.
- Add the card color treatment and responsive alt text.
- Verify the full-screen frame has no inherited toolbar/chrome and that `← Jumbleyard` is the only in-game navigation.

## 8. Expose deterministic testing and verify

- Expose `window.citrusJellyTest` with simulation, camera, pick, cut, stamp, advance, statistics, and controlled failure hooks.
- Add tests for identity/registry changes, wrapper message validation, topology planning, pause/slow/reset, finite simulation state, and piece limits where logic is accessible outside the browser.
- Run focused tests, architecture checks, typecheck, lint, formatting, and the complete production build.
- Run Playwright against supported WebGPU when available; always test the unavailable fallback, responsive desktop/mobile layouts, route loading, no console errors, keyboard controls, and public test-hook shape.
- Visually inspect desktop/mobile screenshots, then rebase, push to `main`, deploy to Railway production, and smoke-test `/citrus-jelly-cutter` publicly.
