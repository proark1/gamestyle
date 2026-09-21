# Reel Problems 2 — full game design

Date: 21 September 2026  
Status: design proposal for review; no gameplay implementation in this pass  
Companion: [implementation plan](2026-09-21-reel-problems-2-implementation-plan.md)

## 1. The game we are making

Reel Problems 2 is a cooperative fishing adventure about a crew trying to run a fishing business with boats that are never quite up to the job. Catching a fish, delivering an order, keeping the hull afloat, and rescuing a friend are equally important parts of the game.

The defining promise: **even losing the boat can become the best part of the trip.** A sinking creates a short rescue and rebuilding story, followed by a real chance to finish the job.

The main experience is a campaign for one to four players. A dedicated two-versus-two tournament mode follows once the cooperative loop works. Sessions should produce coordinated decisions and recoverable mistakes, rather than a pile of unrelated hazards.

The approved direction combines believable water, weather, materials, and physical weight with the readable proportions, expressive animation, and approachable cooperation associated with an Overcooked-like party game. The setting, characters, boats, interface, and missions should have their own identity.

### Product boundaries

- Build inside `games/reel-problems-2` and its `/reel-problems-2` routes.
- Keep the original Reel Problems implementation intact.
- Retain the existing shared account, room, voice, input, rendering, and wardrobe infrastructure where useful.
- Start with private online rooms and solo play. Public matchmaking, ranked competition, and local shared-screen multiplayer are separate later decisions.
- A standalone-quality game does not require a separate application or commercial launch in this milestone. Packaging, storefronts, monetization, and release dates are outside this plan.

All durations, quantities, and thresholds below are initial tuning proposals, not validated balance claims.

## 2. Design pillars

1. **The boat is a shared responsibility.** Fishing changes its balance and trajectory; navigation and maintenance influence what the crew can catch.
2. **Useful choices compete for attention.** Reel or repair? Save the expensive crate or rescue the paddler? Take the safe channel or reach the delivery window?
3. **Failure changes the situation.** A snapped line, lost crate, or wreck creates an actionable problem. Avoid long spectator states and unrecoverable resource shortages.
4. **Chaos is readable.** A player should see or hear a warning, understand the consequence, and learn a response.
5. **Progression adds possibilities.** New boats, equipment, locations, and mission combinations matter more than permanent stat increases.

Reject features that add button complexity or interruptions without creating a meaningful choice for the crew.

## 3. Core session loop

Choose a harbour contract → choose a boat and equipment → launch → fish, navigate, repair, and rescue → deliver the cargo → earn a contract stamp and optional medals → choose the next job.

The harbour is initially a compact contract/loadout screen, not a walkable hub. It shows the next objective, expected duration, weather, boat choice, and the crew's readiness. A navigable harbour can be considered later if it adds play rather than menu travel.

Standard contracts target 6–10 minutes; the introductory contract targets 6–8 minutes. A clear primary objective ends a successful mission immediately. There is no requirement to wait out a timer after finishing the work.

The results screen shows what was delivered, an optional challenge earned, the crew's biggest rescue or recovery, and what unlocked. Offer replay and next contract with the current room preserved.

## 4. Moment-to-moment play

### Fishing

Keep the existing cast, tension, surge, shared-line, and cooperative-pull mechanics. Each fish family should ask for a recognisable response:

| Family | Behaviour | Crew decision |
| --- | --- | --- |
| Small schooling fish | Quick catches near sheltered water | Fill a modest order safely |
| Fast runners | Pull sideways in readable bursts | Steer with the run or risk a tangle |
| Heavy bottom fish | Slow, sustained force on the hull | Share the pull and counterbalance |
| Jumpers | Telegraph a leap before landing near the deck | Create space and protect loose cargo |
| Giant catches | Several phases and a changing route | Navigate, repair, and reel in rotation |
| Salvage | Low value as fish, useful for mission tasks | Spend time collecting equipment or materials |

Do not give every fish every behaviour. The first contract uses only perch and salmon as eligible fish, with mission-owned spawn locations inside the sheltered fishing area and deterministic replacements after catches. Incidental salvage is not counted toward its food order. Boss phases are later content, not a prerequisite for proving the basic loop.

### Movement and work

