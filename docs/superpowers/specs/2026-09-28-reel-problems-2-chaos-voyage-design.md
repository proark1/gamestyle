# Reel Problems 2 — Chaos Voyage

Date: 28 September 2026  
Status: approved design; implementation has not started

## 1. Purpose

Add a highly watchable cooperative mode to Reel Problems 2 that reliably creates funny, understandable stories without Twitch integration or direct audience control.

Chaos Voyage is an eight-to-twelve-minute cooperative run for the existing supported crew sizes. The crew shares one primary outcome but each player receives a personal side objective. Decisions create pressure; the existing physical simulation supplies the punchline. Serious mistakes normally change the crew's problem instead of ending the run immediately.

The mode must be enjoyable to play first and easy to follow on a stream second. It must not rely on random visual noise, deliberate sabotage, permanent power advantages, or players already knowing Reel Problems 2.

## 2. Product decisions

- Add Chaos Voyage as a separate mode. Keep Classic and Last Boat Home available and behaviorally unchanged.
- Target rounds of eight to twelve minutes, with approximately nine minutes as the initial tuning point.
- Keep viewer participation outside the scope. Streamability comes from readable action, player reactions, escalating situations, and a strong recap.
- Use shared victory or defeat plus personal side objectives. Side objectives may create playful friction but never require throwing the shared objective.
- Combine decision pressure with physical slapstick. The decision should explain why the physical chain reaction occurred.
- Make almost every disaster recoverable. The cost is time, lost optional resources, a worse vehicle, or a harder route rather than an arbitrary early game over.
- Add new content as independent event, objective, mission, and finale definitions rather than one-off branches in the main UI component.

## 3. Design pillars

1. **Readable escalation.** A viewer can identify the objective, the current emergency, and its cause without knowing every control.
2. **Decisions cause comedy.** Players choose what to prioritize; physical systems turn those choices into memorable consequences.
3. **Failure creates play.** Losing equipment, cargo, or the boat opens a rescue path instead of creating a spectator state.
4. **Crews create the story.** The game highlights who caused, survived, or solved a crisis without manufacturing a false narrative.
5. **Fast rematches.** Briefing, results, and restart stay short enough that a group wants another run.

## 4. Round structure

### Act 1 — The plan, approximately minutes 0–2

Show one clear primary contract. The crew chooses its route or starting equipment, learns the immediate task, and makes useful progress before the first serious complication. Minor incidents may establish the run's tone but cannot threaten the mission.

### Act 2 — Escalation, approximately minutes 2–6

The Director combines compatible events around the crew's current situation. It prefers events that interact with an existing decision or object: rough water matters when cargo is loose, a gull matters when a catch is exposed, and a steering failure matters near an obstacle.

### Act 3 — Finale, approximately minutes 6–9

One authored finale transforms the final return journey. It must be announced, use mechanics already demonstrated during the run, and offer several useful jobs. The Director stops introducing unrelated major hazards once the finale begins.

### Last chance

Destroying the main boat can lead to a short rescue-and-rebuild sequence. A makeshift raft can still complete the contract. Recovery must remain active play for every connected player and should take less than one quarter of the target round duration.

The initial tuning target is nine minutes. A run may end earlier when the primary objective is conclusively completed or failed. Recovery may extend a run toward the twelve-minute ceiling, but there is no indefinite overtime.

## 5. Chaos Director

The Director is a deterministic, host-authoritative scheduler. It observes summarized game state, selects eligible event definitions, announces them, and asks existing simulation systems to execute them. It does not directly fake physics outcomes.

### Event roles

| Role | Examples | Purpose |
| --- | --- | --- |
| Setup | Heavy catch, full deck, risky route | Creates an interesting situation |
| Disruption | Gust, crab, gull, damaged rudder | Introduces a decision |
| Chain reaction | Sliding fish, dropped material, pulled player | Produces the comic consequence |
| Recovery window | Calm water, floating crate, brief repair advantage | Makes a comeback possible |
| Finale | Monster wave, giant pull, collapsing harbour | Gives the run a climax |

