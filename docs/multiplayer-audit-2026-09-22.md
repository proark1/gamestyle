# Multiplayer audit — 22 September 2026

The collection currently contains 24 games: 21 use the existing peer transport and three (Chaos, First Person, Shelf Control) use existing server-authoritative rooms.

## Implementation

Connected the missing room interfaces in Basketball, Carry-on Carnage, Chain of Fools, Crane Clash, Drive-Thru, Panic Curling, Sample Stampede, Scaffold Scramble and Zorb Clash. Bungee Doubles was connected in the preceding change.

The integrations reuse PeerGameConnection, enterPeerRoom, session storage, invite links and VoicePanel. The shared room controls provide creation, joining, invitations, reconnect status, reload restoration and leaving back to solo. Inputs and game actions go through the existing game adapters; local simulation stops when a room is attached.

Fixed Zorb live admission and four-player team balancing; Sample Stampede NPC replacements and full rematches; Drive-Thru's missing undo action. Page navigation now uses the existing suspended-member grace period so slow 3D reloads retain a player's seat.

## Validation

- Full automated suite earlier in the audit: 1,620 passed, zero failed, including the server-room games.
- Real four-client WebRTC integration passed for all 21 peer adapters, including the experimental Reel Problems 2 copy. Checks cover snapshots, direct generated audio, abrupt host recovery, retained round state, surviving voice links and graceful host handover.
- Type checking and the production client build passed. Focused peer-engine, coordinator and new multiplayer regression tests passed after the final implementation changes.
- Browser checks use desktop and mobile Chromium contexts against the production build and the real in-memory coordinator. All nine newly connected games passed create, invite join, two-player snapshots, reload, leave to solo and invalid-code recovery. The final browser runs use a real local HTTP coordinator and frozen production assets to preserve navigation keep-alive requests and avoid interference from concurrent builds.

The Windows native WebRTC test binding occasionally emits an invalid numeric sdpMLineIndex. The test harness clears only invalid indices when a valid sdpMid is present; production candidate validation is unchanged.

These are local changes. No deployment was performed. Physical devices and restrictive external networks were not tested.

