# Voice, multiplayer and efficiency review — 22 September 2026

Reviewed the current working tree, including its extensive uncommitted changes. This is an audit, not an implementation change. The collection has 24 games: 21 peer gameplay adapters and three server gameplay paths. The best next investment is improving the shared runtime and multiplayer experience; the evidence does not justify an engine rewrite.

## Most valuable changes

| Priority | Change | Evidence and practical effect |
|---|---|---|
| P1 | Repair frame pacing and quality decisions | Reproduced 48 FPS at a 60 FPS setting on a simulated 144 Hz display. A 120 FPS preference on a 60 Hz display unnecessarily reduces resolution and disables shadows. |
| P1 | Generate public invitation URLs in installed clients | Current copy/share handlers use the local app origin. Friends receive localhost/app addresses instead of public HTTPS links. |
| P1 | Remove checkpoint latency from execution of subsequent actions | Every action waits behind the preceding action's full checkpoint upload. A controlled 200 ms checkpoint delay postponed the second immediately submitted action by 209 ms. |
| P1 | Recover voice after an ordinary connection interruption | Server-game voice expires after 15 seconds; a 16-second gap produces a terminal 401 even while game membership remains valid. |
| P2 | Shrink repeated game state and measure real network quality | Early four-player Sample Stampede state implies about 1 MB/s of host upload before voice, chunk wrappers or network overhead. |
| P2 | Add explicit client/protocol/checkpoint compatibility | Installed clients and fresh web clients can currently join the same room without negotiating a rules/schema version. |
| Product | Connect party members to one shared game and party voice | Current party mode intentionally runs independent matches and compares results. Shared play and voice continuity need a party session integration. |
| P2 | Apply performance budgets to the whole frame and add integration gates | The render cap only skips the final renderer call; scene updates and simulation can still run. CI does not run the real WebRTC/voice integration suites. |

## 1. Frame pacing: two confirmed shared-runtime problems

Sources: `shared/rendering/runtime.ts:87`, `shared/rendering/runtime.ts:96`, `shared/rendering/preferences.ts`.

The limiter measures elapsed time from the last rendered frame and resets that timestamp to the current frame. It loses the fractional remainder. On a 144 Hz display, the 60 FPS threshold is reached every third refresh, giving 48 FPS rather than a 60 FPS average.

The adaptive-quality calculation multiplies the observed gap by the requested FPS. When 120 FPS is selected on a 60 Hz screen, a normal 16.7 ms refresh becomes a 33.3 ms sample. It is treated as a persistent performance problem even when the renderer is instantaneous.

Measured by invoking the actual `attachRenderRuntime` with a stub renderer and deterministic frame timestamps for ten simulated seconds:

| Display refresh | Requested FPS | Render calls/second | Final pixel ratio | Shadows |
|---:|---:|---:|---:|---|
| 60 | 60 | 60 | 1 | On |
| 120 | 60 | 60 | 1 | On |
| 144 | 60 | 48 | 1 | On |
| 144 | 30 | 28.8 | 1 | On |
| 60 | 120 | 60 | 0.75 | Off |

Use deadline/accumulator pacing that carries the remainder, and distinguish observed display cadence from actual missed work deadlines. Preserve simulation timing independently. Verify 30/60/90/120/144/165 Hz and irregular frame gaps. These are scheduler reproductions, not physical GPU measurements.

## 2. Invitations: parsing is fixed, generation is still platform-dependent

Sources: `shared/peer/usePeerRoom.ts:198`, `app/party/PartyClient.tsx:237`, `games/bungee-doubles/Game.tsx:242`, and the other copy/share handlers matching `location.origin`.

The installed client now boots locally. Its origin is consequently not the public website: Capacitor uses a local origin and Electron registers `jumbleyard-app://client`. Copying `${location.origin}/${game}?room=...` cannot create a useful public invitation from these environments. The same pattern occurs in party links and saved-build links. The new `inviteTarget` repairs incoming custom-scheme parsing, but does not address outgoing links.

Introduce one public URL builder with an explicit trusted public website origin. Keep game slug, code, challenge/build identifiers and relevant mode parameters. Use it in both clipboard and native share handlers. Test web, Android, iOS and desktop origins, plus a real installed-client-to-browser invitation.

## 3. Action responsiveness still depends on the coordinator

Sources: `shared/peer/connection.ts:394`–`435`, particularly `this.actionQueue` and `await this.commit()`; checkpoint serialization/upload is at lines 237–268.

Action execution and durable acknowledgement share one serial promise chain. The first action executes, then encrypts and uploads a full checkpoint. No later action in the room can execute until that upload finishes. Movement input follows another path; this finding concerns discrete actions such as shoot, pass, interact and game actions.