Players can move around the deck, cast, reel, brace, carry an object, paddle, repair, and rescue. The repair slip is a small walkable dock with an explicit climb-out point and launch edge; the first milestone must add dock movement rather than assume swimming and boat-local movement already support it. A player carries one loose item at a time and cannot fish while carrying it. Dropping is immediate and never destroys an essential object.

Use a contextual interaction button with a visible target and verb. Select the nearest eligible target in reach, with stable focus while holding. Do not silently switch a held repair action into a fishing action when another target moves closer. Keep cast/reel, brace, jump, and cut-line actions distinct where accidental activation would be costly.

Keyboard/mouse, controller, and touch need equivalent actions. Existing bindings are a starting point; adding one key for every new system is not the final control scheme. Prompts must follow the active input device.

### Flexible roles and solo support

There are no locked classes. A crew can exchange fishing, steering, repairs, cargo, and rescue jobs at any time.

Two humans are the initial balancing target. Solo receives an optional deckhand that can steer toward a selected destination, bail, and help recover materials. The human still chooses routes, catches, and deliveries. The current NPCs need navigation, cargo, and rebuilding behaviours before campaign solo support can be called complete.

Every essential action is also possible without an NPC: a solo steering assist balances the opposite oar; building has no mandatory two-person carry; a launch can be completed by one player. Extra people accelerate selected tasks but never unlock a required action unavailable to a lone player.

## 5. Cargo, orders, and rewards

Catching and banking become separate events. Eligible catches enter the boat's cargo; reaching a delivery point and completing an unload interaction banks them. Show onboard and delivered quantities separately.

- Primary contracts ask for explicit quantities or cargo types, not just a hidden score threshold.
- The live well initially holds six catch units; a catch takes one unit regardless of visual size in the first milestone. The emergency raft holds three, enough for the introductory order in one trip.
- At capacity, show a delivery prompt. Prevent an extra catch from disappearing: release it with a clear full-hold message rather than silently awarding or deleting cargo.
- When sunk, onboard cargo becomes a bounded number of floating recovery crates. Delivered cargo remains safe.
- Cargo recovery cannot duplicate a catch or award it twice. Every item has a stable identity and a single owner/location.
- Mandatory mission packages return to a safe pickup point after becoming unreachable. Optional catch cargo may be lost after a clearly announced recovery window.

Campaign rewards are a completion stamp, up to two optional medals, and unlocks. Do not introduce repair debt or a purchase economy in the first release scope; they can punish the players most in need of help.

Each completed contract opens the next one. Medals unlock cosmetic variants and optional challenges, never the main path. Guests receive completion credit for a finished mission they participated in. Save progress locally in a versioned record first; account synchronization is a later integration, not an assumed existing feature.

## 6. Damage, sinking, salvage, and rebuilding

### Damage states

The first playable milestone retains the current single-leak simulation. The later campaign model expands to bow, port, and starboard hull sections, each with readable intact, cracked, and patched appearances.

Damage comes from identifiable events: collision, a large fish pulling into an obstacle, or a telegraphed wave. Random leaks are disabled in the introductory contract. A patch does not expire merely to create more busywork; another damaging event must cause a new problem.

Patching seals a crack; bailing removes existing water. Dock repair restores the hull. Standard repairs use a reusable tool in the first milestone, so consuming the last plank cannot prevent survival. Material inventory can be evaluated later after rebuilding works.

### Sinking sequence

1. A full flooding meter triggers a visible abandon-ship warning and a short sinking animation.
2. Crew enter the water; cargo and selected equipment become recoverable objects.
3. A nearby rescue point is highlighted. A crew member may rescue another or reach the point directly.
4. If nobody reaches safety within 12 seconds in the introductory mission, the harbour service tows the crew to the repair slip. It does not provide a completed replacement boat.
5. Assemble a basic raft, choose whether to retrieve optional cargo, and relaunch.

A downed crew member is included in harbour towing and can act again on arrival at the slip. Recovered crew receive a short safety interval so the same hazard cannot immediately disable them again. Recovery must not require swimming across the whole current lake. Early missions suppress hostile wildlife near the recovery area. The standard mission clock keeps running during recovery, except in the untimed practice variant. Introductory and assisted missions include generous time for one wreck.

### Physical rebuild interaction

Use a floating construction frame at the repair slip. Players carry materials from a nearby supply rack to four obvious sockets:

