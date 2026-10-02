# All-peer voice validation — 22 September 2026

Every game now selects the existing shared peer voice client. Chaos, Brick by Hand and Shelf Control keep their server-authoritative gameplay but authenticate voice signaling against those rooms. No LiveKit account, API key or service is required by current game clients. Older LiveKit endpoints remain only for compatibility with old clients.

Checks completed:
- 44 voice and peer tests: permission races, push-to-talk, room membership, cross-game isolation, expired/revoked credentials, stale browser instances, rejoining, signal bounds/deduplication, proximity, radio and recording consent.
- Two real Chrome contexts passed audible remote audio in both directions and silent mute/PTT release for each of Chaos, Brick by Hand and Shelf Control, plus the existing peer gameplay path. Includes rejoin, device permission, playback recovery, per-player volume, keyboard/pointer overlap, blur, typing/modifier exclusions and touch cancellation.
- TypeScript, scoped lint, architecture boundaries and the Railway production build passed.

The three game cases use the actual peer client, PeerMesh and new signaling coordinator with in-memory room storage and synthetic microphones. These checks do not test physical sound hardware or two separate internet connections. The existing shared ICE/TURN configuration still applies to all games.

Reproduce: `npm run test:voice:browser -- --ui --server-room=chaos` (or `first-person`, `shelf-control`); omit `--server-room` for the existing shared gameplay mesh.