A diagnostic using the actual action handler and an injected 200 ms checkpoint delay executed two immediately submitted actions at 0 ms and 209 ms. At that latency, sustained discrete action execution cannot exceed approximately five actions/second across the room, excluding further work and request queuing. That is a controlled demonstration, not a measured production RTT.

Separate ordered game execution from persistence batching. Acknowledge only after a checkpoint or action journal includes the receipt, preserving the current deduplication and crash-recovery guarantee. Coalesce actions into a durability batch; avoid simply removing the await and weakening recovery. Validate rapid mixed actions from four players at 50/150/300 ms coordinator RTT and host loss during each stage.

## 4. Voice recovery and usability

Sources: `shared/voice/peer-coordinator.ts:60`–`80`, `shared/peer/mesh.ts:85`–`112`, `shared/peer/mesh.ts:154`–`188`, `shared/voice/peer-client.ts:74`–`94`, and `shared/voice/VoicePanel.tsx`.

**Confirmed recovery gap:** server-game voice removes a member after 15 seconds without a signaling heartbeat. Its next `poll` is rejected with 401. The mesh treats every 401 as terminal; the voice client disposes itself. The diagnostic kept the underlying game membership fresh, advanced voice time by 16 seconds, and received `Voice session expired. Leave voice and join again.` An explicit fresh `hello` succeeded. This affects the voice-only mesh used by Chaos, Brick by Hand and Shelf Control; peer gameplay rooms have their own suspend handling.

Distinguish recoverable signaling expiry from revoked credentials or a superseded browser instance. Reauthenticate and rebuild voice after resume only when the game pass is still valid, without reviving a stale tab or automatically reopening the microphone. Test a 20-second pause and a longer app suspension while another client remains active.

**Network recovery:** reconciliation currently rebuilds failed connections, or channels that have not opened after ten seconds. There is no explicit bounded recovery policy for a lingering `disconnected` connection, no `restartIce`, and no connection-health telemetry. Add connection-state observation, a grace interval, an ICE restart/reoffer path and bounded rebuild fallback. Existing offer handling rejects offers on an already described link, so adding `restartIce()` alone would be incomplete. [MDN ICE restart documentation](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce).

**Useful voice polish:** refresh device choices on `devicechange`, provide a local microphone test, distinguish waiting for peers from actual connected audio, and expose an output selector where the browser supports it. The current device list is refreshed when enabling the microphone; it has no device-change subscription or output routing control. Feature-detect output selection and keep the system default available. [MDN device changes](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event), [AudioContext output selection](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).

Current peer voice, PTT, per-player volume, proximity/radio behavior and recording-consent checks are worth preserving. There is no reason in this review to reverse the chosen peer-voice architecture.

## 5. Network and host CPU budgets

Sources: `shared/peer/connection.ts:271`–`319`, `shared/peer/mesh.ts:399`–`437`, `shared/peer/engine.ts:286`–`295`, individual game snapshot functions.

A host creates a recipient-specific snapshot for every member every nominal 50 ms. State has already moved to its own unordered, zero-retransmit data channel, which fixes the earlier shared reliable-queue design. However, full JSON state is still repeatedly copied, serialized and sent.

The diagnostic created four human members in each of the 21 peer adapters, started a round, advanced 100 nominal 50 ms ticks, and serialized snapshots. It is an early-round fixture, not a maximum-size or representative full-match benchmark. Host upload estimates multiply the three remote payload sizes by 20 Hz; they exclude voice, input, checkpoints, chunk wrappers and protocol overhead. They assume sends succeed.

Initial measured examples, rounded:

| Game | One snapshot | Chunks | Four-player host state upload |
|---|---:|---:|---:|
| Sample Stampede | 16.5 KB | 3 | 0.99 MB/s, about 8 Mbit/s |
| Crane Clash | 14.5 KB | 2 | 0.87 MB/s |
| Stack or Sink | 11.6 KB | 2 | 0.69 MB/s |
| Scaffold Scramble | 10.4 KB | 2 | 0.63 MB/s |

Start with static data: Sample Stampede repeatedly includes shelves, kiosks and manifest definitions; Scaffold Scramble repeats window/world definitions. Send map/round configuration once, then compact changing fields. Share only the public portion between recipient encodings; preserve private information and each player's view. Introduce baseline IDs, periodic complete state and explicit resynchronization before adding deltas.

There is also a smaller, low-risk CPU opportunity: only Siege sets `snapshotDetached: true`, while Wrong Floor, One More Button, Four Brain Cells, both Reel games and Carry-On Carnage already deep-copy in their snapshot functions and are copied again by `PeerEngine`. Confirm detachment tests per adapter before enabling the flag.

