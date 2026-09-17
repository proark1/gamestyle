# Structure and efficiency audit — 2026-09-17

Scope: `games/`, `shared/`, `platform/`, `app/`, `db/` at `ab6eded`. 875 files, ~144k lines of
TypeScript outside tests, 31k lines of CSS, 22 games.

## Verdict

The architecture is sound and unusually well guarded for a codebase this size. Every gate is green:

| Gate                                                     | Result                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `node scripts/check-architecture.mjs`                    | pass — 875 files, 2725 local imports, 63 client entries, boundaries hold    |
| `tsc --noEmit`                                           | pass                                                                       |
| `oxlint app games shared platform db lib hooks`          | pass, no diagnostics                                                       |
| `node scripts/test.mjs`                                  | pass — 1131 tests, 0 failures, 49s                                         |
| TODO/FIXME/HACK in non-test source                       | 15 across ~144k lines                                                      |

The strongest asset is `scripts/check-architecture.mjs`. It parses every file with the TypeScript
AST and enforces five real invariants: no game imports another game's implementation, `shared/`
never depends on `games/`/`platform/`/`app/`, no implementation imports a route, analytics never
reach `shared/accounts/`, and no `'use client'` entry can transitively reach a server module. That
last check is a transitive graph walk from all 63 client entries — most projects this size have
nothing equivalent, and it is why the boundaries have actually held across 22 games.

The per-game template is consistent, which is what makes the collection maintainable: 22 games each
with `translations.ts`, `scene.ts`, `avatar.ts`, `analytics.ts`, `Game.tsx`, and 20 with
`simulation.ts` / `types.ts`. `games/<id>/peer.ts` is a genuinely thin `GameAdapter`
(70–135 lines of configuration, not copied logic), and `app/<id>/page.tsx` is an 11-line route.
Per-frame `THREE` allocation is disciplined — no file allocates more than 11 vectors/quaternions
total, so scratch objects are module-scoped rather than created in loops. Client bundles are
correctly isolated: the all-games registries in `platform/audio/catalog.ts` and
`platform/peer/engine.ts` are imported only by route files, and `app/party/PartyClient.tsx`
navigates to routes instead of importing 22 games.

So: yes, it is good. The items below are where it can be better, ranked by what they cost.

---

## 1. Zorb Clash and Scaffold Scramble telemetry is rejected with HTTP 400

This is a live defect, not a style point.

Both games construct and mount a tracker — `games/zorb-clash/Game.tsx:31,163` and
`games/scaffold-scramble/Game.tsx:49,71` call `new GameTracker(...)` + `useGameTracker(tracker)`,
which POSTs to `/api/analytics`. But neither is registered in `platform/analytics/catalog.ts`:
`GAMES` has 20 entries for 22 game folders, and these two are the omissions.

The ingest route calls `parseBatch(body, analyticsGame)`
(`platform/analytics/server/ingest-route.ts:33`), and `parseBatch` does
`if (!definition) fail('Unknown game.')` (`shared/analytics/protocol.ts:267`), which becomes an
`AnalyticsError` → **400 on every batch**. Every report these two games send is discarded, and they
are absent from the admin dashboard, which renders from `GAMES`
(`platform/admin/AdminHub.tsx:221`, `platform/admin/GamePanel.tsx:59`).

The omission is also locked in by the test that should have caught it:
`platform/analytics/catalog.test.ts:20` asserts `GAMES.length === 20`. The magic number was updated
to match the registry instead of the game list, so the suite is green while two games are unwired.

**Fix.** Register both games in `GAMES`, then replace the hardcoded count with a derived assertion:
read `games/` with `readdirSync` and assert every directory appears in the catalog. See finding 4 —
this is the general pattern.

## 2. Every game re-renders its whole HUD 20 times per second

`shared/peer/connection.ts:112` runs `setInterval(() => this.tick(), 50)`, and `tick()` calls
`this.deliver(snapshot)` unconditionally with a freshly built snapshot object
(`shared/peer/connection.ts:250-256`). All 22 `Game.tsx` files pass that straight into
`setState`, so React sees a new object identity 20 times a second and cannot bail out.

There is **no `React.memo` anywhere in the repository** (0 occurrences across all 22 games), and the
big `Game.tsx` files are each a *single* component, so there is no memoization boundary to help:

