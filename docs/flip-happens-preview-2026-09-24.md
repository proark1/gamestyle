# Flip Happens — live

Live: https://www.jumbleyard.com/flip-happens

Preview: http://127.0.0.1:4183/flip-happens

Merged pull request: https://github.com/proark1/gamestyle/pull/54

Implementation commit `210dddf`, merged to main as `060c878`. Source is in the isolated checkout `.tmp/flip-happens`, now at that production commit. This avoids mixing the game's implementation with the existing root checkout's unrelated changes. Published on 24 September 2026; see [the live release record](flip-happens-live-2026-09-24.md).

Six objects, four-player matches with bots, a wobbling table, risky combos and banking, quick rematches, and a deterministic daily challenge with a device-local best. Reuses Nico, wardrobe items, renderer, audio recordings, room/voice/party systems, analytics and the game admission boundary.

All 1,987 checks' tests passed, with formatting, TypeScript, lint and architecture checks. Website and installed-client builds passed. Desktop and German emulated touch browsers, daily completion and best persistence, four real WebRTC peers, generated voice audio and host migration were verified. The final production preview also passed at 320px width. Physical phones and restrictive networks were not tested.

Details: `.tmp/flip-happens/docs/flip-happens-verification.md`. Logs and screenshots: `.tmp/flip-happens/.tmp/flip/`.

To restart the preview in PowerShell from the isolated checkout:

```powershell
$env:GAME_RUNTIME = 'node'
$env:DATABASE_PATH = 'C:/Users/assad/Documents/GitHub/gamestyle/data/flip-preview.sqlite'
node node_modules/vinext/dist/cli.js start --hostname 127.0.0.1 --port 4183
```
