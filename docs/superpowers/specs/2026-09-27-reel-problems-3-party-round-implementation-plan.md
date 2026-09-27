# Reel Problems 3 Party Fishing Round Implementation Plan

**Date:** 2026-09-27

**Design:** [2026-09-27-reel-problems-3-party-round-design.md](2026-09-27-reel-problems-3-party-round-design.md)

## Outcome

Replace Reel Problems 3's scripted scene-to-scene voyage with one complete eight-to-ten-minute party fishing round. Four crew slots are always occupied by humans or bots. The crew physically loads a modeled boat, sails through a deterministic streamed ocean, completes arcade-fishing missions, survives bounded chaos, and docks before time expires. The boat's survival is shared while scores and awards are individual.

This plan changes Reel Problems 3 only, apart from its party guide and collection copy. Reel Problems 1 remains a reference implementation and must not be modified.

## Execution Rules

- Work from the latest `origin/main` in a clean branch or worktree. Preserve unrelated changes.
- Use test-first slices: write the failing focused test, implement the smallest coherent behavior, then run the broader Reel Problems 3 suite.
- Keep `AdventureWorld` and checkpoints structured-clone safe. Three.js, Cannon, audio, input-device, and object-pool instances must stay in runtime caches.
- Keep the host authoritative. Client actions express intent; clients never set trusted positions, catches, mission progress, or scores.
- Reuse concepts and tested equations from `games/reel-problems`, but do not import that game's mutable world or couple the two games.
- Do not ship a partially converted production round. The final release gate requires the full end-to-end loop.
- Deployment is a separate action and requires an explicit user request after implementation and validation.

## Task 1 — Establish the new world schema and deterministic content catalogs

### Files

- Replace the legacy phase types in `games/reel-problems-3/types.ts`.
- Add `games/reel-problems-3/random.ts`.
- Add `games/reel-problems-3/content/items.ts`.
- Add `games/reel-problems-3/content/fish.ts`.
- Add `games/reel-problems-3/content/missions.ts`.
- Add `games/reel-problems-3/content/chaos.ts`.
- Add `games/reel-problems-3/content/content.test.ts`.
- Add `games/reel-problems-3/random.test.ts`.

### Work

Define a structured-clone-safe `AdventureWorld` with these top-level units: round, players, boat, items, fish, missions, streamed world, chaos, scores, events, and deterministic random state. Replace the old harbor/search/storm/sanctuary progression with explicit round states: lobby, preparing, outbound, fishing, returning, docking, finished, and failed.

Define typed client inputs for movement, look, sprint, steering, throttle, reeling, and bracing. Define discriminated actions for start, restart, pick up, drop, throw, place, cast, hook, release, use, claim station, and leave station.

Create stable content identifiers and immutable definitions for:

- the approved equipment catalog;
- six fish species: silver sprat, coral mackerel, blue cod, glassfin, lantern eel, and storm tuna;
- six approved mission templates;
- ten approved chaos event kinds;
- authored harbor, fishing-site, hazard, and landmark modules.

Implement a small seedable generator whose state is stored in the world. Provide deterministic selection, weighted choice, shuffle, and derived per-cell seeds without using `Math.random()` in authoritative rules.

Tests must prove that all identifiers are unique, every item has a model key, physical profile, interaction profile, rack or recovery rule, every fish has behavior and scoring data, every mission references existing content, every chaos event declares severity and prerequisites, and equal seeds produce equal sequences.

### Exit gate

The new schema and catalogs type-check, serialize through `structuredClone` and JSON, and pass deterministic content tests before simulation behavior is migrated.

## Task 2 — Build the round, mission, and score directors as pure rules

### Files