Each event definition declares:

- stable event ID and category;
- eligible acts and Director intensity range;
- world-state prerequisites and possible targets;
- incompatible active events;
- warning duration and presentation cue;
- danger-budget cost, cooldown, and repeat rules;
- execution action in an existing simulation system;
- success, failure, cancellation, and recovery outcomes;
- facts to append to the voyage story.

### Director rules

- Allow no more than two simultaneous urgent problems.
- Telegraph every dangerous event visually or audibly before its consequence.
- Reserve danger budget for the finale rather than exhausting the crew early.
- Insert a short recovery window after a major rescue, rebuild, or narrowly survived event.
- Do not add a major hazard while the crew is already in an unrecoverable or overloaded state.
- Do not choose the same finale in consecutive runs for the same room when alternatives are eligible.
- Cancel an event safely when its target becomes invalid. The Director may choose another event on a later evaluation; it must not retarget a warned event silently.
- Preserve deterministic selection for the same seed and equivalent authoritative inputs.

The Director may reduce pressure for a struggling crew by delaying a scheduled event or selecting recovery content. It must not secretly change completed outcomes or grant unannounced score bonuses.

## 6. Event interactions

The first catalog should contain approximately twelve disruptions and chain-reaction opportunities. It should build on current weather, wildlife, fishing, deck jobs, damage, swimming, rescue, and rebuilding systems.

Initial candidates are:

- An unsecured fish slides with the deck and can hit players, the bucket, or carried material.
- A giant fish's tail slap can knock a nearby unsecured object toward the rail.
- Active rods attract a warned lightning strike; releasing the rod prevents conduction, while tangled active lines can carry the effect between anglers.
- A gull drags an exposed catch across the deck before escaping, creating a short physical chase rather than an immediate deletion.
- A shark catches a taut line and pulls the boat sideways until the crew releases, redirects, or resolves the line.
- A monster wave shifts every loose physical object; tied-down or installed objects remain secure.
- A collision breaks a visible boat component that can be recovered or replaced provisionally.
- A damaged rudder creates asymmetric steering until a player repairs it or the crew compensates.
- Flooding temporarily makes selected deck areas slippery and can disable a low station until water is bailed.
- A dropped essential supply floats within a reachable recovery area and receives a clear marker.
- Strong wind changes the safe side for carrying tall or heavy objects.
- A flopping catch can interrupt a held deck job unless another player secures it.

Exact forces, timing, and probabilities are tuning values. An interaction ships only if players can read its warning, consequence, and response.

## 7. Contracts and finales

The first release contains three reusable primary contract shapes:

1. Bring one giant catch to harbour alive.
2. Deliver a valuable catch quota before an approaching storm closes the route.
3. Rescue a damaged boat and recover a required portion of its cargo.

The first release also contains three finales:

### The Big Pull

The giant catch drags the boat through a signposted obstacle route. Anglers alternate between controlling the line, steering, securing cargo, and repairing collision damage.

### Harbour From Hell

The harbour entrance fails during the return. The crew must open or repair a route while keeping the vessel moving and afloat. The existing winch and deck-job language should be reused where possible.

### Everything Sinks

The main vessel becomes unsalvageable after a clearly signalled sequence. The crew retrieves essential components, launches a makeshift raft, and completes a shortened final leg. The loss is dramatic but does not invalidate earlier progress automatically.

Contracts and finales are independent definitions. Every supported pairing must declare its required systems and exclusions; the catalog must not select an incompatible combination.

## 8. Personal objectives

At round start, the host assigns one private side objective to each human player. The player can read it throughout the run. The crew sees all assignments only in the recap.

Objectives fall into three groups:

- **Heroics:** perform rescues, repairs, or risky manoeuvres.
- **Quirks:** retain the original hat, favor one side of the boat, or avoid a nonessential job.
- **Dares:** fish during a storm, secure a dangerous catch, or recover an optional object.

The initial catalog targets approximately twenty objectives. An objective definition declares eligibility, progress events, completion rules, incompatibilities, and recap text.

Objectives must not:

- require shared mission failure;
- reward damaging the boat, abandoning another player, or deleting essential resources;
- force an action unavailable to the player's input method or crew size;
- depend on another specific human remaining connected;
- provide permanent gameplay power.

Rewards are recap titles, cosmetic badges, and access to optional contract variants. If a player disconnects permanently, their objective ends neutrally and is not reassigned. A reconnecting player resumes the same objective and progress.

## 9. Stream presentation

### Live presentation

- Show short event banners with the cause and involved player names, for example: `TAIL SLAP — NICO KNOCKED MAYA OVERBOARD`.
- Display a simple three-stage chaos meter that communicates the run's dramatic phase, not a hidden probability or exact difficulty value.
- Let music intensity follow the current act and urgency while actionable warnings remain acoustically dominant.
- Give exceptional rescues and recoveries a short audiovisual accent without pausing or slowing authoritative play.
- Keep urgent objects and player silhouettes readable from the existing stream camera views.
- Provide a streamer display option that hides room codes and other private connection information.

The game must avoid full-screen alerts during control-critical moments. Presentation consumes authoritative events but cannot alter simulation timing.

### Story of the Voyage

After the run, replace a generic statistics wall with a concise generated recap:

1. **Biggest disaster:** the highest-scoring causally connected event chain;
2. **Hero of the voyage:** the most consequential successful rescue or recovery;
3. **Most questionable decision:** the largest player-caused recoverable setback;
4. **Personal objectives:** assignments, results, and suitable titles;
5. **Crew sentence:** a short template-based summary using verified facts.

The recap may call a decision questionable only when the event log contains a direct player action and a measured consequence. It must not blame a player for a random target selection, network loss, or Director event.

The story screen also exposes the run's seed and timestamps of notable moments. The first release does not record video, create MP4 files, or replay the simulation. A timestamp such as `Best moment: 06:42` is sufficient for a streamer to find the moment in their own recording.

### Seed challenges

Every run has a short shareable seed code. The seed fixes Director selection and authored event variation, but differences in player actions can still change eligibility and outcomes. The UI must describe it as the same setup rather than promise an identical replay.

## 10. Components and boundaries

The implementation should add focused game-local modules instead of expanding `Game.tsx` with Director rules.

| Component | Responsibility |
| --- | --- |
| `chaos-director.ts` | Director state machine, acts, intensity, budgets, scheduling, recovery windows |
| `chaos-catalog.ts` | Pure event definitions, eligibility, incompatibilities, and weights |
| `personal-objectives.ts` | Objective definitions, assignment, progress, and evaluation |
| `voyage-story.ts` | Structured facts, causal chains, highlight ranking, recap model |
| `ChaosHud.tsx` | Chaos stage, private objective, and live event presentation |
| `VoyageRecap.tsx` | Post-run story, objective reveal, timestamp, and seed presentation |

Existing `chaos.ts`, `survival.ts`, `mission.ts`, `deck-jobs.ts`, `hull.ts`, and related modules remain responsible for their physical and mission rules. The Director calls their public actions or schedules data they already consume. It must not implement duplicate weather, damage, wildlife, or rebuilding simulations.

Extracting the new HUD and recap also prevents the already large `Game.tsx` from becoming the owner of new game rules. Unrelated refactoring is outside scope.

## 11. State and data flow

Authoritative world state gains a discriminated Chaos Voyage mode and a versioned Director state containing:

- run seed and deterministic random state;
- current act and intensity;
- active danger budget;
- scheduled, warned, active, completed, and cancelled event IDs;
- event cooldowns and recovery-window deadline;
- contract and finale IDs;
- objective assignment and progress by player ID;
- bounded structured voyage facts.

On each fixed simulation step:

1. Existing systems advance the physical world.
2. Those systems emit structured facts for significant actions and consequences.
3. The Director updates its act and evaluates whether it may schedule or advance an event.
4. Scheduled event actions enter existing simulation systems.
5. The story builder links new facts by actor, target, object, and recent causal IDs.
6. Checkpoint snapshots include the resulting authoritative state.
7. UI and audio render the latest state and facts without making rule decisions.

