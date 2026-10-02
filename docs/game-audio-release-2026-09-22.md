# Audio production release — 22 September 2026

Live: https://www.jumbleyard.com

- Source: `d63c9fae01ac1cdd8425417fee9426fcda1548ee`, pushed to `origin/main`.
- Audio implementation commit: `fd15560`.
- Railway deployment: `bbf3a676-0d0d-4baf-83cb-362978bb4613`, **SUCCESS**.
- Released through the normal deployment script from the clean isolated checkout
  `.tmp/audio-live-release`, in sync with main, without a force override.
- Preserved the newer wardrobe release by merging it before the final production
  build. The original shared checkout and its unrelated changes were preserved.

Crane Clash, Load Bearing, Panic Curling, Zorb Clash, One More Button and Siege
and Desist now have their expanded sound banks live: 161 bundled cues total,
including 133 newly supplied WAV files and 74 newly added cue definitions.

Validation:

- Final merged production build passed; TypeScript, architecture and all 244
  selected game/shared-audio tests passed on the isolated release.
- Production health returned `status: ok`.
- All six game routes and audio manifests returned successfully.
- All 161 public WAV files were downloaded and SHA-256 matched against the
  tested local files.
- Headless Chrome opened all six public game pages, rendered their game canvases,
  and reported no JavaScript page errors.
- Earlier browser audio tests verified decoding, playback, mute, background
  suspension, reset and disposal for every sound bank.

Evidence: `.tmp/audio-live-release/.tmp/release-logs/`, especially
`live-verification.json`, `live-browser.json`, `tests.log`, `build.log` and
`deploy.log`. Subjective headphone/speaker listening was not performed.