- Add `games/reel-problems-3/round.ts`.
- Add `games/reel-problems-3/missions.ts`.
- Add `games/reel-problems-3/scoring.ts`.
- Add `games/reel-problems-3/round.test.ts`.
- Add `games/reel-problems-3/missions.test.ts`.
- Add `games/reel-problems-3/scoring.test.ts`.
- Refactor `games/reel-problems-3/simulation.ts` into an orchestration layer.
- Replace the old linear-voyage assertions in `games/reel-problems-3/simulation.test.ts`.

### Work

Implement the eight-to-ten-minute state machine:

- sixty-second preparation window;
- outbound state until the first active mission zone is reached;
- three validated fishing objectives;
- return state after the shared quota is complete;
- docking validation at harbor;
- success, timeout, and boat-failure endings.

Mission generation must be deterministic from the round seed. It must reject combinations that lack required species, tools, sites, or achievable travel time, then choose the next valid deterministic candidate. Store generated missions in the checkpoint rather than regenerating them during a running round.

Implement shared completion and individual score events. Scoring must cover requested catches, weight, rarity, cast accuracy, tension control, net assists, navigation, repair, rescue, securing cargo, dropped catches, lost equipment, collision damage, and the shared safe-return bonus. Derive end-of-round awards from recorded stats with deterministic tie handling.

Keep directors pure: they accept the serializable world plus a bounded delta or command and return mutations/events without referencing rendering, browser state, or audio.

### Exit gate

Tests cover all legal round transitions, invalid early docking, timeout, boat failure, mission validation, deterministic fallback, individual scoring, shared bonus, penalties, awards, and a complete rules-only round.

## Task 3 — Implement the authoritative boat and streamed ocean vertical slice

### Files

- Add `games/reel-problems-3/boat.ts`.
- Add `games/reel-problems-3/world-stream.ts`.
- Replace phase layouts in `games/reel-problems-3/physics-layout.ts` with harbor, boat-local, and streamed-world definitions.
- Extend `games/reel-problems-3/physics.ts` for the moving boat coordinate frame.
- Replace and extend `games/reel-problems-3/physics.test.ts`.
- Add `games/reel-problems-3/boat.test.ts`.
- Add `games/reel-problems-3/world-stream.test.ts`.

### Work

Implement a bounded authoritative boat model with position, yaw, linear speed, steering response, throttle, roll, pitch, hull condition, flood level, engine state, and docking state. Use stable gameplay movement rather than an unconstrained boat rigid body. Apply shore and obstacle collisions, impact damage, speed limits, and a docking envelope.

Add explicit `toBoatSpace` and `toWorldSpace` helpers. Players and deck items remain in boat-local coordinates while aboard. Overboard entities use world coordinates and convert back through one tested boundary.

Build the world streamer around integer ocean cells and a shared seed. The harbor occupies an authored fixed region. Nearby cells deterministically expose static module descriptors for water, navigation markers, fishing zones, islands, rocks, debris lanes, and weather cells. The host keeps only the active-radius dynamic state; clients reconstruct static descriptors from the same seed.

Define a conservative mobile active radius and hysteresis so crossing a cell boundary does not churn cells every frame. Dynamic mission content cannot despawn while referenced by a mission, player, line, catch, or incident.

Refactor Cannon integration so player bodies collide with the deck and fixtures in boat space while world-space swimmers and hazards remain separate. Preserve fixed stepping, bounded catch-up, safe reset, and runtime caching.

### Exit gate

A rules-only test can start at harbor, steer out, cross streamed cells, collide with an obstacle, reach a generated mission zone, turn home, and dock. Equal seeds expose equal cells. Physics caches remain absent from snapshots.

## Task 4 — Build the physical item lifecycle and station system

### Files

- Add `games/reel-problems-3/items.ts`.
- Add `games/reel-problems-3/stations.ts`.
- Add `games/reel-problems-3/items.test.ts`.
- Add `games/reel-problems-3/stations.test.ts`.
- Extend `games/reel-problems-3/physics.ts` with bounded item bodies and sleeping.
- Extend `games/reel-problems-3/simulation.ts` action routing.

