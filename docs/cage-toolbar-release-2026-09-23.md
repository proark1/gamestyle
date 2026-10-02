# Cage Clash and shared toolbar production release — 23 September 2026

Live: https://www.jumbleyard.com/cage-clash

- Release commits: `52ccd56` (game and shared menus), `c17bb96` (mobile settings CSS specificity).
- Final Railway deployment: `d2880be4-b16c-48ab-b593-2e6bb474d482`, SUCCESS.
- Released from `.tmp/cage-toolbar-live-release`, based on latest main with persistent crews preserved. Unrelated changes in the shared workspace were left untouched.
- Cage Clash: buffered strikes, clearer punch paths, close grappling camera, corrected face-up bottom / facing top poses, clearer position and submission feedback.
- Shared menus: compact main actions, grouped settings, full-width mobile settings rows including when account controls are enabled.

Validation:

- Full check passed: formatting, TypeScript, lint, architecture, 1,886 tests.
- Production build passed, including a new build after the CSS-only follow-up.
- Two real WebRTC clients passed locally and against production: hidden selection, simultaneous reveal, generated voice audio, strike damage, guest takedown, abrupt host recovery and bot replacement.
- Production health returned `status: ok` after the final deployment.
- Live desktop settings and 390px mobile settings visually verified. A production-only account selector conflict found during verification was fixed and redeployed; final mobile labels and rows are readable.
- Earlier UI validation covered all 26 game pages and special embedded menus at desktop, 390px and 320px widths.

Evidence logs: `.tmp/cage-toolbar-live-release/.tmp/release-logs/`.
Physical phones, physical microphones and restrictive networks were not part of these checks.
