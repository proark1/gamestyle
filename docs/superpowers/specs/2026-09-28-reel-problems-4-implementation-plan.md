# Reel Problems 4 — Implementation Plan

Date: 28 September 2026
Status: approved design translated into an execution plan; gameplay implementation has not started
Design: [Reel Problems 4 — Open-Sea Fishing Voyage](2026-09-28-reel-problems-4-design.md)

## Outcome

Deliver a separate one-to-four-player game at `/reel-problems-4` that begins with Reel Problems 1's boat, fishing, movement, physics, multiplayer, controls, audio behavior, swimming, and rescue systems. Extend that baseline with one continuous open sea, physical navigation, session-only money and inventories, floating traders and repair platforms, socketed boat modules, recoverable wrecks, emergency raft construction, and a multi-stage legendary-fish finale.

The normal successful session should take approximately 20–30 minutes and end when the legendary fish is landed. No money, materials, or upgrades persist into the next session. There is no countdown and no terminal loss from sinking.

This plan does not deploy or publish the game. Deployment requires a separate request after implementation and validation.

## Execution rules

- Treat the approved design as the source of truth. Do not add persistent progression, a harbor, separate region maps, free-form construction, or a second physics engine.
- Fork the **current working Reel Problems 1 implementation**, including its intentional local changes at implementation start. Do not assume the last commit represents the desired baseline.
- Preserve `games/reel-problems` after the fork. Reel Problems 1 must not import from Reel Problems 4 or change behavior to support it.
- Inspect every shared file before editing because the working tree already contains unrelated changes. Apply small targeted patches and never overwrite a whole shared registry from an older copy.
- Stage and commit only work belonging to the current slice. If a shared file contains inseparable pre-existing edits, leave the slice uncommitted and report the overlap rather than staging another person's work.
- Keep authoritative rules in pure game-local modules. `Game.tsx`, scene classes, and panels render state and dispatch actions; they do not decide prices, ownership, crafting, recovery, or victory.
- Write the failing rule test before each behavior. Implement the smallest state transition that passes it, then add presentation.
- Keep every completed slice playable and checkpoint-safe. Run focused tests after each task and the full validation matrix at release-candidate gates.
- Balance numbers are tuning values. Put them in catalogs or named constants instead of scattering them through simulation code.

## Planned source layout

The initial fork retains the complete Reel Problems 1 file set. New responsibilities are added as focused files:

```text
games/reel-problems-4/
  Game.tsx                    # forked shell, panels, input, room lifecycle
  types.ts                    # authoritative serializable state and action types
  simulation.ts               # existing fishing/boat loop plus module orchestration
  peer.ts                     # Reel Problems 4 adapter and checkpoint migrations
  scene.ts                    # boat, crew, catches, physical modules and stations
  sea-scene.ts                # continuous water, sky, waves and distant cues
  ocean.ts                    # zones, currents, destinations and regional queries
  helm.ts                     # helm ownership, throttle, steering and heading hold
  catalog.ts                  # catches, salvage, traders, recipes and modules
  items.ts                    # stable items, inventories, cargo and transfers
  economy.ts                  # wallet, demand, offers, sales and purchases
  crafting.ts                 # recipes, sockets, repairs and installed modifiers
  wreck.ts                    # drops, recovery kit, raft construction and rebuilding
  legendary.ts               # tracking, phases, escape, reset and win resolution
  voyage.ts                   # session lifecycle, readiness and recap facts
  npcs.ts                     # forked behavior plus helm/cargo/recovery jobs
  analytics.ts                # open-sea milestones, actions and outcomes
  audio.ts                    # inherited cues plus voyage-specific cues
  audio/director.ts           # state-driven mix and warning selection
  components/                 # focused HUD, inventory, trader, platform and recap UI
  scripts/peer-scenario.mjs   # real four-client authoritative scenario
  scripts/browser-check.mjs   # desktop and mobile browser path
```

Use additional small files when a module becomes difficult to understand in isolation. Do not combine economy, inventory, and crafting into one large manager.

## Milestone 0 — Freeze the baseline and register the game

### Task 0.1 — Capture the source baseline

**Files inspected**

- `games/reel-problems/**`
- `app/reel-problems/**`
- current Git status and diff for the source directory

