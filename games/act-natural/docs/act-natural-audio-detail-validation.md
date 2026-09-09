# Blend Business natural detail validation — 7 September 2026

Implemented the approved mix polish and twelve cue definitions in the shared checkout.

## Changes

- The farm catalog contains 76 cues, including three takes each of leg/grass brushing, carried-ladder creaks, wind-driven trough laps and small bird wing flutters.
- Farm animal/environment recordings and the new movement/carry details receive downward-only RMS/peak conditioning at playback. Ordinary details target at most -24 dBFS RMS; moos target -20 dBFS RMS; peaks are bounded to 0.89 before the saved mix and distance factors. Quiet recordings are never boosted. This is not a LUFS normalization or subjective loudness guarantee.
- Active positional farm sounds follow the listener and public cow positions with smoothed gain, stereo pan and distance filtering. Captured, escaped or missing cows stop attached sounds. Reset and disposal clear tracking and pending playback remains epoch guarded.
- Grass/ladder details require actual small displacement, and ladder creaks require carrying the ladder. Stationary frames, corrections over 1.5 units, stale snapshots, gaps and inactive cows cannot trigger those details.
- Wind-driven foliage, barn and trough details share the background breeze envelope. Birds, insects and wing flutters have a shared eight-second minimum gap; all ambient foreground details retain at least 1.2 seconds of spacing. The pasture bed is reduced to 75% of its former relative level; fence sound disappears away from the fence.
- Saved clips, cue IDs, prompts and mixer settings remain intact. Other-game edits from the concurrently active Stack or Sink task were preserved.
- Generation preview targets just the twelve new additions. `--all-details` includes the previous 21; saved recordings are always skipped and uncertain paid requests are never retried automatically.

## Verification

- Full `npm test`: 440 tests passed at the full-suite checkpoint.
- After concurrent shared-audio edits: TypeScript and all 26 focused farm/player/world/provider tests passed again.
- Focused Oxlint passed; updated farm modules and tests were formatted.
- `npm run build:railway`: successful. Existing Vinext configuration, chunk-size and route-classification warnings remain.
- Built Node server: `/act-natural`, `/act-natural/admin` and `/api/audio/act-natural` return HTTP 200. Workshop exposes 76 cues and exactly twelve additions, all within the provider's prompt limit. Public manifest excludes provider configuration.
- Generation preview against the local workshop lists exactly the twelve additions without issuing generation requests.
- Read-only check of `https://jumbleyard.up.railway.app/api/audio/act-natural`: 64 cues, all 64 saved, generation key available and saved, workshop idle.

## Initial local handoff (before publication)

The isolated local preview and the existing local game databases have no saved generation key. The live workshop still runs the 64-cue catalog, so the twelve additions cannot be generated through it until the updated code is published. No live files, settings or provider usage were changed in this task. No new recordings or subjective listening playtest are claimed.

After publishing this change to the existing Jumbleyard service, run the generation queue with `GAME_TEST_URL=https://jumbleyard.up.railway.app` and `--generate`. Compare the 64 existing manifest entries before/after, confirm all twelve new files, decode/check them and audition the final in-game mix. Publish from a validated release containing the intended shared-audio changes; another active task is editing Stack or Sink in the same checkout.

## Live publication

Published on 7 September 2026 after the user requested “bring live”. Railway deployment `b06cdabc-428a-4250-a1e9-3f555349abd3` reached `SUCCESS` at the existing public origin, https://jumbleyard.up.railway.app. The existing service and persistent `/data` volume were retained.

- Release source is frozen in `work/farm-natural-release-20260907`, built from the hash-verified previous live release plus only the approved farm changes. The concurrently developing Stack or Sink changes remain in the main checkout and were excluded from this publication. Release file hashes are in `work/farm-natural-release-manifest.json`.
- The isolated release passed TypeScript, all 440 tests and a fresh Node production build.
- The live health endpoint reports `ok`, and the workshop exposes 76 cues.
- Generated exactly twelve missing clips using the saved live ElevenLabs key. Every job succeeded. The public playback manifest now contains all 76 recordings.
- Compared the before/after manifests: all 64 prior clip URLs, volumes, categories, loop settings and saved mixer settings are unchanged. Comparison files are `work/farm-natural-live-before.json` and `work/farm-natural-live-after.json`.
- Downloaded and decoded all twelve new MP3s with libsndfile. Durations range from 1.2 to 3.0 seconds; every file has finite samples and audible signal, with no excessive clipping. Measurements and the applied runtime conditioning factors are in `work/farm-natural-media-validation.json`.
- The live four-player farm integration check passed: collection/game/illustration routes, legacy invites, authenticated players, private roles and independent herd movement. Temporary test players left afterward.

Media decoding and signal checks do not constitute a subjective listening playtest. No full headphone/speaker comparison or human audition is claimed.
