# Host handover

The succession rule is join order: when the host leaves, the earliest-joined remaining connected player becomes host. Skip players who have also disconnected. If a former host rejoins with a new session, that player joins the end of the queue and does not reclaim hosting. An empty room has no host.

## Current implementation

New rooms in all four games use player-hosted simulation. The host's browser runs the existing game rules and sends each player snapshots over WebRTC data channels. Inputs and actions go directly to that host. Voice uses a separate audio track on the full mesh of peer connections, so surviving players keep talking when the game host changes.

`/api/peer` is a small shared coordinator for room codes, authenticated membership, connection signalling, host leases and encrypted recovery checkpoints. It runs on either the existing Node/SQLite backend or Cloudflare/D1. It does not simulate new games or carry their normal gameplay frames or voice. The web application and coordinator must remain reachable independently of any player's device; stopping a laptop that also runs the only web server cannot migrate that web server to another browser.

The host renews an eight-second lease. Expiration is checked before the caller's heartbeat is accepted, preventing a returning old host from reviving expired authority. The coordinator elects the earliest-joined member with an established browser session and a fresh heartbeat using atomic compare-and-swap writes. Stale members are skipped. Packets carry a host generation, and clients reject expired authority and old generations. Reloading the host also rotates its generation; stale tab instances lose access.

## Recovery

The host saves a complete checkpoint approximately once a second and before acknowledging actions. It contains simulation time, physics state, random state where applicable, roles, input sequence positions and recent action receipts. Checkpoints are encrypted with AES-GCM and bound to the game, room, generation and sequence. Only the elected host receives the recovery key; ordinary clients continue receiving their game-specific public views. The host necessarily has access to the full simulation, including Blend Business's hidden roles. This is intended for trusted small groups, not cheat-resistant competitive hosting.

- Using Leave game saves a final checkpoint before releasing the host. Remaining clients normally see the new host within the next one-second poll, plus network and restoration time.
- Closing the tab or losing connection triggers recovery after the eight-second lease expires. The round resumes from the latest saved checkpoint without changing its room code or resetting the round. Unsaved movement can roll back, normally by about one second when checkpoint writes are healthy; network failures can increase that window.
- Simulation time pauses during recovery, and held movement/jump inputs are cleared. Repeated actions use saved receipts so acknowledged actions are not executed twice.
- In Blend Business, a departing farmer passes the role to the next remaining player and retires that player's cow without resetting the active round. Normal win/loss rules still apply when too few players remain.
- Surviving peer audio links do not depend on the elected host and remain in place during handover.

## Compatibility and verification

Existing server-hosted sessions keep their original transport and optional LiveKit voice. New browser-created rooms use the peer transport automatically. A missing peer room code can fall back to the old room namespace for existing invitations.

`shared/peer/coordinator.test.ts`, `shared/peer/engine.test.ts` and `shared/voice/peer-client.test.ts` cover election, concurrent writes, authentication, checkpoint secrecy and integrity, role/state recovery, action retries and microphone permission races. `npm run test:peer` creates four real native WebRTC clients per game, sends generated audio, crashes the first host and then leaves the second host. It verifies preserved round state, ordered succession and uninterrupted surviving voice links. Set `PEER_TEST_URL` to a running server's origin to test the real HTTP coordinator and database; otherwise it uses an in-memory coordinator. See [voice validation](voice-validation.md) for scope and limitations.
