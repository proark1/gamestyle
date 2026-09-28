# Reel Problems 4 — Open-Sea Fishing Voyage

Date: 28 September 2026
Status: approved design; implementation has not started

## 1. Product definition

Reel Problems 4 is a separate one-to-four-player cooperative game built from an exact standalone fork of the current Reel Problems 1 implementation. It preserves Reel Problems 1's starting boat, fishing, movement, balance, weather response, swimming, rescue, camera, controls, networking, and audio behavior.

The new game moves the experience from a lake tournament to one continuous open sea. During one self-contained session, the crew catches and sells fish, salvages materials, crafts and installs boat modules, survives wrecks, reaches deep water, and lands a legendary fish. Money, items, boat modules, and other progression reset when the session ends. There is no account-level or cross-session progression.

The target session length is 20–30 minutes. There is no hard countdown. The game ends successfully when the legendary fish is landed aboard. Sinking is a recoverable setback rather than a terminal loss.

## 2. Design promises

1. **Reel Problems 1 still feels intact.** The starting boat and unchanged actions produce the same outcomes as Reel Problems 1 before Reel Problems 4 upgrades or open-sea forces are applied.
2. **The sea is one place.** Coastal, offshore, and deep-sea conditions exist in one continuous navigable world without loading screens, region-selection menus, or invisible progression gates.
3. **Progress is physical and cooperative.** Fish occupy cargo, large salvage must be carried, crafted modules appear as objects, and players install modules into visible sockets.
4. **Every catch is useful.** All fish can be sold. Wood, iron, scrap, and mechanical parts support crafting. Original junk catches have sale, dismantling, or module uses.
5. **Failure creates work, not a restart.** A wreck scatters recoverable possessions and provides the minimum resources needed to build a basic raft and continue.
6. **Upgrades create possibilities.** The crew chooses useful equipment and becomes capable of surviving deeper water; progression is not a menu-only sequence of percentage increases.

## 3. Scope and boundaries

### Included

- A new `/reel-problems-4` game and route with its own game identity.
- A standalone source fork under `games/reel-problems-4`.
- The current Reel Problems 1 engine, physics, fishing rules, controls, cameras, multiplayer behavior, audio behavior, swimming, rescue, weather interaction, and starting values.
- One seamless open-sea world with coastal, offshore, and deep-sea danger bands.
- Physical helm and engine control.
- Fish cargo, shared money, shared boat storage, and small personal inventories.
- Floating traders, repair platforms, crafting recipes, module sockets, and upgrades.
- Recoverable sinking, salvage, emergency raft construction, and rebuilding.
- A multi-stage legendary-fish encounter using the original fishing mechanics.
- Solo, optional NPC assistance, and rooms for up to four human players.

### Excluded

- Persistent currency, inventories, boats, unlocks, or account progression.
- A walkable harbor or a return-to-harbor loop.
- Separate region maps or loading transitions.
- Free-form or grid-based boat construction.
- A second physics engine or a replacement fishing minigame.
- Public matchmaking, monetization, ranking, seasons, or live-service systems.
- Changes or refactoring that make Reel Problems 1 depend on Reel Problems 4.

## 4. Session flow

1. **Coastal start:** The crew spawns at the starting flotilla on the original small boat with basic rods, limited cargo, and no upgrades.
2. **First catch and salvage:** Players fish with the original cast, bite, tension, surge, tangle, shared-line, and rescue rules. Hooks can also retrieve crafting resources and components.
3. **Store the haul:** Fish enter shared cargo. Compact materials can enter personal inventory or shared storage. Bulky salvage remains physical.
4. **Trade:** The crew navigates to floating traders. Traders buy every fish and selected salvage, crediting one shared wallet.
5. **Craft and install:** At repair platforms, the crew spends shared money and materials on modules, carries the produced objects aboard, and installs them into fixed sockets.
6. **Travel outward:** Hull, engine, and fishing improvements make offshore and deep-sea conditions survivable. Optional utility modules shape the crew's strategy.
7. **Recover when necessary:** A wreck scatters cargo and modules. The crew salvages guaranteed construction resources, launches a basic raft, reaches a repair platform, and rebuilds.
8. **Legendary hunt:** The crew follows sightings and the fish's wake, hooks it, survives its multi-stage pull, and lands it aboard to win.
9. **Recap:** The result shows the final boat, earnings, catches sold, modules installed, wrecks survived, and the anglers attached to the winning catch.