**Work**

1. Record the exact source file list and current diff state for `games/reel-problems`.
2. Run the existing Reel Problems 1 tests before copying:

   ```text
   node scripts/test.mjs games/reel-problems
   ```

3. Copy the full current runtime, audio, styles, tests, and supporting source from `games/reel-problems` to `games/reel-problems-4` without modifying the source. Do not copy historical validation reports from `games/reel-problems/docs`; Reel Problems 4 must produce its own evidence.
4. Copy the thin play and sound-workshop routes to `app/reel-problems-4`.
5. Mechanically change only the new copy's game identity, local-storage keys, route URLs, metadata, invite URLs, audio owner, analytics identity, and user-facing title.
6. Search the new directory for inherited identity strings and classify each match as intentional gameplay copy or required Reel Problems 4 namespace change:

   ```text
   rg -n "reel-problems|Reel Problems|Lake Legend|tournament|ROUND_MS" games/reel-problems-4 app/reel-problems-4
   ```

7. Add `games/reel-problems-4/parity.test.ts`. Construct equivalent Reel Problems 1 and Reel Problems 4 base states with the same clock, players, inputs, and deterministic random sequence. Before ocean forces or modules are enabled, compare boat motion, player motion, casts, bite selection, tension, surges, crossed lines, shared catches, swimming, rescue, flooding, and checkpoint-safe values.

**Exit gate**

- Reel Problems 1 tests pass before and after the copy.
- The new copy has no accidental `reel-problems` room, storage, analytics, route, or audio identity.
- The parity test proves the unmodified Reel Problems 4 baseline matches Reel Problems 1.
- Neither game imports from the other.

### Task 0.2 — Register the new game atomically

**Create**

- `app/reel-problems-4/page.tsx`
- `app/reel-problems-4/admin/page.tsx`

**Modify**

- `shared/games/identity.ts`
- `shared/audio/types.ts`
- `platform/peer/engine.ts`
- `platform/audio/catalog.ts`
- `platform/analytics/catalog.ts`
- `platform/peer/invariants.test.ts`
- `shared/peer/coordinator.ts`
- `app/CollectionClient.tsx`
- `app/page.tsx`
- `shared/language/translations/cards.ts`
- `platform/admin/avatars/catalog.ts`
- `README.md`

**Work**

1. Add `reel-problems-4` in directory order to the canonical `GAME_IDS` list and add a documented party exclusion because a 20–30-minute voyage does not fit short party rotation.
2. Give Reel Problems 4 its own audio ID, catalog, analytics entry, peer engine, workshop, route, and four-player room capacity.
3. Extend the shared peer coordinator's NPC-roster support and in-progress roster error copy to Reel Problems 4.
4. Add the new game to peer invariant coverage.
5. Add an English and German collection card entry. Reuse the approved Reel Problems artwork initially; producing new card art is a separate presentation task and must not block the playable slice.
6. Add the game to the collection ordering only when its route can load the fork successfully. Keep it outside party rotation.
7. Add an avatar-catalog entry that reuses the forked angler avatar definition.
8. Update the authoritative README table and add a concise development-status section without claiming unfinished features are playable.

**Tests**

```text
node scripts/test.mjs shared/games/identity.test.ts platform/games/registry.test.ts platform/peer/invariants.test.ts
node scripts/test.mjs games/reel-problems-4
npm run check:architecture
npm run typecheck
```

**Exit gate**

- The route and workshop load.
- Registry tests report no missing route, card, translation, analytics, audio, playlist decision, or README row.
- A fresh room uses only the `reel-problems-4` namespace.
- A checkpoint serializes, restores, and advances through the shared peer engine.

## Milestone 1 — Replace the tournament with a session voyage

### Task 1.1 — Define versioned voyage state

**Create**

- `games/reel-problems-4/voyage.ts`
- `games/reel-problems-4/voyage.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/peer.ts`
- `games/reel-problems-4/Game.tsx`

**Work**