| Socket | Object | Result |
| --- | --- | --- |
| Deck A | Plank bundle | First half of the deck appears |
| Deck B | Plank bundle | Walkable deck is completed |
| Flotation | Paired barrels carried as one object | Frame rises to floating height |
| Propulsion | Paddle | Raft becomes launchable |

The two deck sockets can be filled in either order. Flotation follows the deck; propulsion follows flotation. A short hold attaches each object. A final push interaction launches the raft. Simultaneous contributions speed the final push, but one player can finish it.

Target total recovery time, measured from sinking to a controllable raft: 30–60 seconds for a two-person novice crew. This is a playtest target, not a forced wait. Keep the material rack close enough to make cooperation useful without turning recovery into walking laps.

The basic kit is guaranteed and cannot be permanently depleted. A missing essential item returns to the rack after 10 seconds without a reachable owner/location. Respawn the same logical item rather than creating additional copies. Salvaging a usable component can satisfy its matching socket; the rack then marks that requirement fulfilled.

The emergency raft has limited cargo capacity and modest speed, but can finish the current contract. A later dock visit restores the selected boat without permanent loss of unlocked equipment. Repeated wrecks remain recoverable; the clock and lost optional cargo provide the consequence.

### Avoiding bad incentives

- Sinking never creates permanent currency or extra mission cargo.
- No medal requires deliberately abandoning a teammate.
- A construction socket cannot consume the same item twice.
- Dropped items and disconnected carriers release their claims safely.
- No player is left in a spectator state while others rebuild.

## 7. Boats and equipment

Boat selection is about layout and teamwork, not a linear power ladder.

| Boat | Advantage | Cost | Initial equipment space |
| --- | --- | --- | --- |
| Rowboat | Balanced, easy to understand | No specialist strength | Two optional stations |
| Skiff | Fast travel and tight turning | Narrow deck and small cargo hold | Two optional stations |
| Salvage barge | Stable deck and more carrying room | Slow acceleration and wide turns | Three optional stations |
| Emergency raft | Guaranteed recovery vessel | Small hold and low speed | No optional stations |

Candidate equipment: stronger winch, extra cargo box, automatic low-rate bilge pump, wide rescue ladder, and salvage hook. Fit equipment only between missions or at designated service docks. Mandatory tools do not consume optional slots.

Prototype only the rowboat and emergency raft first. Add the skiff and barge after navigation and carrying are enjoyable. Competitive loadouts use a common budget and unlocked-for-everyone options, not campaign progression advantages.

## 8. Campaign and level structure

The full design target is six regions with three contracts each. Build an initial three-contract harbour chapter first. Expansion to all 18 contracts depends on playtest results; this table is a content roadmap, not a claim that those levels exist.

| Region | Contract 1: introduce | Contract 2: combine | Contract 3: payoff |
| --- | --- | --- | --- |
| Harbour School | **First Delivery:** catch and unload three fish | **Patchwork Crew:** repair a telegraphed leak while carrying an order | **Back in Business:** begin at a wreck, build a raft, complete a delivery |
| Reedwater Marsh | **Reed Between the Lines:** navigate narrow bends | **Lost and Found:** recover a marked supply crate | **Long Way Home:** choose a safe detour or a timed sluice |
| Working Harbour | **Morning Orders:** deliver to two destinations | **Mind the Ferry:** cross a clearly signalled ferry lane | **Last Collection:** meet a moving collection boat's delivery window |
| Brokenboat Bay | **Useful Rubbish:** salvage matching components | **Tow Trouble:** recover a disabled fishing boat | **Shipshape-ish:** rebuild at an island slip and escape with its cargo |
| Storm Coast | **Before the Squall:** prepare and deliver before rough weather | **Keep the Light On:** deliver lighthouse supplies through waves | **All Hands:** catch, shelter, repair, and finish the return journey |
| Deepwater | **Something Below:** learn the giant catch's pull | **The Long Haul:** navigate a hooked giant through safe channels | **The Lake Manager:** a multi-stage catch and delivery finale |

Each contract has one primary objective, one optional efficiency medal, and one optional teamwork or exploration medal. For solo, teamwork medals have a valid solo/deckhand equivalent. Example: recover all cargo rather than rescue another human.

Challenge variants reuse a level with one meaningful rule change: fragile cargo, limited optional equipment, a different delivery route, or stronger tides. Avoid stacking arbitrary speed, damage, and spawn multipliers.

