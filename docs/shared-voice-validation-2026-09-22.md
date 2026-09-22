# Shared voice across games

All 24 registered games now supply their room session and players to the shared GameToolbar voice panel. Brick by Hand and Shelf Control gain voice support; Chaos uses the same panel and client instead of maintaining a second implementation. The old Chaos token endpoint remains a compatibility wrapper around shared authorization and provider cleanup.

The common controls include open mic, push-to-talk, saved shortcut selection, keyboard/pointer/touch holds, focus-loss release, microphone selection, and remote playback controls. Chaos retains proximity attenuation, radio operation, audio ducking, and consent-gated recording. Radio holds participate in the same input gate as the shared talk button and shortcut.

Construction room adapters authenticate the existing hashed player tokens and use active player heartbeats when checking room freshness. Game-specific storage keys keep rooms with identical codes isolated.

Validation includes an AST coverage check for all 24 game toolbar integrations, real SQLite construction-room authorization tests, shared microphone and input-gate tests, and Chaos proximity/radio/recording-consent tests. The selected unit suite passed 51 tests. The browser harness uses two Chrome contexts with synthetic microphones and measures received audio after playback gain; it exercises the actual shared panel and clients with direct peer and local LiveKit transports. It does not constitute a test of separate physical PCs or production TURN/network configuration.

Completed checks: 51 selected unit tests, TypeScript typecheck, scoped lint, and architecture boundaries. Real two-browser audio and UI scenarios passed for the direct-peer path and for LiveKit with Chaos, Brick by Hand, and Shelf Control. Initial retries encountered local LiveKit startup failures and Chrome `ERR_INSUFFICIENT_RESOURCES`; the environment recovered and all final browser runs exited successfully.

Changes are local and have not been deployed.
