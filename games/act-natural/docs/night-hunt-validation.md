# Smooth movement and flashlight night hunt

8 September 2026. Live: https://jumbleyard.up.railway.app/act-natural

## Delivered

- Immediate local farmer movement, bounded server reconciliation, smooth facing and buffered remote actors. The farmer, flashlight and selection ring share the displayed pose.
- Prompt ordered controls, one sync request at a time, and stale-input rejection. Camera-relative diagonal input is normalized before transmission so prediction and authoritative movement agree.
- Player-farmer rounds use moonlight and a warm handheld flashlight. The beam uses the existing seven-metre range, cone, small pool at the feet and hay occlusion. Shock exposure remains visible briefly outside it. Fence power does not disable the flashlight. Computer-farmer play and lobbies retain daylight.
- Animated farmer gait and raised flashlight arm. Reduced-motion preferences remove the decorative gait while preserving navigational smoothing.
- Reusable sight vertex buffers replace per-snapshot polygon triangulation and disposal. Analytic lighting avoids an extra shadow render pass on mobile. Night HUD text and urgent timer colors remain distinct against the dark background.

See [the design](night-hunt-design.md) for the prediction and visibility boundaries.

## Validation

- Final Act Natural suite: **72 tests passed**. Covers first-frame response, irregular snapshots, stop reconciliation, hay/fence collision, disconnect/reconnect, short rotations across angle wrap, normalized diagonals, ordered requests, private control acknowledgements, existing NPC rounds, roles and electric shocks.
- Whole-project suite: **614 tests passed** before the final isolated diagonal-input regression was added. The final six movement tests and complete 72-test game suite passed afterward.
- Root lint and formatting passed. Final isolated production typecheck and `build:railway` passed. The deployed baseline suite passed 562 tests; focused release checks also covered movement, flashlight, NPCs and legacy peer compatibility.
- Five hundred changing flashlight poses retained the same GPU buffer and respected server occlusion, including cone boundaries and hay corners. Material programs are reused when the light moves.
- Local production HTTP checks passed for both existing four-human modes, NPC slot lifecycle and a complete three-NPC escape, and the new movement protocol.
- Final public HTTP checks passed for walking, turning, persistent stopping, rejecting an older input after a newer stop, and keeping NPC state/other-player controls private. Disposable test players left their rooms afterward.

These are code, simulation, geometry, build, API and asset checks. Browser/device appearance and frame rate were not profiled for this change; this report does not assert a measured FPS or a physical-device playtest.

## Release

Final Railway deployment: `c8b69793-df80-4b0d-87e1-541284e852ad`, **SUCCESS**. Frozen source: `work/act-natural-night-release-v4-20260908`; 574 SHA-256 records in `work/act-natural-night-release-v4-manifest.json`.

The release preserves the live source tree and its older module layout; only Act Natural files were mapped into it. The first isolated build exposed the legacy peer-loader signature difference, which was corrected before publishing. Pre-upload deployment checks prevented using a stale baseline. Core night/motion, mobile contrast, and final diagonal normalization were published successively; no production database was replaced.

Public `/act-natural` returned HTTP 200. The page loads the validated CSS `Game.DGmsSPCP.css` and renderer `scene-ks36Ckz-.js`, both byte-for-byte matches. The live UI bundle `Game-4P64rw5z.js` matches the local implementation after normalizing only platform-dependent hashed JavaScript dependency filenames. It references that exact renderer. Evidence is saved in `work/farm-night-live-check.json`.

Other evidence: `work/farm-night-final-tests.log`, `work/farm-night-all-tests.log`, `work/farm-night-release-v4-build.log`, `work/farm-night-release-v4-typecheck.log`, `work/farm-night-movement-live-final.log`, `work/farm-night-npc-http.log`, and `work/farm-night-existing-http.log`.

Re-run the disposable movement check with `GAME_TEST_URL` set to the desired server origin and `node games/act-natural/scripts/movement-integration.mjs`.
