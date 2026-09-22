**Jumbleyard — efficiency and cross-platform readiness review**

Reviewed 20 September 2026 against the current working tree, including its unfinished clubhouse/party changes.

**Verdict: keep the existing TypeScript/Three.js foundation, but establish a consistent game runtime before treating mobile and Steam as release-ready targets.** The main opportunities are resource reuse, refresh-rate-independent simulation, lifecycle handling, and transport efficiency. An engine rewrite is not justified by the evidence collected here.

This was a repository-wide static review with targeted source inspection, the complete discovered test suite, a Node production build, asset measurements, and a numerical physics reproduction. All 23 scenes were inventoried. It was not an exhaustive line-by-line correctness proof or a manual playthrough of every game. No physical phone, GPU profiler, Steam Deck, native build, real-internet multiplayer session, or production load test was used. FPS, battery life, thermal behavior, and maximum player capacity therefore remain unverified.

**Validation results**

| Check | Result |
|---|---|
| TypeScript | Passed: `npm run typecheck` |
| Complete test discovery, run directly | 1,446 passed, zero failed; approximately 27.7 seconds |
| Normal `npm test` entry point | Blocked before tests: architecture checker finds missing `./adventures.css` imported by `shared/clubhouse/InteractiveCrew.tsx:7` |
| Lint | Seven errors in clubhouse code: three semantic status-element errors and four unhandled test promises |
| Node/Railway production build | Passed, with large-chunk and Vite configuration warnings |
| Cloudflare production build | Not rerun |
| Android/iOS/Steam packaged builds | Not run; no Steam build target found |

The missing stylesheet does not currently prevent the production build, presumably because the affected module is outside the active build graph. It still prevents the normal repository test gate. The report does not attribute these unfinished working-tree issues to an earlier release.

**What is already working well**

All 23 game scenes use the shared renderer factory. The device policy caps pixel ratio and disables antialiasing on the touch tier. Nineteen game components directly use the common HUD pacer; Uphill Delivery also has explicit inline pacing. Heavy scenes and peer adapters are loaded separately, and the voice panel dynamically imports its voice client. There is no evidence that every game is eagerly loaded into every route.

The game/shared/platform boundaries are documented and checked. The shared peer engine has input ordering, action deduplication, checkpoints, and host-recovery coverage across 20 peer games. Hidden-information server games retain a separate authority path. Audio already has bounded buffer counts, limited preload concurrency, and visibility handling. SQLite prepared-statement caching and grouped durable commits are already implemented. Preserve these investments.

**Highest-priority findings**

**1. P1 — Sample Stampede recreates carried-item models on every scene update. Confirmed in source.**

At `games/sample-stampede/scene.ts:378`, every cart calls `syncBasketItems`. At lines 549–575, that method removes all existing basket items and calls `createItemMesh` for every item again. The solo loop calls the scene every animation frame (`Game.tsx:289–344`). Those removed resources are not disposed. Particle and comic-popup expiration similarly removes meshes without disposing their owned geometry/material resources (`scene.ts:771–797`).

This causes unnecessary object allocation, geometry uploads, and unreleased GPU resources during an active session. A basket containing ten items at 60 updates/second creates 600 item-model trees per second; this is an illustrative calculation, not a measured inventory or frame rate. Full-page navigation later does not solve growth during the round.

Fix: retain a map from item ID to mesh, create only new items, update transforms in place, and release removed resources according to ownership. Pool bounded particle objects and reuse geometry/materials. Check textures used by popup materials too. Verify with a 20-minute collection/checkout loop: geometry and texture counts must plateau after warm-up. This is the strongest immediate performance fix found.

**2. P1 — Simulation behavior changes with update frequency. Reproduced.**

Court Clash's solo simulation follows `requestAnimationFrame` (`games/basketball/Game.tsx:164–179`). Air drag multiplies velocity by `0.994` once per call instead of using elapsed time (`physics.ts:112–113`). The peer connection runs at a nominal 50 ms interval. Therefore solo display refresh and multiplayer scheduling affect shot behavior.

A Node reproduction started the same unheld ball at height 100 with horizontal velocity 1, avoiding floor/hoop collisions, and simulated one second:

| Updates per second | Remaining horizontal speed |
|---|---:|
| 20 | 0.8866 |
| 30 | 0.8348 |
| 60 | 0.6969 |
| 120 | 0.4857 |
| 144 | 0.4204 |

