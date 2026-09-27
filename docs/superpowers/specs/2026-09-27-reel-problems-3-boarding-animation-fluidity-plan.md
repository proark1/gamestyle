# Reel Problems 3 Boarding, Crew, and Fishing Polish Implementation Plan

**Date:** 2026-09-27  
**Design:** [2026-09-27-reel-problems-3-boarding-animation-fluidity-design.md](2026-09-27-reel-problems-3-boarding-animation-fluidity-design.md)

## Outcome

Rebuild the existing Reel Problems 3 boat so it has a clear supported boarding gate and enough usable deck space for four crew members. Add physical jumping, movement-derived avatar animation, human-paced deterministic bots, smoothly interpolated presentation, state-responsive fishing lines, and a visible fish landing-and-storage sequence.

This work improves the existing party round. It does not replace the mission system, networking model, ocean streamer, character style, or overall boat identity.

## Execution Rules

- Work test-first in small slices: add the failing focused test, implement the behavior, then run the complete Reel Problems 3 suite.
- Keep `AdventureWorld` structured-clone and JSON safe. Three.js geometry, animation histories, interpolation buffers, and frame measurements stay in runtime-only caches.
- Preserve host authority. Jump requests, bot actions, catches, and storage are validated by the authoritative simulation.
- Reuse authored boat-layout constants for scene geometry, station positions, navigation points, and collision boundaries so the visual and physical boats cannot drift apart.
- Keep React/HUD, audio, analytics, and network publication at their existing bounded cadence. Only the Three.js presentation loop runs at display cadence.
- Bot personality must be deterministic from the world seed and seat. No authoritative behavior may call `Math.random()`.
- Maintain bot-only round completion. Human-like hesitation may slow bots but cannot make the seeded solo experience unreliable.
- Deployment remains a separate action requiring an explicit request after implementation and validation.

## Task 1 — Author one shared, walkable boat layout

### Files

- Add `games/reel-problems-3/boat-layout.ts`.
- Add `games/reel-problems-3/boat-layout.test.ts`.
- Modify `games/reel-problems-3/stations.ts`.
- Modify `games/reel-problems-3/physics-layout.ts`.
- Modify `games/reel-problems-3/physics.test.ts`.
- Modify `games/reel-problems-3/scene.ts`.

### Test first

Add layout tests that prove:

- the starboard gate is wider than two player radii plus clearance;
- a sequence of sample points from dock, over the gangway, through the gate, and into the main deck is not blocked;
- sample points immediately forward and aft of the gate remain blocked by the hull/rail;
- every station approach point is inside the playable deck and outside fixed colliders;
- four spawn/idle positions are mutually separated and valid;
- the clear circulation lane around the reduced cabin remains at least one avatar diameter wide.

Extend physics tests to walk an avatar through the gate in both directions and confirm that it cannot pass through the remaining hull, cabin, mast, ice hold, or work fixtures.

### Implementation

Create a single serializable boat-layout catalog containing:

- hull bounds and deck height;
- starboard gate center and width;
- gangway landing and handrail extents;
- split hull/rail segments;
- cabin, mast, ice-hold, and work-station footprints;
- station approach, crew spawn, and bot idle points;
- the safe fish landing zone.

Use these constants in `physics-layout.ts` instead of independent hard-coded boundaries. Split the starboard collider around the gate. Keep a solid rail collider everywhere else and preserve the dock water-gap protection.

Rebuild `makeBoat()` around the same layout. Reduce and shift the orange cabin cover, modestly widen the usable deck if needed, and group decorative equipment at work stations. Add the visible open side gate, supported gangway lip, shallow threshold, short handrails, open safety gate/rope, warm trim, and small boarding lamps or marker. The deck must retain the current clay-like palette and silhouette.

Move `STATION_POSITIONS` to approved approach points with clear reach and circulation. Update spawn and bot idle locations to avoid the main boarding path.

### Exit gate

The layout and physics tests pass, and one source of layout constants drives geometry, collisions, stations, spawn positions, boarding, and the fish landing zone.

## Task 2 — Add authoritative jumping and collision-safe controls

### Files

