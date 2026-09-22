# Voice, multiplayer and efficiency improvements

Implements the approved collection audit in the existing shared runtime. No production deployment or account configuration was changed. Unrelated existing workspace changes were preserved.

## Changes

- Frame pacing carries fractional deadlines: 60 FPS on a 144 Hz display stays at 60, and choosing 120 FPS on a 60 Hz display does not incorrectly lower rendering quality. Early visual admission now covers the expensive animation paths in Shelf Control, Sample Stampede, Zorb Clash, Crane Clash, Bungee Doubles, Court Clash, Scaffold Scramble, Load Bearing and Chain of Fools. Input, simulation and network cadence remain separate. Visual work is included in render diagnostics; peer simulation, snapshot, encoding, checkpoint and tick timing are exposed in `document.documentElement.dataset.peerPerformance`. These are CPU timings, not GPU completion timings.
- Static scenery is batched in Shelf Control, Sample Stampede, Crane Clash, Zorb Clash and Bungee Doubles. Movable parts, spectators and visibility-controlled objects stay separate. Chain of Fools now disposes scene-owned materials and label textures, respecting shared resources.
- Every outgoing game/party invitation uses a public origin in installed clients. `PUBLIC_GAME_ORIGIN` sets the installed build's invitation origin; ordinary web development still uses its own origin.
- Discrete game actions execute in order while durable checkpoint uploads batch their receipts. An action is acknowledged only after a checkpoint containing it succeeds. Actions arriving during an upload wait for the next checkpoint.
- Each remote recipient gets a separate snapshot baseline. Loss-tolerant deltas refer directly to that baseline; full baselines refresh periodically, and missing baselines trigger resynchronization. Dense updates fall back to replaceable full snapshots. Transmitted transform coordinates are rounded to four decimal places; authoritative simulation and checkpoints retain full precision. Per-player private views remain isolated. Proven detached adapters avoid a second deep clone.
- Protocol, checkpoint schema and game-rule revisions reject incompatible clients/rooms with an update message. ICE restarts preserve working peer links where possible, with bounded replacement fallback. Signaling queues apply backpressure instead of silently evicting offers during candidate bursts.
- Server-room voice can recover an expired signaling heartbeat while preserving newer-browser fencing and checking current membership. Recovery leaves the microphone off. Input-device changes refresh the list; supported browsers offer speaker selection. A local microphone meter sends no audio to peers. Connection status distinguishes waiting/connecting and shows relay, RTT, jitter and packet-loss information.
- Party rounds now issue authenticated seats in one shared game room. The host explicitly starts the round when the humans connect. Party-only game limits and supported NPC rosters carry into the shared engine and its recovery checkpoint. The party page owns voice while an embedded game enters, reloads and returns to standings. Push-to-talk crosses the frame boundary only for the expected origin, frame and party. Bounded API requests and an independent give-up control provide recovery from a failed game load.
- New shared tournaments score actual human outcomes. NPCs fill game seats without taking tournament points. Legacy saved tournaments retain their previous scoring format. Party voice survives round completion and voting; revoked party passes cannot reconnect.
- CI now includes real four-client WebRTC/game/audio recovery tests, browser voice controls, Firefox voice, all server-voice transports, a shared-party browser test, bandwidth budgets and forced TURN relay verification. The load tool discovers all peer games and exercises voice signaling for server-authoritative games.

## Reproduction

```sh
npm run typecheck
npm run lint
npm test
npm run build:railway
npm run build:client
npm run test:peer
npm run test:voice:browser -- --ui
node --import tsx scripts/party-browser-integration.mjs
node --import tsx scripts/measure-peer-bandwidth.mjs
```

Run browser/peer/build workloads sequentially on development machines. The party browser test uses the installed build and its own isolated local server/store. `VOICE_TEST_ENGINE=firefox` selects Firefox. `PEER_RELAY_ONLY=1` forces relay candidates, with `PEER_TURN_URLS`, `PEER_TURN_USERNAME` and `PEER_TURN_CREDENTIAL` supplied for an isolated TURN server. CI uses the [official Coturn container](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md). Local load tests use their own SQLite database and reject non-loopback targets.

## Validation limits

Synthetic audio and local TURN exercise the software paths but do not establish physical microphone, Bluetooth, Android/iOS, Safari, internet NAT or thermal performance. Production rollout must coordinate the protocol change: existing old-format peer rooms require a new room after updating. No migration of live encrypted checkpoints across incompatible schemas is attempted.

## Measured results