| Game             | Game.tsx LOC | JSX elements rebuilt per tick | components in file |
| ---------------- | -----------: | ----------------------------: | -----------------: |
| chaos            |         3242 |                           417 |                  1 |
| stack-or-sink    |         1354 |                           284 |                  1 |
| reel-problems    |         1444 |                           231 |                  2 |
| siege-and-desist |         1415 |                           222 |                  1 |
| act-natural      |         1146 |                           212 |                  2 |
| dont-wake-the-giant |       944 |                           186 |                  1 |
| wrong-floor      |         1072 |                           182 |                  1 |

Permit Pending reconstructs a 417-element tree 20 times a second, alongside the WebGL frame loop, on
phones. That is the most likely remaining source of the mobile jank the last few commits have been
chasing game by game.

**Fix, in order of payoff:**

1. Keep the snapshot in a ref and expose it through a subscription (`useSyncExternalStore` with a
   selector), so a HUD element re-renders only when the field it reads changes. This is the real fix
   and it belongs in `shared/peer/` so all 22 games inherit it.
2. Failing that, split the hot snapshot out of the component: pass it to memoized leaf components
   (`<ScoreBar score={...}/>`) rather than reading `state.world.*` inline in a 400-element tree.
3. Cheapest interim step: throttle the React-visible copy to ~6–10 Hz while the scene keeps the
   full 20 Hz stream, since `scene.current?.setState(next, ...)` already bypasses React.

## 3. `chaos/Game.tsx` is a 3242-line component with 57 useState hooks

`games/chaos/Game.tsx` holds 57 `useState` and 21 `useEffect` calls in one component, and reads the
snapshot 75 times in that single render body. The state clusters cleanly and could be lifted almost
mechanically:

- build/placement — `selected`, `rotation`, `buildLevel`, `demolish`, `paint`, `finish`,
  `painting`, `wholeHouse`, `selectedRoof`
- panels — `buildOpen`, `catalogOpen`, `projectsOpen`, `contractOpen`, `mobilePanel`, `help`,
  `settings`
- session — `code`, `session`, `connectionStatus`, `joining`, `resumeSession`
- audio — `sound`, `broadcast`, `gameVolume`

Six other games are over 1000 lines in a single component (`reel-problems`, `siege-and-desist`,
`stack-or-sink`, `first-person`, `act-natural`, `wrong-floor`). Extracting hooks here also creates
the memo boundaries finding 2 needs, so do them together.

## 4. A game's identity is spread across nine places, and only one is test-enforced

Adding a game means touching, by the checklist in `docs/architecture.md:79`, nine locations. Their
current counts disagree:

| Registry                                    | Games listed |
| ------------------------------------------- | -----------: |
| `games/` directories                        |       **22** |
| `app/<id>/page.tsx` routes                  |           22 |
| `app/CollectionClient.tsx`                  |           20 |
| `platform/analytics/catalog.ts`             |           20 |
| `shared/audio/types.ts` `GameId`            |           19 |
| `platform/audio/catalog.ts`                 |           19 |
| `platform/party/playlist.ts`                |           19 |
| README game table                           |           12 |

Some gaps are deliberate: `chaos` and `first-person` are the Handwerker product and correctly sit
outside the party playlist. Others are not — `shelf-control` is a fully public game with a
collection card and translations but is missing from `GameId`, and finding 1 is the analytics case.

Only the avatar lineup actually fails a build when a game is left out
(`platform/admin/avatars/catalog.test.ts:71`). Everywhere else, omission is silent.

**Fix.** Add one test that reads `games/` from disk and asserts each directory is present in (or
explicitly exempted from, with a reason) every registry. That single test converts nine manual
checklist steps into one enforced invariant, and would have caught finding 1 the day it landed.
`GameId` also belongs in a neutral module — the collection's canonical identity type currently
lives inside `shared/audio/types.ts`.

## 5. The room-code shape is copy-pasted into 23 files

`/^[A-Z2-9]{6}$/` is re-declared independently in 23 files — 19 under `games/` and 4 under
`shared/` (`shared/http/request-budget.ts`, `shared/peer/coordinator.ts`, `shared/ui/PartyRibbon.tsx`,
`shared/voice/membership.ts`). Changing the code alphabet or length is a 23-file edit where a single
missed site becomes an intermittent join failure.