### Work

Spawn real item instances from content definitions and place them at authored harbor or boat stations. Implement stable state transitions between racked, loose, held, thrown, floating, submerged, secured, and recovering.

Support one large held item or two compatible small items. The host validates reach, hand capacity, station compatibility, ownership, and cooldown before pickup, placement, drop, or throw. Use player-facing direction plus clamped force for throws; never trust a client-supplied final velocity.

Give each station one explicit purpose and reservation: rod rack, bait table, net rack, ice hold, engine, fuel port, repair bench, bilge pump, rescue line, chart, helm, and throttle. A human action evicts a bot reservation before validation.

Implement water behavior and recovery. Floating items stay within a bounded recoverable radius. Critical submerged or missing items recover to their rack after a delay. Recovery must never duplicate an existing valid instance.

Limit awake loose items, put settled objects to sleep, and collapse distant decorative motion into serialized resting poses.

### Exit gate

Tests cover pickup races, two-hand capacity, throwing, wave displacement, station placement, human priority, overboard conversion, floating, unique recovery, reconnect serialization, and the inability to make a round unwinnable by discarding essential equipment.

## Task 5 — Add complete arcade fishing and the six-species behavior catalog

### Files

- Add `games/reel-problems-3/fishing.ts`.
- Add `games/reel-problems-3/fishing.test.ts`.
- Add `games/reel-problems-3/fish-behavior.test.ts`.
- Extend `games/reel-problems-3/simulation.ts`.
- Use algorithms from `games/reel-problems/simulation.ts` and `games/reel-problems/cooperation-chaos.test.ts` as references, without importing their world state.

### Work

Implement the complete authoritative sequence: equip rod, bait, aim, charge cast, create line, detect bite, hook window, fight, reel, tension failure, tangle, untangle, land, net assist, release, carry, and secure.

Represent line endpoints and hooked fish in world space, while the rod hand follows the player's current boat-local pose. Recalculate the world-space rod origin each step. Test the conversion while the boat turns and moves.

Reuse the proven tension/strain principles from Reel Problems 1, adapted to the new mission and item systems. Tension must respond to reel input, fish pull, rod angle, distance, tangles, and species strength. A red-band overload accumulates strain before failure so latency does not cause instant unexplained snaps.

Give each species a distinctive authored behavior:

- silver sprat: easy, quick bites, small solo landing;
- coral mackerel: fast schooling turns;
- blue cod: steady deep pull;
- glassfin: fragile, narrow safe-tension band;
- lantern eel: rare glowing movement and erratic direction;
- storm tuna: heavy surges and mandatory landing-net assistance.

Detect line intersections at a bounded cadence and tangle only active nearby lines. An untangle interaction clears the pair after a short uninterrupted action. There is no line-cut action.

Award a catch only after it is secured in the correct container. Unsecured landed fish are physical items and can flop, slide, be picked up by another player, or escape.

### Exit gate

Tests cover every fishing state, missed bites, safe and unsafe tension, latency-tolerant strain, species behavior, line movement on a turning boat, tangles, net assistance, release, unsecured fish, storage, and mission/score credit.

## Task 6 — Fill and operate the four-person bot crew

### Files

- Add `games/reel-problems-3/bots.ts`.
- Add `games/reel-problems-3/bot-navigation.ts`.
- Add `games/reel-problems-3/bots.test.ts`.
- Modify `games/reel-problems-3/peer.ts`.
- Extend `games/reel-problems-3/simulation.ts`.

### Work

Reconcile the roster to four crew slots when a round starts and whenever a human joins or leaves. Use stable per-seat bot identifiers. Mark bots as autonomous in the peer adapter so network membership reconciliation does not remove them. Replace an unneeded bot when a human takes its seat, transferring only seat assignment and dropping any bot-held item safely.

