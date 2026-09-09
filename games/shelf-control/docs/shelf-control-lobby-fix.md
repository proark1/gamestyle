# Shelf Control lobby button fix

The shared-style update put `!active` in the same pause flag used by both scene movement and the room action callback. Since the lobby is not an active round, `Add NPC`, remove NPC, fill/start and replay all returned before sending a request. The buttons looked enabled and gave no feedback. Server-level integration tests did not exercise this client callback.

Reproduced on the live page through the actual browser: created a temporary room and clicked `Add an NPC to the room`; the roster stayed unchanged.

Fix: pause room actions only for instructions, the join dialog or a disconnected connection. Independently pause scene input when no round is active. The menu remains stationary while host controls work. The same fix is applied to the reorganized working source and the existing live-source layout; unrelated unpublished refactor work is excluded from the release.

Regression checks passed through the browser on the local production build: add an NPC and confirm its named roster entry; remove it; add another; fill remaining seats and start. All three NPCs escaped, and clicking `Next shift` started round two with the human playing a mannequin. The temporary local room was left afterward.

Live release `56df56e4-52fa-4315-af0c-17abd46a1262` reached SUCCESS on 2026-09-08. Reloaded the exact previously broken live lobby, added Oakley by clicking, removed Oakley, then clicked fill/start and observed the 15-second hiding countdown. This verifies the real client action callback, not just the server API.

TypeScript and focused lint passed on the reorganized working source. The isolated production build and all 502 release tests passed. The release started from live version `86be90b3-bc20-4815-a262-febfead9d5e5`, verified 537 source files, and changed only `game/shelf-control/Game.tsx`. The other 536 source files match that live baseline. Release manifest: `work/shelf-control-lobby-fix-release-manifest.json`.
