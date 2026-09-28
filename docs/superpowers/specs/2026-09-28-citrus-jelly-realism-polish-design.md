# Citrus Jelly realism polish

**Date:** 2026-09-28  
**Status:** Approved design  
**Target:** The existing Jumbleyard Citrus Jelly WebGPU prototype

## Goal

Make the Citrus Jelly specimen look and behave like premium translucent gummy candy while preserving the calm editorial page, current tools, persistent cuts and stamps, mobile support, and WebGPU-only product decision.

The selected visual direction is **Studio Gummy**: rounded volume, wet broad highlights, warm internal glow, micro-bubbles, softly embedded citrus structure, and a slow heavy wobble. The result should feel edible and physically soft rather than faceted, glassy, or toy-like.

## Scope

This polish changes the visible specimen surface, material response, studio lighting, floor interaction, and deformation presentation. It does not redesign the page, add progression or audio, replace the persistent mask topology, or introduce external assets or libraries.

The implementation stays inside the self-contained `public/citrus-jelly-cutter.html` file, with focused source tests under `games/citrus-jelly-cutter/`.

## Coordinated approach

The improvement combines geometry, shading, lighting, and motion. A shader-only change is insufficient because the current square lattice remains visible at boundaries and cut faces. A full volumetric renderer is unnecessary and would put mid-range laptop performance at risk.

The existing constrained lattice remains authoritative for simulation and interaction. A separate render-surface layer derives a smoother, safer visible mesh from it. This separation allows the game to keep its proven cut/stamp topology while presenting softer geometry.

## Surface geometry

### Smoothed render surface

The visible specimen no longer exposes raw square physics cells. Each render vertex samples a weighted neighborhood of nearby simulation nodes. Interior vertices receive modest Laplacian smoothing in the slice plane and across height; boundary vertices use tangent-aware smoothing so the silhouette remains attached to the topology instead of shrinking.

The smoother is presentation-only. Picking, mask booleans, component extraction, state transfer, and physics constraints continue to use the existing lattice.

### Rounded volume

Front, back, outer-rind, knife-cut, and cutter-hole surfaces use a consistent bevel profile. The profile rounds through multiple rings rather than meeting the side wall at a hard right angle. Tight corners merge or reduce their bevel width so the surface remains watertight.

The upper and lower caps bulge very slightly toward their centers to suggest surface tension. Boundary curvature remains stronger along flesh and pith, while the zest keeps a slightly firmer outer profile.

### Cut and stamp faces

Fresh knife faces and cutter walls use the same translucent flesh material as the specimen interior, with a wetter highlight and slightly brighter thin-edge transmission. Their lips remain rounded after the tool lifts. The presentation layer clamps local displacement around newly rebuilt boundaries to prevent tall spikes or inverted faces.

### Rest-space citrus detail

Material features remain derived from shared rest-space coordinates so they survive cuts and stamps:

- a mottled zest with small recessed oil-gland pores;
- a pale pith band and core with softer scattering;
- five membranes embedded visually beneath the cap surface;
- irregular radial juice vesicles rather than uniform sinusoidal stripes;
- sparse suspended micro-bubbles with varied radius and depth;
- low-amplitude color and density variation through the flesh.

Membranes, vesicles, and bubbles must read as internal detail rather than bright lines painted on top.

## Gummy material

### Thickness-aware transmission

The renderer estimates view-ray thickness from front and back surface depth. Absorption grows with thickness: thin edges glow warm orange, medium regions retain luminous flesh color, and thick areas become deeper red-orange. The absorption range is capped so no area becomes opaque brown.

A small, quality-scaled neighborhood blur softens the transmitted scene and internal detail. This should resemble cloudy confectionery rather than clear glass.

### Surface response

The shader combines:

- a broad low-intensity GGX lobe for the wet body reflection;
- a tighter highlight for fresh cut faces and high-curvature rims;
- Fresnel brightening at grazing angles;
- subtle procedural micro-roughness to break up perfect plastic reflections;
- soft forward scattering in pith and membranes;
- a restrained thin-edge glow.

The Orange, Blood Orange, and Lemon varieties continue to recolor flesh, zest, pith, absorption, membrane tint, and transmitted shadow without resetting simulation state.

## Studio lighting and floor

Two procedural area-light approximations create broad curved highlights: a large warm key softbox above-left and a cooler narrower rim softbox behind-right. A low ambient term keeps the shaded side readable without flattening the volume.

The floor remains visually identical to the page paper after tone mapping. The specimen casts:

- a wide soft amber-tinted shadow;
- tighter contact darkening immediately below resting surfaces;
- a faint transmitted-light pool beneath thin orange areas.

The knife and cutters use cooler, sharper reflections and higher metallic response, maintaining clear material separation from the jelly.

## Heavy premium motion

### Grabbing

A hand grab attaches a weighted patch instead of one visible node. Weight falls off smoothly from the picked point. The center follows the cursor most strongly; neighboring nodes lag slightly, spreading deformation through the material.

### Volume and recovery

