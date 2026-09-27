# Reel Problems 2 — Chaos Voyage implementation plan

Date: 28 September 2026

Status: proposed execution sequence; no gameplay implementation in this pass

Design: [Chaos Voyage design](2026-09-28-reel-problems-2-chaos-voyage-design.md)

## Outcome

Deliver Chaos Voyage as a separate, host-authoritative Reel Problems 2 mode with:

- an eight-to-twelve-minute three-act run;
- a deterministic Director that schedules readable, recoverable chaos;
- three contract shapes and three finale definitions;
- a validated catalog of approximately twelve event interactions;
- private personal objectives with recap-only crew reveal;
- live stream-friendly presentation;
- a structured Story of the Voyage with notable timestamps and seed codes;
- checkpoint, reconnect, host-handover, input, regression, and playtest coverage.

Classic and Last Boat Home must retain their current behavior. Viewer APIs, video recording, replay playback, public matchmaking, additional boats, and permanent power progression are not part of this plan.

## Execution rules

- Work only in `games/reel-problems-2`, `app/reel-problems-2`, and directly required test or documentation files unless an integration requirement proves a shared change is necessary.
- Preserve the repository's unrelated dirty files and untracked work. Stage only files belonging to the current task.
- Build rules in pure game-local modules. React components display authoritative state and dispatch actions; they do not decide outcomes.
- Add one invariant with a failing test before implementing the corresponding rule.
- Keep every event idempotent and checkpointable from its first implementation.
- Use the current seeded world random function rather than `Math.random()` for authoritative selection.
- Treat balance numbers as catalog data, not scattered constants.
- Do not claim fun, virality, controller support, or network resilience from unit tests alone.

## Milestone 0 — protect the baseline

### Task 0.1: Record the current behavior

**Inspect**

- `games/reel-problems-2/types.ts`
- `games/reel-problems-2/simulation.ts`
- `games/reel-problems-2/campaign.ts`
- `games/reel-problems-2/survival.ts`
- `games/reel-problems-2/chaos.ts`
- `games/reel-problems-2/peer.ts`
- `games/reel-problems-2/Game.tsx`

**Work**

1. Save `git status --short` and avoid files outside the task.
2. Run the Reel Problems 2 suite and record the test count.
3. Run TypeScript, scoped lint, and the architecture check.
4. Start a local preview and capture the current Classic and Last Boat Home menu, HUD, and results behavior.
5. Record current checkpoint schema version, mode values, start/restart behavior, world event format, and seed/random helpers.

**Commands**

```text
node scripts/test.mjs games/reel-problems-2
npm run typecheck
npx oxlint games/reel-problems-2 app/reel-problems-2
npm run check:architecture
```

**Exit gate**

The existing failures, if any, are separated from new work. Classic and Last Boat Home have an explicit regression baseline.

## Milestone 1 — mode, schema, and Director foundation

### Task 1.1: Add a discriminated Chaos Voyage mode

**Modify**

- `games/reel-problems-2/types.ts`
- `games/reel-problems-2/simulation.ts`
- `games/reel-problems-2/campaign.ts`
- `games/reel-problems-2/peer.ts`
- `games/reel-problems-2/Game.tsx`

**Create**

- `games/reel-problems-2/chaos-voyage.test.ts`

**Tests first**

1. A `start` action can select `chaos-voyage` without creating a Last Boat Home survival state accidentally.
2. Restart preserves the selected Chaos Voyage contract and seed unless the captain requests a new seed.
3. Classic and campaign starts retain their existing setup.
4. A schema-v2 checkpoint restores to its original mode and never gains Chaos Voyage state implicitly.

**Implementation**

1. Replace the current two-value mode type with explicit `classic`, `campaign`, and `chaos-voyage` values.
2. Add a versioned optional `voyage` state to `ReelWorld`; do not overload `mission.survival` as the mode discriminator.
3. Extend `ReelAction` start/restart data with validated Chaos Voyage contract and optional seed fields.
4. Add a preparation boundary that resets world state once, then applies the selected mode deterministically.
5. Increment checkpoint schema version and write explicit migration defaults in `peer.ts`.
6. Add a temporary menu entry labeled as an in-development mode; detailed presentation comes later.

