# Complete production release — 22 September 2026

Live: https://www.jumbleyard.com

- Source: `7c9aed49e9e4df23e50e96c53f778c9a9c2927c4`, pushed to `origin/main`.
- Railway deployment: `72ba025d-d260-4d3e-9cd3-4e830918784d`, **SUCCESS**.
- Deployed all application changes captured from the shared workspace, including mobile UI, games, party rounds, voice, rendering, avatars and platform work. Previously published changes were merged into the release; the final application source matches the validated build.
- Released from the clean isolated checkout `.tmp/all-current-live-release`. The shared working directory was preserved for ongoing work.

## Validation

- `npm run check`: formatting, TypeScript, lint, architecture and **1,700 tests passed**.
- Railway production and installed-client builds passed locally. Railway's production build and health check passed.
- Shared mobile UI and desktop regression checks passed against the final local production build.
- Four-client local WebRTC checks passed for Court Clash, Crane Clash, Drive-Thru and Bungee Doubles, including generated audio, abrupt recovery and host handover.
- Browser voice checks passed. The mobile party integration passed shared gameplay, push-to-talk across the game frame, reload and return to intermission with voice preserved. Its roster assertion now waits for both players to join and prints diagnostics on failure.
- Live verification at **06:57 UTC**: health returned `status: ok`; the homepage, party page and all 24 game routes returned HTTP 200.
- Live mobile browser verification passed homepage bounds, Court Clash start, joystick visibility, settings/Escape and portrait/landscape control bounds, with no page JavaScript errors.
- Live API tests passed four real WebRTC clients for Court Clash and Crane Clash, including generated audio, abrupt host recovery, preserved round state and graceful handover.

Physical phones, physical microphones and restrictive mobile networks were not available for this release's checks. The prior mobile report documents those limits and the WebKit screenshot caveat.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=72ba025d-d260-4d3e-9cd3-4e830918784d

Evidence: `.tmp/all-current-live-release/.tmp/release-logs/`, including `check.log`, `peer.log`, `voice.log`, `party-diagnostic.log`, `live-verification.json`, `live-peer.log` and live screenshots.