The solver increases approximate volume preservation so vertical compression creates lateral bulging. Flesh constraints remain softer than pith and rind constraints. The rind acts as an elastic frame that guides the specimen back toward its rest silhouette without snapping.

### Wobble profile

Releasing a held piece produces one or two slow secondary oscillations. Damping is low during the first response and increases near rest, giving a heavy gummy motion that settles cleanly. The default material slider values map to this profile while still allowing the existing lively-to-syrupy range.

### Floor contact

The underside receives a bounded compliant contact response. Resting pieces flatten by a small visible amount, with corresponding lateral spread, rather than stopping against a mathematically rigid plane. Friction prevents endless sliding while preserving short soft rebounds.

### Tool response

The knife compresses a soft band before breakthrough. New lips inherit the compressed pose, separate by a small bounded amount, then relax. Cutter rings similarly compress their perimeter; the inner shape softly rebounds and rises after breakthrough.

All tool-driven offsets and inherited velocities are clamped. No operation may create stretched towers, inverted walls, or non-finite nodes.

## Architecture and data flow

The simulation lattice remains the source of truth:

1. fixed-step physics updates node positions and velocities;
2. cut or stamp operations rebuild masks and simulation components when committed;
3. the presentation smoother samples current nodes into reusable render buffers;
4. bevel and detail attributes are evaluated from component boundaries and shared rest space;
5. render passes produce depth/thickness, shadow/contact data, and the final material image.

Normal frames reuse typed buffers and scratch values. Topology rebuilds may allocate new buffers. The render layer is not allowed to mutate masks, component identity, or simulation rest data.

The implementation is divided into focused internal concerns even though the deliverable remains one HTML file:

- surface sampling and safe smoothing;
- boundary/bevel generation;
- thickness and contact render targets;
- gummy material WGSL;
- heavy-motion solver tuning;
- adaptive quality selection;
- diagnostics and test hooks.

## Adaptive quality

The game selects a conservative quality tier from adapter limits, canvas size, and device pixel ratio.

High quality uses the full transmission neighborhood, higher-resolution thickness/contact targets, and all micro-detail. Balanced quality reduces target resolution and transmission samples while preserving bevels, broad highlights, and the heavy motion profile. Mobile quality further reduces internal-detail frequency and shadow softness but never falls back to the old faceted material.

The existing WebGPU unavailable card remains the only non-rendering fallback. Shader compilation diagnostics and the two-attempt device-loss recovery remain intact.

## Stability and error handling

Every generated render vertex, index, normal, and simulation node is checked for finite values at rebuild boundaries. Degenerate triangles and invalid bevel segments are skipped. Surface smoothing limits displacement relative to its source node and retains the last valid visible surface if a new surface fails validation.

Physics keeps its speed cap and strain limits. Additional limits bound contact compression, tool groove depth, inherited cut separation, and post-rebuild velocity. These safeguards target the tall spikes and stretched walls visible in the current post-cut presentation.

If an optional thickness or contact target cannot be allocated, the renderer drops to the next quality tier and reports the reason through diagnostics. It does not disable WebGPU unless device or mandatory pipeline creation fails.

## Test strategy

Focused source tests verify that the self-contained game contains the smoothing, bounded displacement, thickness-aware shader, and adaptive-quality paths. Existing bridge and WGSL compatibility tests remain.

Deterministic hook tests cover:

- pristine finite geometry;
- grab, stretch, release, and stable settling;
- bounded volume recovery after compression;
- one knife cut and all four cutter shapes;
- combined cut/stamp operations up to the piece cap;
- finite nodes, normals, and indices after each rebuild;
- maximum allowed presentation displacement;
- pause, quarter speed, reset, variety changes, and camera controls;
- real WebGPU initialization and forced unavailable mode.

Visual QA captures desktop and mobile states for:

- untouched Orange, Blood Orange, and Lemon specimens;
- active stretch with visible volume bulge;
- the first two wobble peaks after release;
- knife compression and fresh cut lips;
- a stamped shape lifted from its hole;
- resting contact shadow and transmitted floor glow.

Review explicitly checks for blocky silhouettes, staircase cut walls, spikes, opaque or glass-like flesh, flat membrane lines, overly sharp reflections, disconnected shadows, and excessive motion.

## Acceptance criteria

- The untouched specimen reads immediately as soft translucent gummy candy.
- The silhouette, cap-to-wall transition, cut faces, and cutter holes appear rounded rather than grid-stepped.
- Internal membranes, vesicles, pores, and bubbles have believable depth and remain aligned after cuts.
- Thin areas glow while thick areas absorb more light without becoming muddy.
- Broad highlights and floor lighting make the volume legible from the default camera.
- Grab and release feel heavy, delayed, and soft, with one or two secondary wobbles and clean settling.
- Compression produces bounded lateral bulging and subtle floor flattening.
- Knife and cutter operations never generate extreme spikes or non-finite geometry.
- The game remains responsive on a mid-range laptop and preserves a reduced mobile quality tier.
- The public route, controls, interactions, WebGPU diagnostics, and genuine unavailable fallback continue to work.