- Modify `games/reel-problems-3/types.ts`.
- Modify `games/reel-problems-3/players.ts`.
- Modify `games/reel-problems-3/physics.ts`.
- Add or extend `games/reel-problems-3/physics.test.ts`.
- Modify `games/reel-problems-3/simulation.ts`.
- Modify `games/reel-problems-3/peer.ts`.
- Modify `games/reel-problems-3/Game.tsx`.
- Modify `games/reel-problems-3/style.css`.
- Modify `games/reel-problems-3/README.md`.

### Test first

Add tests for:

- a jump request applying one impulse only on the rising input edge;
- held Jump not retriggering until release and a later grounded press;
- gravity, apex, landing, and stable grounded state;
- jumping over the gangway threshold and low deck obstructions;
- collision with the outer rail throughout an ordinary jump;
- no jumping while overboard or locked at the helm;
- snapshot/JSON preservation of vertical state;
- independent Jump and Brace inputs.

### Implementation

Add `jump` to `AdventureInput`. Add structured-clone-safe vertical state to `AdventurePlayer`: height above its current surface, vertical velocity, grounded flag, and the prior jump-button state required for edge detection.

Extend the fixed-step physics controller with gravity, a bounded jump impulse, grounded resolution against `localSurfaceHeight`, and landing. Keep horizontal Cannon bodies stable; resolve the small vertical gameplay axis explicitly so the moving boat remains deterministic. Give rail and major-fixture colliders an authored effective height and reject horizontal penetration when the player's vertical capsule still overlaps them.

Map `Space` to Jump and `B` to Brace. Update key prevention, help copy, and the touch HUD with separate accessible Jump and Brace controls. Update the peer adapter's idle and sanitization paths so stale jump state cannot stick after focus loss or reconnect.

### Exit gate

Jump and brace work independently on keyboard and touch. The authoritative player clears intended low obstacles, lands smoothly, and cannot use the standard jump to bypass the outer rail.

## Task 3 — Replace perfect bots with deterministic human-paced crew behavior

### Files

- Add `games/reel-problems-3/bot-behavior.ts`.
- Add `games/reel-problems-3/bot-behavior.test.ts`.
- Modify `games/reel-problems-3/types.ts`.
- Modify `games/reel-problems-3/players.ts`.
- Modify `games/reel-problems-3/bots.ts`.
- Extend `games/reel-problems-3/simulation.test.ts`.

### Test first

Add deterministic tests proving:

- each seat derives stable reaction, walk pace, reel rhythm, confidence, and accuracy parameters from the round seed;
- two seats do not receive identical timing profiles;
- a newly visible need is not acted on before the bot's reaction window;
- a selected task remains committed for its minimum duration;
- several bots cannot reserve the same catch or work target;
- a bot with no useful job stays at or walks once to a valid idle point rather than alternating targets;
- a bot with no positional progress tries a different safe approach and then yields after a bounded retry count;
- human pickup or station use releases a bot reservation;
- a representative bot-only seeded round still completes within the round limit.

### Implementation

Keep personality and active decision state in serializable bot fields. Derive personality once from world seed plus seat. Add explicit reaction, task-lock, action-duration, cooldown, progress-sample, approach-index, and idle-until times.

Split bot work into three layers:

1. `bot-behavior.ts` deterministically evaluates needs, personality timing, reservations, and task lifecycle;
2. `bots.ts` follows authored approach points and invokes the same item, fishing, station, and helm rules used by humans;
3. the simulation remains responsible for authoritative ordering and time.

Lower movement speed to each bot's preferred pace. Add short look/pause phases before pickup, placement, repair, casting, hooking, and storage. Reel in intermittent safe bursts rather than continuously exploiting the exact tension threshold. Use bounded accuracy offsets for cast and approach targets.

Do not create aimless wandering. An idle bot selects one relevant safe position, faces active work or open water, and remains there for a meaningful interval. Progress checks compare actual displacement over time, preventing rapid forward/back target switching.

### Exit gate

Bots look varied and deliberate, never visibly oscillate without purpose, yield cleanly to humans, and retain reliable solo-round completion.

## Task 4 — Add a real catch landing and storage lifecycle

### Files

