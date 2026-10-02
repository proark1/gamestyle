# Cross-platform runtime production release — 20 September 2026

Live: https://www.jumbleyard.com

- Source commit: `2ffdec6` on `origin/main`.
- Railway deployment: `18be0332-ae26-42ab-82ee-e56a3db64d0c`, **SUCCESS**.
- Built from an isolated checkout of the current production branch, preserving the published Bungee Doubles, Zorb Clash, Sample Stampede, Wrong Floor and other existing releases. Unrelated edits in the shared workspace were not uploaded.
- Release validation: **1,516 tests passed**, TypeScript passed, lint passed, local and Railway production builds passed.
- Live verification: homepage, health endpoint and six representative game pages returned HTTP 200; health reported `ok`.
- Live browser verification: Stack or Sink practice started, the new Graphics panel was present, Battery saver and the 30 FPS setting persisted, and no page JavaScript errors occurred.
- This publishes the browser application. Native store distribution and Steam publishing remain separate release work.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=18be0332-ae26-42ab-82ee-e56a3db64d0c

Local verification evidence: `.tmp/platform-audit/live-runtime.json` and `.tmp/platform-audit/live-runtime.png`.
