# Cross-platform runtime implementation — 20 September 2026

The main audit fixes are implemented. Browser and locally bundled clients build, the Windows package launches and runs a game, and multiplayer recovery passes a real four-client WebRTC test. This is a tested foundation, not a claim that every game is ready for a mobile store or Steam Deck certification.

## Changes

| Audit finding | Implemented change | Scope / limit |
| --- | --- | --- |
| Sample Stampede resource churn | Basket meshes keyed by item ID; expired effects dispose geometry, materials and textures; particle/popup limits; scene cleanup | Regression verifies 600 unchanged updates reuse one model. |
| Refresh-rate-dependent drag | Time-scaled continuous damping in Basketball, Bungee Doubles and Carry-on Carnage | Basketball velocity checked at 20–144 Hz. This does not make every game's collision simulation deterministic. |
| Inconsistent graphics policy | Shared adaptive resolution/shadows, 30/60/120 FPS caps, persistent quality setting, per-canvas performance diagnostics | Rendering caps do not cap every game's simulation loop. Scene complexity still requires device profiling. |
| Suspension and stuck input | Shared foreground state and key release; native app-state integration; host suspend/resume and seat-preserving handover | Browser/native event paths implemented; physical device interruption testing remains. |
| Context loss | Stop rendering on loss, show recovery notice, resume on restoration | Browser support determines whether a lost context can be restored. |
| Transport congestion | Unreliable unordered channel for replaceable state/input, reliable channel for actions, bounded queues and independent fragment buffers | Legacy channel fallback retained. Restrictive-network/TURN testing remains. |
| Duplicate snapshots | Explicit detached-snapshot contract avoids the second Siege clone | Other adapters preserve the defensive clone. |
| Audio memory | Decoded buffers bounded by bytes (32 MiB) and count, with stale-load protection | Cache budget excludes buffers currently retained by active audio sources. |
| Native redirect shell | Dedicated lazy-loaded installed client with local routes/assets and explicit HTTPS API origin | 20 games expose local play; Chaos, First Person and Shelf Control still need an online coordinator to create rooms. |
| Native invite routing | Validate known origins/routes, handle custom-scheme host paths, cold-start and warm-start links | Device URL-association/signing configuration still needs platform testing. |
| Desktop support | Sandboxed Electron shell, local asset protocol, narrow API proxy, Windows packaging | No Steamworks bridge, achievements, cloud saves, AppID, signing or store submission. |
| Controller support | Deadzone, held/released buttons, per-game remapping, basic menu navigation and disconnect cleanup | Baseline keyboard adapter; game-specific semantic actions, consistent camera control, glyphs and controller-only text entry remain. |
| Dependency advisories | Patched Cloudflare tools/types; scoped UUID override for xcode | npm reports zero vulnerabilities after installation; xcode project parsing/writing and UUID generation checked. |

Shared cached materials are marked as shared so scene cleanup does not dispose resources still used elsewhere. Cleanup was added to the audited scenes; this is not an exhaustive ownership proof for every model and effect in all 23 games.

## Verification

- Full test run: **1,517 passed, zero failed** at the recorded run. Files are being edited by other tasks in this workspace, so later additions may change this count.
- TypeScript and lint passed independently. Repository-wide `npm run check` still stops on formatting differences across many existing files; no blanket reformat was applied over concurrent work.
- Node production build and installed-client production build passed. The bundle warning for chunks above 500 kB remains; games are lazy-loaded rather than all eagerly downloaded.
- All **23 routes** loaded locally with no browser JavaScript errors. Smoke coverage: **20 local starts**, **3 offline menus** for coordinator-dependent games. This is startup coverage, not a complete playthrough.
- Touch emulation at 390 × 844: Basketball, Sample Stampede, Stack or Sink and Wrong Floor started without JavaScript errors.
- Real local WebRTC: four clients, generated direct audio, abrupt-host recovery, preserved round, surviving voice and join-order handover passed. Graceful handover measured 279 ms in the recorded run.
- Packaged Windows executable: collection navigation and Stack or Sink practice start passed with no page errors. The test runs hidden through local browser debugging; the debugging flag is not added to normal launches.
- Browser tests used software rendering and desktop smoke ran hidden. Their FPS values are **not** physical-device performance measurements.

## Run and package

```sh
npm run build:client
npm run preview:client -- --port 4173
npm run test:browser
npm run cap:sync
npm run build:desktop
node scripts/desktop-smoke.mjs
```

The Windows output is `output/desktop/Jumbleyard-win32-x64/Jumbleyard.exe`; distribute the entire sibling directory, not just the executable. Packaging supports the host platform by default; other OS targets still require their own builds and testing. `GAME_API_ORIGIN` selects a trusted HTTPS backend at build/package time. `CAPACITOR_DEV_SERVER_URL` is for explicit development only.

The installed client source is `app/installed`; shared Vite adapters are in `platform/client`. Desktop output sits outside `dist` because the web production build cleans that directory.

## Remaining release work

1. Profile representative Android/iPhone, desktop GPUs and Steam Deck, including a sustained 15–30 minute session, thermal behavior, memory growth and background/resume. Heavy scenes still have substantial draw-call/triangle counts; use those captures to choose instancing and geometry reductions.
2. Complete the controller action model and controller-only UI across all games. The current adapter is not a claim of full Steam Deck input support.
3. Build/sign Android and iOS on the required toolchains, verify native HTTP/cookies, microphone permissions and invite associations on devices. No signed mobile artifact was produced here.
4. Configure the actual Steam application, add the chosen Steamworks integration, then test packaged online authentication, invites and achievements/cloud saves if required. No Steam publishing occurred.
5. Test live internet multiplayer across restrictive NATs and TURN, version mismatches, prolonged packet loss and mobile network changes.
6. Resolve the existing repository formatting backlog and finish per-game art/performance reductions after measurements. This implementation deliberately preserves concurrent gameplay and UI edits.

Detailed machine logs and JSON results are under `.tmp/platform-audit/` (local, ignored by Git). The original findings remain in `docs/cross-platform-performance-audit-2026-09-20.md` as the pre-fix audit.
