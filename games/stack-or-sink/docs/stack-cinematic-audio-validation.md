# Stack cinematic audio validation — 2026-09-07

Implemented the approved cinematic direction in the working checkout. The catalog now contains 121 cues: the original 70 and 51 additions (48 effects, two 60-second gameplay tracks, one five-second rescue accent). Existing stored prompts, settings and recordings are preserved. Missing new music and landing variations retain playable legacy fallbacks.

Validated:

- The full project test suite passed: 447 tests, zero failures.
- Stack audio tests cover height/proximity mixing, danger and practice mode, sparse coastal details, actual movement for drips/strain/cable, per-contact cooldowns, surface-specific fall strength, stale snapshots, menu cleanup and catalog limits.
- Web Audio tests cover seam processing, distance filtering, partial variant availability, nonrepeating alternatives, fallback landings, speech ducking, mute/reset cleanup and retaining the old music until its replacement has downloaded.
- Type checking and targeted lint passed. The Node/Railway production build passed after the final music transition change. Existing Vite import-attribute and bundle-size warnings remain.
- Local game and workshop routes returned HTTP 200 at port 3024. The workshop returned 121 cues; the playback manifest returned the 70 original recordings copied from the public library into the isolated preview database. No provider credentials were copied.
- Generation preview found exactly 51 missing new cues requesting 204.2 seconds total. The live workshop remains at 70 cues; its saved provider key is available and it was idle at inspection.

At the initial local handoff, public publication and the 51 new recordings were pending. The local preview contained the existing recordings and all new prompts.

The shared checkout contains concurrent changes for other games. Do not stage or deploy the entire checkout as an isolated Stack change without accounting for that work.

## Live publication

Published after the user requested “bring live”. Railway deployment `46808707-e648-4c40-9f44-c1ebe212c9df` reached `SUCCESS` on 2026-09-07 at https://jumbleyard.up.railway.app. The existing service and persistent `/data` volume were retained.

- The frozen release in `work/stack-cinematic-release-20260907` starts from the hash-verified current live farm release and adds only fourteen approved Stack implementation, test, script and documentation files. It preserves the recently published Blend Business work. File hashes are recorded in `work/stack-cinematic-release-manifest.json`.
- The isolated release passed TypeScript, all 447 tests and a fresh Node production build. Test output is in `work/stack-cinematic-release-tests.log`.
- Generated exactly 51 missing recordings using the saved live ElevenLabs key. Every request succeeded; existing recordings were skipped. The public playback manifest now contains all 121 Stack cues.
- Verified all 51 new audio URLs return playable audio files. Compared before/after manifests for Stack, Blend Business, Uphill Delivery and Tiptoe Thieves: every original cue URL, per-cue setting and saved category mix is unchanged; other-game manifests are identical. Comparison files are `work/stack-cinematic-live-before.json` and `work/stack-cinematic-live-after.json`.
- Downloaded and decoded all 51 new MP3s with libsndfile. All have finite, non-silent audio, with no excessive-clipping warnings. Durations range from 0.88 to 60.029 seconds. Measurements are in `work/stack-cinematic-media-validation.json`.
- Live health, game and workshop routes pass. The live four-player Stack integration passed capacity, authentication, host control, movement, idempotency and origin checks. Temporary test players left afterward.

Media decoding and signal checks do not constitute a subjective listening playtest. No full headphone/speaker comparison or human audition is claimed.