- Modify `games/reel-problems-3/types.ts`.
- Modify `games/reel-problems-3/fishing.ts`.
- Modify `games/reel-problems-3/fishing.test.ts`.
- Modify `games/reel-problems-3/items.ts`.
- Add or extend `games/reel-problems-3/items.test.ts`.
- Modify `games/reel-problems-3/bots.ts`.
- Modify `games/reel-problems-3/scene.ts`.

### Test first

Add tests for the complete sequence:

- an exhausted nearby fish enters `landing` rather than creating an instant deck item;
- the landing record has a rail-side origin, approved clear deck target, start time, and duration;
- a normal fish completes its arc and becomes one loose deck catch;
- a large fish cannot enter the landing sequence without an eligible net helper;
- landing completion cannot duplicate a catch on repeated simulation steps;
- the catch bounces, settles, and remains pickable before storage;
- mission progress and score remain unchanged while the fish is landing or loose;
- explicit placement in `ice-hold` secures and scores exactly once;
- bot reservation and human takeover of a loose catch work correctly.

### Implementation

Add a structured landing record to `FishState` and include `landing` in its state union. When landing conditions are met, preserve the fish in world space and record the authored rail and deck endpoints. Advance the normalized landing time deterministically. On completion, create one boat-local fish item at the target with vertical and horizontal landing velocity, then clear the line and finalize the fish state.

Extend loose fish items with bounded vertical velocity, deck bounce, damping, settled time, and flop phase. Only fish use this small deck-body behavior; do not add a full rigid-body population. Clamp landing targets to the shared safe zone and keep them outside fixed colliders. Chaos may move an unsecured fish, but it remains recoverable.

Expose the ice hold clearly in the revised deck layout. Preserve the existing pickup and `placeItem(..., 'ice-hold')` authority boundary so scoring still occurs only on storage. Update bots to notice, reserve, approach, pause, lift, carry, and place a catch using their human-paced lifecycle.

Render the hooked fish through the landing arc, with a single bounce and restrained flop after conversion to an item. The landing net helper should visibly face and reach toward the catch for large species.

### Exit gate

A catch visibly comes over the rail, reacts on deck, can be picked up by either a human or bot, and earns progress only after it is carried to the ice hold.

## Task 5 — Build curved, state-responsive fishing lines without frame allocations

### Files

- Add `games/reel-problems-3/rendering/fishing-line.ts`.
- Add `games/reel-problems-3/rendering/fishing-line.test.ts`.
- Modify `games/reel-problems-3/scene.ts`.

### Test first

Test the pure point generator for:

- exact rod-tip and lure/fish endpoints;
- a cast arc above both endpoints;
- gravity sag for a waiting slack line;
- decreasing curve deviation as tension increases;
- bounded bite/pull displacement from deterministic time;
- a landing arc that follows the fish over the rail;
- finite points under zero-distance and extreme-tension inputs.

### Implementation

Create a pure function that fills a caller-owned `Float32Array` for a fixed segment count. Inputs include endpoints, line state, tension, time, and landing progress. Use a quadratic or cubic curve with controlled sag and deterministic vibration; do not use a rope physics engine.

In `scene.ts`, create each Three.js line geometry once, attach a reusable position buffer, update its values in place, and mark the attribute dirty. Stop disposing and recreating line geometry on each snapshot. Resolve the start point from the actual animated rod-tip anchor. Keep the normal line understated; blend toward warning color and subtle vibration as strain rises.

### Exit gate

All fishing states have a readable line shape, the line follows rod and fish at display cadence, and profiling shows no repeating geometry allocation/disposal during normal fishing.

## Task 6 — Decouple visual animation from snapshot publication

### Files

- Add `games/reel-problems-3/rendering/motion.ts`.
- Add `games/reel-problems-3/rendering/motion.test.ts`.
- Modify `games/reel-problems-3/scene.ts`.
- Modify `games/reel-problems-3/Game.tsx`.

### Test first

Add pure motion tests proving:

- measured position delta activates walking even when input is zero;
- small snapshot jitter does not repeatedly toggle walk/idle;
- smoothed speed converges and decays within bounded time;
- interpolation remains monotonic between snapshots and clamps after its window;
- walk phase advances from visual delta time, not snapshot count;
- jump and landing pose phases derive from vertical state;
- frame-quality hysteresis, if enabled, cannot oscillate pixel ratio rapidly.