Multi-chunk unreliable snapshots require every chunk to arrive. Under an illustrative independent 5% application-message loss rate, a three-chunk snapshot completes with probability `0.95^3`, approximately 85.7%. This is a model, not a measured packet-loss result; SCTP fragmentation means actual network packet loss is not identical. Smaller state improves both upload demand and completion likelihood. [MDN data-channel guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels).

Collect actual selected candidate type (direct/relay), RTT, audio loss/jitter, snapshot age, bytes, backpressure skips and reconnect duration. `relayConfigured` proves configuration fields exist, not that a relay connection works. Existing integration harnesses deliberately clear ICE servers; add a forced-relay test and two separate-network tests. Production TURN configuration was not inspected.

Server request volume also deserves a separate budget. The peer mesh polls roughly once a second, in addition to host checkpoints and actions. Shelf Control targets a 65 ms gameplay polling interval (`games/shelf-control/connection.ts:116`), and active server-game voice adds another roughly one poll per second per participant. Four active Shelf Control players can therefore approach 65 gameplay-plus-voice requests/second at low request latency, before actions; this is a calculation from intervals, not a load-test result. Chaos and Brick by Hand have 220 ms polling delays after requests. Instrument request bytes, database work and room contention, reduce redundant responses and idle polling, and evaluate a persistent server transport if measured request cost warrants it while preserving server authority. The existing load harness covers seven games and omits the new voice endpoint, so it is not current collection-wide capacity evidence.

## 6. Installed-client compatibility

Sources: `shared/peer/types.ts`, `shared/peer/coordinator.ts`, `shared/peer/engine.ts:109`–`131`.

The snapshot `version` is an epoch/sequence number, not a wire-format version. Room joins do not negotiate client protocol or game rules versions, and recovery validates only a small common checkpoint shape. Packaged clients can remain on older code while the website updates. A new host may then load an incompatible world or interpret actions differently.

Add explicit protocol and per-game rules/checkpoint versions; reject incompatible joins with a useful update message or support a deliberate migration. Version static-map baselines too. Test old/new clients and takeover in both directions.

## 7. Party mode is the largest multiplayer product opportunity

Sources: `platform/party/types.ts:48`, `app/party/PartyClient.tsx:178`, `shared/ui/PartyRibbon.tsx:169`–`277`, `shared/peer/usePeerRoom.ts:128`.

The current type contract explicitly says every human plays their own match. The party sends everyone to the selected game's route, then a DOM-based helper clicks practice/solo/create buttons. The shared room hook skips restoration in party mode. The party page has no shared voice panel/session.

This is intentional current behavior, not evidence that the separate multiplayer rooms are broken. If the intended experience is friends playing together through a sequence of games, provision one authoritative game-room assignment per party round, authenticate each seat into it, and expose explicit game lifecycle hooks rather than matching button text/classes. Keep party voice associated with party membership through voting and round transitions. Full-page navigation currently tears down voice, so continuous voice also needs a persistent shell/session owner or a designed reconnect experience. Preserve proximity rules where applicable.

Separately, party requests and result reporting lack explicit timeouts (`platform/party/client.ts:7`, `shared/ui/PartyRibbon.tsx:313`). The serial poll schedules its next attempt only after the request settles. Add bounded requests, cancellation and safe retries with idempotent result submission; otherwise a stalled fetch can leave the page appearing to reconnect indefinitely without making another attempt.

## 8. Efficiency: measure the entire frame and recurring workloads

The shared runtime wraps `renderer.render`. Its FPS/visibility early return occurs after callers may already have simulated physics, updated scene objects, particles, camera, audio and snapshots. For example, `games/chain-of-fools/scene.ts:830` performs chain, camera, particle and dust updates before reaching the wrapper. Lowering draw FPS does not automatically lower those CPU costs.

Move the scheduling decision before nonessential scene work while keeping fixed simulation steps and networking independent. Instrument simulation, snapshot copy/encoding, scene update, React/HUD work and render submission separately. The existing `p95WorkMs` times only the wrapper/render call, not the whole frame or GPU completion.

Software-rendered smoke diagnostics show substantial submission counts: Shelf Control's offline menu scene reported 1,879 calls; Sample Stampede 1,694; Zorb Clash 1,201; Bungee Doubles 1,110; Carry-On Carnage 951; Crane Clash 926; Court Clash 888. Prioritize those scenes for physical-device profiling. Evaluate repeated props, avatar parts and shadow passes for batching/instancing and distance/detail reduction. Those counts identify work to investigate; software-renderer FPS under concurrent local tests is not a device-performance benchmark. Counts also vary with scene state, shadow passes and adaptive quality.

Preserve existing HUD pacing, deferred game/voice imports, byte-bounded audio caching and keyed Sample Stampede models. Check shared asset ownership and repeated create/destroy cycles: Chain of Fools teardown still handles geometry and particle materials separately and does not dispose all scene-owned label textures/materials.

