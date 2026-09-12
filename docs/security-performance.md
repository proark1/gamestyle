# Shared-server security and performance

Audit date: 2026-09-08. The audit used isolated local data. These changes were subsequently deployed to Railway production; see the [release verification](deployment-2026-09-08.md).

## Implementation

- All room, voice, build-save and audio mutation APIs use one streamed JSON reader. It counts UTF-8 bytes, handles missing/incorrect Content-Length, rejects invalid objects, cancels oversized streams and enforces a 10-second total upload deadline. Limits remain specific to each API (1–5 KB for ordinary requests, 16 KB for workshop requests, 280 KB for peer checkpoints).
- A shared per-process admission limit allows 128 simultaneous API handlers. Room creation has a collection-wide burst of 120, replenished at two rooms/second. Joining is limited per room; game updates have separate per-room and per-member budgets. Tracking is capped at 4,096 keys. Saturation returns retryable 429/503 responses instead of allowing unbounded queues. Forwarded IP headers are not trusted.
- Workshop library access, settings, key management and every paid generation operation require `AUDIO_ADMIN_PASSWORD`; same-origin checks remain an additional write condition. Missing configuration disables administration. Published manifests and files remain public. The password is checked on the server and held only in browser memory after sign-in. See [setup](audio-setup.md).
- Both workshop APIs use a common transport and a ten-second manifest cache. Concurrent readers share one database load; edits invalidate cached manifests. Failed reads are not cached. Game-specific catalogs and the two existing storage contracts remain separate.
- Peer messages store only recognized SDP/ICE fields. Individual field limits, a 128 KB total signal-queue budget and the existing encrypted-checkpoint limit prevent amplification through unused JSON properties. Membership authentication, hidden-state handling, host election and recovery remain covered by regression tests.
- The Node database adapter caches up to 256 prepared statements while keeping each request's bindings separate. All games share one SQLite connection and group ready writes in a two-millisecond window. Every operation has its own savepoint; acknowledgements wait for the durable commit. WAL, `synchronous=FULL`, compare-and-swap conflict checks and crash persistence are preserved.
- Play analytics (added later, see [play analytics](analytics.md)) arrive at `POST /api/analytics` with the same origin check and streamed reader, a 16 KB limit, validation against each game's step list and a separate admission budget of 32 concurrent requests, 100 reports a second, 2 new visits a second and one report a second per visit, so reports cannot take capacity from rooms. Reports store no names, IP addresses or room codes, only a room hash, and are deleted after 180 days. `GET /api/admin/analytics` requires `AUDIO_ADMIN_PASSWORD` and shares a bucket of 120 requests (two a second) between password attempts and report loads.
- Player accounts (added later, see [accounts](accounts.md)) have their own admission budget. Every cookie-authenticated write needs an allowed `Origin` before any database access. Session tokens and sign-in codes are stored only as hashes, and email codes are limited per address in the database and per browser in memory.
- The architecture check now follows client dependency chains and rejects database/server implementations in browser modules, in addition to enforcing game-folder ownership and shared-code boundaries. Cloudflare binding types are imported explicitly so their global types cannot replace Node/DOM types.
- Cloudflare tools and affected transitive packages were patched. A scoped esbuild override fixes the deprecated loader dependency retained by Drizzle Kit; migration and both build targets must be checked when updating this override.

## Validation and measurement

The SQL read microbenchmark used five runs of 20,000 parameterized reads against in-memory SQLite on Node 24.14.0. Median duration decreased from 312.19 ms to 62.80 ms after statement caching. This measures SQL preparation overhead, not whole-game throughput.

