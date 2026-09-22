# Chain of Fools polish

Implemented locally on September 22, 2026. Existing workspace changes were preserved; no deployment was performed.

## Gameplay

- Extended the finish from 146m to 174m, with staggered cargo obstacles, a narrow bridge and final gap, two clip rings, two additional checkpoints and a 4:30 time limit.
- Added English/German section guidance, crew distance remaining, checkpoint counts and painted course arrows. Fixed mobile prompt overlap and synchronized the camera label with keyboard camera changes.
- Full-height body collision replaces feet-only wall checks. Small swept movement increments apply to walking, rope corrections, rescues and hazard movement. Scaffold posts, rails and the office are solid. The plank's support height matches its rendered rotation and its sides/underside block workers.
- Rescues lift workers outside solid deck edges before pulling them onto the deck. Net jumps release correctly. Clipped workers remain stationary. Normal jumps retain their movement control over gaps. Diagonal input no longer increases speed.
- Hanging crew weight still pulls an unbraced worker off the edge; braced teammates can hold and rescue. Bots follow a human onto the lower route and complete the extended course.
- Finish detection requires standing on the office pad. Completed workers remain fixed rope anchors. Finish score/time stay fixed, replays reset temporary state, and multiplayer joins/leaves replace workers in place rather than spawning a link back at the gate.

## Verification

- 59 game/audio/regression tests passed, including complete bot runs at 30, 60 and 120 Hz with solid-overlap assertions on every frame.
- Chain of Fools peer adapter test passed: detached snapshots, party startup, delta reconstruction and checkpoint recovery.
- TypeScript, scoped lint, architecture boundaries and formatting of all 14 edited source/test files passed. The whole-directory formatting check also reported five files outside this change; these were left untouched.
- Browser inspection covered the live baseline, local start flow, desktop and 390×844 phone HUD, and a temporary rendering of the extended course. No browser JavaScript errors were reported. Temporary preview fixture was removed.
- Production client build output is isolated in `.tmp/chain-build`; build log is `.tmp/chain-final-build.log`.

The collision regressions cover the observed failure paths and normal course traversal; this does not claim exhaustive proof of every possible multiplayer or physics state. Browser multiplayer across separate devices was not exercised.