**Exit gate**

Mode selection, restart, snapshot, and legacy restore tests pass. No Director or event content is required yet.

### Task 1.2: Implement the pure Director state machine

**Create**

- `games/reel-problems-2/chaos-director.ts`
- `games/reel-problems-2/chaos-director.test.ts`

**Modify**

- `games/reel-problems-2/types.ts`
- `games/reel-problems-2/simulation.ts`

**Tests first**

1. Act transitions occur at configured boundaries and stop after result resolution.
2. Equivalent seed and summarized authoritative inputs produce identical selections.
3. The Director never exceeds two active urgent problems or its current danger budget.
4. A major recovery installs a quiet window in which no new urgent event starts.
5. Invalid or ineligible candidates are skipped without consuming budget or changing the seed incorrectly.
6. A finale reserves budget and excludes unrelated major events.

**Implementation**

1. Define `VoyageDirectorState`, event lifecycle states, act definitions, danger budget, cooldowns, and recovery deadline.
2. Implement a pure `advanceDirector(state, observation, catalog, now)` function that returns the next state plus requested transitions.
3. Derive a small `DirectorObservation` from authoritative world state. Avoid passing mutable UI state into selection.
4. Integrate one Director advance per fixed simulation step after core physics and before snapshot publication.
5. Store scheduled transition IDs so a repeated tick or restored checkpoint cannot apply them twice.

**Exit gate**

Director tests pass with a synthetic catalog. It can schedule, warn, activate, complete, cancel, and cool down without real hazards.

### Task 1.3: Validate event definitions

**Create**

- `games/reel-problems-2/chaos-catalog.ts`
- `games/reel-problems-2/chaos-catalog.test.ts`

**Tests first**

Reject duplicate IDs, missing lifecycle handlers, negative timing or cost, unknown incompatibilities, impossible act ranges, and events with no recovery or cancellation path.

**Implementation**

1. Define the event contract from the approved design.
2. Add startup/test-time catalog validation with useful event-specific errors.
3. Add a minimal no-damage test catalog to connect the Director to the simulation.
4. Keep weights, warning durations, cooldowns, and danger costs in definitions.

**Exit gate**

The catalog validator prevents malformed content from entering a run, and the real catalog can grow without new Director branches.

## Milestone 2 — structured voyage facts and causal stories

### Task 2.1: Add bounded structured facts

**Create**

- `games/reel-problems-2/voyage-story.ts`
- `games/reel-problems-2/voyage-story.test.ts`

**Modify**

- `games/reel-problems-2/types.ts`
- `games/reel-problems-2/simulation.ts`
- `games/reel-problems-2/hull.ts`
- `games/reel-problems-2/deck-jobs.ts`
- `games/reel-problems-2/chaos.ts`
- `games/reel-problems-2/survival.ts`

**Tests first**

1. Fact IDs remain unique across checkpoint restore.
2. Facts link actor, target, object, source event, cause fact, timestamp, and consequence without storing display sentences.
3. Retention is bounded while all facts required for the current recap survive.
4. Duplicate transition IDs do not append duplicate facts.
5. Voice content and arbitrary chat text have no field in the fact schema.

**Implementation**

1. Add an `emitVoyageFact` helper that is a no-op outside Chaos Voyage.
2. Instrument existing high-value transitions: catch, slap, slip, fall, rescue, leak, patch, bail, sink, recovery component, relaunch, cargo loss, collision, wildlife impact, and mission result.
3. Preserve the existing short-lived `ReelEvent` UI feed; structured facts are a separate authoritative log.
4. Cap facts by count with protected retention for result and causal-chain facts.

**Exit gate**

A synthetic run yields a correct, bounded fact stream without changing Classic presentation or behavior.

### Task 2.2: Build truthful recap selection

**Modify**

- `games/reel-problems-2/voyage-story.ts`
- `games/reel-problems-2/voyage-story.test.ts`

**Tests first**

