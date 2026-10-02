# Party plaza production release — 22 September 2026

Live URL: https://www.jumbleyard.com/party

Release commit: 3395a06 (based on current production main 46389f9).
Railway deployment: e1e33fcb-3ac8-49c1-9ba6-9e85ec9240af — SUCCESS.

The isolated release checkout preserved newer game changes. No force push or deployment safety bypass was used. The startup migration completed and the existing persistent volume remains mounted.

Validation: 112 relevant tests, TypeScript, scoped lint, architecture checks and production build passed. Live health, party, boxing and Chain of Fools routes returned 200. Anonymous inventory access returned the expected 401. The public-site two-player browser test passed movement, browsing, try-on, coin purchase, equip, reload persistence and desktop/mobile layouts. Temporary guest seats left afterward. Live screenshots are in .tmp/plaza-release/docs/plaza-qa.

This release does not enable real-money checkout or paid admission. Signed-in inventory was tested against an isolated local SQLite database before deployment; the live smoke test used guests and did not create customer accounts or charge money.