Related source patterns occur in Carry-On Carnage's free-item drag (`physics.ts:460–461`) and Bungee Doubles' grounded-ball friction (`physics.ts:212–213`). These were inspected but not separately numerically reproduced. Collision impulses should not be mechanically converted just because they also multiply velocity.

Fix: adopt a fixed-step accumulator for simulation with bounded catch-up and rendering interpolation. Alternatively, make continuous damping time-based where appropriate, choosing a documented reference step. Apply the same simulation schedule to solo and host play. Add equivalent-elapsed-time tests at 20/30/60/120/144 Hz and under irregular frame gaps. Uphill Delivery already supplies a useful fixed-step example; Panic Curling and Chain of Fools already use time-based damping in several paths.

**3. P1 — Packaged mobile currently depends on booting the live website. Confirmed architecture gap.**

`scripts/prepare-native.mjs` generates a connection page in `dist/client/index.html`, fetches the remote health endpoint, then redirects to `https://www.jumbleyard.com`. This is not a self-contained installed game client, despite the configuration comment describing local bundling. A fresh offline launch cannot reach local solo play through this bootstrap. Its fetch has no explicit timeout. The health route itself declares no CORS response headers; the cross-origin bootstrap also needs validation against actual deployment headers.

`capacitor.config.ts` supports `server.url` and broad navigation allowances. Capacitor documents these server settings as development/live-reload facilities, not its intended production packaging path. [Capacitor configuration](https://capacitorjs.com/docs/config).

Fix: create a real locally bootable client entry with bundled runtime assets and an explicit remote API origin. Design authentication, CORS, cookies/token transport, invite routing, and version compatibility for the local native origin. Keep the existing website/server build for web distribution. Explicitly decide which solo features work offline; multiplayer can remain online. Merely copying the current SSR output into Capacitor will not establish this separation.

**4. P1 — Custom-scheme invitations lose their route. Reproduced URL parsing.**

In `shared/browser/platform.ts:120–141`, `new URL(event.url)` succeeds for `jumbleyard://stack-or-sink?room=ABCDEF`. However, `stack-or-sink` is its hostname, so the computed target becomes only `?room=ABCDEF`. Likewise `jumbleyard://room/ABCDEF` becomes `/ABCDEF`. The custom-scheme fallback is in `catch`, which is not reached for these valid URLs.

Fix: branch explicitly on the protocol, define supported invite formats, validate the game route, and handle both cold-start and already-running delivery. Add parser tests for HTTPS invites and custom-scheme invites. This is important for friends joining from messaging apps on phones.

**5. P1 for mobile release — Lifecycle and input reset are inconsistent. Confirmed coverage gap; device impact unmeasured.**

Ten scene files contain no direct visibility listener, and only six contain an application-level context-loss listener. Three.js itself has internal context handling, so this does not mean the other scenes necessarily crash on context loss; it means there is no consistent product-level recovery behavior. Native initialization handles Back and links but does not register app-state changes. Crane Clash stores held keys without a blur/visibility reset, making a missed key-up on task switching a concrete input risk.

Fix: a shared lifecycle owner should clear held input, stop nonessential rendering, suspend audio, and explicitly manage network-host succession on backgrounding. On resume, reacquire or recreate required resources and rejoin from authoritative state. Do not simply stop all timers when the phone is hosting; define the host-transfer policy. Validate lock/unlock, incoming calls, switching apps, Bluetooth audio changes, and network transitions.

**6. P2 — Graphics quality is centralized only in part. Confirmed.**

The shared tier is based on pointer/screen width, not measured GPU capacity. It is a useful starting estimate, but cannot detect a slow desktop, a strong tablet, or thermal throttling. Load Bearing still enables a hard-coded 2048² shadow map (`scene.ts:106–117`) on the touch tier, bypassing the policy's 1024² recommendation. Other hard-coded maps require individual review: for example, Blend Business disables its shadows on mobile, so its 2048 setting should not be counted as mobile shadow work.

Only Stack or Sink and Uphill Delivery directly use the shared `FrameStats`. Uphill Delivery already reduces resolution and eventually disables shadows based on frame gaps (`scene.ts:571–580`). Extend this measured policy across the collection, using stable thresholds and recovery hysteresis. Offer an explicit 30/60 FPS and quality preference. Separate UI size/input detection from rendering quality. Profile draw calls before applying instancing or geometry merging; existing repeated props are good candidates, but no draw-call totals were measured here. [Three.js instancing reference](https://threejs.org/docs/pages/InstancedMesh.html).

**7. P2 — Multiplayer snapshots compete with reliable actions and repeat expensive work. Confirmed design; severity needs network measurement.**

`shared/peer/mesh.ts:212` uses one ordered reliable data channel. `connection.ts:235–275` generates a separate snapshot for each member every nominal 50 ms. `PeerEngine.snapshot` clones the adapter result; Siege and Desist also clones inside its adapter snapshot, producing a redundant copy. Large JSON messages are chunked, and sends are rejected above a 256 KB queued-data threshold (`mesh.ts:362–390`). Backpressure is present, but obsolete reliable snapshots can still delay newer traffic on a poor connection.

Fix: measure per-game serialized bytes and host CPU first. Separate replaceable state updates from reliable actions/control, preserve sequence checks, coalesce stale snapshots, and use periodic complete state to recover from dropped deltas. Reduce duplicate cloning while maintaining immutable snapshots and each recipient's privacy. Quantization/delta encoding should follow measurements, not precede them.

The coordinator polls once per second per client; a four-player room adds roughly four polls/second plus periodic host checkpoint writes and actions. At 1,000 connected players that is approximately 1,000 membership polls/second before additional work, not a capacity estimate. Validate TURN on separate networks; TURN configuration support exists, but its production configuration was not inspected. Benchmark current 23-game workloads instead of extrapolating the historical seven-game load report. Preserve server authority for hidden-role games. Competitive rankings or paid rewards would need a separate trust design because player-hosted simulation trusts the host.

**8. P2 — Resource cleanup needs a shared ownership contract. Confirmed incomplete examples.**

Court Clash and Crane Clash teardown stops listeners/loops and disposes the renderer, but does not explicitly release scene-owned geometry/material/texture resources. Other games, including Brick by Hand, have substantially more complete teardown. The documented full-navigation strategy reduces cross-game accumulation, but does not replace correct disposal for restart/recreation within a page.

Fix: use a resource registry or consistent owned/shared asset convention. Do not indiscriminately dispose globally shared materials when one mesh leaves. Measure repeated enter/leave/restart cycles and active-session entity churn independently. Fix Sample Stampede's active-session churn first.

**9. P2 — Steam and controller support are future work, not existing targets.**

No desktop packaging target, Steam bridge, or Gamepad API input implementation was found in the application source. Current controls are mainly per-game keyboard mappings plus shared touch controls. Mobile packaging alone does not establish Steam support.

Create semantic actions such as move, look, interact, primary/secondary action, and pause, with per-game action sets and adapters for keyboard, touch, and controllers. Include menus, room-code entry, remapping, controller glyphs, and disconnection handling. Steam Deck verification also considers controller access, text input, readable UI, and default performance; these are distinct from merely listing a game on Steam. [Valve compatibility criteria](https://partner.steamgames.com/doc/steamhardware/compat).

After the locally bundled client works, evaluate a desktop shell using representative games. Electron is one possible reuse path with documented packaging support, but its memory/startup cost and Steam integration need a prototype before choosing it. [Electron distribution documentation](https://www.electronjs.org/docs/latest/tutorial/distribution-overview). Keep the native bridge narrow: platform identity, invites, storage/cloud saves, achievements, windowing, and controller integration. Do not migrate all 23 games to another engine without device measurements showing an unsolved limitation.

**10. P2 — Loading and audio budgets need route-level measurements.**

The generated build's largest JS files were approximately 603 KB raw/153 KB gzip for `worker-*.js`, and 514 KB raw/132 KB gzip for LiveKit. These are individual files, not initial-page transfer totals. The name `worker` is not evidence that simulation runs in a Web Worker. Voice loading is already deferred.

The public directory contains approximately 70.0 MB across 125 files, including a 5.12 MB WAV and several 2–3 MB PNGs. This is shipped asset inventory, not a 70 MB page download: the current collection cards reference smaller JPGs and the clubhouse uses WebP. Trace actual requests before removing or recompressing anything. Add route cold-load budgets, responsive variants where useful, and caching validation. Evaluate compressed delivery for long music tracks while retaining short decoded effects. Audio buffers are bounded by count, not decoded bytes; a byte-aware budget would better account for long tracks.

**Game coverage and next profiling targets**

Every row received scene/runtime source inventory, and all discovered tests were included in the direct test run. The last column is a recommended next workload, not a measured bottleneck or a completed playthrough.

| Game | Review finding or next workload |
|---|---|
| Siege and Desist | Destruction burst; redundant snapshot clone; host CPU and bytes |
| Stack or Sink | Existing frame statistics; profile late tower/flood and multiplayer HUD updates |
| Blend Business | Mobile shadows already disabled; NPC visibility and network privacy workloads |
| Uphill Delivery | Reuse fixed-step/adaptive-quality approach; profile mixed NPC carrying |
| Tiptoe Thieves | Giant/environment animation and background/rejoin behavior |
| Permit Pending | Large scene/component; dense saved builds, collision cost, and touch HUD |
| Brick by Hand | Stronger cleanup example; detailed props, foliage, pointer-lock recovery |
| Wrong Floor | Context-loss handler exists; clue privacy and escape on weak phones |
| One More Button | Context-loss handler exists; maximum concurrent hazards and music |
| Four Brain Cells | Context-loss handler exists; articulated robot and cooking interactions |
| Reel Problems | Context-loss handler exists; water/weather, many lines, audio/particles |
| Shelf Control | Preserve server authority; showroom visibility and sustained movement load |
| Load Bearing | Hard-coded mobile shadow cost; maximum destruction/debris |
| Crane Clash | Held-key reset and teardown; ropes, camera, full touch/controller mapping |
| Court Clash | Reproduced refresh-rate-dependent physics; particle/teardown behavior |
| Bungee Doubles | Grounded friction update dependence; rope and ball interpolation |
| Panic Curling | Some damping already time-based; full-round touch aiming and lifecycle |
| Zorb Clash | Collision-heavy round and lifecycle/teardown verification |
| Carry-On Carnage | Free-item damping update dependence; packed luggage collisions |
| Sample Stampede | Fix carried-item recreation and particle disposal before profiling |
| Drive-Thru Static | Busy order/bot scene and background/rejoin behavior |
| Scaffold Scramble | Dense scaffold and moving load; resource cleanup and touch controls |
| Chain of Fools | Existing instanced chain/time-based damping; rope recovery with four players |

**Recommended implementation order**

1. Restore the normal validation gate, fix Sample Stampede resource churn, fix variable-rate simulation, and repair native invite parsing. Add regression checks directly tied to these failures.
2. Standardize lifecycle, fixed-step scheduling, resource ownership, and graphics telemetry. Keep game rules and art in each game; share these runtime contracts instead of combining games into one huge component.
3. Run repeatable device benchmarks and fix the worst measured draw-call, physics, allocation, audio, and network costs. Reuse existing instancing and adaptive-quality code. Consider simulation workers only if main-thread profiles justify their communication complexity.
4. Build the locally bootable mobile client and validate authentication, suspend/resume, offline behavior, touch ergonomics, and real-network multiplayer.
5. Add controller action sets and prototype the desktop/Steam shell, then validate Deck and desktop builds. Test cross-version rooms and checkpoint compatibility because installed clients will update at different times.

**Proposed release criteria — targets, not current results**

Use at least one lower-performance Android phone, a mid-range Android phone, an older supported iPhone, an integrated-GPU laptop, and a Steam Deck. Exercise solo, four players, phone-as-host, TURN relay, worst-case effects, and a 20-minute thermal run. Compare 30/60/120/144 Hz simulation outcomes.

Aim for p95 frame intervals within 33.3 ms on the supported low tier and 16.7 ms on the 60 FPS tier, with simulation/rendering headroom. Investigate long-frame spikes separately. Require stable geometry/texture counts after warm-up and no progressive memory growth across repeated rounds. Record cold/warm time to interactive, decoded audio memory, snapshot/checkpoint bytes, round-trip latency, dropped-state counts, host-handover time, and background recovery. Establish byte and draw-call limits from the first device baselines rather than inventing universal limits for all scenes.

Add an automated release gate for typecheck, lint, architecture, unit/integration tests, production builds, and a browser smoke pass of all game routes. No checked-in GitHub Actions directory was found; external CI may exist and was not inspected. Extend testing with refresh-rate invariance, repeated lifecycle/resource checks, and real-browser host loss. The existing 1,446 passing tests are a strong foundation but do not establish visual quality, frame rate, or native release readiness.

Raw logs and the reproducible Node diagnostic are retained in the workspace under `.tmp/platform-audit/`. Application source was not modified by this review.
