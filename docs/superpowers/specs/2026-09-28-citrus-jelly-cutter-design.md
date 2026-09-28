# Citrus Jelly — Knife & Cookie Cutters

**Date:** 2026-09-28  
**Status:** Approved design  
**Deliverable:** A polished WebGPU prototype integrated into Jumbleyard as its own game

## Product Goal

Create a tactile material-study game built around one translucent gummy citrus slice. The player can stretch and throw the jelly, divide it with a visible nakiri knife, stamp star, heart, flower, and round shapes, and lift the stamped pieces from their holes. Knife cuts and stamps must permanently change the geometry and remain freely combinable.

The game should feel like an interactive museum specimen rather than a conventional arcade HUD. It is a single-player sandbox without score, timer, multiplayer, progression, or audio in this prototype.

## Prototype Boundary

The prototype preserves the defining interactions and presentation while using a simpler physical foundation than the full research-grade prompt.

Included:

- WebGPU and WGSL rendering only;
- true persistent knife cuts and cookie-cutter holes;
- separate, liftable and further editable pieces;
- a layered XPBD-style soft body with fixed-step simulation;
- translucent candy rendering with procedural citrus detail;
- visible procedural knife and four cookie cutters;
- desktop, touch, reduced-motion, failure, and device-loss handling;
- a single self-contained game HTML file;
- full Jumbleyard route and collection integration.

Approximated:

- a three-layer constrained particle mesh replaces tetrahedral co-rotational FEM;
- sampled grid morphology and contour cleanup replace exact Euclidean distance transforms;
- robust ear-clipped or Delaunay-like cap triangulation replaces a general exact constrained Delaunay implementation;
- limited thickness blur and PCSS-lite replace full optical transport and high-sample shadows;
- rigid piece-frame mapping replaces a full best-fit embedding into old tetrahedra.

Excluded from this prototype:

- multiplayer and party rotation;
- achievements, scoring, persistence, and audio;
- libraries, external assets, WebGL, and canvas rendering fallbacks.

## File and Platform Architecture

The playable application lives in `public/citrus-jelly-cutter.html`. It contains all CSS, markup, JavaScript, WGSL, icons, procedural geometry, and texture generation. It uses exactly one `<script type="module">` and has no imports, libraries, network assets, or runtime fetches. It requires no bundling, but must be served from HTTPS or localhost because WebGPU is unavailable in ordinary insecure contexts.

Within that file, the code is organized into clear internal units:

- `GPUDeviceManager` owns adapter acquisition, device creation, shader compilation, pipelines, resize handling, and device recovery.
- `Renderer` owns render targets and passes for thickness, height/shadow, HDR scene, and tone mapping.
- `SoftBodyWorld` owns particles, constraints, contacts, piece collisions, time accumulation, pause, slow motion, and safety guards.
- `PieceGeometry` owns signed-distance masks, connected components, contour extraction, mesh rebuilding, and state transfer.
- `ToolController` owns the hand, knife, cutters, pointer/touch gestures, picking, and tool choreography.
- `EditorialUI` owns all controls, hints, live readouts, toasts, responsive state, and diagnostics.

The game exposes `window.citrusJellyTest` for deterministic browser testing.

Jumbleyard integration adds:

- `/citrus-jelly-cutter` as a metadata-bearing full-screen route;
- a borderless full-viewport wrapper around the self-contained file;
- a collection card and local card illustration;
- the game identity, translations, analytics/audio registry treatment, and an explicit party exclusion because it is a single-player material sandbox.

The in-game page contains only a small `← Jumbleyard` link rather than the shared game toolbar.

## Visual Direction

The composition is a warm editorial material study, not a standard game HUD.

### Palette

- Studio paper: `#F2ECE2`
- Carbon ink: `#24211D`
- Citrus flesh: `#F28A24`
- Pith cream: `#FFE7AE`
- Brushed steel: `#A8AEAA`
- Botanical shadow: `#59624B`

Orange, Blood Orange, and Lemon varieties change flesh, zest, pith, membranes, absorption, and shadow tint without resetting geometry or motion.

### Typography

- Display: `Iowan Old Style`, `Baskerville`, `Georgia`, serif
- Body: `Avenir Next`, `Gill Sans`, system UI, sans-serif
- Data: `ui-monospace`, monospace

No webfonts are used.

### Desktop Layout

The top-left editorial block contains `MATERIAL STUDIES / NO. 010`, the large italic two-line title `Citrus / Jelly.`, and its three-line caption. The WebGPU status pill sits top-right. A restrained right control panel contains `THE SPECIMEN · fig. 10`, tool selection, cutter shapes, varieties, material sliders, actions, and toggles. Live instructions and readouts sit bottom-left; collapsible experiment notes sit bottom-right.

