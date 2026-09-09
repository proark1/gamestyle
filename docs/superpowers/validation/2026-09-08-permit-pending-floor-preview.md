# Permit Pending: floor preview height clarity

Published to the existing Railway `stack-or-sink` service in `production` on 8 September 2026, continuing the authorized live fix.

URL: https://jumbleyard.up.railway.app/chaos

Deployment: `eae923a4-ed7d-4497-bd4c-906fc2d175ba`, status `SUCCESS`.

## Cause and correction

The supplied screenshot shows the ground floor selected and a preview at `(0, -6)`, behind the wall. Both floor preview surfaces and outlines had depth testing disabled. They were drawn over the nearer wall, making a ground-level tile appear to sit on the wall top.

Floor preview surfaces and outlines now respect depth. Desktop and compact placement labels identify the preview's target floor: `Ground floor`, `Floor 2`, or `Floor 3`. The selected floor continues to determine placement; selecting Floor 2 puts tiles above ground-floor walls. The existing overhead building and stair approach fixes remain present.

## Validation

- Added a regression that recreates a ground tile behind a nearer wall using the real meshes and camera rays. It failed before the correction and passes afterward.
- Verified preview versus authoritative construction heights for all three levels and all four rotations, with the worker below upper tiles. The only height difference is the existing 0.02 preview offset.
- Local focused suite: 45 tests passed; TypeScript and lint for the changed files passed.
- Prepared release: all 545 tests, TypeScript, and Railway production build passed.
- Live route and database health return HTTP 200.
- The live game references `scene-DFXaTPSh.js` and `saved-build-CFWnWwUF.js`; both match the validated local files byte for byte. The served game bundle `Game-BotAJdeB.js` contains the floor label. The game bundle name differs from the local build, so verification discovers it from the live page rather than assuming its filename.
- Checked that the live scene still contains overhead routing and the rules still allow building from intermediate stair heights.

This verification checks geometry, material depth settings, simulation behavior, and published assets. It does not claim a browser screenshot comparison.

## Release source

Baseline: the preceding successful deployment `c4da22a6-f7cb-457c-a1d1-0e59c95c3492`, in `.tmp/permit-overhead-release-20260908`.

Only `games/chaos/scene.ts`, `games/chaos/Game.tsx`, and `games/chaos/scene.test.ts` changed in the 555-file release. The existing live changes to the other games are preserved. Databases, credentials, environment files, and local work directories are excluded.

Release: `.tmp/permit-floor-preview-release-20260908`.

Manifest: `.tmp/permit-floor-preview-release-manifest.json`.

Live verification: `.tmp/verify-floor-preview-live.mjs` and `.tmp/floor-preview-live-verification.json`.
