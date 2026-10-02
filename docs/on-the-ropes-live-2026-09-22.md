# On the Ropes production release

Live: https://www.jumbleyard.com/on-the-ropes

- Commit: `a96da58` — Polish boxing combat feedback and finalize NPC tag handoffs.
- Railway deployment: `6136d5a7-5a2a-43fa-b8f4-6fe0c5448061`, SUCCESS.
- Built from the latest `origin/main` in `.tmp/on-the-ropes-live-release`.
  Most boxing changes were already included in the prior Party Mode release;
  this release adds the remaining boxing polish without reverting that release.
- Pushed to `origin/main` and deployed through `scripts/deploy.mjs` with its
  clean-checkout, up-to-date source, and concurrent-deployment checks enabled.

Validation of the isolated release: TypeScript, boxing lint, architecture,
76 targeted boxing/peer tests and the production build passed.

Live verification: `/api/health` returned HTTP 200 and `status: ok`; `/` and
`/on-the-ropes` returned HTTP 200. A fresh public-site browser session started
outside, clicked Call/Tag once, and confirmed the player entered the ring while
the NPC took the corner position. No captured browser JavaScript errors.

Four actual local WebRTC clients passed against the production API, including
generated direct audio, abrupt host recovery, preserved match state, surviving
voice links and graceful host handover (1179 ms). Physical microphones and
restrictive external networks still require separate checks.

Logs: `.tmp/on-the-ropes-live-release/.tmp/boxing-release-tests.log`,
`boxing-release-build.log`, `boxing-live-peer.log`, `boxing-live-health.json`.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=6136d5a7-5a2a-43fa-b8f4-6fe0c5448061