### Implementation

Create runtime-only motion records for each rendered crew member: previous and target transform, last sample time, smoothed planar speed, vertical state, walk phase, and pose state. `render(snapshot)` becomes a state-ingest operation. `animate()` interpolates transforms and evaluates `poseWorker`/`liveKid` every `requestAnimationFrame`.

Drive walk detection from actual displacement. This makes direct-position bots animate correctly and prevents input disagreement from affecting remote presentation. Add restrained hip motion, alternating legs and feet, arm counter-swing, airborne pose, and landing compression. Preserve fishing/held-item upper-body overrides while the lower body continues its locomotion state.

For solo play, expose a lightweight scene method that receives the live authoritative world reference or a visual sample on every local simulation frame. Keep `receive()` and the roughly 42 ms snapshot/HUD/audio/analytics path unchanged. For network play, interpolate between received targets rather than increasing packet frequency.

Reuse vectors, quaternions, transform records, and line buffers. First measure the corrected cadence. Only add a slowly adapting pixel-ratio cap when sustained frame timing still misses the target; do not reduce geometry or water quality without evidence.

### Exit gate

Bots' legs and feet animate from movement, local walking no longer advances in visible snapshot steps, remote movement interpolates smoothly, and UI/network update cadence remains bounded.

## Task 7 — Integrate controls, guidance, browser checks, and performance validation

### Files

- Modify `games/reel-problems-3/presentation.ts` and its tests if contextual guidance changes.
- Modify `games/reel-problems-3/Game.tsx`.
- Modify `games/reel-problems-3/style.css`.
- Modify `games/reel-problems-3/README.md`.
- Extend `games/reel-problems-3/scripts/browser-check.mjs`.
- Extend relevant Reel Problems 3 simulation, physics, bot, fishing, item, and rendering tests.

### Work

Update desktop and mobile instructions for Jump, Brace, catch pickup, and ice-hold storage. Keep touch controls outside the central view and away from the hull/bilge HUD.

Extend the production-mode browser check to:

1. verify the open boarding gate visually and traverse dock to deck;
2. walk around both sides of the reduced cabin without clipping or dead ends;
3. jump over the threshold, land, and confirm the rail still blocks departure;
4. observe a moving bot long enough to confirm leg/foot animation and no idle oscillation;
5. cast, hook, and reel a fish while checking the line states;
6. observe the fish arc, bounce, flop, pickup, carry, and score on ice-hold placement;
7. capture desktop and mobile screenshots and fail on console or same-origin request errors.

Measure render cadence during continuous walking and fishing. Verify that presentation frames remain near display cadence even though state publication remains near 24 Hz. Check allocations during line rendering and avatar animation. Target stable 60 FPS on the desktop profile and stable 30 FPS on the representative mobile profile.

Run the release gate:

```text
node scripts/test.mjs games/reel-problems-3 platform/games/registry.test.ts shared/games/identity.test.ts platform/peer/invariants.test.ts
npx oxlint games/reel-problems-3 app/reel-problems-3
npm run typecheck
npm run build:railway
git diff --check
```

Then run the local production server and the expanded desktop/mobile browser check. Review screenshots of the gate, deck circulation, jump, fishing line, landed fish, and stored catch.

### Exit gate

All automated checks pass; the revised boat, controls, bots, catch loop, and animation work together on desktop and mobile; there are no browser errors; measured frame pacing meets the targets; and the branch is ready for a separate deployment request.

## Recommended Commit Sequence

1. `feat(reel-problems-3): open and expand the working deck`
2. `feat(reel-problems-3): add physical avatar jumping`
3. `feat(reel-problems-3): humanize autonomous crew behavior`
4. `feat(reel-problems-3): animate catch landing and storage`
5. `feat(reel-problems-3): render responsive fishing lines`
6. `perf(reel-problems-3): smooth crew and world presentation`
7. `test(reel-problems-3): validate boarding and fishing polish`

Each commit must pass its focused tests. The final combined branch must pass the complete release gate before it is offered for deployment.