1. Add a checkpoint schema version and a voyage state containing session seed, phase, start time, shared wallet, ocean state, item counters, installed-module IDs, wreck state, legendary state, and recap facts.
2. Replace the five-minute tournament timeout and score-target result with `lobby → playing → won`. Do not add a normal `lost` phase.
3. Keep `start` and `restart` host-authoritative. Restart builds a completely fresh session and resets money, inventory, modules, trader demand, wreck count, and the legendary fish.
4. Preserve transient-input clearing during host migration while migrating missing new fields safely.
5. Update the menu and HUD just enough to remove tournament promises and countdown presentation. Do not build the final HUD in this task.

**Tests first**

- A playing voyage does not end after `ROUND_MS`.
- Landing a normal fish cannot win.
- `restart` resets all session progression.
- A checkpoint round trip preserves the voyage seed and progression fields.
- A missing or older Reel Problems 4 checkpoint field receives a safe default.
- Reel Problems 1 retains its five-minute tournament tests unchanged.

**Exit gate**

- A no-timer session can start, advance past five minutes in simulation time, checkpoint, restore, restart, and remain deterministic.

### Task 1.2 — Add a deterministic tuning catalog

**Create**

- `games/reel-problems-4/catalog.ts`
- `games/reel-problems-4/catalog.test.ts`

**Work**

1. Define stable IDs and validation for sea bands, catch families, salvage kinds, traders, repair platforms, recipes, core modules, utility modules, and the legendary catch.
2. Give every fish a positive base price and every salvage kind a defined sale, dismantle, or recipe purpose.
3. Declare socket compatibility and two tiers for hull, engine, and fishing modules.
4. Define more utility choices than available utility sockets.
5. Validate that recipes reference real materials/modules and that no required progression recipe depends on a resource unavailable before its destination band.

**Exit gate**

- Catalog validation catches duplicate IDs, missing prices, invalid sockets, impossible recipes, and missing regional sources.

## Milestone 2 — Build the seamless ocean and physical helm

### Task 2.1 — Add continuous sea bands and destinations

**Create**

- `games/reel-problems-4/ocean.ts`
- `games/reel-problems-4/ocean.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/chaos.ts`
- `games/reel-problems-4/sea-scene.ts`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`

**Work**

1. Replace the bounded lake/shore presentation in the new game with a compact continuous ocean coordinate space.
2. Implement pure `bandAt(position)`, current, wave-pressure, visibility, nearest-trader, nearest-platform, and safe-respawn queries.
3. Place the starting flotilla, two coastal traders, one coastal repair platform, offshore destinations, deep-sea cues, and the legendary roaming bounds from seeded catalog data.
4. Apply regional current and wave modifiers to the existing boat body. Do not bypass its velocity, roll, pitch, flooding, or fish-pull calculations.
5. Add visual and audio language for band transitions: water color, wave amplitude, buoy shapes, platform lights, compass labels, and warnings.
6. Cull or simplify distant decoration, catches, audio, and particles while keeping authoritative state deterministic.

**Tests first**

- Positions classify consistently on both sides of every band boundary.
- There is a continuous traversable route from start to every trader, platform, and deep-sea territory.
- Regional forces are zero or baseline-safe in the starting parity fixture.
- The same seed produces the same destinations and conditions.
- Distant presentation culling cannot delete authoritative catches or items.

**Exit gate**

- The base boat can move within the coastal sea, see offshore/deep-sea transitions, and experience stronger physical conditions without a loading screen or invisible gate.

### Task 2.2 — Implement the helm and engine station

**Create**

- `games/reel-problems-4/helm.ts`
- `games/reel-problems-4/helm.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/peer.ts`
- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/style.css`

**Work**

1. Add an authoritative helm owner, throttle, rudder, idle state, and heading-hold state.
2. Use one contextual Work action (`C` on keyboard, mapped controller action, and one touch button) to claim or leave stations and handle later platform interactions. Preserve all original fishing, brace, untangle, cut, jump, and rescue bindings.
3. While attached, map movement input to throttle and steering; suppress walking and incompatible actions.
4. Apply propulsion and turning as forces/torque to the existing boat simulation.
5. On release, disconnect, overboard state, incapacitation, or host migration, clear ownership and return the engine to idle.
6. Add solo heading hold with a conservative duration and no obstacle avoidance.
7. Render the helm, current operator, throttle/rudder feedback, and contextual prompt.

**Tests first**

