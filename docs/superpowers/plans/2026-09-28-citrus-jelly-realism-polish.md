# Citrus Jelly realism polish implementation plan

## Objective

Upgrade the existing self-contained Citrus Jelly prototype to the approved Studio Gummy direction: rounded visible geometry, richer translucent shading, more believable studio lighting, heavy premium deformation, and bounded cut/stamp rebuilds without changing the editorial shell or persistent topology model.

## Task 1 — Lock the polish contract with focused tests

**Files**

- Modify `games/citrus-jelly-cutter/shader-source.test.ts`
- Create `games/citrus-jelly-cutter/polish-source.test.ts`

**Steps**

1. Add source assertions for the named quality tiers, reusable surface buffers, displacement clamps, thickness/transmission shader terms, dual studio lights, contact shadow, weighted grab radius, and presentation statistics exposed by the test hook.
2. Reject the old flat-only normal/material pattern and any reintroduction of scalar/vector WGSL arithmetic without explicit splats.
3. Run `node scripts/test.mjs games/citrus-jelly-cutter` and confirm the new assertions fail before implementation.

## Task 2 — Add bounded heavy-gummy simulation behavior

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Extend each piece with rest centroid, rest radial distance, boundary-node metadata, and reusable scratch values needed for volume and surface calculations.
2. Replace the current grab patch falloff with a smooth cubic weight and a larger bounded patch so movement propagates instead of pulling a single visible cell.
3. Add an approximate planar-area/volume preservation pass that measures current radial spread against rest spread and applies a capped lateral correction.
4. Differentiate rind/pith constraint response from flesh using rest-space classification.
5. Replace the hard floor stop with bounded compliant compression and lateral bulge while preserving the minimum safe height.
6. Add velocity-dependent damping: low enough for the first one or two oscillations, stronger near rest.
7. Clamp tool offsets, inherited separation, node speed, and post-rebuild height delta.
8. Extend `window.citrusJellyTest.stats()` with centroid, planar area ratio, maximum speed, maximum height delta, and finite-state diagnostics.
9. Run the focused tests and deterministic hook checks for stretch, settle, cut, and stamp.

## Task 3 — Separate physics nodes from the visible surface

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Allocate reusable render-node position and normal buffers sized for the fixed lattice and piece limit.
2. Build a presentation sampler that computes weighted neighbor positions without modifying simulation nodes.
3. Detect boundary nodes from the piece mask and smooth them tangentially with a smaller weight than interior nodes, preserving the component silhouette.
4. Clamp every presentation displacement relative to its source node and restore the last valid presentation sample if a non-finite value appears.
5. Compute smooth cap normals from neighboring presentation nodes instead of using constant up/down normals.
6. Refactor `buildSceneMesh()` to consume presentation samples and share vertices where practical within each cell group.
7. Extend test-hook presentation stats with finite vertex/normal counts and maximum smoothing displacement.

## Task 4 — Round caps, outer boundaries, cuts, and holes

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Replace each single vertical boundary quad with a three-stage bevel profile: lower rim, side wall, and upper rim.
2. Derive outward boundary normals from neighboring empty cells and normalize diagonal corners for a rounded silhouette.
3. Offset bevel rings inward in the rest plane and vertically toward the cap, with a reduced width at crowded corners.
4. Apply a subtle capped cap bulge based on distance to the nearest boundary and current compression.
5. Tag newly created cut/stamp boundary material so fresh faces receive a slightly wetter shader response during their initial relaxation.
6. Skip zero-area bevel triangles and verify index bounds before GPU upload.
7. Capture pristine, cut, and stamped local screenshots and inspect for staircase walls, cracks, inverted faces, and spikes.

