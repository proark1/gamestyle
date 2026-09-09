# Act Natural audio verification — 7 September 2026

Implemented the approved natural farm sound direction in the current checkout.

- Added 21 workshop cues (three takes each of breathing, snuffling, hoof settling, birds, insects, foliage and barn timber), bringing the farm catalog to 64. Existing cue IDs, prompts and stored mixer settings remain compatible.
- Added sparse, irregular ambience scheduling using visible cow state and real scene locations. Captured/escaped cows are silent. Grazing and breathing stay close to the listener; bird calls and moos carry farther. Nearby hoofsteps take priority, and stopped cows may make a quiet settling scuff.
- Gate sound now follows the second delivered key, matching the visible opening, instead of repeating when cows escape. Out-of-order snapshots cannot replay farm events.
- Farm effects gain distance-based low-pass filtering and restrained playback variation. Farm music plays at 65% of its previous relative level, retaining user mixer values. Fence/panel sound stays local. Other games retain their existing acoustic behavior.
- Farm ambience buffers receive a 350 ms tail/head overlap (bounded for short buffers) to soften the wrap. This is signal-boundary conditioning, not a substitute for auditioning the actual recordings.

Checks completed:

- `npm test`: 437 passing tests, including seven new farm/Web Audio tests. Covers gate synchronization, audible ranges, sparse scheduling, public-state identity neutrality, nearby step priority, stale snapshots, menu cleanup, stereo loop continuity, Web Audio filters/variation, mute/reset and other-game isolation.
- `npm run typecheck`: passes.
- Focused Oxlint over changed sound modules, new tests and generation queue: passes. The final test-only string conversion cleanup was rerun through the focused player test and lint.
- `npm run build:railway`: passes. Existing Vinext config, chunk-size and route-classification warnings remain.
- Built Node server: `/act-natural`, `/act-natural/admin`, and `/api/audio/act-natural` return 200; the workshop exposes exactly 64 cues and 21 new details. The first preview process encountered missing build chunks; restarting after output settled resolved all three routes without a source change.
- `games/act-natural/scripts/farm-audio-generation.mjs` preview against the built server lists exactly the 21 additions and makes no generation requests. Its opt-in queue skips saved files, uses the workshop's existing saved key, checks for busy jobs, and stops on uncertain requests without automatic paid retries.
- Exported the updated prompt reference to `docs/audio-prompts.md`.

Initial local handoff (before publication):

The isolated local workshop has no generation key. No provider calls, new recordings, live settings changes, or deployments were made in this pass. After publishing the code, generate only the 21 missing additions through the saved live workshop provider configuration. Audition the clips and a full farm round, including headphones and small speakers, before calling the final mix listening-verified. Actual generated-media quality and loop seams have not been auditioned.

Generation command after publication (PowerShell):

```powershell
$env:GAME_TEST_URL = 'https://jumbleyard.up.railway.app'
node --import tsx games/act-natural/scripts/farm-audio-generation.mjs --generate
```

The generation script defaults to preview-only when `--generate` is omitted. It never regenerates saved recordings, including user-edited additions.

## Live publication

Published on 7 September 2026 after the user requested “bring it live”. Railway deployment `2b0222b3-0215-4a14-9d2a-8729f69be918` reached `SUCCESS` at the existing public origin, https://jumbleyard.up.railway.app. The source was frozen in `work/farm-audio-release-20260907`; that release passed all 438 tests and a fresh Node production build. The existing service and persistent `/data` volume were retained.

- The live health endpoint reports `ok`; the workshop has 64 cues.
- Generated exactly the 21 missing additions with the saved live ElevenLabs key. All 21 jobs completed successfully and their recordings are present in the public playback manifest.
- Compared the before/after manifests: all 43 prior clip URLs, volumes, categories, loop settings, and saved mixer settings are unchanged.
- Downloaded and decoded all 21 new MP3s with libsndfile. Durations range from 0.8 to 4.0 seconds, with finite audio samples, audible signal and no excessive clipping. Detailed measurements are in `work/farm-audio-media-validation.json`; this verifies media integrity, not subjective listening quality.
- The live four-player farm integration check passed: authenticated roles, private cow identities, independently moving herd, game/collection/illustration routes and legacy invite redirects. Temporary test players left afterward.
- Replaced the local preview in the existing browser tab with the live `/act-natural` page.

No full human listening playtest, headphone/speaker comparison, or subjective audition of generated clips is claimed.
