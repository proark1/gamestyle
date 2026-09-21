# Reel Problems 2

Experimental copy of Reel Problems, made from the working tree on 2026-09-21, including its current local changes. Play at /reel-problems-2; sound workshop at /reel-problems-2/admin.

The first playable campaign mission, **First Delivery**, is implemented: catch and deliver three fish in eight minutes, manage a hull leak, and rebuild a four-part emergency raft if the boat sinks. An optional solo deckhand helps fish, repair, and rebuild. Classic tournament mode remains available.

Choose a destination with the Fish / Café / Repair buttons (keyboard 1 / 2 / 3). Hold C or the work button to unload, repair, recover cargo, pick up materials, attach parts, and launch. Walk with WASD; existing fishing controls remain available. Completion and best time are saved locally.

This is Milestone A of the approved campaign-first plan. Additional chapters, competitive 2v2, and the final art pass are future milestones, subject to playtesting this mission.

The game implementation is independent in this folder. Rooms, preferences, sessions, audio workshop and analytics use reel-problems-2. Shared platform code, avatar utilities and existing public images remain shared. It is excluded from the party rotation.

Run: node scripts/test.mjs games/reel-problems-2

See [First Delivery validation](docs/first-delivery-validation.md) for this implementation's checks and limits. Other copied documents in docs/ are historical validation for the original game.
