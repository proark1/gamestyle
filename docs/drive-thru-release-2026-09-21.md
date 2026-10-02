# Drive-Thru production release — 21 September 2026

- Live: https://www.jumbleyard.com/drive-thru
- Source: `bf26fa9`, pushed to `origin/main`.
- Railway deployment: `2b56c725-e4b0-40c1-97ca-8494470d25e9` — SUCCESS.
- Released from `.tmp/drive-thru-release`, an isolated checkout of current main with only the Drive-Thru changes. Existing live releases and unrelated local work were preserved.
- Validation on release checkout: all 1,531 repository tests passed, TypeScript passed, scoped lint passed, architecture check passed, local Railway production build passed.
- Railway production build and health check succeeded. Public health endpoint and game route returned HTTP 200; health reported `ok`.
- Live browser verification: new opening dialog, game start, teal/ivory sedan, diner windows and landscaping, driving pedals, speed/parking guidance rendered. No console errors observed.
- Full order completion and mobile layout were verified locally before deployment; the production browser check was a startup/render smoke check.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=2b56c725-e4b0-40c1-97ca-8494470d25e9
