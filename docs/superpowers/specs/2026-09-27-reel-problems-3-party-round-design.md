# Reel Problems 3 Party Fishing Round Redesign

**Date:** 2026-09-27

**Status:** Approved design

**Scope:** Reel Problems 3 only

## Goal

Turn Reel Problems 3 from a scripted first-person voyage into a replayable, polished party fishing game. Each eight-to-ten-minute round places four crew members on one shared boat. Human players compete for individual points while depending on one another to complete fishing missions, keep the boat afloat, and return to harbor before time expires. Empty crew seats are always filled by bots.

The redesign must replace generic supply boxes and abstract interaction markers with recognizable physical equipment, make the boat genuinely controllable, add complete arcade fishing, create systemic physical comedy, and preserve reliable multiplayer and mobile performance.

Reel Problems 2 and the other Jumbleyard games remain unchanged.

## Product Principles

- The shared boat must survive for anyone to win, but each player earns an individual score.
- Chaos comes from movement, crowded work, loose equipment, crossed lines, waves, and mistakes. There is no dedicated sabotage action.
- Objects communicate through shape, material, placement, animation, and sound rather than floating labels.
- Fishing must be immediately readable but reward timing, aim, positioning, and teamwork.
- The same round rules apply on desktop, touch devices, and controllers.
- Procedural content must be deterministic, bounded, authored from reusable modules, and safe for mobile hardware.
- A recoverable mistake is entertaining; an unwinnable round caused by a lost tool is not.

## Chosen Structure

The game uses a seeded modular party expedition rather than a larger fixed map or an unconstrained procedural simulation. The harbor and boat are handcrafted. The surrounding ocean is assembled from reusable streamed tiles, mission sites, weather cells, hazards, and landmarks selected by a shared round seed.

Only the boat and nearby world cells remain active. Distant cells are returned to object pools and reconstructed deterministically when needed. This gives each round a different route while bounding render cost, physics cost, memory, and network traffic.

## Round Structure

Every round has four crew slots. Human players occupy available seats and bots fill the rest. At least one human starts the round; the gameplay itself always operates as a four-person crew and does not switch to a reduced solo ruleset.

### 1. Harbor Scramble

The crew has approximately sixty seconds to load and organize the boat. Required equipment includes rods, bait, rope, ice, repair timber, fuel, a landing net, and navigation tools. Players physically pick up, carry, throw, rack, or stow these items. The departure timer prevents slow checklist play and creates the first comic collisions.

### 2. Outbound Sailing

One player takes the active helm and controls both steering and throttle. Other players can prepare rods, study the chart, organize loose equipment, and respond to early hazards while the boat is moving. Any player may take the helm; a bot immediately yields a claimed station to a human.

### 3. Fishing Missions

The round selects three compatible mission objectives from the mission catalog and places them at reachable streamed sites. The crew fishes for roughly four to five minutes while navigating between moving schools, landmarks, hazards, and changing weather.

Initial mission templates are:

- catch a quantity of one species;
- reach a combined catch weight;
- find a rare glowing fish;
- land one large fish with the landing net;
- protect fragile fish from rough handling;
- fish inside a moving school.

The first release will ship these six templates. Unrequested fish can still be released instead of stored. The mission director will only combine missions whose required species, equipment, travel time, and completion conditions are compatible.

### 4. Return Chaos

Once the quota is complete, the harbor return window begins. Weather and incidents intensify while the crew secures its catch, repairs damage, rescues overboard players, and navigates home. The return lasts approximately one to two minutes.

### 5. Dock and Score

The crew completes the round only when the mission quota is satisfied, the boat is safely docked, and the timer has not expired. Shared survival produces a crew completion bonus. Individual scores and comic awards determine the party ranking.

## Physical Item System

All required gameplay objects receive recognizable handcrafted models in the selected clay maritime style. A box is used only when the real-world object is genuinely a crate or container.

The first item catalog includes:

- coiled rope with visible loose ends;
- rods with reels, guides, hooks, and visible line;
- bait buckets containing individual bait pieces;
- lanterns with handles and glowing glass;
- repair timber shown as distinct planks;
- hammer and patch material;
- bailer and bilge equipment;
- fuel can;
- ice basket or ice box;
- landing net;
- chart and compass;
- species-specific fish and appropriate catch containers.