The intended pacing is approximately:

- minutes 0–6: coastal fishing, first sale, first crafted improvement;
- minutes 6–15: offshore trips, larger catches, and utility choices;
- minutes 15–22: deep-sea preparation and advanced upgrades;
- minutes 20–30: locating and attempting the legendary catch.

These are tuning targets, not scheduled stages. Skilled or lucky crews may finish earlier. Wreck recovery may extend a session.

## 5. One continuous ocean

The sea uses distance and authored world features to create three natural bands.

### Coastal sea

- Gentler waves and currents.
- Common small and medium fish.
- Wood, rope, basic scrap, tyres, boots, and common utility salvage.
- Two nearby floating traders and at least one repair platform.
- Safe space for learning helm, trading, inventory, and installation.

### Offshore sea

- Stronger currents, storms, and heavier fish pulls.
- Fast runners, heavy fish, valuable schools, iron, pumps, and engine components.
- Better sale values and demand bonuses.
- Navigation decisions that make steering and deck work compete for attention.

### Deep sea

- Severe waves, forceful currents, rare valuable fish, giant catches, and advanced mechanical parts.
- The legendary fish's roaming territory.
- Conditions that strongly reward upgraded hull, engine, pump, stabilizer, and fishing gear.

There are no invisible walls. An under-equipped crew can enter any band, but the same physical forces make deeper water difficult to survive. Water color, wave height, wind, wildlife, buoy language, distant platform lights, audio, and a compact compass communicate danger and direction.

The open sea must remain compact enough that travel creates decisions rather than dead time. Distant simulation and rendering use culling or simplified state without changing authoritative outcomes.

## 6. Navigation and helm

The boat has a physical helm/engine station. One player can claim it through the contextual interaction. While attached to the helm, that player's movement controls become steering and throttle. The player cannot simultaneously walk, fish, carry an item, or perform repairs.

The helm applies propulsion and steering forces to the existing boat simulation. Fish, waves, wind, flooding, collisions, installed modules, and crew weight continue to affect the same boat body. Leaving the helm returns controls to normal movement and drops the engine to idle instead of applying an instantaneous stop.

A solo player may lock the current heading briefly, leave the helm, and perform deck work. Heading hold maintains direction only; it does not avoid hazards, choose routes, or negate currents. Optional NPC assistance may steer toward a player-selected marker, but the human remains responsible for route and upgrade decisions.

If a helmsman disconnects, becomes incapacitated, or leaves the station, helm ownership releases immediately and the engine returns to idle.

## 7. Fishing and catches

Reel Problems 4 retains Reel Problems 1's fishing language:

- aim and cast;
- wait for a bite;
- reel while managing line tension;
- release during readable surges;
- attach multiple anglers to one catch;
- share pull and catch credit;
- cross and untangle lines;
- hook teammates accidentally;
- brace against pull and deck movement;
- cut a dangerous line;
- rescue overboard crew.

The original catch set remains represented. New fish families and salvage entries extend the catch catalog by sea band. Each family has a readable pull pattern rather than every fish receiving every behavior.

Every fish can be sold. Its value is based on a catalog base price, size or rarity, condition if applicable, and the current trader demand bonus. A trader always offers at least the guaranteed base value. The UI shows the complete value before a sale is confirmed.

Junk catches remain useful:

- tyres can be sold, dismantled, or used in stabilizer recipes;
- magnets can be sold or used in a salvage-magnet recipe;
- boots and common rubbish have modest sale or material value;
- wood, iron, scrap, and mechanical parts feed crafting directly.

Catch and salvage tuning must preserve the original bite and line behavior. Zone data chooses eligible entities and their strength; it does not replace fishing with a separate interaction.

