# Shelf Control: invited NPC players

User request, 8 September 2026: the room creator can invite NPCs to fill the four seats and start, with capable opponents/teammates that make play fun. This extends the approved game; four seats may now contain one to four humans plus zero to three invited NPCs. The fifteen ambient showroom mannequins remain decoys.

## Chosen approach

Use deterministic server-side behaviour and navigation, sharing the existing movement, interactions, collision, visibility and inspection rules. Simple wandering would not complete the escape objectives; a remote language-model service would add latency and a new service dependency. Local goal selection with observation memory gives responsive, testable teammates and opponents.

The host can add one NPC per empty seat, remove an NPC between rounds, or fill all remaining seats and start in one action. Starting otherwise remains manual. Human joiners replace an NPC in a waiting room when necessary; occupied human seats are never replaced. The guard continues rotating through all four seats. Only humans can host or authenticate. Bots disappear when the last human leaves. Existing human departures still end the current round.

## Behaviour

Mannequin bots prepare a hiding position, share task intentions to avoid duplicating jobs, disable security, collect keys or the ladder, deliver equipment and use a ready exit. They learn item changes through their own view, react to a visible guard with delayed posing or retreat to cover, and reassign unfinished jobs when another bot is captured. They use the same speeds and action distances as humans.

The guard bot receives only the same filtered snapshot as a human guard. It patrols public showroom locations, builds suspicion from visible carried equipment, sabotage and sustained movement, and inspects only nearby visible figures. It has a reaction delay, remembers last-seen locations rather than following hidden coordinates, avoids repeatedly inspecting a cleared display and can make occasional plausible wrong guesses. Its decision function cannot access player-to-figure ownership or global item state.

Navigation uses a static walkable graph around shelves, with paths cached in each bot's private state and recomputed on goal changes, obstructions or recent visible danger. Decisions run at a limited rate; steering follows the path during normal simulation steps. Bot identity appears only in the lobby roster, never as an in-world marker. Private bot plans, memories and role mappings never enter client snapshots.

## Verification and release

- Verify host-only seat controls, authentication, concurrent joins/fills, removal, empty-room cleanup and compatibility with old persisted rooms.
- Verify both bot roles, collision-safe routes, meaningful escape progress and guard decisions independent of hidden state.
- Run seeded complete rounds to check that bots finish tasks, escape when unopposed, react to visible danger and do not get permanently stuck.
- Run the full suite, typecheck, focused lint, production build and real HTTP checks with one human plus NPCs and mixed crews.
- Publish this requested enhancement to the existing live game, preserving unrelated source and all existing audio. The user's public-publication authorization remains in effect.