1. Biggest disaster ranks a connected cause chain above unrelated high-severity facts.
2. Hero selection requires a successful recovery with measurable consequence.
3. Questionable-decision selection requires a direct player action; random targeting, Director selection, and disconnects cannot assign blame.
4. Ties resolve deterministically.
5. Template summaries use only present verified facts and have a neutral fallback.
6. Notable timestamps are clamped to the run duration.

**Implementation**

1. Build causal components from fact IDs and short allowed time gaps.
2. Score disaster severity, recovery value, and player-caused setbacks with explicit pure functions.
3. Return a language-neutral recap model containing IDs, values, and template keys.
4. Generate the short seed code from validated run-seed data; invalid entered codes produce a new safe seed.

**Exit gate**

Unit tests can explain why each recap card won. No generated text invents an event or blames a player without evidence.

## Milestone 3 — personal objectives

### Task 3.1: Implement the objective catalog and assignment

**Create**

- `games/reel-problems-2/personal-objectives.ts`
- `games/reel-problems-2/personal-objectives.test.ts`

**Modify**

- `games/reel-problems-2/types.ts`
- `games/reel-problems-2/simulation.ts`

**Tests first**

1. Assignment is deterministic for seed and eligible roster.
2. A player never receives an objective unavailable to their input method, crew size, contract, or finale.
3. Incompatible objectives are not assigned to the same player or impossible combination of players.
4. Objective progress applies once per fact ID.
5. Reconnect preserves assignment and progress; permanent departure resolves neutrally.
6. No catalog entry rewards mission failure, essential-object destruction, or teammate abandonment.

**Implementation**

1. Define objective eligibility, progress reducers, completion, recap title, and translation key.
2. Assign one objective to each human when the authoritative roster locks for the run.
3. Drive progress from structured facts rather than reading UI events.
4. Add the initial safe subset: rescues, repairs, bailing, securing a catch, retaining the initial hat, storm fishing, optional recovery, and controlled one-side paddling.
5. Expand to approximately twenty only after catalog validation and normal-input feasibility tests exist.

**Exit gate**

Every shipped objective is achievable through supported normal controls and cannot improve its reward by intentionally losing the shared mission.

### Task 3.2: Add objective privacy and reveal behavior

**Modify**

- `games/reel-problems-2/Game.tsx`
- `games/reel-problems-2/peer.ts`
- `games/reel-problems-2/personal-objectives.test.ts`

**Implementation**

1. Keep authoritative assignments in checkpoint state for recovery.
2. Render only the local player's objective during play.
3. Reveal all human objectives only after authoritative result resolution.
4. Treat privacy as presentation privacy, not anti-cheat secrecy; do not add private network channels solely for this feature.

**Exit gate**

Two real clients see only their own live objective and the full crew reveal after the run.

## Milestone 4 — playable event catalog

Implement event interactions in small vertical slices. Each slice needs eligibility, warning, execution, structured facts, cancellation, recovery, scene feedback, audio cue, normal-input test, and checkpoint coverage before the next slice begins.

### Task 4.1: Loose-object and deck-chain slice

**Modify**

- `games/reel-problems-2/chaos-catalog.ts`
- `games/reel-problems-2/deck-jobs.ts`
- `games/reel-problems-2/simulation.ts`
- `games/reel-problems-2/scene.ts`
- `games/reel-problems-2/audio/director.ts`

**Add tests**

- `games/reel-problems-2/chaos-events.test.ts`

**Content**

- sliding unsecured fish;
- tail slap transferring force to one nearby loose object;
- monster wave shifting loose but not installed or tied-down objects;
- flopping catch interrupting a nearby held job.

**Gate**

At least one test demonstrates a complete readable chain: warned wave → fish slide → player fall or object loss → valid recovery action.

### Task 4.2: Rod, weather, and wildlife slice

**Modify**

- `games/reel-problems-2/chaos.ts`
- `games/reel-problems-2/simulation.ts`
- `games/reel-problems-2/scene.ts`
- `games/reel-problems-2/audio/director.ts`

**Content**

- warned rod-conducted lightning with release counterplay;
- conduction over an actually tangled active line;
- gull dragging an exposed catch across the deck before escape;
- shark catching a taut line and creating lateral pull.