## 8. Cargo, inventories, and item ownership

The crew has three storage layers:

1. **Personal inventory:** Each player has three slots for stackable wood, iron, scrap, rope, and compact mechanical parts.
2. **Shared boat storage:** A limited material locker holds extra compact resources.
3. **Fish cargo:** A separate live well or cargo hold stores landed fish until sale.

Large salvage, completed modules, and wreckage cannot enter an abstract inventory. A player must carry them physically. Carrying a bulky item prevents fishing and makes footing and balance more difficult.

Every item has a stable ID and exactly one valid location:

- hooked;
- floating;
- carried by a player;
- in a personal slot;
- in shared boat storage;
- in fish cargo;
- on a trader or platform transfer point;
- installed in a socket;
- part of a wreck or raft frame;
- sold;
- consumed.

Transfers are host-authoritative, validated, and idempotent. A disconnect releases carried objects at a safe nearby position. An unreachable mandatory object returns to its defined recovery point after a clear delay using the same logical item ID; it does not create a duplicate.

Initial capacities are tuning values. The implementation plan should begin with three personal slots, a modest shared material locker, and a fish hold that forces at least one sale before deep-sea readiness. Capacity upgrades may increase the latter two without changing personal slots.

## 9. Traders and economy

Floating traders are physical destinations in the world. They do not require a harbor transition. The crew brings the boat into an interaction zone, secures it, and uses a shared trade panel.

All traders:

- buy every fish at a guaranteed base value;
- buy selected salvage and unused components;
- show exact prices before confirmation;
- credit one shared crew wallet;
- complete each sale once even across retries, reconnects, or host migration.

Each trader advertises a small seeded set of temporary demand bonuses. Bonuses make route choice useful but never make another catch unsellable. Demand changes are visible and deterministic for the session. Prices do not fluctuate during an open confirmation in a way that changes the offered transaction.

The crew cannot divide or privately reserve money. Purchases, repairs, crafting, and rebuild services all spend from the shared wallet. The interface shows the resulting balance before confirmation.

The economy must prevent dead ends. Base coastal fish always produce enough value to restore minimum operational capability. Essential raft construction never requires money.

## 10. Repair platforms, crafting, and modules

Repair platforms provide three services:

1. repair the current hull;
2. rebuild a sunk boat from a completed emergency raft and recovered materials;
3. craft boat modules from shared money and materials.

Recipes use short, visible combinations such as money plus wood and iron, or money plus iron and mechanical parts. Crafting produces a physical module at the platform. A player carries it aboard and installs it by holding the contextual action at a matching highlighted socket.

Replacing a module returns the previous module to shared platform or boat storage when capacity permits. It is never silently destroyed. A full or invalid destination prevents the replacement and explains why.

### Core progression sockets

| Socket | First improvement | Deep-sea improvement | Purpose |
| --- | --- | --- | --- |
| Hull | Reinforced hull | Deep-sea plating | Reduces damage and flooding from rougher conditions |
| Engine | Improved motor | Offshore engine | Adds propulsion and control against stronger currents |
| Fishing | Stronger winch | Legendary-grade reel | Handles heavier pulls and higher line loads |

Core improvements make deeper water naturally survivable. They do not unlock artificial map gates.

### Utility sockets

The boat has fewer utility sockets than available modules, forcing a crew choice. Initial candidates are:

- cargo crate;
- automatic low-rate bilge pump;
- salvage magnet;
- rescue ladder;
- stabilizer or tyre outrigger.

Utility modules complement crew actions rather than automate the whole game. The pump cannot outpace serious flooding, the magnet does not collect distant objects without players, and the rescue ladder shortens rather than removes rescue interaction.

Module effects feed parameters into the existing simulation. The base calculations and force model remain the same. No module creates an independent boat controller or physics layer.

## 11. Sinking, salvage, and rebuilding

Sinking is repeatable and recoverable.