Every physical item has a stable identifier, kind, pose, velocity, holder, station, recovery policy, and optional durability or contents. Players may hold one large item or two compatible small items. Items can be picked up, carried, placed, dropped, thrown, bumped, or moved by waves.

First-person hands use item-specific grips. Third-person avatars show the same held object. Items placed into racks or stations snap into a readable authored pose, while loose items remain physical.

Critical equipment cannot permanently invalidate a round. Floating items drift within recoverable range, submerged critical items return near the boat after a delay, and bots retrieve missing essentials. A final recovery rule respawns an essential item at its home rack when no valid instance exists.

## Arcade Fishing

Fishing is a concise skill sequence rather than a single interaction or a deep simulation.

1. The player takes a rod and adds bait.
2. The player aims toward visible water activity and holds the cast control to select distance.
3. A bite is communicated through rod movement, line motion, water response, and sound.
4. The player reacts within the hook window.
5. The player reels while keeping tension within a safe band as the fish changes direction and force.
6. The player moves around the deck to keep the line clear of rails, players, and other lines.
7. Small fish can be landed directly. Large fish require another crew member or bot to operate the landing net.
8. The catch must be carried to an ice box or mission container before it becomes secured and scores.

Fishing lines are visible and may cross. Crossed lines reduce reel speed and create a short untangling task. Players can steal an unsecured landed fish or accidentally block another player, but they cannot cut or deliberately destroy another line.

The first release contains six visually and behaviorally distinct fish species. Species define preferred zones, movement patterns, bite timing, tension range, size distribution, score value, handling rules, and mission eligibility.

Touch controls use drag-to-aim, hold-to-cast or reel, a large tension indicator, and one contextual action button. Mobile receives slightly wider input tolerances without changing scoring or mission rules.

## Boat Gameplay

The boat is one continuously controlled shared vehicle. The helm player controls steering and throttle. The boat responds to waves visually, collides with shores and obstacles, and takes damage from impacts. It uses an authoritative bounded movement model instead of an unconstrained rigid body so that deck movement, multiplayer synchronization, and mobile behavior remain stable.

The deck contains:

- helm and throttle;
- chart and compass;
- four rod racks;
- bait preparation table;
- landing-net rack;
- ice hold;
- engine compartment;
- bilge pump and repair bench;
- rescue line and life rings;
- rails and storage positions for loose equipment.

Players and loose deck equipment are simulated in boat-local coordinates. The boat pose transforms them into world space for rendering and interaction. An object or player that goes overboard changes to ocean-world coordinates; recovery converts it back to boat-local coordinates. This avoids unstable standing-on-a-moving-platform physics.

## Chaos Director

The chaos director produces contextual incidents based on boat speed, current mission, weather, damage, player positions, loose equipment, and recent events. It may run at most one major incident and one minor incident at the same time. Recovery windows prevent constant punishment.

The initial event catalog targets approximately ten incidents:

- a wave rolls unsecured items across the deck and can knock an exposed player overboard;
- two active fishing lines tangle;
- a large fish pulls a player toward the rail;
- seabirds steal exposed bait or unsecured small catches;
- the engine stalls and needs fuel plus a restart;
- a leak appears in a hull section;
- fog hides distant navigation markers;
- floating debris or rocks force an evasive turn;
- a slippery landed fish escapes an open container;
- the landing net tears and requires a quick patch.

The shipped set may combine closely related variants but must provide roughly ten distinct situations. Events must expose a clear world cue, a recoverable response, and an explicit end condition. The director cannot select an event if its required tool is unavailable or if it would make the active mission impossible.

## Bot Crew

Bots fill every crew seat not occupied by a human. Bots use the same stations, items, actions, and physical constraints as players. They do not receive private shortcuts that would make multiplayer state inconsistent.

The bot director scores available jobs by urgency, distance, current assignment, human claims, and crew coverage. Jobs include helm, fishing, net assistance, bait preparation, equipment recovery, repair, bailing, rescue, catch storage, and docking support. A reservation prevents multiple bots from choosing the same station or item.

