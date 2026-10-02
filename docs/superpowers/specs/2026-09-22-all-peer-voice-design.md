# One peer voice transport

The user explicitly chose the existing peer voice system for every game and cancelled LiveKit setup. All shared voice panels load the peer client. Games already using PeerGameConnection keep sharing their existing mesh; server-authoritative and legacy game sessions use the same PeerMesh with an authenticated signaling request adapter. Gameplay transports remain as they are.

The new /api/voice/peer endpoint validates the real game membership and token on every request. Signaling rooms use separate game-qualified storage keys and optimistic concurrency. Only hello, poll, signal and leave are accepted. Existing signal validation, queue limits, ICE configuration, offer/answer logic and audio track handling are reused. No microphone audio passes through the application server.

Voice members expire after 15 seconds without a heartbeat and immediately disappear from subsequent signaling views when their game membership is revoked. Browser instances fence stale tabs, rejoining clears obsolete signals, and leaving voice does not leave the game.

The peer client retains proximity attenuation, radio override and explicit per-player recording consent. Existing push-to-talk controls and microphone preparation are retained. Tests cover room isolation, authentication, revoked membership, stale instances, signal deduplication, proximity/consent and real two-browser audio/PTT for all three server games plus the existing game mesh. Legacy LiveKit endpoints remain backward-compatible for old clients but the current game UI never selects them.