Implement a host-only utility job system. Candidate jobs include rescue, urgent repair, bailing, helm, docking, net assist, catch storage, equipment recovery, bait preparation, and fishing. Score jobs by severity, mission relevance, distance, existing reservation, human claim, and crew coverage.

Update bot decisions at a limited cadence rather than every physics tick. Route bots across an authored boat navigation graph and harbor loading paths; use direct steering only within a station approach. Detect stuck bots and reset only that bot to the nearest safe node after a bounded timeout.

Bots execute the same item, station, fishing, rescue, and helm commands as humans. Give them slower reaction windows, imperfect casts, conservative tension control, and reduced personal score weighting. Any human station or task claim cancels the bot reservation immediately.

### Exit gate

Tests cover one human plus three bots, two humans plus two bots, four humans, human mid-round join, disconnect replacement, job uniqueness, urgent rescue priority, human station takeover, stuck recovery, and a deterministic full round completed by one human with three bots.

## Task 7 — Add the bounded chaos director and ten recoverable incidents

### Files

- Add `games/reel-problems-3/chaos.ts`.
- Add `games/reel-problems-3/chaos.test.ts`.
- Extend `games/reel-problems-3/items.ts`, `fishing.ts`, `boat.ts`, and `world-stream.ts` through typed incident hooks.
- Extend `games/reel-problems-3/simulation.ts` event orchestration.

### Work

Represent incidents as a discriminated state with severity, eligibility, start time, end condition, cooldown, claimed tools, temporary entities, and cleanup behavior. Permit at most one major and one minor incident concurrently.

Implement the approved catalog:

1. wave rolls loose items and can knock an exposed player overboard;
2. active fishing lines tangle;
3. a large fish pulls a player toward the rail;
4. seabirds target exposed bait or unsecured small catches;
5. engine stalls and requires fuel plus restart;
6. a leak requires repair and bailing;
7. fog reduces distant navigation cues;
8. debris forces evasive steering or causes impact damage;
9. an unsecured slippery fish escapes its container;
10. the landing net tears and needs a patch.

Eligibility must account for current round state, active mission, crew positions, available tools, previous incidents, and recovery time. Each incident must expose clear start, response, success, timeout, cancellation, and cleanup paths. Invalidated incidents release all reservations and temporary state.

Difficulty increases with crew performance rather than human count alone, since bots always fill the roster. Do not select an incident that invalidates the active mission or consumes its only required tool.

### Exit gate

Tests cover each incident, concurrency limits, cooldowns, prerequisites, cleanup, deterministic selection, mission safety, required-tool recovery, overboard rescue, and a long seeded simulation with no deadlock or permanent impossible state.

## Task 8 — Harden multiplayer actions, snapshots, checkpoints, and host migration

### Files

- Modify `games/reel-problems-3/peer.ts`.
- Add `games/reel-problems-3/snapshot.ts`.
- Add `games/reel-problems-3/peer.test.ts`.
- Extend `games/reel-problems-3/simulation.test.ts`.
- Extend `platform/peer/invariants.test.ts` only if a new generic invariant is required.

### Work

Register the new authoritative actions in the adapter and validate all payload fields, ranges, identifiers, and sequence semantics before mutation. Use the shared action durability and input-order rules rather than introducing a second transport.

Keep static streamed cell content derived from seed and transmit only active dynamic state. Build snapshots that include all visible players, boat, nearby dynamic items, active fish and lines, mission progress, scores, incidents, and ordered events. Do not remove information needed by reconnecting clients or host migration merely to reduce packet size.

Implement owner replacement for held items, station claims, fishing lines, job reservations, and assist credit when a member disconnects or a bot is replaced. Rebuild physics, stream, render, and audio caches from the structured checkpoint.

Exercise party-round locking, direct room play, late human replacement of a bot, reconnect with a new browser instance, duplicate action requests, stale inputs, host departure during fishing, host departure during an incident, and host departure during docking.

### Exit gate

