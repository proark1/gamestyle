# Permit Pending crane roof access — 2026-09-08

The shared placement check now rejects roofs whose footprint overlaps installed construction on any higher storey. This includes partial overhangs and a third storey above an empty second one. Exposed lower wings remain valid. The selected level remains explicit and is never silently changed. Crane pickup uses the same access rule; final installation reuses the existing server revalidation, preserving the load if a new obstruction appears during travel.

Validation:

- The new regression cases failed against the former placement rules and passed after the fix.
- 576 tests passed across the exact release source, including nine new regression tests. Coverage includes all roof rotations, upper floors/walls/stairs/roofs/furniture, partial overlap, setbacks, load preservation, valid top-storey installation, concurrent building, pickup, reserved origins and the real scene preview method.
- Root and release TypeScript checks passed; lint passed for changed source and tests.
- Railway production build passed. A manifest verifies all 569 uploaded source files; only `games/chaos/crane.ts`, `games/chaos/placement.ts`, `games/chaos/scene.test.ts` and the new `games/chaos/roof-access.test.ts` differ from the prior live release.
- Compiled assets contain the new overhead-access rule and retain the existing storey transparency, wall-edge support, floor preview correction, overhead building reach and right toolbar.
- No browser interaction or GPU screenshot verification was performed. Scene tests execute the real preview method using Three.js objects in the test process.

Release source: `.tmp/permit-roof-access-release-20260908`, based on deployment `4e6e5b23-f6a4-4b48-b3e7-90cabecf3090`. Railway deployment `b247397b-c171-46ea-a42e-5ee1eff9050d` succeeded. Public `/api/health` and `/chaos` returned HTTP 200. The live page references `Game-DfT0mNk9.js`; its scene `scene-DN1OGbiY.js` and rules `saved-build-BmjYiDTb.js` match the validated release byte for byte. Verification is recorded in `.tmp/roof-access-live-verification.json`.
