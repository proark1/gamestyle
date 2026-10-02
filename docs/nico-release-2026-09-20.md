# Nico production release — 20 September 2026

Live: https://www.jumbleyard.com

- Source commit: `03e3136fbeba722d2d87b2b29127e69a067f417b`, pushed to `origin/main`.
- Railway deployment: `f34c3014-f448-44b7-8f22-8827fa081ec6`, status **SUCCESS**.
- Released from an isolated checkout of the latest production branch, retaining all preceding live releases and the newer wardrobe fitting fixes. Unrelated shared-workspace edits were not uploaded.
- Nico is the standard human avatar. Cows, robots, wooden mannequins and other non-human exceptions remain unchanged. Game-specific scales and equipment fitting are preserved.
- All **1,522 repository tests** passed, plus formatting, TypeScript, lint, architecture validation and the Railway production build.
- Local production-browser checks started six representative games without runtime errors: Stack or Sink, Bungee Doubles, Scaffold Scramble, Zorb Clash, Act Natural and Four Brain Cells.
- Live verification: homepage, all **23 game routes**, health endpoint and the new Nico JavaScript asset returned HTTP 200. Health reported `ok`.
- A live Stack or Sink practice session rendered a canvas and loaded the new Nico asset without browser errors. This is not a complete multiplayer playthrough of every game.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=f34c3014-f448-44b7-8f22-8827fa081ec6

Local evidence: `.tmp/nico/live-check.json`, `.tmp/nico/live-browser.json`, `.tmp/nico/live-stack-or-sink.png`, `.tmp/nico/release-check.log`, and `.tmp/nico/release-build.log`.
