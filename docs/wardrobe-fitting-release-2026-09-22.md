# Wardrobe fitting release — 22 September 2026

Live: https://www.jumbleyard.com

- Commit: `2d8855d77cd102bef62b61c7a8e6ccc0d66ee754`, pushed to `origin/main`.
- Railway deployment: `79b58250-614d-461e-9be7-f5c145ac5970`, SUCCESS.
- Isolated release checkout: `.tmp/wardrobe-live-release`.
- Preserved the latest production clothing models and farmer changes. Applied helmet/cap fitting, front/back sash wrapping, rounded shoe soles, Golden Kicks surface separation, visible snorkel and lower beard cheek edges.
- Validation: 36 avatar/wardrobe tests passed; TypeScript, scoped lint and production build passed. Front/rear lineup visually inspected using the production models.
- Live verification: `/api/health` returned `status: ok`; homepage returned HTTP 200. Public wardrobe opened, rendered its canvas and displayed Viking Helmet, with no page JavaScript errors.
- Evidence: `docs/wardrobe-fit-qa/lineup.png`, `docs/wardrobe-fit-qa/live.png`; production build log in `.tmp/wardrobe-live-release/.tmp/release-logs/build.log`.