Voyage facts use stable IDs and a bounded retention policy. The authoritative state keeps the facts needed for the current run and recap, not an unbounded analytics history. Voice content is never recorded or interpreted.

## 12. Recovery, networking, and errors

- Every event instance receives a stable unique ID. Applying an already applied transition is a no-op.
- Checkpoints preserve Director phase, event states, contract, finale, objective progress, and voyage facts.
- Host handover clears transient held inputs but does not replay warnings or completed event actions.
- Legacy checkpoints default to their original mode and receive no Chaos Voyage state implicitly.
- A missing or invalid event definition cancels that event, records a diagnostic fact, releases its budget, and allows the run to continue.
- If a warned target disconnects or becomes invalid, cancel visibly; never move the consequence to another player without a new warning.
- Essential recovery objects keep the existing single-owner/location invariants and safe-return behavior.
- Results resolve once. Late network actions cannot change a completed run or award an objective twice.
- A disconnected player's personal objective is neutral for the recap. Shared success still follows the existing room participation rules.

## 13. Testing

### Automated rule tests

- Equivalent authoritative inputs and seed produce the same Director decisions.
- The urgent-problem cap, danger budget, cooldowns, warnings, and recovery windows hold at boundary ticks.
- Every event definition passes catalog validation and has valid completion, cancellation, and recovery paths.
- Invalid targets cancel safely and do not leak danger budget.
- Supported contract/finale pairs meet their declared dependencies.
- Reconnect and host handover neither duplicate nor skip event transitions.
- Objective eligibility, progress, disconnect handling, and single completion are correct.
- Causal-chain ranking selects connected facts rather than unrelated high-value events.
- Recap blame requires a verified player action and consequence.
- Seed codes parse safely and invalid codes fall back without crashing.
- Classic and Last Boat Home retain their current behavior and tests.

### Browser and network checks

- Complete each contract with each finale through normal controls.
- Exercise the main recovery path and finish on the raft.
- Verify keyboard, controller, and touch can respond to every shipped event and objective.
- Verify event banners, warnings, chaos meter, and recap at desktop and representative phone sizes.
- Verify streamer display hides room credentials.
- Run real multi-client sessions through an event warning, host loss, recovery, and recap.
- Confirm audio warnings remain distinguishable from music and voice chat.

### Human playtest gates

The first tuning pass is successful when directional playtests show:

- a new viewer can state the primary objective within one minute;
- a typical run produces at least two clearly remembered moments;
- important decisions are separated by no more than approximately twenty seconds of dead time during active play;
- players recognize a comeback action after a major disaster without facilitator instruction;
- players can explain what caused the largest chain reaction;
- personal objectives create discussion without encouraging intentional mission failure;
- recap cards agree with the crew's recollection of the run;
- most test groups voluntarily start a second run.

These are playtest gates, not claims that automated tests can prove fun or virality.

## 14. Initial delivery scope

Build the following as one coherent release slice:

- separate Chaos Voyage mode;
- eight-to-twelve-minute three-act round structure;
- deterministic Chaos Director with danger budget and recovery windows;
- three primary contract shapes;
- three finale definitions;
- approximately twelve validated event interactions;
- approximately twenty eligible personal objectives;
- live chaos meter and event presentation;
- structured voyage story, recap cards, notable timestamp, and seed code;
- checkpoint, reconnect, host-handover, input, regression, and human playtest coverage.

Defer video recording and replay, viewer interaction, Twitch APIs, public matchmaking, a large campaign, additional boats, permanent power progression, and unrelated simulation rewrites.

## 15. Open tuning values

The following are intentionally tuning parameters rather than unresolved product decisions:

- exact act boundaries within the eight-to-twelve-minute envelope;
- warning and recovery-window durations;
- danger-budget costs and selection weights;
- physical forces and event cooldowns;
- objective counts required for individual completion;
- causal-chain scoring weights used by the recap.

They should receive conservative defaults in the implementation plan and be adjusted from recorded playtest evidence. Their configurability must not weaken the fixed product rules above.