- Only one player owns the helm.
- Remote or stale claims fail without displacing the operator.
- Helm input cannot also move the player or cast.
- Release and disconnect clear ownership exactly once.
- Engine forces combine with fish, wind, wave, crew-weight, and flood effects.
- Heading hold maintains direction but does not negate current.

**Exit gate**

- One to four players can steer naturally while the unchanged fishing and deck physics remain active. A solo player can leave the helm long enough to perform a nearby task.

## Milestone 3 — Make catches into cargo and resources

### Task 3.1 — Introduce stable items and inventories

**Create**

- `games/reel-problems-4/items.ts`
- `games/reel-problems-4/items.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/peer.ts`

**Work**

1. Add stable item IDs, a monotonic item counter, discriminated item kinds, three personal slots, shared material storage, fish cargo, physical-carry ownership, installed state, floating state, sold state, and consumed state.
2. Centralize every transfer in pure validated functions. No caller directly edits two inventories.
3. Route landed fish from tournament score banking into fish cargo. Retain landing animation, shared catch credit, line release, and catch statistics.
4. Spawn wood, iron, scrap, rope, and mechanical parts as hookable salvage using the original bite/line pipeline.
5. Keep bulky parts physical. Prevent a bulky carrier from fishing or taking the helm.
6. On disconnect or invalid support, drop the same item ID at a reachable position.
7. Add capacity errors that release or retain a catch visibly; never silently delete it.

**Tests first**

- Every transfer conserves IDs and total quantities.
- One item never exists in two locations.
- Full personal, shared, or fish storage rejects safely.
- Multiple attached anglers create one cargo fish and retain individual catch credit.
- Host handover does not duplicate a landed fish or carried part.
- A disconnected carrier drops one reachable object.

**Exit gate**

- Players can fish every base catch and salvage material into the correct storage layer, drop and recover resources, and restore the state through a checkpoint.

### Task 3.2 — Add minimal inventory and cargo presentation

**Create**

- `games/reel-problems-4/components/VoyageHud.tsx`
- `games/reel-problems-4/components/InventoryPanel.tsx`

**Modify**

- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`
- `games/reel-problems-4/style.css`
- `games/reel-problems-4/translations.ts`

**Work**

1. Show shared money, fish capacity, boat-storage capacity, current sea band, boat condition, and contextual Work verb without hiding the original tension and rescue information.
2. Let a player inspect and transfer their three slots while safely docked or while no urgent held action is active.
3. Render fish cargo and bulky carried objects on the boat.
4. Add English and German copy and device-specific prompts.
5. Ensure closing a panel restores gameplay focus and never leaves a held interaction active.

**Exit gate**

- Desktop, narrow touch, and controller users can understand storage state and move items without losing fishing controls or urgent warnings.

## Milestone 4 — Add traders and the shared economy

### Task 4.1 — Implement deterministic prices and transactions

**Create**

- `games/reel-problems-4/economy.ts`
- `games/reel-problems-4/economy.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/voyage.ts`
- `games/reel-problems-4/peer.ts`

**Work**

1. Generate each trader's visible demand bonuses from the session seed and a bounded deterministic demand epoch.
2. Build offers from item base value, rarity/size, condition if used, and demand bonus.
3. Freeze the quoted value into a short-lived authoritative offer ID.
4. Confirm sales by consuming the exact item IDs and crediting the shared wallet in one transaction.
5. Record completed transaction IDs with bounded retention so retries and host migration are idempotent.
6. Guarantee a positive base offer for every fish and a defined offer or dismantling path for junk.
7. Ensure coastal base catches can always finance minimum repairs and the first required progression recipes without grinding indefinitely.

**Tests first**

- Every catch has a positive sale offer at every trader.
- Identical seeds produce identical demand.
- An offer does not change during confirmation.
- Double confirmation credits once.
- Missing, sold, or remote items cannot be sold.
- Wallet arithmetic is integer-safe and never becomes negative.

**Exit gate**

- A deterministic rule test can catch fish, dock, quote, sell, receive shared money, restore the checkpoint, retry confirmation, and retain the correct balance once.

### Task 4.2 — Build floating trader interactions

**Create**

- `games/reel-problems-4/components/TraderPanel.tsx`

**Modify**

- `games/reel-problems-4/ocean.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`
- `games/reel-problems-4/style.css`

**Work**

1. Add safe trader approach, docking, release, and panel-open rules.
2. Require the boat to be secured before opening the panel. Prevent trading while sinking, in legendary combat, or outside interaction range.
3. Show all fish, exact base value, bonus, total, and resulting wallet balance before confirmation.
4. Support sell-one and sell-selected actions without a hidden sell-all default.
5. Render trader silhouettes, demand boards, mooring cues, and clear departure space.

**Exit gate**

- A newcomer can identify a trader, dock, understand a price, sell a catch, and leave. Trading cannot freeze active physics outside the designated safe docking state.

## Milestone 5 — Craft and install meaningful modules

### Task 5.1 — Implement recipes, repairs, sockets, and modifiers

**Create**

- `games/reel-problems-4/crafting.ts`
- `games/reel-problems-4/crafting.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/hull.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/helm.ts`
- `games/reel-problems-4/peer.ts`

**Work**

1. Implement quote and confirmation transactions for hull repair and module recipes.
2. Atomically consume shared money/materials and create one physical finished module at the platform output point.
3. Implement compatible fixed sockets: hull, engine, fishing, and a deliberately limited utility set.
4. Install through a held physical interaction. Completed installation moves the same module ID to the socket; interrupted progress consumes nothing.
5. Replacing a module returns the old one to a valid storage or platform position. Reject when no destination is available.
6. Centralize `effectiveBoatModifiers(world)` and `effectiveFishingModifiers(world)` so physics and fishing read one bounded modifier object.
7. Add first and second tiers for hull, engine, and fishing plus cargo crate, low-rate pump, salvage magnet, rescue ladder, and stabilizer.
8. Keep utility effects assistive: none may remove flooding, salvage, rescue, steering, or fishing work entirely.

**Tests first**

- Invalid recipes preserve money and materials.
- Duplicate confirmations create one module.
- Socket compatibility, tier replacement, and capacity are enforced.
- Base modifier output is exactly neutral for the parity fixture.
- Hull, engine, reel, cargo, pump, magnet, ladder, and stabilizer effects stay within catalog bounds.
- Replacement never deletes the old module.

**Exit gate**

- A crew can earn, craft, carry, install, replace, and recover every module through authoritative actions. An unupgraded boat still passes parity tests.

### Task 5.2 — Build repair-platform presentation

**Create**

- `games/reel-problems-4/components/PlatformPanel.tsx`

**Modify**

- `games/reel-problems-4/ocean.ts`
- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`
- `games/reel-problems-4/style.css`
- `games/reel-problems-4/translations.ts`

**Work**

1. Add safe approach and docking cues distinct from trader cues.
2. Show hull repair, affordable recipes, missing ingredients, compatible sockets, output location, and resulting wallet before confirmation.
3. Render the physical output module, carry pose, boat socket highlights, installation progress, and installed geometry.
4. Make core progression readable without calling the sea bands locked.
5. Keep platform panels usable with keyboard, controller, touch, reduced motion, and screen-reader labels.

**Exit gate**

- Players can understand why they cannot craft an item, locate its output, carry it aboard, and find the matching socket without developer instruction.

## Milestone 6 — Make every wreck recoverable

### Task 6.1 — Replace terminal sinking with a wreck state machine

**Create**

- `games/reel-problems-4/wreck.ts`
- `games/reel-problems-4/wreck.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/hull.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/peer.ts`
- `games/reel-problems-4/npcs.ts`

**Work**

1. Replace inherited terminal/automatic boat-replacement paths with explicit `sinking → salvage → raft-building → raft-ready → platform-return → rebuilt` states.
2. On sinking, transfer bounded fish, materials, carried objects, and installed modules to floating salvage using their existing IDs.
3. Create one emergency raft frame and a non-sellable guaranteed recovery kit tied to the wreck ID.
4. Implement visible construction sockets and held attachment for required wood, scrap/flotation, and propulsion pieces.
5. Return an unreachable mandatory piece to the recovery area using the same ID after a delay.
6. Let the completed raft use the existing boat simulation with poor catalog-defined engine, stability, fishing, and cargo values.
7. At the nearest repair platform, rebuild the starting hull while preserving shared money and all recovered modules/items.
8. If all players are incapacitated, return them near the frame with a short safety window.
9. Support another full wreck and rebuild after recovery.