Snapshots remain wire-safe and bounded, the full round survives JSON checkpoint round-trips, repeated actions are idempotent, stale input is ignored, and host migration resumes every round state without duplicate items, catches, bots, or scores.

## Task 9 — Replace marker boxes with polished modular 3D presentation

### Files

- Refactor `games/reel-problems-3/scene.ts` into the scene orchestrator.
- Add `games/reel-problems-3/rendering/materials.ts`.
- Add `games/reel-problems-3/rendering/boat.ts`.
- Add `games/reel-problems-3/rendering/harbor.ts`.
- Add `games/reel-problems-3/rendering/ocean.ts`.
- Add `games/reel-problems-3/rendering/items.ts`.
- Add `games/reel-problems-3/rendering/fish.ts`.
- Add `games/reel-problems-3/rendering/view-model.ts`.
- Add `games/reel-problems-3/rendering/effects.ts`.
- Add `games/reel-problems-3/rendering/rendering.test.ts` for model/catalog coverage.

### Work

Keep the current handcrafted clay material language and sculpted water direction. Build low-poly procedural Three.js model factories for every catalog item and fish species. A real crate may look like a crate; rope, rods, bait, lanterns, timber, tools, fuel, ice, net, chart, compass, and fish must not reuse a generic box marker.

Build one polished working boat with readable stations, rail openings, storage, engine access, bilge area, rod racks, ice hold, helm, and throttle. Ensure visible geometry and physics footprints share authored constants.

Render streamed ocean cells from pooled tile groups. Pool fish, items, birds, debris, splashes, mission indicators, and effects. Reuse geometries and materials and instance repeated scenery. Apply mobile quality tiers to water subdivisions, shadow maps, particles, view distance, and decorative density only.

Replace detached first-person hands with item-specific view-model poses for empty hands, small objects, large objects, rod casting, reeling, net use, repair, bailing, steering, and throwing. Keep the crosshair and fishing line readable without covering the center view.

Replace floating labeled markers with close-range warm rim highlights, physical signs, painted station symbols, gauges, lamps, and hand reach. Preserve invisible interaction volumes so detailed solid objects remain usable.

### Exit gate

Catalog coverage tests guarantee that every gameplay object has a model factory. Visual review confirms recognizable silhouettes, correct grips, readable stations, stable moving-deck presentation, no geometry/collider drift, and no generic placeholder boxes.

## Task 10 — Rebuild controls, HUD, results, audio, analytics, and party guidance

### Files

- Add `games/reel-problems-3/controls.ts` and `controls.test.ts`.
- Add `games/reel-problems-3/TouchControls.tsx`.
- Refactor `games/reel-problems-3/Game.tsx` around the new scene and controls.
- Replace `games/reel-problems-3/presentation.ts` and extend its tests.
- Update `games/reel-problems-3/style.css`.
- Replace event handling in `games/reel-problems-3/audio.ts`.
- Update `games/reel-problems-3/catalog.ts`.
- Update `games/reel-problems-3/analytics.ts`.
- Update `games/reel-problems-3/README.md`.
- Update the Reel Problems 3 entry in `platform/party/guides.ts`.
- Update Reel Problems 3 collection copy in `shared/language/translations/cards.ts` if it still describes the retired beacon voyage.

### Work

Create one input controller that merges keyboard, touch, and the repository's shared keyboard-emulating gamepad layer without stuck-button conflicts. Desktop controls must cover movement/look, contextual use, pickup/drop, throw, cast, reel, brace, and station steering/throttle. Touch must provide movement, drag look/aim, a large hold control for cast/reel, and one context-sensitive action. Controller mappings must expose equivalent commands.

Refactor `Game.tsx` so WebGL, simulation, networking, input, HUD pacing, audio, and dialogs remain separate refs/components rather than adding more responsibilities to the existing large component.