The WebGPU camera uses an asymmetric projection/lens shift so the slice occupies the visual opening between title and control panel. The stage is not merely centered behind overlays. The floor sweep tone-maps to the page paper color.

Below 860 px the page stacks title, stage, controls, readouts, and notes. Tool targets are at least 48 CSS pixels. The scene keeps a useful interaction height and does not require horizontal scrolling.

The signature element is the materially rich, translucent orange specimen. Surrounding UI remains flat, quiet, and print-like.

## Slice Construction and Appearance

The rest shape is a thick half-moon, approximately radius 1.58 and thickness 0.56, with a flat cut edge, rounded planar corners, and bevelled front/back rims.

Rest-space classification is shared by every descendant piece. Shader and geometry queries derive:

- mottled glossy zest with procedural oil-gland pores;
- a pale pith band and pithy core;
- five radial flesh segments;
- thin pale membranes represented by embedded translucent sheets;
- radial teardrop-shaped juice vesicles;
- sparse small air bubbles.

These features remain aligned on new cut faces because their material zones use shared rest-plane coordinates rather than local mesh indexing.

## Simulation

The simulation advances at a fixed 60 Hz using an accumulator. Pause stops simulation; quarter-speed advances one simulation tick for every four real-time ticks. Rendering remains responsive while paused.

Each piece uses a triangulated planar lattice extruded through three thickness layers. The solver applies several XPBD-style substeps with:

- structural and shear distance constraints;
- front/back area preservation;
- thickness and approximate volume constraints;
- local shape-retention constraints;
- hard strain limiting at 1.8 times rest length;
- relative edge-velocity damping;
- higher compliance resistance for rind and pith;
- static/kinetic floor friction and settling damping;
- bounded speed, finite-number validation, and recovery to a last valid pose.

All pieces share one world. Broad-phase AABBs prune piece pairs; a small number of particle push-out passes prevents obvious intersections. A maximum of 14 pieces bounds work. Components below a visible minimum area are treated as crumbs and dropped.

Per-frame loops reuse typed arrays and scratch vectors. Memory is allocated during topology rebuilds, not normal simulation frames.

## Persistent Topology

Every piece owns a binary/SDF mask over the original shared rest plane. Knife and cutter operations modify these masks through boolean subtraction and intersection. A thin removed band represents blade or cutter-wall clearance.

After an operation:

1. light closing/opening rounds single-cell defects and sharp artifacts;
2. flood fill extracts connected components;
3. undersized crumbs are discarded;
4. marching squares extracts outer and hole loops;
5. loops are resampled, smoothed, and projected back toward the zero contour;
6. cap triangles are generated and filtered against outer loops and holes;
7. walls and bevel rings are swept along all loops;
8. a new layered simulation lattice is produced inside each valid component.

New particles map through the source piece's current rigid/deformation frame and inherit interpolated velocity from nearby source particles. The rebuild occurs at the committed knife release or cutter click and swaps atomically at the choreography breakthrough moment.

## Tools and Gestures

### Hand

Ray picking targets the skinned render surface with a forgiving projected fallback. A grab creates a soft attachment over a local patch and moves it on a camera-facing plane with bounded reach. The target is clamped above the floor. Mouse wheel or a second touch twists the held patch. Release preserves measured velocity so pieces can be tossed.

### Knife

A procedural nakiri contains a tall brushed-steel blade, bevel, bolster, walnut handle, and three rivets. It participates in the main and shadow passes; buried steel remains visible through the translucent jelly.

Dragging over jelly draws a dashed SVG guide and defines a vertical cutting plane in the source piece's rest frame. The knife hovers under the pointer with its handle on the left. Release starts an approximately 1.1-second sequence: align, press a rounded groove, break through and swap geometry, travel to the board while a wedge separates and holds the lips, then lift and release the lips.

Short misses, insufficient local thickness, and the piece cap produce calm italic toasts.

### Cookie Cutters

Star, Heart, Flower, and Round use rounded polygon paths. Their visible models are thin tin-plate walls with rolled top rims and subtle satin vertical grain.

The ring hovers upright under the cursor. A click stamps; movement beyond the click threshold orbits the camera instead. Only pieces whose up vector and vertical spread classify them as lying flat can be stamped.

The stamp sequence aligns, presses a full perimeter groove, swaps the split at breakthrough, wedges inside and outside apart, raises the stamped shape slightly, and lifts the ring to a higher waiting position. The tool then switches to Hand so the shape can be lifted from its hole.

## Camera and Input

