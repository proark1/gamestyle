# Party Mode production release — 22 September 2026

Live: [Jumbleyard Party Mode](https://www.jumbleyard.com/party).

- Source: [`cee84121761bad6da469c204b25c7b2a2fe6d8e5`](https://github.com/proark1/gamestyle/commit/cee84121761bad6da469c204b25c7b2a2fe6d8e5), pushed to `origin/main`.
- Railway deployment: [`4d912075-256c-43d6-851f-ac4178d6a0b8`](https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=4d912075-256c-43d6-851f-ac4178d6a0b8), **SUCCESS**.
- Released the current application changes, including the approved [Party Mode improvements](party-mode-implementation-2026-09-22.md) and On the Ropes. Merged the latest production branch and preserved the newer Chain of Fools gauntlet.
- Used the clean isolated checkout `.tmp/party-mode-live-release`; the shared working tree and its Git history were preserved.

## Validation

- Full repository checks passed: formatting, TypeScript, lint, architecture and **1,812 tests**.
- Release verification caught and corrected a server/client rendering mismatch in embedded party room/voice controls. The subsequent **126 targeted regressions**, TypeScript, lint and formatting checks passed; the production browser repeated the flow without JavaScript errors.
- On the Ropes now uses the shared reduced-motion query constant, satisfying the existing rendering architecture test.
- Final Railway production and installed-client builds passed. Railway's own build and production health check passed. Existing build-size and wardrobe import warnings remain nonfatal.
- The local production server passed a two-browser Stack or Sink party walkthrough and a separate Carry-On Carnage hydration check.
- Live verification passed the health/database endpoint, homepage, Party Mode and **all 25 game routes**.
- Two browser players completed the live **Crane Clash** party flow: invitation, Quick Party, readiness gate, briefing, shared break/resume, game launch, push-to-talk from the game frame, confirmed zero-point forfeits, preserved voice into intermission, three visible vote choices, unanimous lock-in and the next briefing. No JavaScript errors. Test seats were removed afterward.

The live browser check used synthetic microphone input and desktop/phone-sized Chromium windows. It does not establish physical microphone quality, phone performance or restrictive-network connectivity.

## Evidence

- [Live lobby](party-mode-release-2026-09-22/live-party-lobby.png), [shared game](party-mode-release-2026-09-22/live-party-game.png), [voting](party-mode-release-2026-09-22/live-party-vote.png)
- [Live party check](party-mode-release-2026-09-22/live-party-verification.json), [route checks](party-mode-release-2026-09-22/live-routes.json), [Railway status](party-mode-release-2026-09-22/railway-deployment.json)
- Full local logs: `.tmp/party-mode-live-release/.tmp/release-logs/`.