Weather and wildlife are authored pressure events with seeded variation. A mission has a limited danger budget: an introductory repair lesson cannot overlap a shark attack and lightning strike. Give successful recovery a quiet interval.

## 9. First playable level: First Delivery

### Briefing

“The harbour café needs three fish. Bring them back before lunch. Try to bring the boat back too.”

Primary objective: deliver three eligible fish to the home dock within eight minutes. All three may be delivered together or in separate trips. The objective is identical for one or two humans in this prototype; evaluate three/four-player quotas only after that experience is tested.

Optional medals: finish within six minutes; return with no cargo lost. Sinking is not an automatic failure and does not invalidate the completion stamp. Once unlocked, an untimed practice version uses the same interactions without medals based on time.

### Map blockout

Reuse the current lake bounds initially. The playable route is concentrated in the southern cove, with the existing home mooring near `(0, 33.4)` and dock near `(0, 38)`.

Suggested authoring positions, to adjust after traversal testing:

- Sheltered fishing area centred near `(-9, 16)`.
- Repair slip and construction frame near `(12, 28)`.
- Optional salvage crate near `(10, 18)`.
- A broad practice steering gate near `(-16, 22)`.

Mark a safe route visually with buoys, shoreline shapes, and a destination beacon. Do not require a minimap for this level. Ensure the chosen camera shows the next navigational decision.

### Sequence

1. At the mooring, show the delivery objective and a short steering prompt.
2. First approach to the fishing area teaches casting and tension.
3. The first landed fish introduces onboard cargo and the return marker.
4. After the second catch, a single clearly signalled hull fault teaches patching and bailing. Suppress other hazards during the lesson.
5. Deliver the fish to complete the mission. If the crew sinks at any point, enter the salvage/rebuild path, then resume the same objective.

At the dock, a marked unloading berth captures a slow-moving boat and enables an explicit two-second unload interaction. Moving out of range or releasing cancels the hold without losing cargo. The simulation validates proximity and transfers eligible cargo once on completion.

The rebuild path is available through ordinary mistakes; the level does not secretly force a sink. A developer scenario and the third harbour contract start from a wreck so rebuilding can be tested reliably without teaching players to sabotage the introductory mission.

### Completion and failure

- Success: three fish delivered before the deadline; end immediately.
- Deadline: show delivered progress and offer a retry with the same crew.
- Sinking: recovery, not immediate failure.
- All crew disconnected: use the existing room lifecycle; do not invent offline mission simulation.
- Inaccessible required material: restore its existing logical item to the repair rack.
- On the exact deadline tick, resolve valid completed unloading interactions before evaluating expiry. No new actions are accepted after the result is set.

## 10. Two-versus-two: Harbour Derby

This is a separate mode with four players on two boats in one shared simulation. It is not two independent copies of the present single-boat world.

### Initial rules

- Six-minute round; highest banked catch value wins.
- Mirrored starting docks, equal travel distances, same boat/loadout budget.
- Common fishing areas and a telegraphed high-value catch event.
- Onboard catches are visible cargo; points count only when unloaded at the team's dock.
- No weapons, boarding, opponent item theft, or cutting an opponent's line in the initial mode.
- Gentle boat contact can redirect a boat; prototype contacts do not cause hull damage. Environmental damage still applies.
- A fish takes a team claim when its first hook attaches. That team's second player may help. The claim releases once no line from that team remains attached; an already-claimed fish rejects opposing hooks with clear feedback.
- Floating cargo retains its team ownership in the initial mode. Competition is over fishing grounds and delivery timing, not repeated theft during recovery.
- A sinking uses the same rebuild sequence, scaled to the symmetric team docks. Brief launch protection prevents immediate blocking; protected boats cannot claim fish or bank cargo until it expires or they leave the recovery zone.
- At the buzzer, banked value decides the result. Equal value is a draw in the prototype. No sudden-death extension until tie frequency is measured.

### Fairness and recovery

Announce valuable catch locations before they become active. Match opportunities symmetrically where practical. Do not grant hidden catch bonuses to the losing team. A common guaranteed raft kit creates a route back into the match without changing the score.

For a disconnect, preserve the seat for rejoining and allow a clearly identified deckhand to take over. The prototype uses private rooms; no ranked rating, public queue, or anti-cheat claim is implied by the existing host-authoritative networking.

Playtest competition only after two boats can move, collide, catch, sink, and recover independently without affecting the other team's state.