1. Flooding reaches the existing sinking threshold.
2. The boat enters a readable wreck sequence and players enter the water through the existing swimming rules.
3. Fish, stored materials, carried objects, and installed modules become bounded floating salvage around the wreck.
4. The wreck exposes an emergency raft frame and guarantees enough logical wood and scrap to complete it.
5. Players recover materials and place them into visible construction sockets on the frame.
6. The completed raft is controllable but slow, unstable, and limited in cargo.
7. The crew sails it to the nearest repair platform.
8. The platform rebuilds the starting boat. Recovered modules and remaining cargo may be reinstalled or stored.

The guaranteed recovery resources cannot be sold, consumed by unrelated recipes, lost permanently, or duplicated. If dropped beyond reach, the same logical resource returns to the wreck recovery area after a delay.

Shared money and completed upgrade knowledge remain after a wreck. Recovered physical modules remain owned. Optional fish and materials left floating may expire after a clearly communicated recovery window. The consequence is lost time, cargo, and recovery work rather than session deletion.

If every player becomes incapacitated, emergency flotation returns them beside the raft frame with a short safety window. Nobody remains in a spectator state. Repeated wrecks repeat the same recoverable structure.

## 12. Legendary fish finale

The legendary fish always exists in the deep-sea simulation. It is not created only after a checklist is completed. Its wake, distant jumps, trader rumors, compass cues, and environmental signs allow the crew to locate it. Suitable hull, engine, and fishing upgrades make the encounter practical, but an exceptionally skilled under-equipped crew is not blocked by an invisible rule.

The encounter extends the original fishing mechanics through deterministic phases:

1. **Track:** Follow its wake and place a successful cast.
2. **First pull:** Hold the initial run while other anglers may attach additional lines.
3. **Tow:** The fish changes direction and pulls the boat through deep-sea waves and hazards. The helmsman steers while the crew reels, braces, repairs, and manages line crossings.
4. **Surges:** Telegraph stronger bursts that require players to release or risk snapping lines and destabilizing the boat.
5. **Final struggle:** Combine sustained reeling, balance, repairs, and multiple lines without adding new controls.
6. **Landing:** Bring the fish aboard. Resolve the win exactly once and enter the recap.

Losing all attached lines lets the fish escape and resume roaming after a recovery interval. Sinking during the fight also releases it. The crew may rebuild, reacquire it, and try again. Previous damage to the fish does not remain indefinitely across a full escape or wreck; the next attempt restarts the encounter so the authoritative state stays understandable.

Landing the fish wins immediately. A return trip to a trader or harbor is not required.

## 13. Session pressure without a timer

The game has no hard or soft deadline. It targets 20–30 minutes through:

- limited starting cargo and the need for an early sale;
- stronger values and required materials farther from the start;
- travel and opportunity costs between traders, platforms, and fishing grounds;
- naturally stronger weather and currents by sea band;
- trader demand bonuses that encourage changing routes;
- a compact two-tier core upgrade path;
- visible legendary-fish tracking once the crew approaches deep-sea readiness;
- recovery work after avoidable wrecks.

Weather pressure follows location, authored seeded patterns, and crew actions rather than an invisible global countdown designed to force an ending. Remaining in coastal water indefinitely is safe but economically slow. The game must not secretly raise all danger until the crew loses.

## 14. Solo and NPC support

Every essential action is possible solo:

- temporary heading hold lets the player leave the helm;
- carrying and installation never require two simultaneous humans;
- raft construction uses repeated solo interactions when necessary;
- the legendary encounter scales its pull and endurance by starting human count while retaining the same phases;
- platform panels pause no authoritative danger only when the boat is securely docked in a designated safe zone.

Optional NPC crew retain the original behavior and gain focused capabilities: steer toward a selected marker, fish, brace, bail, repair, retrieve nearby salvage, and carry a requested object. NPCs do not choose purchases, recipes, module loadouts, sale confirmations, or the overall route.

Additional humans accelerate work and allow parallel roles but do not unlock actions unavailable to solo players.

## 15. Architecture

Implementation uses a separate `games/reel-problems-4` directory created from the current Reel Problems 1 working implementation at the implementation start point. The fork includes the current local Reel Problems 1 changes that define its actual behavior, not merely the last committed version. Reel Problems 1 itself remains untouched by the fork.

