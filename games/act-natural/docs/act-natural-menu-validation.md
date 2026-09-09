# Act Natural menu correction — 2026-09-08

Removed the constrained inner scrolling panel. The home menu now uses normal document flow, with reduced spacing, compact type on short/narrow viewports, and accessible controls. Very small viewports retain normal page scrolling rather than clipping controls. Gameplay layout is unchanged.

Only `games/act-natural/style.css` changed in the release. The frozen source contains all 537 files from the previously live farmer/fence release, with this stylesheet overlaid. Other work in the shared checkout was excluded.

- Baseline deployment: `94cf205d-2fe9-4e17-af32-e6a6468e499a`.
- Successful deployment: `86be90b3-bc20-4815-a262-febfead9d5e5`.
- Frozen source: `work/act-natural-menu-release-20260908`.
- Manifest: `work/act-natural-menu-release-manifest.json`.
- Scope: `work/act-natural-menu-release-scope.json`.
- Production build passed; log: `work/farm-menu-build.log`.
- Public route returned HTTP 200, and its referenced menu stylesheet exactly matched the built stylesheet SHA-256; result: `work/farm-menu-live-check.json`.
- No browser layout testing was performed.

Live: https://jumbleyard.up.railway.app/act-natural
