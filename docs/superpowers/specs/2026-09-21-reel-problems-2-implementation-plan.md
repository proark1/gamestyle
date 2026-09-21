# Reel Problems 2 — implementation plan

Date: 21 September 2026  
Status: proposed execution sequence; no gameplay implementation in this pass  
Design: [full game design](2026-09-21-reel-problems-2-design.md)

## Outcome and execution rules

Deliver a standalone-quality cooperative campaign in increments, beginning with one complete fishing-delivery-and-rebuilding mission. Build 2v2 only after cooperative play is validated. This plan does not commit to a calendar date or imply that later phases are already implemented.

All gameplay changes belong to `games/reel-problems-2`. Shared platform changes must be justified by actual integration needs. Preserve unrelated working-tree changes and the original `games/reel-problems` game. Do not deploy as part of implementation unless separately requested.

Before implementation, review the linked design and choose the first milestone below. Treat the numerical balance values as tunable mission data. Each stage produces a playable or testable result with a clear exit gate.

## Milestone A — one complete mission

### A1. Establish the baseline and mission boundary

**Work**

- Record the starting state and run the existing copy's rule tests.
- Add explicit classic/campaign mode state and checkpoint schema version.
- Create `campaign.ts` with the First Delivery definition: eight minutes, three eligible fish, home dock, repair slip, and optional medals.
- Create `mission.ts` with start, playing, recovering, completed, and failed mission transitions. Recovery is a substate of an active mission, not a second round.
- Replace campaign uses of `ROUND_MS` with the selected mission duration; retain classic duration. Audit hull leak windows, music/timer warnings, UI countdown, and finish logic together.
- Preserve selected contract/mode when starting or restarting. Existing `reelAction()` replaces the world with `freshReel()`, so selection must be reapplied deliberately.

**Existing integration points**: `types.ts`, `simulation.ts`, `hull.ts`, `peer.ts`, `Game.tsx`, `analytics.ts`.

**Exit gate**: classic tests still pass; a campaign run starts with the correct goal and duration, resets correctly, and survives a checkpoint round trip. Legacy checkpoints restore as classic tournaments.

### A2. Make delivery a real objective

**Work**

- Implement `cargo.ts` with stable IDs, bounded boat storage, and a single location per item.
- Route campaign catches from `bank()` into cargo rather than immediate completion credit. Preserve catch animation and classic scoring.
- Configure perch/salmon spawn points and replenishment in the mission fishing area; keep salvage separate from eligible delivery cargo.
- Add the delivery berth near the existing home dock and a validated unload hold.
- Transfer cargo and update mission progress in one authoritative action; reject repeated/remote/ineligible interactions.
- End the mission when the third fish is delivered. Define and test unloading at the deadline before adding presentation.
- Add full-hold feedback and ensure catches are not silently deleted.

**Exit gate**: a normal-input simulation can catch, carry, unload, and complete. Catching alone cannot win, unloading twice cannot duplicate credit, and leaving the berth mid-hold does not consume cargo.

### A3. Make the route usable by one or two people

**Work**

- Add `navigation.ts` for berth rules, points of interest, and a solo steering assist.
- Add explicit water/boat/dock support state and coordinate conversions, plus walking, collision bounds, climbing out, and boarding at the small repair slip. Test dock movement before placing carried materials there.
- Block out the cove, fishing area, repair slip, optional crate, and steering gate using existing scenery primitives.
- Preserve physical paddling, but make solo travel practical without constant side switching.
- Introduce one telegraphed hull fault after the second catch and suppress competing hazards during that lesson.
- Add proper dock repair with visible state feedback; retain patching and bailing aboard.
- Gate scenario triggers so rejoining or restoring a host cannot repeat the tutorial fault.

**Exit gate**: a solo player and a two-person crew can navigate to the fish and return. Repair stops flooding, bailing clears water, and the scripted lesson fires once per mission.

### A4. Replace automatic boat replacement with rebuilding

**Work**

- Implement `rebuilding.ts`: wreck, rescue, gather, attach, ready, relaunch.
- Change both automatic replacement paths: swimmer arrival in `swim()` and timeout replacement in `step()`. Campaign recovery must not fall through either classic launch path.
- Preserve cargo as recoverable crates and place a guaranteed construction kit at the recovery slip.
- Implement carrying, dropping, valid socket attachment, single-item ownership, and missing-item recovery.
- Build the raft from two plank bundles, one barrel pair, and one paddle. Completed attachments survive interrupted holds; partial holds do not.
- Add the final push/launch interaction, solo completion, grace interval, and limited raft cargo/speed (three cargo units for the initial raft).
- Return disconnected players' essential carried objects to a reachable state.
- Add a deterministic wreck-start developer scenario for tests and future Back in Business content. Do not expose a destructive debug button in the standard mission.

