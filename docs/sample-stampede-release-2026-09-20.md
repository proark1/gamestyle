# Sample Stampede release — 2026-09-20

- Live URL: https://www.jumbleyard.com/sample-stampede
- Published source: 8a3a84e on origin/main.
- Railway deployment: 77d9ce10-9353-40a4-9885-5614a59b620e — SUCCESS.
- Published from isolated `.tmp/sample-stampede-release`, preserving existing Bungee Doubles and Zorb Clash releases and excluding unrelated working changes.
- Validation: 1,505 tests passed; TypeScript passed after rebasing; targeted lint and architecture checks passed; local Railway production build passed; Railway production build and startup succeeded.
- Live verification: game and health endpoint HTTP 200; new start dialog, game start and pause dialog verified in Chrome on the production URL.
- Mobile portrait and landscape were inspected locally during implementation. Physical multitouch and a full manual end-to-end round remain outside this release smoke check.