`npm run test:load` is an intentionally local-only HTTP load test. Start a Node production build with an isolated SQLite database first. `LOAD_TEST_URL` defaults to `http://127.0.0.1:3057`; `LOAD_TEST_ROOMS` defaults to four rooms per game and `LOAD_TEST_SECONDS` to 30. Four players occupy each room: 28 rooms / 112 clients across seven games. The four peer games send one-second membership polls and valid synthetic encrypted recovery payloads of roughly 64 KB each second per host. Shelf Control runs its round with movement updates at its normal 65 ms interval. Construction games send position updates at 220 ms. Polls never overlap for one simulated client, so saturation reduces achieved throughput rather than accumulating unlimited client requests.

The initial mixed-game run after statement caching but before shared group commit completed 5,954 requests in 30.07 seconds with zero errors: 198 requests/second, p50 342 ms, p95 713 ms. A CPU profile identified synchronous SQLite writes as the largest bottleneck. This is why group commit was extended from construction batches to all writes and games.

With shared group commit, the same 112-player / 28-room workload completed 9,104 requests in 30.05 seconds with zero errors: 303 requests/second, p50 165 ms and p95 321 ms. Relative to the initial run, throughput increased by 53% and p95 latency decreased by 55%. The reduced 56-player / 14-room workload completed 6,490 requests in 30.09 seconds with zero errors: 216 requests/second, p50 44 ms and p95 150 ms. These are individual local runs, not statistical capacity estimates. The 112-player result remains too slow to promise consistently smooth server-authoritative play on this machine.

| Workload | Rooms | Simulated players | Requests/s | p50 | p95 | HTTP errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before shared group commit | 28 | 112 | 198 | 342 ms | 713 ms | 0 |
| After shared group commit | 28 | 112 | 303 | 165 ms | 321 ms | 0 |
| Lower load after group commit | 14 | 56 | 216 | 44 ms | 150 ms | 0 |

The HTTP security probe verifies streaming limits and origin rejection for eleven mutation endpoints, administrator access for all six workshop libraries, and public playback manifests. It makes no paid provider calls. Regression coverage includes durable acknowledgement, failed-batch isolation, stale-version rejection, independent bindings in cached statements, stalled/chunked uploads, signal-field sanitization, queue limits and manifest-cache invalidation. Dependency verification reports zero known vulnerabilities in the installed lockfile.

- `npm run check`: formatting, TypeScript, lint, architecture checks and all 647 tests pass.
- Both Cloudflare Worker and Node/Railway production builds pass with the patched dependencies.
- The final Node build serves all 16 checked routes and 74 referenced assets. Every workshop renders its sign-in form; server administrator configuration and the isolated test credential are absent from browser JavaScript. Authenticated volume edits pass for all six libraries while unauthenticated edits are rejected.
- Multiplayer HTTP integration checks pass for all seven games, including four-player capacity, authentication, shared state and game actions. Brick by Hand passes all 26 integration assertions.
- Real four-client WebRTC integrations pass for all four peer games against the local Node HTTP coordinator and shared SQLite database, including direct generated voice, abrupt host loss, checkpoint recovery, continuing rounds and graceful host handover (338–1,051 ms).
- No manual browser, mobile-device or two-network microphone playthrough was performed in this audit.

Detailed command output and local-only databases/profiles are retained in the ignored `.tmp/security-audit/` directory. The checked-in load-test script makes the capacity experiment repeatable without publishing any local sessions or credentials.

## Deployment limits

These results apply to this local machine and synthetic workload. They do not establish a player capacity for a Railway instance, mobile performance, real internet latency or TURN bandwidth. Benchmark the actual production instance class before promising a capacity. Large construction worlds and extra NPCs can cost substantially more CPU than the load-test scenes.

The in-process budgets supplement an edge/proxy rate limiter; they are not a distributed DDoS defense. Separate processes have separate budgets and caches. SQLite remains a single-writer database on one persistent volume; multiple replicas must not mount and write the same database file as a scaling strategy. Monitor request latency, event-loop delay, memory, disk growth and CPU under real play. Back up the SQLite database, audio directory and master key together. Existing saved builds and construction rooms retain their persistence behavior; automated archival/retention is not introduced by this audit.