**Tests first**

- Sinking never sets a terminal loss.
- Wreck transfers conserve item/module identities.
- Guaranteed resources cannot be sold, consumed elsewhere, or exhausted.
- The raft cannot launch before all required sockets are complete.
- A solo player can complete every recovery action.
- Repeated wrecks create one current frame and one valid recovery kit each.
- Checkpoint restoration at every recovery phase neither skips nor repeats completed work.

**Exit gate**

- Normal-input simulation can sink, salvage, build, sail, rebuild, reinstall recovered modules, sink again, and recover again without duplication, permanent spectator state, or resource deadlock.

### Task 6.2 — Render and explain recovery

**Create**

- `games/reel-problems-4/components/RecoveryHud.tsx`

**Modify**

- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`
- `games/reel-problems-4/style.css`
- `games/reel-problems-4/audio.ts`
- `games/reel-problems-4/audio/director.ts`

**Work**

1. Render the wreck, bounded floating salvage, raft frame, required sockets, attached components, completed raft, and nearest-platform beacon.
2. Show one next-action prompt at a time without hiding swimmer rescue or danger warnings.
3. Add distinct audio for sinking, surfacing cargo, attaching parts, launching, and completed rebuild.
4. Keep cargo-expiry and unreachable-item recovery visible and fair.

**Exit gate**

- A novice crew can identify the raft frame, find the required pieces, launch, and locate the repair platform without facilitator instructions.

## Milestone 7 — Add the deep-sea legendary finale

### Task 7.1 — Implement tracking and encounter phases

**Create**

- `games/reel-problems-4/legendary.ts`
- `games/reel-problems-4/legendary.test.ts`

**Modify**

- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/catalog.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/peer.ts`
- `games/reel-problems-4/ocean.ts`

**Work**

1. Spawn one legendary fish in deterministic deep-sea roaming bounds from session start.
2. Expose sightings, jumps, wakes, rumors, and compass cues without an artificial unlock flag.
3. Enter `first-pull`, `tow`, `surges`, and `final-struggle` phases through the original cast, line, tension, reel, release, brace, and shared-hook actions.
4. Apply the fish's forces through the existing boat and line equations with phase-specific catalog modifiers.
5. Make the tow interact with helm steering, regional waves, flooding, crew weight, crossed lines, repairs, and installed modules.
6. Scale endurance and force by starting human count while preserving the same sequence and possible actions.
7. On total line loss, return the fish to roaming after a recovery interval and reset encounter stamina.
8. On wreck, release and reset the fish while preserving the recoverable session.
9. On landing, resolve one win, freeze further authoritative transactions, and create recap facts.

**Tests first**

- The fish is locatable from the start and not gated by a boolean unlock.
- Each phase transition has one cause and survives checkpoint restoration.
- Multiple lines combine once and one broken line leaves other lines attached.
- Surges remain readable and use the same release response as ordinary fishing.
- Escape and wreck reset the attempt without duplicating the fish.
- Landing resolves the win and awards participants once.
- Late damage, sale, cast, or install actions cannot change a completed result.

**Exit gate**

- A deterministic one-player and four-player simulation can locate, hook, fight, lose, reacquire, and land the legendary fish using the normal action set.

### Task 7.2 — Present the finale and recap

**Create**

- `games/reel-problems-4/components/LegendaryHud.tsx`
- `games/reel-problems-4/components/VoyageRecap.tsx`

**Modify**

- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/scene.ts`
- `games/reel-problems-4/models.ts`
- `games/reel-problems-4/style.css`
- `games/reel-problems-4/audio.ts`
- `games/reel-problems-4/audio/director.ts`
- `games/reel-problems-4/analytics.ts`

**Work**

1. Render distant jumps, wake direction, cast opportunity, phase change, surge warning, attached lines, and final landing without replacing the tension UI.
2. Add music intensity and warnings that remain distinguishable from voice chat and critical hull sounds.
3. Build the immediate win transition and recap for final boat, total earnings, fish sold, modules installed, wrecks survived, and winning anglers.
4. Make Restart explicitly state that money, materials, and upgrades will reset.
5. Report milestones for first sale, first module, first offshore/deep-sea entry, first wreck/rebuild, legendary hook, escape, and landing.

**Exit gate**

- The encounter reads as a larger expression of familiar fishing rather than a different boss minigame, and the recap accurately reflects authoritative facts.

## Milestone 8 — Complete solo, NPC, multiplayer, and input support

### Task 8.1 — Extend NPC jobs without giving away decisions

**Modify**

- `games/reel-problems-4/npcs.ts`
- `games/reel-problems-4/types.ts`
- `games/reel-problems-4/simulation.ts`
- `games/reel-problems-4/CrewSlots.tsx`

**Work**

1. Add NPC tasks for steering toward a human-selected marker, fishing, bracing, bailing, patching, retrieving nearby salvage, carrying a requested module, and filling raft sockets.
2. Add stable item and station claims so two NPCs do not select the same work.
3. Keep trader sales, recipe choice, module choice, route choice, and restart under human control.
4. Make solo viable without making NPCs complete the voyage unattended.

**Exit gate**

- Solo play can complete the entire session with or without an NPC. NPC actions accelerate physical work but never make strategic purchases.

### Task 8.2 — Add full control parity

**Modify**

- `games/reel-problems-4/Game.tsx`
- `games/reel-problems-4/components/**`
- `games/reel-problems-4/style.css`
- shared input files only if the existing abstract action cannot represent Work safely

**Work**

1. Map Work, panel navigation, inventory transfer, helm, heading hold, and carried-item drop for keyboard/mouse, controller, and touch.
2. Preserve original fishing control muscle memory.
3. Ensure prompts change with the active device and every essential action has an accessible equivalent.
4. Add focus management, reduced-motion behavior, readable captions, safe touch sizes, and no hover-only information.

**Exit gate**

- A complete solo voyage is possible on each supported input family without using a hidden keyboard fallback.

### Task 8.3 — Exercise real peer recovery

**Create**

- `games/reel-problems-4/scripts/peer-scenario.mjs`

**Modify**

- `scripts/peer-integration-client.mjs`
- `shared/peer/coordinator.test.ts` or the nearest existing roster tests

**Work**

1. Add a four-client scenario covering shared fishing, one sale, one recipe, physical carry, installation, helm transfer, one wreck, raft construction, rebuild, legendary hook, and win.
2. Force host departure while an offer exists, while a module is carried, during raft construction, and during the legendary encounter in separate deterministic cases.
3. Assert shared wallet, item IDs, installed modules, recovery sockets, fish phase, room roster, and voice links after handover.
4. Verify NPC roster changes are rejected during a live voyage and allowed in the lobby.

**Exit gate**

```text
node scripts/peer-integration.mjs reel-problems-4
```

passes without duplicate transactions, missing items, replayed construction, lost voice links, or inconsistent phase state.

## Milestone 9 — Browser, performance, and playtest gates

### Task 9.1 — Add a deterministic browser smoke path

**Create**

- `games/reel-problems-4/scripts/browser-check.mjs`

**Work**

1. Start a solo session, claim the helm, catch and store one fish, dock at a trader, sell, dock at a platform, craft and install one module, trigger the deterministic wreck fixture, attach one raft part, and restore normal play.
2. Capture menu, coastal voyage, trader, platform, wreck, deep-sea, legendary, and recap screenshots at desktop and representative phone sizes.
3. Fail on page errors, console errors, missing WebGL context, stuck panels, invisible urgent prompts, or route reload failure.
4. Keep developer fixtures behind test-only or explicit development guards.

**Exit gate**

- The scripted path passes twice from a clean session and leaves no persisted progression in a new session.

### Task 9.2 — Profile the long session

**Work**

1. Run a deterministic 30-minute accelerated simulation and a real-time browser soak.
2. Measure snapshot size, checkpoint size, tick cost, render frame time, active scene objects, audio nodes, timers, retained events, and heap trend.
3. Bound transaction receipts, recap facts, expired items, particles, floating labels, wake segments, and distant entity presentation.
4. Verify background-tab catch-up uses the shared engine's bounded stepping and does not replay 30 minutes of warnings or transactions.

**Exit gate**

- State and resource counts remain bounded, snapshots stay practical for peer transport, and the browser remains responsive on the project's representative desktop and phone profiles.

### Task 9.3 — Conduct directional human playtests

**Work**

1. Observe several solo players and at least five novice crews of two to four.
2. Record time to first catch, first sale, first install, offshore entry, first wreck recovery, deep-sea entry, legendary location, and completion.
3. Ask players to explain trader demand, storage, danger bands, socket choices, wreck recovery, and why the legendary fight was won or lost.
4. Look for dominant utility loadouts, dead travel, confusing docking, inventory busywork, unrecoverable loss, excessive helm duty, and finale phases that do not read.
5. Tune catalog values and presentation from evidence. Change approved product boundaries only through a design revision.

**Exit gate**

- Most novice crews complete in approximately 20–30 minutes.
- Players identify the first sale and recovery path without facilitator instruction.
- At least two utility modules create a real choice.
- Wrecks feel costly without prompting a restart.
- The legendary fish is findable and feels like familiar fishing at a larger scale.

## Milestone 10 — Release-candidate validation

Run focused validation throughout implementation, then complete this matrix on the final candidate:

```text
node scripts/test.mjs games/reel-problems
node scripts/test.mjs games/reel-problems-4
node scripts/test.mjs shared/games/identity.test.ts platform/games/registry.test.ts platform/peer/invariants.test.ts
node scripts/peer-integration.mjs reel-problems-4
node games/reel-problems-4/scripts/browser-check.mjs
npm run check:architecture
npm run typecheck
npx oxlint games/reel-problems-4 app/reel-problems-4 shared/games/identity.ts shared/peer/coordinator.ts platform/peer/engine.ts platform/audio/catalog.ts platform/analytics/catalog.ts
npx oxfmt --check games/reel-problems-4 app/reel-problems-4 shared/games/identity.ts shared/peer/coordinator.ts platform/peer/engine.ts platform/audio/catalog.ts platform/analytics/catalog.ts
npm run build
```

Also run the repository's full test suite before release if the working tree and execution time allow it:

```text
npm test
```

Perform manual checks for:

- desktop keyboard/mouse;
- controller;
- representative phone touch input;
- one, two, and four human players;
- optional NPC assistance;
- host departure during each transactional system;
- repeated sinking and rebuilding;
- under-equipped deep-sea entry and escape;
- legendary escape, reacquisition, wreck, and final landing;
- new-session reset after a win;
- Reel Problems 1 route and behavior remaining unchanged.

## Suggested commit sequence

Use small commits only when they can exclude pre-existing work safely:

1. `feat: fork Reel Problems 4 baseline`
2. `test: lock Reel Problems physics parity`
3. `feat: register Reel Problems 4`
4. `feat: add open-sea voyage state`
5. `feat: add ocean navigation and helm`
6. `feat: add voyage cargo and inventories`
7. `feat: add floating traders and economy`
8. `feat: add boat crafting and modules`
9. `feat: add recoverable wreck rebuilding`
10. `feat: add legendary fish finale`
11. `feat: complete Reel Problems 4 multiplayer and presentation`
12. `test: validate Reel Problems 4 release candidate`

Do not stage entire shared files merely to achieve this sequence. Correct preservation of existing work takes precedence over commit shape.

## Final completion criteria

Implementation is complete only when all of the following are true:

- `/reel-problems-4` is a separate registered game and Reel Problems 1 remains unchanged.
- The unupgraded starting boat passes the parity suite against Reel Problems 1.
- One continuous ocean contains coastal, offshore, and deep-sea conditions with no loading transition or artificial progression gate.
- A physical helm moves the existing boat body while original fishing and balance forces remain active.
- Every fish can be stored and sold; every resource has a defined use or sale path.
- Shared money, shared storage, and three-slot personal inventories remain host-authoritative and checkpoint-safe.
- Players can craft, carry, install, replace, recover, and reinstall socketed modules.
- Repeated wrecks remain recoverable through active salvage, raft building, and platform rebuilding.
- One to four players, including solo and optional NPC assistance, can reach and land the legendary fish.
- A new session resets all money, items, modules, trader demand, and voyage progress.
- The focused tests, peer scenario, browser path, architecture check, typecheck, lint, formatting, build, and human playtest gates pass.
- No deployment has occurred without separate authorization.