Dragging empty space or a non-click cutter gesture orbits within conservative yaw and pitch limits. The wheel zooms within a narrow editorial range unless the Hand currently holds a patch, in which case it twists the patch. Double-click resets the camera. After a thrown piece travels outside the ideal composition, the camera gently eases its target to keep the active mass framed.

Keyboard controls:

- `Space`: pause/resume
- `N`: nudge
- `R`: reset
- `H`: Hand
- `K`: Knife
- `C`: Cutter
- `1`–`4`: Star, Heart, Flower, Round

Reduced-motion mode disables nonessential UI easing and camera follow, shortens tool choreography, and increases settling damping while preserving all operations.

## Rendering

The renderer uses WebGPU/WGSL only and four passes:

1. a back-face depth pass estimates view-ray thickness;
2. a top-down height/shadow pass supports contact AO and tinted PCSS-lite floor shadows;
3. a 4× MSAA HDR scene pass renders jelly, inclusions, floor, tools, and procedural studio lighting;
4. PBR-neutral tone mapping outputs sRGB with subtle dither.

Jelly shading combines capped Beer–Lambert absorption, a small jittered thickness blur, milky pith/membrane scattering, thin-edge transmission glow, Fresnel, and GGX highlights. A procedural studio environment supplies large softbox reflections. The floor and CSS background converge on `#F2ECE2` after tone mapping.

The mesh toggle overlays restrained topology lines without replacing the material shader.

## Interface Behavior

The status pill reports `WEBGPU · LIVE`, `PAUSED`, `RECOVERING`, or `UNAVAILABLE`. All stateful controls use accessible native buttons, ranges, and checkboxes with visible keyboard focus. Controls are disabled while unavailable or recovering.

The tool hint changes with the selected tool. Live readouts report approximate mass, volume as a percentage of rest, kinetic energy in microjoules, and active piece count.

Miss and limit messages appear as small italic toasts:

- `Place the cutter over the jelly.`
- `Lay that piece flat to stamp it.`
- `Too thin to cut there.`
- `That's plenty of pieces.`

`Inside the experiment` explains physics, cutting, cookie cutters, and rendering in a collapsed disclosure. An illustrative-scale footnote makes clear that the mass and energy values are interpretive.

## WebGPU Failure and Recovery

If `navigator.gpu` is absent or no adapter is available, the stage becomes an editorial fallback card headed `This slice needs WebGPU.` It names a current WebGPU-capable browser as the remedy and explains that the simulation uses GPU features unavailable in the current context. Controls are disabled.

Shader modules are checked through `getCompilationInfo()`. Compilation failures show the affected stage, line/column, and message inside a collapsible diagnostics panel rather than leaving a blank canvas.

On device loss, current masks, piece transforms, settings, and selected tools are serialized. The renderer and GPU resources rebuild at most twice. A third loss leaves the explicit unavailable card and preserved diagnostics.

## Test Hook and Verification

`window.citrusJellyTest` exposes:

- `sim`, `camera`, and current tool/settings snapshots;
- `pick(x, y)`;
- `planCut(stroke)` and `startCut(stroke)`;
- `planStamp(shape, transform)` and `startStamp(shape, transform)`;
- `advance(seconds)` for deterministic stepping;
- per-piece particle, triangle, area, velocity, and validity statistics;
- controlled device-loss and unavailable-mode hooks for test builds.

Browser tests verify:

- direct loading and the Jumbleyard route;
- fallback and disabled controls without WebGPU;
- shader compilation and zero uncaught page errors;
- pause, quarter-speed, reset, nudge, and keyboard tool selection;
- a knife cut increasing the component count;
- each cutter producing a removable inner component and persistent hole;
- combined cut/stamp operations respecting the 14-piece limit;
- finite particles after throws and rebuilds;
- desktop and mobile responsive layouts;
- reduced-motion behavior.

Desktop and mobile screenshots are inspected for lens-shift composition, floor/page color matching, readable controls, intact cut holes, visible tool models, and plausible seated/resting jelly contact.

## Acceptance Criteria

- The public Jumbleyard collection contains a playable Citrus Jelly card and route.
- The standalone HTML has no external runtime dependency and uses no WebGL.
- Hand interaction visibly stretches, twists, lifts, and throws the jelly.
- Knife cuts and all four cutter shapes permanently change the geometry.
- Stamped shapes can be lifted out and both inner and outer pieces can be edited again.
- The prototype stays bounded to 14 pieces and remains numerically stable during ordinary play.
- WebGPU fallback, WGSL diagnostics, and two-attempt device recovery are visible and actionable.
- Desktop and mobile layouts preserve the editorial composition and touch usability.
- Automated checks, production build, and live smoke tests pass before release.
