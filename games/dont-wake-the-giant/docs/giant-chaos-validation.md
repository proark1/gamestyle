# Giant chaos validation — 2026-09-06

Implemented height-sensitive player and item impacts, carried bulk/rattle, quieter crouched landings, pillow cushioning, momentum-preserving airborne release, and quiet handoffs to nearby grounded teammates. Handoffs prefer an eligible teammate below, then proximity, and reject blocked furniture crossings. The keyboard context action and mobile Pass button use the same authoritative rules. Both HTTP rooms and the new peer engine accept explicit pass actions.

Also added a full standing stage driven by the existing escape deadline and fixed event-source spreading that previously overwrote numeric event IDs and noise kinds with item/player fields. The HUD now shows substantial noise events and their causes. No world-state schema migration is required.

## Completed checks

- Full regression suite: 189 tests passed before the final peer-checkpoint case was added.
- Giant simulation and chaos checks: 31 passed, including the original crown and necklace routes, true impact-triggered waking, serialization, handoff chains and concurrent HTTP retries. The final targeted chaos suite passed all 10 cases, including the added peer-host handoff and recovery-checkpoint replay test.
- Type checking and targeted Oxlint passed.
- Node/Railway production build passed. Existing Vite configuration/chunk-size warnings remain non-blocking.
- Four-client Giant HTTP integration passed against the development server at `http://127.0.0.1:3003` and the production build at `http://127.0.0.1:3004`. It now verifies a quiet handoff and return, retry protection and subsequent banking, as well as the existing route, capacity, authentication and stale-input checks. Temporary test rooms were left.

## Release status

The user explicitly requested publication after the initial local handoff. A fixed release copy was prepared at `work/giant-live-release-20260906`, including the completed human movement refinement and current audio/peer code. All 220 tests, type checking, the Node/Railway production build and the Giant four-client local WebRTC integration passed in this copy.

Railway deployment `82da5767-244b-4b86-9221-f5979461e776` reached `SUCCESS` on 2026-09-06. The game is live at https://stack-or-sink-production.up.railway.app/dont-wake-the-giant. Production `/api/health` returned `ok`, and the four-client Giant HTTP integration passed against the public origin, including quiet handoffs, transfer retries, return passing and banking. Four real local WebRTC clients also passed against the live room coordinator, including generated audio transport, abrupt host recovery, preserved rounds and join-order handover. Temporary test rooms were left. The existing browser preview was redirected to the public game through Codex.

The local preview was opened through Codex. Browser visual QA, a human multiplayer playtest and physical mobile-device testing were not performed. The production verification server is stopped at handoff; the development preview remains available for the ongoing model work.