**Gate**

Each warning provides enough time for the documented response. A cancelled or cut line cannot keep applying force or damage.

### Task 4.3: Boat damage and recovery slice

**Modify**

- `games/reel-problems-2/hull.ts`
- `games/reel-problems-2/deck-jobs.ts`
- `games/reel-problems-2/mission.ts`
- `games/reel-problems-2/mission-scene.ts`
- `games/reel-problems-2/scene.ts`

**Content**

- visible recoverable component loss on a qualified collision;
- asymmetric steering from a damaged rudder;
- flooded slippery deck area and temporarily disabled low station;
- marked reachable floating essential supply;
- wind-sensitive carrying of a tall or heavy object.

**Gate**

Every essential loss has a tested reachable recovery or safe-return path. Reconnect cannot duplicate a component or leave a disabled station permanent.

### Task 4.4: Catalog integration and repetition control

**Tests first**

1. All initial event definitions validate.
2. No incompatible pair can become active together.
3. Event repetition rules work across restart in the same room.
4. Struggling-state observations delay major danger and permit recovery content.
5. Each event emits a warning, terminal status, and story facts.

**Gate**

Approximately twelve interactions are selectable through the Director; none depends on a test-only state mutation to finish through normal controls.

## Milestone 5 — contracts and finales

### Task 5.1: Make contracts data-driven

**Create**

- `games/reel-problems-2/chaos-contracts.ts`
- `games/reel-problems-2/chaos-contracts.test.ts`

**Modify**

- `games/reel-problems-2/campaign.ts`
- `games/reel-problems-2/mission.ts`
- `games/reel-problems-2/simulation.ts`

**Tests first**

- validate contract IDs, duration range, objective reducer, completion/failure boundary, required systems, and supported finales;
- resolve a valid final action before expiry on the same authoritative tick;
- prevent completion from counting twice;
- reject unsupported contract/finale pairings before a run starts.

**Implement**

1. Giant catch delivery.
2. Valuable catch quota before storm closure.
3. Disabled-boat rescue with required cargo recovery.

**Gate**

Each contract can be completed and failed through normal simulation actions with Director events disabled.

### Task 5.2: Implement The Big Pull

**Modify**

- `games/reel-problems-2/survival.ts`
- `games/reel-problems-2/survival-scene.ts`
- `games/reel-problems-2/scene.ts`
- `games/reel-problems-2/audio/director.ts`

**Tests first**

Cover signposted route progress, line control, steering, collision consequences, catch escape, successful arrival, checkpoint restore, and disconnected line holders.

**Gate**

The finale offers useful simultaneous fishing, steering, securing, and repair jobs without spawning unrelated Director hazards.

### Task 5.3: Implement Harbour From Hell

**Modify**

- `games/reel-problems-2/survival.ts`
- `games/reel-problems-2/deck-jobs.ts`
- `games/reel-problems-2/survival-scene.ts`
- `games/reel-problems-2/mission-scene.ts`

**Tests first**

Cover gate/winch state, route repair, movement during work, solo assistance, crew-size scaling, collision/flooding, completion boundary, and host handover.

**Gate**

Existing winch and deck-job language is reused; no required job is impossible for solo or touch input.

### Task 5.4: Implement Everything Sinks

**Modify**

- `games/reel-problems-2/hull.ts`
- `games/reel-problems-2/mission.ts`
- `games/reel-problems-2/survival.ts`
- `games/reel-problems-2/mission-scene.ts`

**Tests first**

Cover announced irreversible loss, crew inclusion, essential component recovery, raft build, shortened final leg, preserved contract progress, time ceiling, and every checkpoint phase.

**Gate**

A crew can lose the main boat, remain active, build the raft, and win. The sequence cannot start as an untelegraphed random failure.

## Milestone 6 — stream-friendly interface and audio

### Task 6.1: Extract the Chaos HUD

**Create**

- `games/reel-problems-2/ChaosHud.tsx`
- `games/reel-problems-2/chaos-hud.test.ts`

**Modify**