`shared/rooms/identity.ts` already exists for exactly this purpose — it holds `hashToken` and
`playerName` with the comment *"Keep the persisted token representation identical across all room
adapters."* Export `ROOM_CODE` and `isRoomCode()` there and replace all 23 literals.

## 6. Session restore is duplicated verbatim across 11 games

Eleven `Game.tsx` files carry their own `SESSION_KEY` block: `sessionStorage.getItem` → `JSON.parse`
→ validate `peer === true` and the code/id/token shapes → `attach(saved)`, plus a matching
reconnect path that resets `latest`, `input`, `sound` and `scene` in the same order. Block-level
comparison finds these as byte-identical 8+ line runs across `four-brain-cells`, `load-bearing`,
`one-more-button`, `reel-problems`, `siege-and-desist` and `wrong-floor`.

**Fix.** One `useGameSession()` hook in `shared/peer/` returning
`{ session, status, attach, reconnect }`. This is the single highest-value extraction in the
codebase: it removes ~11 copies of persistence *and* reconnect ordering, both of which are easy to
get subtly wrong in a copy.

## 7. Renderer setup is duplicated 19 times with divergent quality policy

Each game builds its own `new T.WebGLRenderer(...)` in `scene.ts`. There is no shared factory, and
the quality settings have drifted into 12 different pixel-ratio caps:

| Cap                       | Games                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| mobile-aware (1.15–1.3 / 1.6–1.8) | chaos, act-natural, dont-wake-the-giant, stack-or-sink, siege-and-desist |
| flat 2.0                  | carry-on-carnage, crane-clash, panic-curling, sample-stampede, scaffold-scramble, zorb-clash |
| flat 1.6–1.8              | basketball, bungee-doubles, drive-thru, first-person, four-brain-cells, load-bearing, one-more-button, reel-problems, shelf-control, wrong-floor |

Only 5 of 22 games reduce resolution on touch devices. A game capped at 2.0 on a 3× phone renders
**2.4× more pixels** than one capped at 1.3 — on the same device, in the same collection. Shadow
maps and tone mapping diverge the same way (6 games set no `toneMapping` at all), and the import
alias is split `import * as T` (87 files) vs `import * as THREE` (9).

**Fix.** `shared/rendering/create-renderer.ts` taking a device tier and returning a configured
renderer plus its resize/dispose handlers. Games that genuinely need different shadows pass that as
a parameter — the point is that the *device policy* is decided once.

## 8. Six different spellings of "is this a touch device"

Games detect touch/small screens ad hoc, in six mutually non-equivalent forms:
`(pointer:coarse)`, `(pointer: coarse)`, `(pointer: coarse), (max-width: 900px)`,
`(max-width: 900px), (pointer: coarse)`, `(any-pointer: coarse), (max-width: 900px)`, and
`'ontouchstart' in window || navigator.maxTouchPoints > 0` — 40 detection sites in total.

Meanwhile `shared/browser/platform.ts` already exports `isMobile()` (768px breakpoint),
`isTouchDevice()`, `getPlatform()` and `isStandalone()`, and **their only importer is their own
test file**. `shared/browser/use-media-query.ts` has no game consumers either. The module's
`initNativeApp` is wired up properly (`app/layout.tsx:9` via `NativeProvider`) and `wake-lock` /
`haptics` reach games indirectly through `GameToolbar` and `TouchControls` — it is specifically the
detection API that went unused while 22 games each reinvented it.

Pick one breakpoint, export it from `shared/browser/platform.ts`, and replace the 40 sites. This is
the same root cause as finding 7: without a shared device-tier concept, every game guesses.

## 9. Game CSS has no token layer

Across `games/*/*.css` (about 21k of the 31k CSS lines):

- **2,261** hardcoded hex colors, **1,465 of them distinct**
- **1,137** raw `px` font sizes
- against only **316** `var(--…)` reads and **53** custom properties defined

`shared/styles/game-ui.css` is loaded globally in `app/layout.tsx:8`, but only `load-bearing`
mentions building on it. `shared/rendering/palette.ts` is a four-colour array used by 4 of 22 games.
A 22-game collection meant to read as one product currently has 1,465 distinct colours.

