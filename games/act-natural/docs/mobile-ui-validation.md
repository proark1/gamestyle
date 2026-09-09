# Mobile UI release — 2026-09-08

Implemented compact role/time/Plan/menu header, an inline visibility/objective status, on-demand objective/herd/player details, contextual touch actions, conditional Drop, separated thumb controls with movable joystick feedback, and input clearing while menus/dialogs are open. Voice remains mounted when its menu closes. Active-round notices expire after five seconds, and touch play omits idle and keyboard hints. Lobby and dialogs respect dynamic viewport height and safe areas; short landscape screens retain the two thumb zones.

Validation:

- TypeScript and focused lint passed on the reorganized working source.
- All 54 Act Natural tests passed, including six new contextual-action checks covering real pickup/unlock/power/escape/ladder actions, exposure and farmer inspection availability.
- Those six tests also passed against the existing production source layout.
- The isolated Node production build passed (`work/farm-mobile-v2-build.log`).
- Public `/act-natural` returned HTTP 200. The referenced new CSS matched the built asset exactly (`work/farm-mobile-live-check.json`).
- Refreshed the existing preview tab after publication. No browser layout/interaction testing or physical-device testing was performed.

Production:

- Successful deployment: `84d87bfa-b988-4693-9cbe-adcc8bc13bfe`.
- Preserved baseline: `56df56e4-52fa-4315-af0c-17abd46a1262` (Shelf Control lobby fix).
- Frozen source: `work/act-natural-mobile-release-v2-20260908`.
- Manifest: `work/act-natural-mobile-release-v2-manifest.json` (541 files).
- Scope: `work/act-natural-mobile-release-v2-scope.json`.

Only Act Natural's Game component and four new local UI/helper/test files changed. Current workspace paths are `games/act-natural/`; the live baseline still uses `game/act-natural/`. Release staging maps only the existing Sound/toolbar adapters back to that layout, excluding the unrelated unpublished repository refactor. Other deployed games, assets and runtime storage were preserved.

Live: https://jumbleyard.up.railway.app/act-natural