- `games/reel-problems-2/Game.tsx`
- `games/reel-problems-2/mission.css`
- `games/reel-problems-2/translations.ts`

**Work**

1. Show primary objective, time, three-stage chaos meter, local objective, and current warned event.
2. Show short cause-and-participant banners sourced from structured template keys.
3. Prevent full-screen or pointer-blocking banners during live control.
4. Preserve existing Classic and Last Boat Home HUD branches.
5. Add reduced-motion behavior and color-independent warning states.

**Gate**

Desktop and 390×844 layouts keep controls, warnings, objective, and time legible without horizontal overflow.

### Task 6.2: Add dynamic audio intensity

**Modify**

- `games/reel-problems-2/audio/director.ts`
- `games/reel-problems-2/audio/director.test.ts`
- `games/reel-problems-2/audio.ts`

**Tests first**

Verify act/intensity transitions, warning priority, one-shot deduplication after restore, and ducking beneath actionable cues and voice chat.

**Gate**

The music communicates escalation, but blind audio checks can still distinguish line, leak, wave, rescue, and finale warnings.

### Task 6.3: Add streamer-safe display mode

**Modify**

- `games/reel-problems-2/Game.tsx`
- `games/reel-problems-2/style.css`
- shared room presentation only if the game cannot hide credentials locally

**Tests first**

Verify room codes, invite URLs, and connection credentials are absent from the rendered stream-safe state while player names and gameplay information remain.

**Gate**

Toggling the option changes presentation only and does not alter room membership or connection state.

### Task 6.4: Build Story of the Voyage recap

**Create**

- `games/reel-problems-2/VoyageRecap.tsx`
- `games/reel-problems-2/voyage-recap.test.ts`

**Modify**

- `games/reel-problems-2/Game.tsx`
- `games/reel-problems-2/mission.css`
- `games/reel-problems-2/translations.ts`

**Work**

Render biggest disaster, hero, questionable decision, all personal objective results, verified template summary, notable timestamp, seed code, replay, and new-seed actions.

**Gate**

The recap works with sparse facts, ties, disconnects, loss, win, and no blame candidate. Restart preserves the room and obeys the selected seed action.

## Milestone 7 — checkpoint, multiplayer, analytics, and integration

### Task 7.1: Harden checkpoint migration and idempotency

**Modify**

- `games/reel-problems-2/peer.ts`
- `games/reel-problems-2/chaos-voyage.test.ts`
- `shared/peer/all-adapters.test.ts` only if fixture coverage requires it

**Tests first**

Restore during scheduled warning, active event, recovery window, each finale, objective progress, raft construction, and finished recap. Confirm transient held input clears while completed work remains exactly once.

**Gate**

Every Director lifecycle state survives a checkpoint round trip, and old Classic/campaign fixtures still restore.

### Task 7.2: Extend real peer integration

**Modify**

- `scripts/peer-integration.mjs`
- supporting integration fixtures if already used by the repository

**Scenario**

1. Start four clients in Chaos Voyage with a fixed seed.
2. Verify private objective presentation per client.
3. Cross an event warning boundary.
4. Remove the host before activation.
5. Verify one activation, preserved objective progress, and cleared held input.
6. Complete a recovery action and reach the recap.
7. Restart with same seed and then new seed.

**Gate**

The real multi-client scenario passes without duplicated facts, events, objectives, or results.

### Task 7.3: Add anonymous milestones

**Modify**

- `games/reel-problems-2/analytics.ts`

**Work**

Add mode, contract, finale, first warning, first chain, recovery, personal-objective result, notable timestamp availability, completion, retry, and voluntary same-room replay milestones. Do not record voice, arbitrary names, invite data, or complete fact logs.

**Gate**

Analytics can answer whether runs reach their climax and produce replays without exposing the recap narrative or personal content.

## Milestone 8 — verification and tuning

### Task 8.1: Full correctness pass

Run:

```text
node scripts/test.mjs games/reel-problems-2
node scripts/test.mjs shared/peer platform/peer
npm run check:architecture
npm run typecheck
npx oxlint games/reel-problems-2 app/reel-problems-2 scripts/peer-integration.mjs
npx oxfmt --check games/reel-problems-2 app/reel-problems-2 scripts/peer-integration.mjs
npm run build
```

