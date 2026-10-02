# Bungee Doubles production release — 2026-09-20

Live: https://www.jumbleyard.com/bungee-doubles

- Source commit: a7d56ce (pushed to origin/main).
- Railway deployment: a8777544-e1a0-45fe-8919-d57dd146fb5a, status SUCCESS.
- Released from an isolated checkout of current main with only the Bungee repair scope and required shared helpers. Unrelated workspace changes were not uploaded.
- All 1,479 repository tests passed, plus TypeScript, lint, architecture checks and the full Railway production build.
- Production health endpoint and game page returned HTTP 200. Startup logs confirmed database readiness and the server running on port 8080.
- Live browser checks confirmed the updated controls, serving, score progression, team switching and help dialog.
- Desktop, 390×844 portrait and 844×390 landscape rendering checked. Landscape document dimensions matched the viewport, with no visible buttons outside it. No browser errors were captured during the verification.
- Physical iPhone/Android multitouch, audio policies and device performance remain outside these browser viewport checks.

Railway logs: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=a8777544-e1a0-45fe-8919-d57dd146fb5a