# Structure and efficiency audit — 2026-09-17

Scope: `games/`, `shared/`, `platform/`, `app/`, `db/`, audited at `ab6eded` and fixed on
`claude/game-structure-efficiency-review-ace67e` in three commits. 22 games, ~144k lines of
TypeScript outside tests.

## Outcome

| Gate                                      | Before  | After                          |
| ----------------------------------------- | ------- | ------------------------------ |
| Architecture boundaries                   | hold    | hold (889 files, 2834 imports) |
| `tsc --noEmit`                            | clean   | clean                          |
| `oxlint` on the source directories        | clean   | clean                          |
| Tests                                     | 1131    | **1258** (+127), all passing   |

The architecture was already sound. `scripts/check-architecture.mjs` walks the import graph
from all 63 client entries and enforces five real boundaries, which is why the collection held
together across 22 games. The work below fixes three live defects, puts decisions that belong
to the collection in one place, and adds tests that stop each problem from coming back.

| #   | Finding                                                   | Status                         |
| --- | --------------------------------------------------------- | ------------------------------ |
| A   | Three games' multiplayer clocks exploded; handover failed | **Fixed** — found while fixing |
| 1   | Two games' analytics rejected with HTTP 400               | **Fixed**                      |
| 2   | HUD re-rendered on every snapshot                         | **Fixed** in 18 of 22          |
| 4   | Registries had no completeness check                      | **Fixed**                      |
| 5   | Room-code shape written out in 23 files                   | **Fixed**                      |
| 6   | Session restore duplicated in 11 games                    | **Fixed**                      |
| 7   | 12 different pixel-ratio caps                             | **Fixed**                      |
| 8   | Six spellings of "is this a touch device"                 | **Fixed**                      |
| 12  | README listed 12 of 22 games                              | **Fixed**                      |
| 13  | Crew-counting block rebuilt by hand                       | **Fixed**                      |
| 10  | Server room handlers ~75% identical                       | Corrected; left for its own PR |
| 3   | `chaos/Game.tsx` is a 3242-line component                 | Left for its own PR            |
| 9   | Game CSS has no token layer                               | Left for a design pass         |
| 11  | Test depth varies between games                           | Corrected, partly addressed    |

Four claims in the first version of this report were wrong. They are corrected in place below
and marked **Correction**.

---

## A. Three games broke in multiplayer, and host handover failed — fixed

This was the most serious defect, and the original audit missed it. It turned up while writing
the invariant test described at the end of this section.

The peer engine calls `adapter.advance(world, now)` with an **absolute time in milliseconds**
(`shared/peer/engine.ts:213`). Court Clash, Carry-On Carnage and Bungee Doubles each handed that
value to a simulation that steps by **elapsed seconds**. `advanceBasketball` does
`w.clock += dt * 1000`, so each tick added a whole timestamp to the clock and fed the result back
in on the next tick. The clock grew exponentially:

| Game             | World clock after 6 s of play | Checkpoint restore |
| ---------------- | ----------------------------: | ------------------ |
| Court Clash      |                    `Infinity` | **rejected**       |
| Carry-On Carnage |                    `Infinity` | **rejected**       |
| Bungee Doubles   |                     `6.6e37` | accepted, but meaningless |
| other 16 games   |                  `1,006,000` | ok                 |

Every timer compared against those clocks was meaningless. The engine refuses a checkpoint whose
clock is not finite (`shared/peer/engine.ts:116`), so **host handover failed outright**: when the
host left, nobody could take over the room. Carry-On Carnage's adapter even named the parameter
`dt` while it was receiving the timestamp.

A second defect sat behind it. In multiplayer, **Court Clash and Bungee Doubles bots never
moved.** Their solo loops step the bots before advancing, but the simulation doesn't, so
wiring it straight into the adapter skipped them.

**Fix.** Each adapter now recovers the step as `now - world.clock`. The engine computes that
value as exactly the elapsed milliseconds, so the step comes out right whatever unit a game keeps
its clock in. The adapters also step the bots the way each solo loop does.

**Why no test caught it.** Every game's own tests call its simulation directly, with correct
seconds. None of them goes through the adapter, and the adapter is where the mismatch was.

**Guard.** `platform/peer/invariants.test.ts` runs every one of the 19 peer games through
`createPeerEngine`, the same entry point host handover uses, and checks what the transport
depends on:

- snapshots and checkpoints survive JSON with nothing non-finite (`sealCheckpoint` runs
  `JSON.stringify`, so a `Map`, `NaN` or `Infinity` would corrupt silently on handover)
- a restored world matches the one the old host left, and keeps playing
- players can leave mid-round
- a tab backgrounded for ten minutes comes back intact

Run against the old adapters, it fails exactly these three games and passes the other 16.

**Still open.** Bungee Doubles keeps its clock in seconds for the scene's animation, but the
engine's idle check reads it as milliseconds. As a result, idle players there are released
after minutes instead of half a second. The explosion was hiding this. Fixing it means moving the
scene's animation to milliseconds, so I've noted it and left the code alone.

## 1. Zorb Clash and Scaffold Scramble analytics were rejected — fixed

Both games mounted a `GameTracker` and posted to `/api/analytics`, but neither was registered in
`platform/analytics/catalog.ts`. `parseBatch` failed them with `Unknown game`
(`shared/analytics/protocol.ts:267`), which comes back as a 400, so every report was dropped. The
test that should have caught this asserted `GAMES.length === 20`, a number someone had updated to
match the registry rather than the game list.

Both games are now registered, along with the sound workshop and admin avatar lineup each needs.

