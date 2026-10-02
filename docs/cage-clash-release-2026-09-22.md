# Cage Clash release — 22 September 2026

Production URL: https://www.jumbleyard.com/cage-clash

- Release source: `501d24dbb6b79ff12040bf3df468034f0cda0181`, pushed to `origin/main`.
- Game implementation: `4761be0`.
- Railway deployment: `e0f77c85-2229-4180-b63f-4307b057d8b3`.
- Isolated release checkout: `.tmp/cage-clash-live-release`.
- Preserved the current boxing updates and the newer wardrobe/shop plaza release
  by merging current main before the final validation and build.
- Used the normal deployment script with its clean-tree, current-main and
  concurrent-deployment checks enabled.

Includes the complete 1v1 MMA game, solo bot, secret style selection, octagon,
strikes and grappling, collection integration, two-seat rooms and 38 original
bundled sound cues. The shared working folder was preserved.

Validation before deployment:

- Full `npm run check` passed: formatting, TypeScript, lint, architecture and
  1,869 tests.
- Final merged Railway production build passed.
- Two real local WebRTC clients passed private selection, simultaneous reveal,
  generated direct voice audio, strike damage, guest takedown, host recovery and
  bot replacement.
- Audio browser verification previously passed all 38 decoded recordings,
  playback, mute, volume, music controls, suspension, reset and disposal.

Deployment and live verification results are recorded under
`.tmp/cage-clash-live-release/.tmp/release-logs/`.

## Live result

Railway reports **SUCCESS**. At 12:47 UTC, the public health endpoint returned
`status: ok`, the collection linked Cage Clash, the game route returned HTTP 200,
and all 38 published WAV files matched the release's SHA-256 hashes. The public
manifest contained all 38 cues.

Two clients connected through the live production peer API and passed hidden
selection, simultaneous reveal, generated direct voice audio, strike damage,
guest takedown, abrupt host recovery and bot replacement. A browser opened the
public style-selection screen and started a solo match without captured JavaScript
errors. Physical microphones, restrictive networks and subjective listening were
not part of these automated release checks.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=e0f77c85-2229-4180-b63f-4307b057d8b3
