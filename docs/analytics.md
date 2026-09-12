# Play analytics and the admin page

`/admin` shows how every game is played and holds every sound workshop behind a single sign-in. It uses the same `AUDIO_ADMIN_PASSWORD` as the individual workshops; without that variable the page stays locked.

## What the admin page shows

- **Overview**: sessions per day and how many started a round, the share that start and finish a round, median visit length and time spent in rounds, who played alone, with NPCs or with real players, and a table of every game with its crew mix and the step players most often leave at.
- **Games**: one game in depth. How far people get through every step, including that game's own milestones; where they leave; how rounds end and why; the crew mix and whether hosted rooms ever got a second person; which actions players use and which nobody uses; visit length and how the time splits between menu, lobby, rounds and results; how visits arrive and on what device; and plain-language hints about where the game loses players.
- **Sessions**: every visit, newest first, filterable by crew, way in, result, device and exit step. Opening a session shows its facts, the steps it reached, its actions and results, the full timeline, and other visits to the same room.
- **Sound**: the state of every workshop (sounds ready, missing, outdated or failed, and whether a key and voice are saved) and the workshop itself, opened in place without signing in again. The standalone workshop pages at `<route>/admin` are unchanged.
- **Avatars**: every game's player avatar walking side by side, built from each game's own model and pose code. A template avatar, the shared worker by default, is laid over every other one as a blue outline, and each card gives height and width as a difference from it. Avatars show at the size each game uses, or all at the same height to compare proportions. Each game declares its looks in `games/<id>/avatar.ts`. Above them, three potential avatars from `shared/rendering/avatars/` (one funny, one cute, one scary) can be compared before one is chosen for other games; each keeps the shared worker's rig and takes the player colour.

Every report follows the period and game filters at the top of the page.

## What is collected

A session is one visit to one game page. The browser keeps a random identifier in memory only: no cookies, nothing written to the device, no names or chat, and no IP addresses. Room codes are stored only as a 10-character hash, which is enough to group the visits to one room. [Accounts](accounts.md) are kept apart: reports are sent without cookies, and analytics code may not import the account module.

A session records its device class (touch or mouse), how it arrived (invite link, the game shelf, another game, another site, a reload), how it entered a room (solo, hosting or joining), the steps and milestones it reached, the largest crew it saw in people and NPC seats, its rounds with their results and reasons, counts of the game's declared actions, the time spent in each stage, the time the page was visible, and how the visit ended.

`shared/analytics/tracker.ts` reports two seconds after the page opens, then at most every 15 seconds while something changes, once a minute while the page stays visible, whenever the tab is hidden, and with a keepalive request when the page closes. Reports are cumulative and numbered, so a retried or duplicated delivery never counts twice. A session's timeline keeps its first 400 events; its totals keep counting.

`POST /api/analytics` validates each report against the game's own step list (`shared/analytics/protocol.ts`), checks the origin like the room APIs do, accepts at most 16 KB, and uses its own admission budget — 32 concurrent requests, 100 reports a second, 2 new visits a second and one report a second per visit — so reports cannot crowd out game traffic. Sessions unseen for 180 days are deleted together with their events, checked at most once an hour. `GET /api/admin/analytics` requires the administrator password.

## How a game reports

Each game keeps `games/<id>/analytics.ts` beside its code, holding only data and type imports: the milestones a round can reach in their usual order, the reasons rounds end, the actions worth counting, and a function that maps the game's snapshot to a `PlayState`.

| Field              | Meaning                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage`            | `menu`, `lobby`, `playing` or `finished`                                                                                                                        |
| `mode`, `room`     | How this visit entered the room. Only the first report for a room counts, so a host handover never turns a guest into a host.                                  |
| `humans`, `npcs`   | People in the room, and computer-controlled seats or roles. A computer farmer counts as an NPC; the background herd does not.                                  |
| `round`            | Changes when a new round starts, so rematches that skip the lobby still count, while a round restored from a checkpoint after a host handover is counted once. |
| `milestones`       | The milestone keys the current round has reached.                                                                                                              |
| `result`           | `won`, `lost` or `ended`, with an optional reason and score, once the stage is `finished`.                                                                     |

The game module creates `const tracker = new GameTracker(definition)` once, outside the component, so callbacks that report never become hook dependencies. The component calls `useGameTracker(tracker)`, then `tracker.observe(...)` wherever it accepts a snapshot, `tracker.action(type)` in its action function, and `tracker.observe({ stage: 'menu' })` when it leaves a room. Mounting again after the game was left starts a new visit. The tracker works out rounds, results, rounds left or called off, time per stage and exits by itself. Register the definition in `platform/analytics/catalog.ts`; `platform/analytics/catalog.test.ts` checks that every game has a route, a workshop and well-formed keys.

The two building games have no classic rounds. Permit Pending counts each job from its crew lobby to the inspection result, while sandbox sites stay in `playing`. Brick by Hand counts a visit to a building site as one round and reports its tutorial steps and the roof-raising race as milestones.

## Storage and limits

`analytics_sessions` holds one row per visit, replaced by each newer report, and `analytics_events` holds the timelines (migration `drizzle/0003_analytics.sql`). Reports aggregate the newest 100,000 sessions of a period in memory and say so when a period holds more.

Run `node scripts/test.mjs shared/analytics platform/analytics` for the tracker, validation, storage, report and per-game mapping tests.
