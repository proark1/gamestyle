# Crate bands and rescue platform — 2026-09-08

The crate wrapping meshes had exactly the same top and bottom planes as the wood, with only 0.006 m separation at the ends. Their overlapping depths caused flickering. The bands now protrude 0.02 m on each wrapped face. Side trim ends are inset to avoid sharing the front and back wood planes. Salvage collision dimensions remain the same.

The rescue deck was already solid at y = 13.5 m. A nine-crate tower beside the deck puts the player's feet at 11.83 m; the original jump peaks at approximately 13.555 m. That clears the deck but cannot clear the 14.34 m rail tops. Before the fix, three approaches stopped at x/z = ±2.560 on the outside rim, outside the rescue area. The front approach landed inside successfully.

Each of the three railed edges now has a 1.8 m central opening, shared by rendering and collision through SCENERY. The original open front remains accessible. Contrasting thresholds, inward chevrons and a height label identify the deck and entry paths. Jump strength and the solid underside are unchanged: build beside the deck and jump into an opening, rather than directly upward underneath it.

## Verification

- Twelve regression tests cover band visibility and surface separation on upright and tilted crates; nine-crate jumps through all four entries in client prediction and authoritative simulation; rescue completion; falling onto the deck; underside contacts; and the remaining rails blocking walking.
- All 553 repository tests pass, including architecture checks.
- Formatting, TypeScript and targeted lint on the four changed TypeScript files pass.
- The Railway/Node production build passes.
- The complete `npm run check` stops at ten lint errors in existing Shelf Control tests (`models.test.ts`, `motion.test.ts`, `connection.test.ts`). These files were not changed by this fix. The full test suite was run separately after that stop.
- The regular local practice game loaded successfully. Camera orbit checks showed continuous crate bands. A temporary browser fixture using the production GameScene and host simulation ran each nine-crate approach; all four visibly landed at 13.50 m and completed the crew rescue.

Browser checks used a prepared tower, not a complete manual playthrough from ground level. The 60 Hz solver can briefly overlap the underside by less than one upward step before resolving head contact; the player does not pass through the deck.

## Crane suspension correction

The orbit screenshots exposed a second, independent defect: the old boom ran along z = -6.5 m, while the rescue platform and its four vertical cables were centered at z = 0. Each cable ended in open air. The earlier entrance fix did not address this missing structural connection.

The boom now points from the existing mast toward a hoist directly above the deck. A mast turntable, central hoist joint, four bridle cables, a square spreader frame and four corner suspension cables form a continuous connection. All heights derive from GOAL. The frame bottom is 2.82 m above the deck, leaving the 1.94 m player room to stand and enter. The deck remains at its original position and height.

Scenery has an optional yaw that is applied to both its mesh and Cannon shape, and to placement/support queries. This prevents an invisible collider at the former boom position. Cables remain visual details, like the original cables; the boom, frame, deck and rails have matching solid collision geometry.

Validation: fourteen targeted regression tests pass, including real attachment checks at both ends of every cable, boom/hoist/mast alignment, matching placement and rigid-body surfaces on the rotated boom, no ghost surface at the old boom position, and the existing four-direction nine-crate jump/rescue checks. All 69 Stack or Sink tests, project TypeScript and targeted lint pass.

The browser fixture confirmed all four approaches land at 13.50 m and rescue the crew with the production host simulation and renderer. Camera orbit and overview checks show a continuous mast-to-boom-to-platform connection. As above, these jumps use a prepared nine-crate tower, not a complete build from ground level.

Published as Railway deployment `c0f783e2-6118-409b-b6b2-9508316b1f1e` (`SUCCESS`, 2026-09-08). The final source in `work/crane-rig-release-v2-20260908` preserves the newest live baseline `eae923a4-ed7d-4497-bd4c-906fc2d175ba`, including the concurrent Permit Pending floor-preview update. Exactly three runtime files, two existing test files and this document differ from that baseline. All 555 source checksums were verified before upload; the final release passed TypeScript, all 547 tests and a fresh production build.

Public verification passed for all seven game routes and health; audio manifests are unchanged. The live route loads `geometry-CKyDQJij.js` and `objects-DxvLOIjS.js`, each byte-identical to the validated build. Both four-client live integration suites passed for room access/movement and carry/placement/settled stacking. Results are recorded in `work/crane-rig-live-after.json`.

## Deployment

Published on explicit request to [the existing live game](https://jumbleyard.up.railway.app/stack-or-sink). Railway deployment `8ea857f8-6498-4090-8290-2532bf4877aa` reached `SUCCESS` on 2026-09-08.

The frozen release in `work/stack-platform-release-20260908` starts from the hash-verified live release `1c0c4c4f-d310-4791-a8c4-1c28b4a9ffd9`. It modifies only the published `game/geometry.ts` and `game/objects.ts`, and adds the two regression test files and this validation document. This keeps the published source layout and all other games intact. Checksums for all 555 release files are recorded in `work/stack-platform-release-manifest.json` and were verified again after validation. The isolated release passed TypeScript, all 538 tests and a fresh Railway production build.

Public checks confirmed healthy routes for the collection and all seven games, unchanged audio manifests, and SHA-256 matches between the validated geometry/rendering bundles and the assets loaded by the live game. Both live four-client HTTP suites passed, covering multiplayer authentication, capacity, movement, host control, exact preview placement and another client's settled stack. Temporary test players left their rooms afterward. Results are recorded in `work/stack-platform-live-after.json`.