**Exit gate**: sink with cargo, recover, rebuild, relaunch, and complete in one run. No instant replacement, missing-material deadlock, cargo duplication, or permanent spectator state. Verify every recovery phase through checkpoint restoration.

### A5. Present the mission clearly

**Work**

- Add `ContractSelect.tsx`, `MissionPanel.tsx`, and `mission-scene.ts` instead of placing every feature in the large existing `Game.tsx` and `scene.ts` files.
- Show objective, delivered/onboard cargo, time, boat condition, and next contextual action.
- Render visible cargo, recovery crates, material rack, construction sockets, and each installed raft component.
- Add camera framing and destination guidance for sailing, swimming, and rebuilding.
- Rewrite campaign briefing, prompts, errors, and results in English and German.
- Add device-specific prompts, touch/controller equivalents, keyboard focus, reduced-motion behaviour, and useful warning sounds/captions.
- Keep campaign and classic menu options clearly distinct; do not describe unfinished later regions as playable.

**Exit gate**: a newcomer can identify the goal, delivery dock, repair action, and next assembly component without developer instructions. Desktop and narrow touch layouts remain usable in all phases.

### A6. Support NPCs, progress, and multiplayer recovery

**Work**

- Extend `npcs.ts` with navigation assistance, cargo delivery support, material collection, and attachment priorities. Prevent two NPCs claiming the same object.
- Add a simple deckhand destination/task command, with a visible current task.
- Add `progress.ts` for versioned local completions and earned medals. Reads must tolerate unavailable/corrupt storage and must not block play.
- Credit participating guests after authoritative completion without granting permanent upgrades mid-mission.
- Add anonymous mission analytics for first catch, delivery, repair, sinking, recovery duration, retry, and completion.
- Verify action allowlists, validation, snapshot restoration, reconnects, and host migration for every new interaction.

**Exit gate**: solo and two-human runs are complete; a four-client integration session confirms interaction ownership and recovery. Losing the host during unloading or assembly preserves completed work exactly once.

### A7. Playtest and tune

**Work**

- Run scripted correctness checks and render/browser checks.
- Observe at least five novice pairs and several solo sessions using the questions in the design document.
- Record time to first catch, delivery confusion, recovery duration, task distribution, completion, and voluntary replay.
- Fix unreadable causes, excessive travel, input ambiguity, or maintenance overload before adding content.
- Profile the chosen desktop and phone hardware; record frame rate and sinking/rebuild spikes.

**Exit gate**: the introductory mission passes correctness checks and the practical comprehension/recovery targets, or the design is revised and retested. Do not advance just because the code compiles.

## Milestone B — a complete harbour chapter

Depends on A7.

1. Add Patchwork Crew and Back in Business using the same mission systems, with distinct objectives rather than copied scoring rounds.
2. Add a chapter-selection screen, completion stamps, optional medals, clear unlocks, and replayable untimed practice.
3. Add authored pressure scheduling, with quiet intervals after recovery and no impossible hazard overlaps.
4. Add the skiff and salvage barge only after their different layouts improve decisions in real sessions.
5. Introduce a small optional-equipment set and verify every contract remains finishable with its default loadout.
6. Replace temporary art where it obscures identity or readability; polish boat damage, fish tells, construction animation, and results feedback.

**Exit gate**: the three-contract chapter is playable end to end with saved local progress, one to four participants, meaningful variation, and no requirement to grind medals. Test all launchable boat/loadout combinations for mission viability.

## Milestone C — one fair 2v2 arena

Depends on the stable campaign systems from B. Do not introduce a second boat before addressing the single-boat assumptions.

### C1. Refactor boat ownership without changing campaign behaviour

- Replace the single `world.boat` model with a boat collection and explicit team/player boat references.
- Move leaks, water, gear, cargo, recovery, and boat events onto their owning boat.
- Make coordinate conversion, swimming/boarding, NPC destination selection, line origins, camera targets, and rendering accept boat identity.
- Run the cooperative campaign on one boat through the new representation.
- Add checkpoint migration and reject impossible cross-boat references safely.

