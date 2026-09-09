# Upper wall edges and storey transparency

Upper-storey walls, window walls, and doors may sit on a floor tile's outer edge. Support is checked continuously along the wall's two-metre centre line, with the same small tile-joining tolerance as other floor support. The full length must be supported; gaps, partly supported ends, missing/held/hoisted tiles, and the wrong storey are rejected. Furniture still needs its full footprint supported. Wall previews also snap to the edges of upper tiles.

While choosing a construction floor, all placed parts on other storeys remain visible at 17% opacity. Their depth writing and shadows are disabled so they do not obscure the selected floor. Changing selection restores original opacity, transparency, depth writing and shadows. The material variants belong to the individual piece and are reused and disposed with it, preserving shared colour materials. Roofs use their existing fade animation with the same other-storey rule; the selected roof remains opaque while building. In walking mode, the active storey follows the builder; the menu overview restores all storeys. Loose items, supplies, held pieces and crane loads remain visible and usable.

Picking filters transparent storeys so a higher floor cannot intercept a click intended for the selected storey. Placement, collision and structural support remain authoritative and independent of transparency.

## Validation

- Focused workspace suite: 48 passing tests, including upper wall edges in both upper storeys, all rotations, both sides, wall/window/door types, snapping, support gaps, server placement and protected support removal.
- Rendering tests exercise the real scene methods without a GPU: all three floor selections and restoration; floor/wall/roof opacity and visibility; picking through transparent floors; preservation of shared materials, glass, shadows, material arrays, reuse and disposal.
- Workspace TypeScript and lint of affected source/test files: passed.
- Final staged release TypeScript and production build: passed.
- Full release suite, including the concurrent crane-physics changes: 567 passed, zero failures.
- A local production request to `/api/health` and `/chaos` returned HTTP 200. Browser interaction and screenshot checks were not run.

## Isolated release

- Staging directory: `.tmp/permit-storey-release-20260908`.
- Manifest: `.tmp/permit-storey-release-manifest.json`, 568 verified source files.
- Final baseline: crane-impact release `4eeb06d7-8d5f-44fc-a7c0-d4c1060f7811`, preserving the concurrently published Stack or Sink physics update.
- Changed existing files: `games/chaos/structure.ts`, `placement.ts`, `scene.ts`, `scene.test.ts`.
- Added: `games/chaos/storey-view.ts`, `storey-view.test.ts`, `wall-edge.test.ts`.
- All other source files are verified against the baseline manifest. The right-side construction UI and earlier overhead construction and floor-preview fixes are retained. Unrelated workspace changes and the ongoing repository refactor are excluded.
- `.tmp/verify-storey-release.mjs` checks the manifest, exact source-change scope and compiled fixes; `.tmp/verify-storey-live.mjs` verifies public health and the corrected scene/build-rule assets against the validated bytes.

## Production

- Railway deployment `4e6e5b23-f6a4-4b48-b3e7-90cabecf3090`: SUCCESS.
- Public URL: https://jumbleyard.up.railway.app/chaos.
- Public `/api/health` and `/chaos`: HTTP 200.
- The live client `Game-CtADyz1Z.js` references the corrected `scene-D4Hi802L.js` and `saved-build-D8ZzV0np.js`. Both assets match the validated release bytes exactly. Existing construction-toolbar controls remain present.
- Verification record: `.tmp/storey-live-verification.json`.
- Local production smoke server stopped after validation.