Build the compact HUD from derived presentation selectors: round timer, shared mission quota, harbor/mission compass, boat health, flood, engine state, contextual tension, held items, short warnings, and quiet individual score. Use world feedback before text and keep touch controls clear of critical information.

Create the end screen with crew completion, catch summary, mission results, boat condition, return time, rankings, and deterministic awards. Update analytics milestones and completion reasons to the new round lifecycle.

Expand audio events for casting, bite, reel tension, strain, line snap, fish movement, item handling, sliding cargo, engine states, leak location, repair, rescue, weather, docking, scoring, and the return bell. Preserve audio unlock, mute, cleanup, and reduced-motion behavior.

### Exit gate

Control tests prove clean press/release behavior across input sources. Accessibility names cover all touch actions. HUD selectors match round state, audio emits once per ordered event, analytics reports the new milestones, and English/German user-facing guidance describes the new game.

## Task 11 — Complete end-to-end, performance, and regression validation

### Files

- Extend `games/reel-problems-3/scripts/browser-check.mjs`.
- Add `games/reel-problems-3/scripts/round-replay.mjs` as the deterministic soak harness.
- Add or extend focused test files from Tasks 1–10.
- Update `games/reel-problems-3/README.md` with final validation commands and controls.

### Work

Add deterministic replay fixtures for representative one-human/three-bot and four-human command streams. Run long seeded simulations that include all mission templates, every fish species, every chaos event, timeout, boat failure, reconnect, and successful return.

Expand the browser check to exercise the production-mode local build at desktop and mobile viewports. It must start a round, load real equipment, leave harbor under helm control, cast and land a fish, secure a catch, complete or deterministically advance a mission, trigger repair/rescue behavior, return, dock, and open results. Capture console errors, failed same-origin requests, overflow, missing canvas, inaccessible controls, and stuck input.

Run a four-client peer test for simultaneous pickup, crossed lines, net assistance, bot replacement, and host migration. Confirm the final snapshots converge.

Measure the worst supported active load. Verify a stable 30 FPS target on the representative mid-range mobile profile and 60 FPS on the desktop profile. Inspect active tiles, draw calls, awake physics bodies, dynamic meshes, particles, audio sources, snapshot size, and update frequency. Tune quality tiers without changing authoritative gameplay.

Run the full release gate:

```text
node scripts/test.mjs games/reel-problems-3 platform/games/registry.test.ts shared/games/identity.test.ts platform/peer/invariants.test.ts shared/input/gamepad.test.ts
npx oxlint games/reel-problems-3 app/reel-problems-3 platform/party/guides.ts shared/language/translations/cards.ts
npm run typecheck
npm run build:railway
git diff --check
```

Run the local production server and the expanded browser check on desktop and mobile. Review screenshots or recordings of harbor preparation, recognizable items, sailing, each fishing state, representative chaos, first-person grips, docking, and results.

### Exit gate

All automated checks pass; the full round is completable by one human with three bots and by four humans; desktop and mobile browser checks have no console or same-origin network failures; performance targets hold under the defined load; the repository is clean and release-ready.

## Recommended Commit Sequence

1. `feat(reel-problems-3): define party round content and state`
2. `feat(reel-problems-3): add deterministic round missions and scoring`
3. `feat(reel-problems-3): add sailing and streamed ocean`
4. `feat(reel-problems-3): add physical equipment lifecycle`
5. `feat(reel-problems-3): add arcade fishing systems`
6. `feat(reel-problems-3): add four-seat bot crew`
7. `feat(reel-problems-3): add recoverable chaos director`
8. `feat(reel-problems-3): harden multiplayer recovery`
9. `feat(reel-problems-3): build polished world and item models`
10. `feat(reel-problems-3): finish controls hud audio and results`
11. `test(reel-problems-3): validate complete party fishing rounds`

Each commit must pass the focused tests for its layer. Before release, the final combined branch must pass the complete gate in Task 11.