New game-local modules keep responsibilities isolated:

| Module | Responsibility |
| --- | --- |
| `ocean.ts` | Sea bands, currents, navigation markers, regional conditions, and world queries |
| `helm.ts` | Helm ownership, throttle, steering, idle behavior, and solo heading hold |
| `items.ts` | Item definitions, stable identities, stacks, locations, and transfers |
| `economy.ts` | Shared wallet, fish valuation, trader demand, sales, and purchases |
| `crafting.ts` | Recipes, repair-platform services, sockets, installation, and module modifiers |
| `wreck.ts` | Wreck drops, guaranteed recovery resources, raft construction, and rebuilding |
| `legendary.ts` | Tracking, phases, escape, reset, and final win resolution |
| `voyage.ts` | Session lifecycle, readiness summaries, end state, and recap model |
| `catalog.ts` | Fish, salvage, recipe, module, trader, and tuning definitions |

Existing forked modules remain responsible for physics, fishing, player movement, swimming, wildlife, weather response, audio, scene rendering, and peer adaptation. `Game.tsx` presents state and dispatches actions; it does not own economy, crafting, wreck, or legendary rules.

The new game registers its own:

- route and page metadata;
- game identity and peer-engine entry;
- audio and analytics catalogs;
- collection or homepage entry when the playable slice is ready;
- sound workshop route if the collection's convention requires it.

Shared account, room, voice, input, rendering, toolbar, wardrobe, analytics transport, and host-recovery infrastructure are reused through their existing interfaces.

## 16. Authoritative state and data flow

The host owns all consequential state:

- ocean seed and regional conditions;
- boat state, helm owner, throttle, and installed module IDs;
- player inventories and shared storage;
- fish cargo and item locations;
- wallet and completed transaction IDs;
- trader demand and offers;
- platform, recipe, repair, and rebuild state;
- wreck, raft, and guaranteed-recovery-resource state;
- legendary-fish location, phase, lines, stamina, and escape state;
- session result and recap facts.

On each fixed simulation step:

1. Validated player input updates movement, helm, fishing, and held interactions.
2. The existing physics and fishing systems advance using base parameters plus installed-module modifiers and regional forces.
3. Ocean, cargo, item, wreck, and legendary systems observe the resulting authoritative state and apply valid transitions.
4. Completed interactions create stable transaction or event IDs.
5. A bounded checkpoint captures all state needed for reconnect and host migration.
6. UI, scene, and audio consume state and events without making rule decisions.

Actions that spend, sell, craft, install, transfer, recover, or resolve the win must be idempotent. Reapplying an already completed action is a no-op.

## 17. Recovery and error handling

- Invalid or stale inventory moves are rejected without deleting either item.
- A full destination prevents a transfer and returns a clear reason.
- A price is fixed for the confirmed transaction; demand changes apply only to later offers.
- A missing recipe or module definition cancels the operation and preserves money and materials.
- A disconnect releases helm control and safely drops a carried physical object.
- An unreachable mandatory recovery item returns using the same stable ID.
- Host migration clears transient held inputs but preserves completed interactions, inventories, money, modules, wrecks, raft progress, and legendary phase.
- A legacy or malformed Reel Problems 4 checkpoint falls back to the safest compatible session state or refuses restoration with a clear error; it must never be interpreted as Reel Problems 1 state silently.
- The win resolves once. Late line, sale, or damage actions cannot change a completed result.
- Trader, platform, or visual presentation failures do not bypass authoritative validation.
- Rendering or audio failures do not stop the simulation and are disposed through the existing lifecycle.

## 18. Testing and validation

### Parity tests

- Seeded unmodified Reel Problems 4 starting states match Reel Problems 1 for boat response, player weight shift, cast trajectory, bites, tension, surges, tangles, shared lines, weather response, swimming, and rescue.
- The parity harness runs before any regional force or installed-module modifier is enabled.
- Reel Problems 1's existing tests continue to pass unchanged.

### Unit and rule tests