## 11. Visual, audio, and interface direction

### Art

Use chunky silhouettes, generous deck proportions, rounded tools, expressive crew animations, and distinct fish shapes. Keep believable water response, wood texture, ropes, and weather lighting. Reserve high contrast and strong saturation for players, interaction targets, danger, and mission objects.

Default to an elevated three-quarter gameplay camera. Preserve a wider view for navigation. Camera shake, flashes, and celebratory effects must never hide a leak, an approaching obstacle, or the tension warning. Offer reduced motion and reduced flashes.

A damaged hull needs visible cracks and water; a patched hull needs visible repair plates. Each installed raft component visibly changes the construction frame. Readability must survive without text labels and without relying only on colour.

### Sound

Prioritize actionable sounds: line tension, a fresh leak, rising flood, fish surge, successful patch, cargo banking, rescue, and completed assembly. Use distinct patterns and captions for urgent events. Music can increase intensity, but should yield to warnings and voice chat.

### Interface

In play, prioritize the contract, time remaining, delivered/onboard cargo, and boat condition. Show a contextual action prompt near the relevant work area. Rebuilding temporarily replaces fishing guidance with the next material/socket requirement.

Introduce controls during the action that needs them. Explain mistakes with a useful next action: “Water is still aboard—use the bucket,” rather than “Boat damaged.” Put detailed controls and fish information in an optional help panel.

Respect small screens, remapping, hold/toggle interaction preferences, readable text scaling, subtitles, and colour-independent team markings. Accessibility assistance may alter medals but must not block campaign progress.

## 12. Progress, replayability, and retention

The campaign supplies new mechanics and destinations. Replayability comes from improving routes, trying different boat layouts, optional challenge variants, and playing with different crew sizes.

Use contract completion to unlock locations and boat blueprints. Use medals for paintwork, flags, and celebratory cosmetics. Do not require grinding a currency to replace a sunk boat.

After a successful session, recommend one clear next contract. After a failure, preserve the loadout and offer a quick retry or assist settings. Avoid long results screens and repeated mandatory tutorials.

A seeded challenge board may follow the campaign. Daily obligations, live-service scheduling, and procedural open-world generation are not part of the first release scope.

## 13. Technical design grounded in the current implementation

### Current capabilities confirmed in source

- `simulation.ts`: casting, shared fish pulls, scoring, movement, swimming, rescue, fixed-step world advancement, and round results.
- `hull.ts`: one active leak, held patching, bailing, sinking, and replacement at the dock.
- `paddles.ts`: physical strokes and asymmetric turning; straight travel currently needs coordinated paddling or changing sides.
- `npcs.ts`: fishing, repair, rescue, and swim-to-dock behaviours.
- `peer.ts`: game adapter and checkpoint restoration.
- `scene.ts` / `models.ts` / `sea-scene.ts`: a single rendered boat, players, fish, shoreline, weather, wildlife, and recovery markers.
- `Game.tsx`: tournament menus/HUD, solo launch, rooms, touch input, and results.
- `analytics.ts`: tournament milestones and goal-based outcomes.

Important constraints: `ReelWorld` has a single `boat`, one `leak`, shared `gear`, and a global score. Catches award score immediately in `bank()`. Automatic replacement exists both when a swimmer reaches the dock and after a rescue timeout. The five-minute limit appears in simulation, hull timing, and UI. Changing one constant or rendering a second boat is insufficient for the proposed game.

### Recommended module boundaries

| Module | Responsibility |
| --- | --- |
| `campaign.ts` | Pure contract definitions, objective evaluation, medal rules |
| `mission.ts` | Authoritative mission state, duration, transitions, event schedule |
| `cargo.ts` | Stable item identity, carrying, storage, unloading, ownership |
| `rebuilding.ts` | Recovery phase, materials, sockets, assembly, relaunch |
| `navigation.ts` | Berths, interaction distances, solo steering assistance |
| `progress.ts` | Versioned local campaign completion and unlocks |
| `MissionPanel.tsx` / `ContractSelect.tsx` | Mission guidance and contract selection |
| `mission-scene.ts` | Delivery markers, repair frame, and physical mission objects |

These are proposed boundaries, not files created by this design pass. Reuse existing math and gameplay functions rather than creating a second simulation inside the UI. Keep these modules game-local and respect the repository's game/shared/platform import boundaries.