Also run the original Reel Problems suite if any shared or copied behavior changes.

**Gate**

All relevant automated checks pass, and no unrelated files are formatted or staged.

### Task 8.2: Browser, input, and visual QA

Exercise:

- all three contracts and finales;
- every event warning and recovery response;
- win, loss, raft comeback, disconnect, and recap;
- keyboard/mouse, controller, and touch equivalence;
- isometric and first-person cameras;
- English and German copy;
- desktop and representative phone layouts;
- reduced motion and streamer-safe display;
- room replay with same and new seeds.

Inspect console errors, audio overlap, warning visibility, input focus, horizontal overflow, and performance spikes during waves, sinking, and recap generation.

**Gate**

No shipped interaction requires a hidden key, developer state mutation, or unavailable second player.

### Task 8.3: Human playtest gate

Run several solo sessions and at least five novice crew sessions. Record:

- time until a viewer can state the objective;
- remembered moments per run;
- longest active-play decision gap;
- comprehension of warnings and comeback actions;
- ability to explain the biggest chain reaction;
- whether personal objectives encouraged throwing;
- whether recap cards matched crew memory;
- voluntary same-room replay;
- recovery duration and task distribution.

Tune catalog weights, warning durations, danger costs, physical forces, and objective thresholds from the evidence. Change fixed product rules only by revising the design first.

**Release gate**

The mode meets the design's directional playtest targets, or the failing mechanic is revised and retested. A passing build alone is not enough.

## Recommended implementation slices

Keep review units small and independently verifiable:

1. Mode/schema plus pure Director and catalog validation.
2. Structured facts plus truthful recap model.
3. Personal objective engine and safe starter catalog.
4. Loose-object event slice.
5. Weather/wildlife event slice.
6. Damage/recovery event slice.
7. Contract definitions and one finale at a time.
8. Chaos HUD and audio intensity.
9. Voyage recap and streamer-safe display.
10. Checkpoint migration, peer integration, full QA, and playtest tuning.

Do not implement all content before the first end-to-end slice. The first playable review should contain one contract, one finale, four compatible events, three personal objectives, live warnings, and a truthful recap. Validate that small loop with humans before multiplying catalog content.

## Main risks and responses

| Risk | Response |
| --- | --- |
| Chaos feels arbitrary | Prerequisites, visible causes, warnings, deterministic selection, and causal recap |
| Too many simultaneous jobs | Hard urgent-event cap, danger budget, exclusions, and recovery windows |
| Director punishes weak crews | Struggling-state observation delays danger; no hidden outcome correction |
| Personal objectives encourage sabotage | Catalog validation, fact-based progress, eligibility rules, and neutral disconnect handling |
| Recap falsely blames a player | Require direct actor fact plus measured consequence; use neutral fallback |
| Reconnect duplicates events | Stable transition IDs, idempotent reducers, and lifecycle checkpoint tests |
| New rules leak into existing modes | Discriminated mode state and regression tests before content work |
| `Game.tsx` becomes harder to maintain | Extract Chaos HUD and recap; keep rule logic in pure modules |
| Event content becomes branch-heavy | Validated data catalog with existing-system handlers |
| Spectacle hides counterplay | Warning-priority audio, readable silhouettes, reduced-motion path, browser QA |
| Scope expands into replay technology | Ship timestamps and seed codes first; defer video and simulation replay |

## Immediate coding handoff

Start with **Milestone 0 and Milestone 1 only**. The first code review must prove:

- existing behavior has a recorded baseline;
- Chaos Voyage is a separate restorable mode;
- the pure Director is deterministic and budgeted;
- malformed event definitions are rejected;
- Classic and Last Boat Home remain unchanged.

After that review, build the smallest end-to-end playable slice: one contract, one finale, four compatible events, three personal objectives, live warnings, and a truthful recap. Do not begin the full twelve-event and twenty-objective catalogs until that slice passes a human playtest.