Human control always has priority. When a human grabs a station, item, or task, the assigned bot yields immediately and selects another job. Bots keep the round functional but use slower reactions and conservative fishing skill so they do not dominate individual rankings.

## Mission and Scoring Rules

The mission director validates each seeded objective set before the round begins. It confirms that required fish can spawn, tools exist, destinations are reachable, and expected travel plus task time fits within the round budget. An invalid combination is replaced deterministically from the same seed.

Players earn individual points for:

- requested species and fish weight;
- rare catches;
- accurate casts and clean tension control;
- landing-net assists;
- navigation and safe driving;
- repairs and bailing;
- rescues;
- securing catches and loose equipment;
- completing mission-specific support work.

Personal penalties apply for losing equipment, dropping or mishandling fish, damaging the boat, and missing assigned catches. These penalties do not directly eliminate a player. Every player receives the shared safe-return bonus if the crew succeeds.

The result screen shows mission completion, total catch, boat condition, return time, individual rankings, and contextual awards. Initial awards include Biggest Catch, Line Tangler, Deck Medic, Bait Bandit, Storm Driver, and Most Time Overboard.

## Presentation and Feedback

The approved handcrafted maritime style remains the production direction. The comic look-development mode is not used for this redesign.

World objects use distinctive silhouettes, tactile materials, authored placement, and motion. Reachable objects receive a restrained warm rim only at interaction range. Stations use physical signs, painted symbols, lamps, gauges, handles, and moving parts. The first-person hand reaches toward the selected object rather than relying on a large center-screen marker.

The compact HUD shows:

- round timer and shared mission quota;
- compass direction for harbor and the active mission;
- boat health, water level, and engine state;
- fishing tension only while relevant;
- held-item state;
- quiet individual score feedback;
- short incident warnings.

Audio carries mechanical and directional information. Reel clicks communicate tension, line strain warns before failure, splashes identify fish direction, loose equipment rattles before sliding, hull groans indicate damage, spatial engine changes indicate faults, and the harbor bell marks the final return window.

## Technical Architecture

The existing phase-driven simulation will be replaced by focused systems sharing a serializable `AdventureWorld`:

- `RoundDirector`: timer, round states, success, failure, and score finalization;
- `WorldStreamer`: shared seed, tile activation, mission sites, landmarks, and hazards;
- `BoatController`: helm input, propulsion, collision, damage, local coordinate frame, and docking;
- `ItemSystem`: item lifecycle, carrying, throwing, station placement, floating, and recovery;
- `FishingSystem`: casts, hooks, fish behavior, tension, line intersections, landing, and storage;
- `MissionDirector`: deterministic mission selection, validation, and progress;
- `ChaosDirector`: contextual event eligibility, scheduling, recovery, and completion;
- `BotDirector`: job evaluation, reservation, navigation, and action execution;
- `ScoreSystem`: shared completion, individual scoring, penalties, and awards;
- presentation adapters for objectives, prompts, HUD, audio events, and results.

Each unit exposes typed commands and derived state instead of mutating another unit's internal data. Content definitions for fish, items, missions, chaos events, and world modules remain data-driven and independently testable.

## Multiplayer and Data Flow

The host remains authoritative. Clients submit intentions such as movement, steering, throttle, aim, cast, reel, pick up, throw, place, and contextual use. Clients never submit trusted positions, catches, mission progress, or scores.

The host advances the round, boat, physics, fish, items, missions, bots, and chaos. It emits compact snapshots plus ordered gameplay events. Clients interpolate remote poses and may predict local camera movement, held-item presentation, casting feedback, and reel feel. Authoritative corrections remain smooth and bounded.

Procedural generation uses a shared round seed and stable content identifiers. Clients reconstruct static streamed content locally; snapshots transmit only dynamic state and exceptions. Distant fish and physical objects update at reduced frequency or as aggregate state.

Checkpoints contain the seed, round clock, round state, boat pose and condition, mission definitions and progress, crew and bots, catches, item state, scores, and active incidents. Physics bodies, rendered meshes, audio nodes, particle systems, and tile objects stay in runtime caches and are rebuilt after reconnect or host migration.