Registering Scaffold Scramble exposed a second bug. Two of its report keys were camelCase
(`useTool`, `switchTool`). The tracker normalises an action name to kebab-case *before* matching
it against the definition, so those keys never matched and both counts silently stayed at zero.

## 2. The HUD re-rendered on every snapshot — fixed in 18 of 22

The peer connection ticks every 50 ms (`shared/peer/connection.ts:112`) and hands each game a
freshly built snapshot. Passing that snapshot straight into `setState` re-renders the whole HUD,
and no game uses `React.memo`. Drive-Thru Static was worse again: its solo loop called
`setSnapshot` on every animation frame.

> **Correction.** The first version said all 22 games did this. In fact eight had already worked
> out how to pace updates and done it by hand, six of them with character-for-character identical
> code. Thirteen didn't pace at all.

**Fix.** `shared/ui/hud-pacer.ts` implements that rule once. A game names what a player is waiting
for with `signal` (a phase, a score, a round); anything else waits for a 90 ms interval. The
scene doesn't go through React, so it still gets every snapshot. The pacer deliberately **drops**
a snapshot rather than deferring it: the next one arrives within 50 ms, and a deferred publish
could land after the player has left the room and put a stale world back on screen.

Eighteen games now use it. Stack or Sink and Uphill Delivery keep their own game-specific pacing,
because it also drives audio timing. Permit Pending and Brick by Hand are left alone on purpose:
their HUD is an interactive building tool, not a readout, so pacing it should wait for real
play-testing.

Checked in the browser on Panic Curling. Delivering a stone flipped the HUD straight away, and the
speed readout kept ticking behind it.

## 4. Registries had no completeness check — fixed

> **Correction.** The first version counted 20 collection cards; there are 22 (the grep missed
> unquoted keys). It also said Shelf Control's absence from `GameId` was a mistake. That was wrong:
> Shelf Control plays the Blend Business recordings, so leaving it out of `GameId` is by design.

`shared/games/identity.ts` is now the single list of games, and its own test checks that list
against the folders under `games/`. `platform/games/registry.test.ts` then checks the list
against every registry a game has to appear in: route, analytics, workshop, audio catalog, party
playlist, collection card, translations and the README table. A game that legitimately skips a
registry is named in `HANDWERKER_GAMES`, `BORROWED_AUDIO` or `PARTY_EXCLUDED`, with the reason.
The audio `GameId` is now derived from that list instead of being a hand-written union plus a
19-branch guard.

## 5–8. Decisions that belong to the collection, not a game — fixed

These all had the same root cause: each game re-decided something that has to be identical
across the collection.

- **Device tier (7, 8).** There were twelve different pixel-ratio caps, and only five games reduced
  anything on a phone, so two games could render 2.4× apart in pixel count on the same handset.
  `shared/browser/device.ts` now owns the queries and `renderQuality()`, with a documented `heavy`
  tier for Permit Pending. All 19 scenes build through `createRenderer`, which takes only what is
  genuinely per game (shadow style, exposure, accessible label). All six spellings of the touch
  test are gone. Three tests read every game's source so they stay gone. It also stops requesting
  `PCFSoftShadowMap`, which three 0.185 swaps for PCFShadowMap with a warning on every page.
  Verified live: Panic Curling dropped from a 2.0 cap to 1.3 on a touch device.
- **Room code (5).** The code's pattern was written out in 23 files and its alphabet in two.
  `shared/rooms/identity.ts` owns both, with one guard for a canonical code and one for
  player-typed input.
- **Session storage (6).** Eleven games inlined the same read-parse-validate-attach sequence,
  each spelling the validation slightly differently. `sessionStore(key)` owns it now. The keys
  themselves stay per game, because they name sessions that live players are holding.

## 10. Server room handlers — corrected, left for its own PR

> **Correction.** The first version said Stack or Sink had been moved to a generic `/api/rooms`
> route, so a migration template already existed. That was wrong. `/api/rooms` is just Stack or
> Sink's own server, exported under a generic name. There is no half-finished migration.

The real finding is narrower. Five games run server-authoritative rooms (Shelf Control needs this
because it has hidden roles), and all five share `shared/http/room-handler`. But their `rooms.ts`
files are about 75% identical: the same create/join/action/leave lifecycle and the same
compare-and-swap loop, with only the game functions changed. A diff of two of them is almost
entirely renames.

The peer games already solve this with a `GameAdapter`, and the server rooms need the same
treatment. It's left for its own PR because it's concurrency code covering host succession under
simultaneous requests. It needs a focused review, and its existing tests make that review
practical.

## 3, 9, 11 — left, with reasons

- **3. `chaos/Game.tsx`** is 3242 lines, with 57 `useState` in a single component. It's the
  flagship game and its HUD is a building interface, so breaking it up needs real play-testing
  rather than a mechanical split.
- **9. CSS** has 2,261 hardcoded hex colours (1,465 distinct) and 1,137 raw pixel font sizes,
  against 53 custom properties. This belongs in a design pass, not a refactor, since every change
  there is a visual one.
- **11. Test depth.** > **Correction.** Measured against all source, the ratio overstated the gap,
  because most of the untested code is Three.js scene construction. Measured against simulation
  code only, the eight newest games sit at 0.16–0.28 lines of test per line of simulation, while
  the mature ones sit around 2.0. Their existing tests do cover each game's core mechanic. The
  cross-game invariant test above adds depth to all 19 peer games at once, and it's the test that
  found finding A.

## Also noticed

`shared/accounts/server/routes.test.ts:484` ("starts are still limited") failed once in six
full-suite runs, with a `302` where it expected a `429`. It passes every time in isolation. It
fills a rate limiter against the wall clock, so under full-suite load the bucket can refill before
the 200-request loop hits the limit. None of this work touched it.