The refresh-rate regression for Court Clash now verifies air-drag strength, which fixes the previous reproduced issue. Extend equivalence checks to trajectories, collision outcomes, game clocks and sustained input under 20/30/60/120/144 Hz and scheduler stalls. A damping-only test cannot establish that the whole simulation behaves equivalently; several adapters still cap individual elapsed steps rather than share a common accumulator.

## Validation and limitations

- Architecture gate and all 1,651 discovered tests passed.
- Type checking and lint passed.
- Installed-client and Railway/Node production builds passed; large-chunk and route-classification warnings remain.
- Real Chrome voice/PTT tests passed for the gameplay mesh and all three server-game voice paths, using synthetic microphones and local storage/signaling fixtures.
- Deterministic reproductions confirmed frame pacing/quality, voice TTL recovery and action/checkpoint serialization issues.
- All 21 peer adapters were included in the snapshot diagnostic.
- The final installed-client Chromium smoke completed all 24 routes without reported JavaScript page errors: 21 solo starts and three server-game offline menus. It is a short startup check, not a complete playthrough.
- All 21 peer adapters passed four-client local WebRTC integration across the initial run and retries: snapshots, direct generated audio, abrupt host recovery, retained round state, surviving voice links and graceful host handover. The final nine-adapter sequence completed with exit code zero for every adapter. Game-specific scenarios also exercised the fishing campaign, shared siege controls and Wrong Floor's private clues/escape.

The first browser smoke was invalidated by the server build clearing the shared build output during the run; this was a review-harness sequencing error. Its route failure is not counted as a game bug. The initial peer integration pass stopped on a One More Button negotiation timeout; its targeted retry passed. Reel Problems subsequently timed out during negotiation while the software-rendered browser sweep was active, then passed when rerun without that workload. Those intermittent negotiation failures remain a test-reliability concern; their root cause was not established. The final result is coverage across runs, not one uninterrupted green integration run.

No physical Android/iOS devices, Bluetooth hardware, Safari/Firefox voice session, restrictive internet connection, production load, long thermal run or maximum-size late-game world was tested. No production settings were read or changed. No application source changes or deployment were performed for this audit.

Diagnostics and logs: `.tmp/review-2026-09-22/`. Reproduce the focused checks with `node --import tsx .tmp/review-2026-09-22/render-check.mjs`, `recovery-check.mjs`, and `measure.mjs` (use the same directory prefix for each).

## Recommended order

1. Fix the shared frame limiter and outgoing invitation URLs; add the specific reproductions to the automated suite.
2. Repair recoverable voice expiry and action/persistence scheduling without weakening credential fencing or durable action receipts.
3. Reduce the four largest measured snapshot payloads; add connection and bandwidth diagnostics plus forced-relay testing.
4. Add protocol compatibility and complete party-to-game session integration if shared party play is the product goal.
5. Profile full-frame CPU/GPU work and 20-minute memory/resource behavior on actual target devices. Add real voice/peer regression jobs to CI, along with non-Chromium coverage and explicit performance budgets.

## Collection coverage

Every row received route startup coverage and the discovered unit tests. All peer rows also received an adapter snapshot fixture. This inventory does not claim a full manual playthrough. Render-call counts are one short software-rendered sample, including applicable shadow work; they are not GPU timings.

| Game folder | Startup scope | Snapshot bytes | Sample render calls |
|---|---|---:|---:|
| act-natural | offline-solo | 5085 | 90 |
| basketball | offline-solo | 3078 | 888 |
| bungee-doubles | offline-solo | 2920 | 1110 |
| carry-on-carnage | offline-solo | 5139 | 951 |
| chain-of-fools | offline-solo | 2463 | 333 |
| chaos | offline-menu | Server transport | 306 |
| crane-clash | offline-solo | 14542 | 926 |
| dont-wake-the-giant | offline-solo | 5988 | 125 |
| drive-thru | offline-solo | 4381 | 838 |
| first-person | offline-menu | Server transport | 0 |
| four-brain-cells | offline-solo | 1905 | 180 |
| load-bearing | offline-solo | 6298 | 803 |
| one-more-button | offline-solo | 1590 | 109 |
| panic-curling | offline-solo | 7032 | 584 |
| reel-problems | offline-solo | 6692 | 284 |
| reel-problems-2 | offline-solo | 5560 | 259 |
| sample-stampede | offline-solo | 16505 | 1694 |
| scaffold-scramble | offline-solo | 10426 | 433 |
| shelf-control | offline-menu | Server transport | 1879 |
| siege-and-desist | offline-solo | 2156 | 758 |
| stack-or-sink | offline-solo | 11573 | 246 |
| uphill-delivery | offline-solo | 2154 | 107 |
| wrong-floor | offline-solo | 1174 | 93 |
| zorb-clash | offline-solo | 3748 | 1201 |