## Mobile and Performance Strategy

- Keep only the boat and nearby world tiles active.
- Pool water tiles, fish, physical items, splashes, birds, and debris.
- Reuse geometries and materials; instance repeated scenery.
- Use simplified distant water, lighting, and shadows.
- Put inactive physics bodies to sleep and cap loose dynamic items.
- Reduce snapshot frequency and detail for distant entities.
- Cap active fish, particles, spatial audio sources, and event actors.
- Adapt render distance and visual density without changing mission logic.
- Preserve dynamic loading so Reel Problems 3 does not increase the main collection page's initial WebGL bundle.

The target is a stable 30 FPS on a representative mid-range mobile device and 60 FPS on the supported desktop test environment.

## Recovery and Error Handling

- Invalid or non-finite player, boat, item, or fish transforms reset to the nearest safe authored point.
- Essential items missing from all valid locations return to their home rack.
- Players stranded in water can be rescued; after a bounded timeout they respawn at a life-ring point with a score penalty.
- A mission whose target becomes unreachable regenerates its affected site deterministically or swaps to a validated fallback.
- Streamed tile creation failures fall back to an empty navigable ocean tile.
- An invalid client command is rejected without mutating world state and returns a concise gameplay error.
- Repeated or out-of-order input sequences are ignored.
- Host migration rebuilds runtime caches from the latest valid checkpoint before accepting new actions.
- Chaos events clean up their reservations, temporary objects, and modifiers when completed, cancelled, or invalidated.

## Delivery Stages

1. Replace the old phase model with the timed round director and seeded mission definition.
2. Build the moving boat and continuous streamed ocean.
3. Add modeled physical items, carrying, throwing, racks, and recovery.
4. Add complete fishing mechanics and the six-species catalog.
5. Add mission selection, scoring, docking, and safe-return completion.
6. Add the chaos director and initial incident catalog.
7. Add four-slot bot staffing and job assignment.
8. Finish first-person item poses, mobile and controller controls, audio, HUD, and results.
9. Complete multiplayer, performance, visual, accessibility, and production validation.

Stages are implementation boundaries, not separate partial releases. The production release is ready only when the complete round works end to end.

## Validation and Acceptance Criteria

Automated unit and integration tests must verify:

- every required item has a recognized content definition, model factory, interaction profile, and recovery policy;
- item pickup, placement, dropping, throwing, floating, loss recovery, and station reservations;
- boat steering, throttle, collision damage, docking, and boat/world coordinate conversion;
- seeded worlds reproduce the same tiles, mission sites, species, and hazards;
- streaming activates and removes cells without duplicating dynamic state;
- casting, hooking, tension, line failure, tangling, landing, releasing, and storage;
- all mission templates validate and complete under legal seeded layouts;
- chaos incidents respect concurrency, cooldown, tool, and recoverability constraints;
- humans can claim bot tasks immediately and bots do not reserve the same job;
- one human with three bots and four humans can each complete a round;
- timeout, boat failure, incomplete quota, successful docking, scoring, and awards;
- snapshot serialization, reconnects, and host migration during every round state;
- desktop, touch, and controller actions map to equivalent authoritative commands;
- existing registry, multiplayer, analytics, audio, and production-build invariants remain valid.

Browser and device validation must:

- complete real rounds on desktop and mobile-sized viewports;
- verify the boat physically leaves harbor, reaches generated mission sites, and docks again;
- confirm items are visually recognizable without relying on labels;
- inspect first-person grips for representative large and small objects;
- exercise fishing, large-fish net assistance, repair, rescue, and at least several chaos incidents;
- verify reconnect and host migration during active fishing and the return leg;
- measure mobile and desktop frame pacing under the maximum supported active load;
- report no console errors, failed same-origin requests, or inaccessible critical controls.

The redesign is complete when an eight-to-ten-minute round reliably delivers physical preparation, active sailing, skill-based fishing, mission variety, recoverable shared chaos, meaningful individual competition, and a safe-return finish across desktop and mobile.
