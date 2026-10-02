# Multiplayer production release — 22 September 2026

- Live: https://www.jumbleyard.com
- Source: `8720b11` on `origin/main`.
- Railway deployment: `a9f29460-4948-41a9-999b-444a869b63ba` — SUCCESS.
- Released from `.tmp/multiplayer-release`, based on current production including the voice release and Reel Problems 2 launch. Unrelated local redesigns were preserved rather than uploaded.
- Completed the remaining room-admission, NPC replacement, rematch, slow-reload and Drive-Thru action fixes. The earlier multiplayer UI integrations were already included in the preceding production release.

## Validation

- Release checkout: 1,629 automated tests passed, TypeScript passed, scoped lint passed, architecture passed, Railway production build passed.
- Railway build and health check succeeded. Public health returned HTTP 200 and `status: ok`; all 24 game routes returned HTTP 200.
- Against the live API, four real WebRTC clients passed snapshot synchronization, direct generated audio, abrupt host recovery, preserved round state, surviving voice links and graceful handover for Bungee Doubles, Zorb Clash, Sample Stampede and Drive-Thru.
- Live desktop/mobile browser contexts created and joined rooms and displayed synchronized two-player rosters in Bungee Doubles and Zorb Clash.
- A test-only Windows native WebRTC compatibility shim normalized malformed ICE indices for the final two transport checks. No production network validation was weakened.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=a9f29460-4948-41a9-999b-444a869b63ba
