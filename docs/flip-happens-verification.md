# Flip Happens verification

24 September 2026. Implementation follows the approved [design](superpowers/specs/2026-09-24-flip-happens-design.md).

- `npm run check`: formatting, TypeScript, lint, architecture and **1,987 tests passed**. Nineteen game-specific tests cover scoring, all six objects, host timing, multiplier bounds, heavy impacts, daily determinism, rematches, finite bounded physics, input validation, ownership transfer and host migration.
- `npm run build:railway` and `npm run build:client`: passed.
- `node games/flip-happens/scripts/browser-check.mjs`: desktop timed landing, bank, intentional failed throw, keyboard controls, help, complete daily round, rematch and persisted personal best passed. German emulated mobile verified touch aiming, object selection and a held/released washing machine throw. No JavaScript errors or failed local HTTP requests.
- `PEER_TEST_URL=http://127.0.0.1:4183 node scripts/peer-integration.mjs flip-happens`: four real WebRTC clients agreed on aiming, object selection, an upright washing machine landing and banked score. Generated voice audio, abrupt host recovery, preserved round and graceful host handover passed.
- The card image is a real capture of the new game, with a heavy landing and airborne props.

Physical phones and restrictive networks were not tested. The daily best is local to the device, not an online leaderboard. Existing build warnings about shared chunk sizes remain.

The game is prepared on branch `codex/flip-happens`, based on the current main branch containing the live Castle release. Local production preview: http://127.0.0.1:4183/flip-happens. It has not been deployed publicly. Detailed local logs and captures live in this checkout's ignored `.tmp/` folder.
