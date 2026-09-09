# Player-farmer NPC cows: validation

8 September 2026. Public game: https://jumbleyard.up.railway.app/act-natural

## Delivered behavior

Choose **Player farmer**, create a farm, then use **Add one NPC** or **Fill all empty slots**. One human can start with one, two or three NPC cows. The host can remove individual NPCs in the lobby; friends can replace NPC seats in a full lobby before the round. Farmer duty rotates among humans only. NPCs have no credentials or voice membership, and the last human leaving clears them.

NPC controllers use utility scoring, risk-weighted A*, locally observed farmer positions, brief memory, independent seeded personalities, variable decision delays, grazing pauses, cover and task coordination. Normal game actions, movement speed, collisions, ladder slowdown, electrical shocks and exposure apply to them. The farmer's snapshot never contains their brains, plans or cow identity mappings. See [the design and primary references](npc-cows-design.md).

## Automated evidence

- All **532 project tests** passed, including **63 Act Natural tests** and nine new NPC tests. Type checking, focused lint and formatting checks passed.
- Complete-round regression trials cover 24 fixed seeds, both escape strategies, obstacle clearance, routing at hay corners, finite bounded input, threat response, serialization, private snapshots, atomic capacity, authentication, request replay, human replacement and host lifecycle.
- A separate production build passed. Its 502 existing tests and nine NPC tests passed. HTTP checks passed for both existing four-human game modes and for the new NPC flows.
- The NPC HTTP integration checks adding/filling/removing, idempotency, host-only controls, rejection of forged bot sessions, human replacement, mode cleanup, starting with one NPC, a complete three-NPC escape, private farmer snapshots, solo farmer restart and last-human cleanup.
- That HTTP integration passed locally and on the public production server. The live NPC group completed the unopposed round in **20.5 seconds**. Temporary test players left their rooms afterward.

Re-run the NPC HTTP check with `GAME_TEST_URL` set to a running game origin, using `node games/act-natural/scripts/npc-integration.mjs`. This creates disposable rooms and cleans up its test players.

## Behavioral trials and limits

Sixty seeded simulation rounds used three scripted farmer strategies. When the farmer guarded the ladder, all 20 NPC teams completed the two-key route. Against a patrolling farmer, 19 of 20 teams escaped, with 22 total captures. A farmer guarding the required four-second power-panel task won all 20 trials. This is an effective counter under the current single-panel rules; the NPCs can hesitate and avoid observation but do not receive rule-breaking advantages to defeat it.

These are synthetic scenarios, not estimated human win rates. They show route adaptation, catchability and working objectives. Human playtesting is still needed to judge perceived realism and difficulty. No physical-device or browser interaction testing was performed for this change.

## Published source

While the isolated NPC release was being validated, deployment `11ebc9e2-2d81-4c97-9d43-cd0624f87fd3` published the shared project's Permit Pending mobile update. The pre-upload baseline guard prevented uploading an older source tree. Inspection established that the new deployment already included all eleven final NPC files byte-for-byte, including the final navigation and power-task safeguards.

All 617 source hashes in `.tmp/permit-mobile-release-manifest.json` were verified against `.tmp/permit-mobile-release-20260908`. The eleven NPC files also matched the validated working source. No second deployment or rollback was necessary. The unused `work/act-natural-npc-release-20260908` staging directory was not uploaded.

The public route returned HTTP 200 and served the matching NPC/mobile stylesheet `Game.BHOjBdNu.css`, SHA-256 `fe24808f7a846d62178665ba82b9c10547fcac51a07eb0a30ff2b9ec840021e2`. Deployment status was `SUCCESS`; live API behavior passed the integration above.

Evidence: `work/farm-npc-published-source.json`, `work/farm-npc-live-check.json`, `work/farm-npc-http-live.log`, `work/farm-npc-http-local.log`, `work/farm-bots-all-tests.log`, `work/farm-bots-tests.log` and `work/farm-bots-threat-trials.json`.