## Task 5 — Add adaptive render quality and thickness/contact resources

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Introduce explicit `high`, `balanced`, and `mobile` quality profiles selected from canvas area, device pixel ratio, and adapter limits.
2. Add reusable single-sample front/back depth or thickness textures and a top-down contact texture at quality-scaled resolution.
3. Create WGSL modules and pipelines for back-depth/thickness, contact/shadow, and the final scene while retaining 4× MSAA for the main pass when supported.
4. Recreate optional targets during resize and device recovery; destroy previous resources before replacement.
5. If an optional target or pipeline fails, step down one quality tier and record the reason in diagnostics. Only mandatory scene-pipeline failure should activate the unavailable card.
6. Expose the selected quality tier and optional-pass availability through `window.citrusJellyTest`.

## Task 6 — Implement the Studio Gummy WGSL material

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Expand vertex attributes with smooth curvature/boundary data and material-zone metadata.
2. Add thickness-aware Beer–Lambert absorption with explicit WGSL vector types for cross-device compatibility.
3. Add quality-scaled transmission blur, restrained forward scattering, thin-edge glow, and depth-aware membrane/pith treatment.
4. Replace the single hard highlight with a broad warm key softbox lobe and a narrower cool rim lobe, plus Fresnel and procedural micro-roughness.
5. Replace regular sinusoidal vesicles with irregular rest-space radial sacs and add sparse depth-varied bubbles.
6. Refine rind pore and mottling functions so they alter roughness and normal response rather than only subtracting color.
7. Add a cooler metallic steel branch for the knife and cutters.
8. Preserve the mesh overlay and all three variety palettes.
9. Run shader compilation in Chrome/Edge WebGPU and verify zero `getCompilationInfo()` errors.

## Task 7 — Improve floor contact presentation

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Sample the contact texture in the floor branch to produce soft ambient occlusion below the specimen.
2. Add an amber-tinted wide shadow and a restrained transmitted-light pool beneath thin jelly areas.
3. Keep the fully lit floor output matched to page color `#F2ECE2` after display conversion.
4. Ensure tool shadows remain neutral and visually sharper than jelly shadows.
5. Compare default, low camera angle, and mobile framing for shadow detachment or excessive tint.

## Task 8 — Tune tool choreography and defaults

**File**

- Modify `public/citrus-jelly-cutter.html`

**Steps**

1. Add a bounded pre-break compression field around the knife stroke and cutter perimeter.
2. Transfer the compressed pose into rebuilt pieces, apply a small separation impulse, and decay the fresh-face value during relaxation.
3. Tune the default firmness and damping values to the selected heavy premium profile while keeping the full slider ranges useful.
4. Preserve reduced-motion behavior by shortening choreography and increasing settling without removing the visible compression cue.
5. Verify all keyboard, pointer, touch, camera, and tool-selection behavior remains unchanged.

## Task 9 — Full verification and visual review

**Files**

- Modify `.tmp/citrus-jelly-qa.mjs` only as ignored local test support when needed
- Modify focused tests only if a genuine acceptance gap is found

**Steps**

1. Run `node scripts/test.mjs games/citrus-jelly-cutter shared/games/identity.test.ts platform/games/registry.test.ts`.
2. Run `npm run typecheck`, `npm run lint`, and `npm run check:architecture`.
3. Run targeted `oxfmt --check` on every changed tracked file and `git diff --check`.
4. Run `npm run build` and confirm `/citrus-jelly-cutter` is present.
5. Run the browser QA hook with real WebGPU for pristine, stretch/release, cut, all four stamps, and combined operations. Assert all simulation and presentation statistics are finite and within bounds.
6. Run the forced unavailable-mode test and confirm controls remain disabled with useful diagnostics.
7. Inspect desktop and mobile screenshots for the acceptance criteria in the design specification.

## Task 10 — Publish and verify production

**Steps**

1. Commit the implementation with a focused feature message.
2. Fetch `origin/main`, rebase if needed, and rerun focused tests after conflict resolution.
3. Push `HEAD:main`.
4. Deploy the production service through the existing Railway project and wait for `SUCCESS`.
5. Run the full public WebGPU browser QA against `https://www.jumbleyard.com/citrus-jelly-cutter`.
6. Report the live URL, commit, deployment result, performance tier tested, and any intentionally retained prototype limitations.