**Fix.** Promote the recurring HUD patterns (panel, pill, toast, mobile action button) and a colour
plus type scale into `shared/styles/game-ui.css` as custom properties, then migrate games
opportunistically. Worth doing before the next visual pass, not as a standalone refactor.

## 10. Three parallel multiplayer transports

| Transport                                            | Games                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Peer mesh (`shared/peer/engine` + `GameAdapter`)     | 17 games — the modern path, one `/api/peer` + `/api/rooms`               |
| HTTP room polling with a **bespoke** route           | act-natural, dont-wake-the-giant, shelf-control, uphill-delivery         |
| Handwerker server (`games/*/server/`, `/api/handwerker/*`) | chaos, first-person                                                |

Four games still fetch game-specific endpoints — `/api/act-natural`, `/api/dont-wake-the-giant`,
`/api/shelf-control`, `/api/uphill-delivery` — for lobby and join. `stack-or-sink` has already been
moved to the generic `/api/rooms` (`games/stack-or-sink/connection.ts:41`) while keeping its
`rooms.ts`, so **the migration template already exists and is proven**. `shelf-control` is the only
game with no peer path at all.

The polling stack itself is well built — `shared/http/room-handler.ts` is used by all five
`server.ts` files, and `shared/rooms/input-rate.ts` / `shared/http/request-budget.ts` provide shared
`MIN_POLL_MS` and rate limiting. This is a half-finished migration, not bad code. Finishing it
retires four API routes and one of three transports; note that `chaos` and `first-person` are a
separate product and should stay as they are.

## 11. Test coverage varies 7× across games

Test-to-source line ratio:

| Ratio       | Games                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| 0.28–0.37   | uphill-delivery, act-natural, shelf-control, stack-or-sink, dont-wake-the-giant, reel-problems, chaos |
| 0.12–0.23   | four-brain-cells, wrong-floor, siege-and-desist, one-more-button, load-bearing, first-person, crane-clash |
| **0.05–0.09** | **basketball, sample-stampede, drive-thru, panic-curling, scaffold-scramble, zorb-clash, carry-on-carnage, bungee-doubles** |

The eight thinnest are the eight newest party games. `basketball` has 234 test lines for 4,432
source lines. They are also the games missing from registries (finding 1) and the ones with flat
2.0 pixel ratios (finding 7) — the same "added fast, integration lagged" pattern showing up three
ways.

## 12. Smaller items

- **Analytics `playState` boilerplate.** The `base` block (`modeOf`, `room`, `humans`, `npcs`,
  `round`) plus the lobby/playing/finished switch is duplicated identically across at least 6
  games. A `basePlayState(snapshot, session)` helper in `shared/analytics/protocol.ts` removes
  ~25 lines × 22 games while leaving the genuinely game-specific milestone logic in place.
- **README drift.** The table lists 12 games and the prose says "twelve games" and "eleven games";
  10 games are missing entirely (basketball, bungee-doubles, carry-on-carnage, crane-clash,
  drive-thru, load-bearing, panic-curling, sample-stampede, scaffold-scramble, zorb-clash). The
  table calls itself "the authoritative mapping," which makes the drift actively misleading.
- **75 design/validation markdown files under `games/*/docs/`.** Useful history, but per-game design
  docs and the central `docs/` tree now overlap; worth deciding which is canonical.

---

## Recommended order

1. **Register the two missing games and derive the registry test from `games/`** (findings 1, 4).
   Small, fixes a live defect, and stops the next recurrence.
2. **`useGameSession()` hook** (finding 6). Removes 11 copies of the most error-prone logic.
3. **Snapshot subscription + memo boundaries in `shared/peer/`** (finding 2). Biggest runtime win,
   and it lands for all 22 games at once.
4. **Shared renderer factory and one device-tier helper** (findings 7, 8). Makes mobile quality a
   single decision instead of 22.
5. **Decompose `chaos/Game.tsx`** (finding 3), which is much easier once 3 exists.
6. **Finish the transport migration for the four bespoke-route games** (finding 10), following the
   `stack-or-sink` template.
7. **Backfill tests on the eight thin games** (finding 11), and fix the README (finding 12)
   whenever the table is next touched.

Items 1, 2 and 7 are each under a day. Items 3 and 4 are the ones that change how the next game gets
added.
