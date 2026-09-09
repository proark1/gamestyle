# Invited NPC players — 8 September 2026

The host can add/remove NPCs in the lobby or fill the remaining seats and start immediately. Humans can replace NPCs between rounds. Only humans can hold hosting rights or authenticate. Bot players rotate into the guard role, preserve the same movement and interaction limits as humans, and never carry their previous role's memory into another round.

Mannequins share escape jobs, navigate around shelves, observe equipment changes locally, pose briefly under scrutiny and move toward cover when watched for too long. They deliver keys or a ladder, switch security off, and escape. The guard patrols, reacts with a delay to visible theft/sabotage, follows last-seen positions, checks exits after observing missing equipment, and does not read hidden ownership, coordinates or objective progress. Visible sabotage now animates the mannequin's arm so its activity is also legible to a human guard.

## Automated checks

Seventeen new tests cover NPC seat controls, host-only permissions, replay, authentication, join/fill races, replacing a bot with a human, expiry, host transfer, last-human cleanup, old-room compatibility, navigation, task reassignment, private snapshots, reaction delays, pursuit memory, capture rules and guard decisions independent of hidden state.

Twenty-four complete deterministic rounds verify that all three NPC mannequins escape against a stationary guard, remain outside collision rectangles and use both escape routes across the set. An additional capture scenario verifies that the bot guard catches a visible equipment carrier through the normal inspection action. These are behaviour checks, not a human balance playtest.

Type checking and focused lint pass. The local real-time HTTP check passed seat management, replay, NPC authentication rejection, a full NPC escape with one human observer, an NPC guard with a human teammate, host transfer and cleanup.

## Published verification

Railway deployment `64e42406-41a7-4520-b739-01ec81d4791d` reached `SUCCESS` on 8 September 2026 at https://jumbleyard.up.railway.app/shelf-control. The existing public service and persistent volume were retained.

- The frozen release in `work/shelf-control-bots-release-20260908` starts from the hash-verified 512-file Shelf Control deployment `ef581548-41da-4650-831f-f9157023b54f`. It adds only the NPC feature scope; hashes for all 518 release files are recorded in `work/shelf-control-bots-release-manifest.json`.
- The exact release passes all 480 tests, TypeScript, focused lint and a fresh Node production build. The original four-human integration and new NPC integration both pass against the built server. Test/build logs are in `work/shelf-control-bots-release-tests.log` and `work/shelf-control-bots-release-build.log`.
- The public HTTPS NPC integration passed. A host added and removed a bot, replayed an add safely, filled and started with three bots, and observed an NPC complete an escape. A second room verified human host transfer and an NPC guard with a human teammate. Temporary test players left afterward, clearing the remaining bots.
- All seven public game routes and the health endpoint return HTTP 200. The collection and Shelf Control entry page advertise one to four humans with NPC support.
- All 336 existing audio entries, recording URLs, per-cue volumes and category settings match the pre-release manifests exactly. Comparisons are saved in `work/shelf-control-bots-live-before.json` and `work/shelf-control-bots-live-after.json`. No sound generation was performed.
- No browser visual QA or human balance playtest is claimed. The validation covers deterministic behaviour, private information, real room connections and complete NPC objective execution.

## Reverified after the shared-toolbar release

On 2026-09-08, the user's request to confirm four-player multiplayer and host-controlled NPC slots was checked against the current live Shelf Control game. Both requested NPC controls were already present, so no gameplay implementation or deployment change was needed.

- The four-client live integration passed: four independent authenticated HTTP clients joined the same room, synchronized through the 15-second hiding phase into play, received one guard and three mannequin roles, changed pose, enforced room capacity and private snapshots, and returned to the lobby on a player departure. It completed 67 synchronized updates.
- The live NPC integration passed: the host added and removed a single NPC, replayed an add without duplicating a seat, filled all remaining seats and started with three NPCs. An NPC completed an escape against the idle human guard. A second room verified an NPC guard, a human teammate, human host handover, rejection of non-host seat management and rejection of NPC authentication.
- All temporary test players left their rooms and NPC cleanup completed.
- All 42 current Shelf Control tests passed, including human replacement of a waiting NPC, concurrent joins/fills, host-only controls, role rotation, navigation, both escape routes, bot fairness and network prediction.

The lobby exposes **Add NPC** on each open place and **Fill with NPCs & start** for all remaining places. Only the host can manage those places. Four is the total seat limit across humans and invited NPCs; the showroom's ambient display mannequins do not consume seats.

These results establish live API/client synchronization and automated NPC behaviour; they do not claim a four-person manual browser playtest.
