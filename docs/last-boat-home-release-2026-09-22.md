# Last Boat Home production release

Date: 22 September 2026

Live: https://www.jumbleyard.com/reel-problems-2

Release commit: `3199b07` (survival implementation `42df05d`, merged with the current multiplayer/voice production updates).
Railway deployment: `c2c285c9-6102-4850-bdd6-e6dbcb958806` — SUCCESS.

Checks: 1,642 repository tests passed; TypeScript and production build passed. Live homepage, health, original game and Reel Problems 2 returned HTTP 200. Live test players created/joined a room and left successfully. Chrome started Last Boat Home on the public site and advanced the giant fight with keyboard input without page errors.

The root working tree's unrelated changes were not deployed. Release source is preserved in `work/reel-problems-2-release` and on origin/main.