### State and authority

Add a discriminated mode for classic tournament, campaign, and eventually derby. Mission definitions are immutable data; live mission progress is authoritative world state. Represent player support explicitly as water, a boat deck, or a dock, with a support ID and clear local/world position conversion. Introduce dock support before carrying and rebuilding; do not infer it from the current swimming flag. Add a checkpoint schema version and explicit legacy defaults. A legacy tournament checkpoint must remain a tournament, not silently become a campaign run.

Carry items have an ID, kind, location, and ownership claim. Location is exactly one of water, rack, player, boat hold, installed socket, or delivered. Validate interaction reach, phase, capacity, and ownership on the host. Repeated network actions must not duplicate an attachment or unload.

Store rebuilding phase, installed components, cargo, objective counters, and event scheduling in checkpoints. On host handover, clear held input and transient interaction holds; preserve completed work. Drop or safely reassign objects held by a disconnected player.

Keep standalone progress separate from room session credentials. No additional personal data is required for design validation.

### Multi-boat migration

Before derby, introduce `boats` keyed by boat ID, team IDs, player support/boat IDs, and per-boat hull, gear, cargo, and recovery state. Fish and weather remain shared world entities. Boat-local and world positions require explicit conversion helpers.

Audit every use of the current `w.boat`, rendering singleton, swim target, line origin, NPC target, audio distance, and camera target. Convert cooperative mode to use the same multi-boat representation with one active boat before adding a second. Preserve mode identity through migration and reconnects.

## 14. Testing and playtest gates

Automated checks verify rules; human sessions determine whether the game is enjoyable. Do not treat a passing suite as proof of fun.

### Correctness

- Complete a mission through normal inputs; bank exactly once and end immediately.
- Fail and retry cleanly at the deadline; verify the boundary tick.
- Sink with cargo, recover essential materials, rebuild, launch, and still complete.
- Recover after losing every optional crate and every human being downed.
- Disconnect a carrier and the host during each rebuild phase; retain completed work without duplicated items.
- Verify solo can navigate and rebuild without a second simultaneous interaction.
- Preserve classic tournament rules and the original game's tests.
- For derby, isolate per-team scoring, fish claims, damage, recovery, and victory evaluation.

### Initial human playtest targets

| Question | Initial acceptance target |
| --- | --- |
| Do newcomers understand the job? | At least 4 of 5 novice pairs can state the objective after the briefing |
| Is the first useful action accessible? | First successful cast within 60 seconds for most novice players |
| Can players recover? | At least 4 of 5 pairs relaunch after a prompted wreck without facilitator instructions |
| Is recovery too slow? | Most two-person recovery sequences finish in 30–60 seconds |
| Is the mission finishable? | At least 3 of 5 novice pairs complete within two attempts |
| Does someone become a maintenance servant? | Observe task switching; revise if one player spends most of the round doing only repairs |
| Is it worth replaying? | Ask whether they want another round and why; record actual voluntary replays |

Use these small samples as directional evidence, not statistical proof. Collect mission start/result, first catch, unload, sink, recovery duration, rescue, and retry events through the existing anonymous analytics conventions. Never record voice contents.

Performance targets for the prototype: stable 60 fps on the chosen desktop test machine and 30 fps on the chosen representative phone, with no sustained pauses during sinking or construction. Record actual hardware before interpreting those targets. Test four real network clients before claiming four-player support for new interactions.

## 15. Scope and decisions

### Build first

One contract, rowboat, emergency raft, cargo delivery, dock repair, reliable rebuilding, solo access, two-human cooperation, and reconnect/host-handover correctness.

### Build after the first loop passes its gate

Three-contract harbour chapter, progression and medals, better art/audio readability, then multi-boat architecture and one 2v2 arena. Expand to the six-region campaign only after those experiences justify more content.

### Deferred

Open-world survival, freeform boat construction, weapons, boarding, economy grinding, public matchmaking, ranked play, local couch co-op, cross-device cloud progression, walkable social harbour, and a live-service calendar.

### Decisions for review

The plan assumes short mission-based adventures, quick socket-based rebuilding, flexible roles, campaign-first progression, and sports-like 2v2 competition. The most consequential creative choice is whether rebuilding remains this short comeback activity or eventually becomes a deeper construction game. The recommendation is to keep it short until playtests demonstrate demand for more depth.