The deterministic runtime fixture now produces 60 FPS at a 60 FPS preference on 60/120/144 Hz schedules, and 30 FPS at a 30 FPS preference on 144 Hz. Selecting 120 FPS on a simulated 60 Hz display keeps its pixel ratio and shadows. Additional Court Clash regressions cover bounded trajectory error, floor/rim outcomes, held movement, shot charging and clocks at 20/30/60/120/144 Hz. This does not prove identical physics for every game or every possible stall.

The 21-adapter bandwidth fixture advances four members with input for ten seconds, compares complete snapshots with the actual wire codec, and verifies reconstructed views. Figures below are total state payload sent to three remote members; voice, input, checkpoint traffic, chunk wrappers and network overhead are excluded. They are fixture measurements, not production match averages.

| Game | Full snapshots, KB/s | Encoded state, KB/s | Reduction |
|---|---:|---:|---:|
| Sample Stampede | 997.7 | 151.4 | 85% |
| Scaffold Scramble | 639.0 | 96.4 | 85% |
| Crane Clash | 879.3 | 387.9 | 56% |
| Stack or Sink | 746.0 | 201.1 | 73% |

An isolated production Node/SQLite server handled 24 rooms and 96 simulated players for 15 seconds: 2,993 measured requests, 199.4 requests/s, 47.4 ms p50, 162.65 ms p95, 330.72 ms p99, no failed requests, and 5,376,016 response bytes. All 21 peer coordinators and the three server-game paths participated, including server-game voice polling. Host checkpoints used synthetic encrypted 48 KB payloads. This short local check is not a capacity or soak test and does not measure production database contention. The first attempt used a process holding pre-rebuild module paths and was discarded after restarting the isolated server.

The final installed-client smoke starts all 24 routes without JavaScript page errors: 21 solo starts and three server-game offline menus. Sampled render calls fell from 926 to 426 for Crane Clash, 1,110 to 537 for Bungee Doubles, 1,694 to 1,356 for Sample Stampede, 1,879 to 1,604 for Shelf Control, and 1,201 to 1,143 for Zorb Clash. These are short software-rendered scene samples; scene state, shadows and adaptive quality can change submission counts. They do not establish physical GPU speed or thermal gains. The remaining avatar/shadow workload is substantial in several games and should guide physical-device profiling before larger rendering changes.

## Verification record

- Architecture checks and all 1,699 discovered unit tests pass. A regression submits twelve actions from four players while checkpoint I/O is blocked, verifies ordered execution without premature acknowledgements, and fences acknowledgements after a host epoch change. Failed persistence and subsequent retry are also covered.
- Final TypeScript checking and lint pass. The last test-only assertion adjustment was rerun separately after the full suite.
- Production Railway and installed-client builds pass. Existing large-chunk, dynamic-import and route-classification warnings remain.
- Chrome synthetic voice passes UI controls/local microphone checking, early joining, Shelf Control, Chaos and First Person voice paths. Firefox passes the default peer, early-join and Chaos voice fixtures across runs. Initial Firefox cold-start runs timed out; their cause is not established, so this is coverage across successful runs rather than one uninterrupted green browser batch.
- Two real browsers pass shared-party entry, authenticated human seats, automatic startup, cross-frame push-to-talk, host game reload and voice continuity into intermission for Crane Clash, Four Brain Cells, Bungee Doubles and Act Natural. Broader coverage caught and fixed custom-game startup being blocked by a room invitation query. The persistent voice controls occupy a separate row above the game.
- Four Brain Cells also passes at a 390 × 844 mobile viewport. This is desktop Chromium mobile emulation, not a physical phone. The harness separately records the expected retryable roster/checkpoint conflict during reload rather than treating it as a JavaScript failure.
- All 21 peer adapters pass four-client native WebRTC checks across runs, including generated audio, snapshots, abrupt host recovery and graceful handover. Crane Clash and Siege required targeted retries after initial negotiation timeouts on Windows; the cause is not established.
- After the final wire compression change, the all-adapter reconstruction suite passes and real WebRTC passes again for Crane Clash, Sample Stampede and Stack or Sink. Forced local UDP TURN relay passes four-client gameplay/audio, ICE restart and host handover; an earlier TCP relay run also passed. External NATs and separate physical networks remain untested.
- The full repository formatter reports 138 files with formatting differences, including pre-existing work. Files edited for this implementation were formatted selectively; unrelated changes were preserved. The aggregate `npm run check` therefore is not green.

Local evidence is in `.tmp/improvement-*.log`, `.tmp/improvements/`, and `.tmp/platform-audit/`. CI jobs are configured; hosted CI has not been run from this workspace.
