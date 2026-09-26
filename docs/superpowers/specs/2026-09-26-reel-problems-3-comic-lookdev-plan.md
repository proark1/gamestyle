# Reel Problems 3 Comic Lookdev Implementation Plan

## Objective

Add three real-time comic render presets to the existing Beacon Island lookdev scene. Preserve looks `1`–`3`; expose Bright Adventure Comic, Dark Graphic Novel, and Hand-Drawn Comic on keys `4`–`6`.

## Task 1: Extend style data and shortcut coverage

**Files:**

- `games/reel-problems-3/lookdev/types.ts`
- `games/reel-problems-3/lookdev/styles.ts`
- `games/reel-problems-3/lookdev/lookdev.test.ts`

**Work:**

1. Add `comic-adventure`, `comic-noir`, and `comic-sketch` to `LookStyleId`.
2. Expand look keys to `1`–`6` and add the three complete palettes and rendering presets.
3. Map `Digit4`–`Digit6` and number-pad equivalents.
4. Update tests for ordered preset coverage, shortcuts, and distinct comic treatment values.

## Task 2: Add a reusable comic material treatment

**Files:**

- Create `games/reel-problems-3/lookdev/comic.ts`
- Modify `games/reel-problems-3/lookdev/scene.ts`

**Work:**

1. Define treatment metadata for normal, adventure, noir, and sketch rendering.
2. Install one stable shader hook on existing `MeshStandardMaterial` instances.
3. Drive cel-lighting quantization and treatment intensity through uniforms so switching does not rebuild geometry.
4. Reuse existing geometry outlines while varying color, opacity, and scale per treatment.
5. Add a faint secondary outline for the sketch preset and keep it hidden in all other looks.
6. Apply treatment-specific hemisphere light, sun position, texture strength, fog, motes, and beacon values.
7. Preserve a flat-shaded outline fallback when shader customization is unavailable.

## Task 3: Extend sculpted water for comic rendering

**Files:**

- `games/reel-problems-3/lookdev/water.ts`
- `games/reel-problems-3/lookdev/lookdev.test.ts`

**Work:**

1. Add water motion, ridge, foam, and banding values for all three comic styles.
2. Add an ink color and comic-mode uniform to the water shader.
3. Render bright banded streaks for adventure, dark ink troughs for noir, and irregular painted bands for sketch.
4. Keep shoreline foam, wet contact details, fish glow, reduced motion, and touch-density behavior.
5. Add focused assertions for the three comic water configurations.

## Task 4: Make the entire interface participate

**Files:**

- `games/reel-problems-3/lookdev/Lookdev.tsx`
- `games/reel-problems-3/lookdev/style.css`

**Work:**

1. Add an inert comic texture layer over the WebGL world.
2. Use `data-look` selectors for halftone, crosshatch, and paper-grain patterns.
3. Give each comic preset matching panel borders, fills, shadows, and accent colors.
4. Change the desktop selector to a two-column six-option layout.
5. Keep the mobile selector at three columns and two rows, adjusting action and guide positions to avoid overlap.

## Task 5: Browser verification and captures

**Files:**

- `games/reel-problems-3/lookdev/browser-check.mjs`

**Work:**

1. Switch through keys `4`, `5`, and `6` and verify the matching `data-look` state.
2. Capture one desktop screenshot for each comic treatment.
3. Verify beacon interaction remains active after switching.
4. Capture a mobile comic view and verify there is no horizontal overflow.
5. Fail on page, console, or WebGL errors.

## Verification

Run:

```powershell
node scripts/test.mjs games/reel-problems-3/lookdev
npm run typecheck
npx oxlint games/reel-problems-3/lookdev app/reel-problems-3/lookdev/page.tsx
npm run build
```

Then start the production preview on port `4184` and run:

```powershell
$env:REEL3_LOOKDEV_URL='http://127.0.0.1:4184'
node games/reel-problems-3/lookdev/browser-check.mjs
```

Inspect the adventure, noir, sketch, and mobile screenshots before committing only the comic-lookdev files.