**Gate**: campaign and legacy restoration tests pass; no singleton assumption remains in an interaction that can target different boats.

### C2. Add Harbour Derby rules and team UI

- Create mirrored docks, two crews, equal loadouts, six-minute timing, and banked-value scoring.
- Add explicit fish team claims and release rules; team cargo ownership; gentle non-damaging boat contacts.
- Add independent recovery kits, protected relaunch with anti-farming restrictions, and transparent draw resolution.
- Add team selection, readiness, opponent score, team patterns, and rematch flow.
- Keep this mode outside automated party rotation until it has a deliberate party integration and validation pass.

**Gate**: four clients complete a match; sinking or reconnecting on one boat never resets the other. Equal-value scores draw and no action after the buzzer can change the outcome.

### C3. Competitive playtests

- Observe repeated matches with swapped teams and starting sides.
- Look for dock blocking, fish monopolies, recovery loops, collision abuse, one dominant loadout, and disengagement after an early deficit.
- Compare opportunity and travel time by side, not just wins in a tiny sample.
- Tune routes, claims, telegraphs, and recovery before considering weapons or stealing.

**Gate**: neither starting side has a known structural advantage; the basic interactions remain understandable and losing crews have a practical route back into play. Private-room prototype only; ranked/public-matchmaking requirements remain separate.

## Milestone D — full campaign expansion

Depends on B, and informed by C where systems overlap.

Build the five remaining regions from the design in order of mechanic dependency: channels, moving destinations, salvage/towing, weather combinations, then a giant-catch finale. Each region needs a blockout, three distinct contracts, objective/hazard tests, solo checks, multiplayer checks, and observed playtests before art completion.

Prefer a smaller campaign of strong missions over filling all 18 slots with near-identical rounds. The six-region table is the intended direction; content count can shrink if the mechanics do not support enough variety.

Add optional challenge variants only after normal missions work. Revisit cloud progress, app packaging, release platforms, and commercial scope through separate decisions rather than silently extending this implementation.

## Verification plan

Use the repository's existing runner and tools. Commands below are proposed implementation checks; they were not run as gameplay validation in this documentation-only pass.

```text
node scripts/test.mjs games/reel-problems-2
node scripts/test.mjs shared/games platform/games
node scripts/check-architecture.mjs
npm run typecheck
npx oxlint games/reel-problems-2 app/reel-problems-2
npx oxfmt --check games/reel-problems-2 app/reel-problems-2
```

Add meaningful tests for the new mission, cargo, rebuild, ownership, deadline, and checkpoint invariants. Extend the existing peer integration harness with a Reel Problems 2 scenario; merely passing a new game ID to an unmodified scenario is not sufficient evidence. Run the relevant original-game suite when shared integration changes might affect it.

Browser checks should cover entering a mission, the first catch, a delivery, contextual repair, sinking, every construction stage, relaunch, win/loss, replay, and leaving the room. Inspect desktop and touch layouts and check console errors. Use real browser clients for network and input verification; direct state mutation is appropriate for deterministic test setup, not proof that the normal user flow works.

## Main risks and responses

| Risk | Response before adding scope |
| --- | --- |
| Rebuilding feels like punishment | Short travel, obvious sockets, guaranteed kit, measure recovery time |
| One person becomes the permanent repair worker | Fewer overlapping hazards, durable patches, task rotation, useful assists |
| Sailing feels slow or awkward | Test the cove route early; provide solo steering support |
| A late wreck makes the opening mission hopeless | Tune travel/time allowance and offer untimed practice; preserve banked cargo |
| Carrying or delivery duplicates under retries | Stable item IDs, host validation, idempotent state transitions |
| Host loss destroys assembly progress | Versioned checkpoints and tests at every recovery phase |
| Two boats expose hidden world assumptions | Migrate cooperative mode first; audit every boat lookup |
| Attractive effects hide actionable information | Readability review before adding visual density |
| The campaign becomes many copies of one mission | Require a new decision or mechanic combination in each contract |

## Immediate handoff

The next coding task is **Milestone A1–A2: campaign state plus a real catch-and-deliver objective**, followed by navigation, rebuilding, and the first-level interface. Do not jump directly to all regions or a competitive mode. The first reviewable playable result should prove that catching and delivering is understandable before rebuilding increases the interaction load.
