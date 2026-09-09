# Uphill Delivery NPC implementation

Design approved by the user on 2026-09-08. Implement directly; no further design approval is pending. The referenced writing-plans skill is not installed; this plan records the execution steps.

1. Add validated, idempotent NPC slot operations to HTTP and peer rooms. Reserve slots atomically with human joins. Add optional peer roster reconciliation and checkpoint revision fencing. Verify capacity, authority, replay and host recovery.
2. Add persistent NPC state, game-local navigation and cooperative control before each physics step. Preserve normal actions, collisions and forces. Exercise collection, grips, turns, hazards, panels, delivery and recovery with simulated real bodies.
3. Add four lobby slots, host add/remove/fill controls and public NPC task indicators. Filter NPCs out of voice membership. Reuse existing style and controls.
4. Run complete deliveries and mixed-crew physics scenarios, targeted networking tests and integration checks. Fix failures before broad checks.
5. Run repository checks and Worker/Node builds, document measured results and any limitations. Inspect existing Sites access before any hosting handoff.

NPC IDs, positions and actions must never be accepted as arbitrary client-controlled entities. No teleportation or completion shortcuts. Other games retain their existing peer behavior.

## Execution status

- Steps 1 and 3 implemented and verified, including real browser mixed-crew host handover.
- Step 2 implemented with corrected carrying formation, reachable recovery grips, higher-bank support, sequential gap crossing, panel clearance, human rotation/priority and different regroup assignments. Follow-up work adds simultaneous human-led lifts, anticipatory turning, balanced two-person grips with gap/recovery exceptions, route reconciliation for human backtracking and bypassed waypoints, halt-safe gap departures, alternative panel interaction positions and flexible placement inside the room.
- Step 4: all five autonomous depot-to-house variants deliver through normal physics within 600 simulated seconds (278.58, 588.00, 199.58, 345.45 and 326.28 seconds), including after the final corrections. All six mixed sizes carry and halt in short real-physics tests; 37 behavior tests cover the interaction and recovery cases. The independent human-seat pilot and 30-case matrix runner record source, driver and input hashes. The latest complete matrix delivered 9/30, so complete mixed-crew acceptance remains open. Subsequent corrections retain failed-grip memory during human regripping and cancel obsolete gap crossings after cargo falls. These have regression tests and separate targeted route reports; scripted controls are not a human playtest.
- Step 5 checks and evidence are recorded in [the validation report](../validation/2026-09-08-uphill-delivery-npcs.md). The existing private Sites project was inspected; no deployment was performed.

The five autonomous scenarios pass. The full design acceptance remains open because the complete mixed-crew route matrix has not passed. Do not describe that broader matrix or human playtesting as complete.