- Every item has one valid location and transfers conserve item identity and stack totals.
- Every fish has a base sale value and every trader buys it.
- Demand and offer generation are deterministic for the same seed.
- Sales, purchases, recipes, installation, replacement, and repairs apply once.
- Socket compatibility and capacity rules reject invalid operations without loss.
- Sea-band forces and module modifiers apply to the existing simulation within bounded values.
- Helm ownership, idle throttle, heading hold, and disconnect release behave correctly.
- Wreck drops are bounded and never duplicate cargo or modules.
- Guaranteed raft resources cannot be exhausted or sold.
- Repeated sinking and rebuilding never creates a softlock.
- Legendary phases, line loss, escape, wreck reset, landing, and single win resolution are deterministic.
- Crew-size scaling preserves all essential solo actions.

### Simulation scenarios

- Complete a full seeded session from coastal start to legendary landing.
- Complete a session after one and after several wrecks.
- Sell every fish family and craft every module through normal actions.
- Replace a full utility loadout without losing modules.
- Enter deep water under-equipped, escape, upgrade, and return.
- Lose and reacquire the legendary fish.
- Complete the session solo, with NPC assistance, and with four humans.

### Multiplayer and recovery checks

- Run real multi-client sessions through a sale, purchase, craft, carry, installation, wreck, raft build, rebuild, and legendary phase.
- Remove the host during each transaction boundary and verify no duplication or loss.
- Disconnect a helmsman and a physical-item carrier.
- Reconnect players with their inventories and participation restored correctly.
- Confirm room isolation under the `reel-problems-4` game identity.

### Browser, input, and performance checks

- Keyboard/mouse, controller, and touch can operate helm, fishing, inventory, trade, crafting, installation, salvage, and rebuilding.
- Desktop and representative phone layouts keep urgent fishing and damage information visible while panels are closed.
- A docked platform panel cannot trap input or leave the player attached after closure.
- Distant ocean entities do not create unbounded render, physics, audio, or snapshot cost.
- A 30-minute session does not leak scene objects, audio nodes, timers, or retained events.

### Human playtest gates

The initial experience is ready for release consideration when directional playtests show that:

- new players understand how to make the first sale without facilitator instruction;
- crews can explain why offshore and deep water are dangerous;
- at least two utility modules create a genuine loadout disagreement;
- a wreck feels costly but players can identify the recovery steps;
- routine travel does not create long dead periods;
- the legendary fish is findable without a walkthrough;
- the finale uses familiar mechanics while feeling materially larger than an ordinary catch;
- typical successful first sessions finish in approximately 20–30 minutes;
- most groups understand that all progression resets with the next session.

## 19. Initial delivery sequence

The implementation plan should divide the work into independently verifiable slices:

1. Create the standalone fork, route, game identity, registrations, and parity harness.
2. Add the continuous ocean, helm, regional conditions, and navigation cues.
3. Add stable items, personal inventory, shared storage, fish cargo, and traders.
4. Add repair platforms, recipes, sockets, modules, and installed modifiers.
5. Add wreck salvage, emergency raft construction, repeated rebuilding, and recovery safeguards.
6. Add deep-sea content, tracking cues, and the multi-stage legendary encounter.
7. Add NPC behaviors, complete input parity, audio/presentation, analytics, performance work, and release validation.

Each slice must keep the game playable and preserve Reel Problems 1. Later slices may tune earlier values from evidence but must not weaken the approved boundaries.

## 20. Success criteria

The design is fulfilled when Reel Problems 4 is a separate, stable one-session game in which one to four players can:

- begin with the exact Reel Problems 1 feel;
- navigate one continuous open sea;
- catch and sell every fish they land;
- collect and store wood, iron, scrap, and parts;
- craft and physically install meaningful boat modules;
- choose between competing utility loadouts;
- reach offshore and deep-sea water through capability rather than artificial gates;
- recover from repeated sinkings without restarting;
- locate, fight, and land a multi-stage legendary fish;
- finish a typical successful session in roughly 20–30 minutes;
- start a new session with all money, items, and upgrades reset.
