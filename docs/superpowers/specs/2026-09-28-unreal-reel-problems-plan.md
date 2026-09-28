# Reel Problems Unreal — vertical-slice implementation plan

Date: 28 September 2026

Design: [Reel Problems Unreal design](2026-09-28-unreal-reel-problems-design.md)

## Outcome

Deliver a packaged Windows vertical slice of Reel Problems in Unreal Engine 5.8 that:

- plays entirely in first person;
- supports solo and a two-client networked session on the acceptance path;
- is architected and tested for one to four players;
- includes harbor departure, an introductory catch, a storm catch, return, and results;
- uses server-authoritative boat, fish, fishing, interaction, and voyage rules;
- supports keyboard/mouse and controller;
- recovers cleanly from gameplay and network failures;
- meets the approved 1080p laptop performance target.

The Unreal project is a separate Git repository from the existing browser project. This repository retains the approved design and execution record.

## Execution rules

- Do not begin installation until an SSD has at least 120 GB free. Do not delete personal files automatically.
- Use the stable Unreal Engine 5.8 Launcher build, not a Preview or source build.
- Keep authoritative rules in C++ and tuning/content in Blueprint classes and Primary Data Assets.
- Add an automated invariant before or with each authoritative gameplay rule.
- Keep first-person responsiveness cosmetic; clients do not decide catches, damage, checkpoints, or results.
- Use a controlled server-driven boat. Do not convert the slice to unrestricted replicated Chaos physics.
- Keep every progression-critical interaction recoverable and checkpoint-safe from its first implementation.
- Profile packaged builds on the target laptop throughout development, not only after visual polish.
- Commit small milestones that build and pass their relevant tests.

## Milestone 0 — storage, toolchain, and clean project

### Task 0.1: Establish a safe installation location

1. Confirm an internal or external SSD has at least 120 GB free.
2. Use an `UnrealProjects\ReelProblems` project directory on that SSD.
3. Keep Unreal Derived Data Cache on the same spacious SSD if the default C-drive cache would exhaust remaining space.
4. Record the selected engine, project, cache, and packaged-build locations in the project README.

**Exit gate:** Engine and project paths resolve to the selected SSD, and at least 120 GB is free before downloads begin.

### Task 0.2: Install the supported Windows toolchain

1. Install or update the Epic Games Launcher.
2. Install the stable Unreal Engine 5.8 binary with core components, templates, Starter Content, and editor debugging symbols.
3. Install the supported Visual Studio release with Game Development with C++, the Windows SDK, MSVC, C++ profiling tools, and Unreal integration components.
4. Update the NVIDIA driver only if Unreal reports a driver or rendering-feature incompatibility.
5. Let the user perform account authentication and accept license terms when the installers require it.

**Exit gate:** A stock C++ First Person template opens, compiles, launches in editor, and packages for Win64.

### Task 0.3: Create the project and repository

Create:

- `ReelProblems.uproject`
- `Source/ReelProblems/ReelProblems.Build.cs`
- `Source/ReelProblems/ReelProblems.cpp`
- `Source/ReelProblems/ReelProblems.h`
- `Config/DefaultEngine.ini`
- `Config/DefaultGame.ini`
- `Config/DefaultInput.ini`
- `.gitignore`
- `.gitattributes`
- `README.md`

Work:

1. Create a C++ Games/First Person project with Starter Content.
2. Initialize a separate Git repository.
3. Ignore `Binaries`, `DerivedDataCache`, `Intermediate`, `Saved`, IDE state, and local packaged builds.
4. Configure Git LFS for `.uasset`, `.umap`, and other large binary asset types added by the project.
5. Enable Enhanced Input, Water, Niagara, and MetaSounds. Disable unused optional plugins.
6. Configure Win64, DirectX 12, Shader Model 6, a 60 FPS cap, and Development packaging defaults.
7. Add an empty startup map and a small automation-test map.

**Exit gate:** A clean clone can generate project files, compile, open, run the test map, and package without untracked generated directories.

## Milestone 1 — module, state, and test foundation

### Task 1.1: Add gameplay tags and data contracts

Create:

- `Source/ReelProblems/Public/ReelGameplayTags.h`
- `Source/ReelProblems/Private/ReelGameplayTags.cpp`
- `Source/ReelProblems/Public/Data/ReelFishDefinition.h`
- `Source/ReelProblems/Public/Data/ReelEncounterDefinition.h`
- `Source/ReelProblems/Public/State/ReelTypes.h`
- `Source/ReelProblems/Private/Tests/ReelDataTests.cpp`

Work:

1. Define tags for fishing states, fish tactics, interaction verbs, damage, equipment, weather, and voyage phases.
2. Define Primary Data Assets for fish and encounters with validation methods.
3. Define compact replicated structs for fishing, boat condition, objectives, checkpoint summaries, and results.
4. Reject invalid tension ranges, negative timing, duplicate identifiers, missing presentation classes, and impossible encounter gates.

**Exit gate:** Automation tests validate good definitions and reject malformed definitions with useful errors.

### Task 1.2: Create the authoritative game shell

Create:

- `Source/ReelProblems/Public/Game/ReelProblemsGameMode.h`
- `Source/ReelProblems/Private/Game/ReelProblemsGameMode.cpp`
- `Source/ReelProblems/Public/Game/ReelProblemsGameState.h`
- `Source/ReelProblems/Private/Game/ReelProblemsGameState.cpp`
- `Source/ReelProblems/Public/Player/ReelPlayerController.h`
- `Source/ReelProblems/Private/Player/ReelPlayerController.cpp`
- `Source/ReelProblems/Public/Player/ReelPlayerState.h`
- `Source/ReelProblems/Private/Player/ReelPlayerState.cpp`

Work:

1. Replicate voyage phase, objective, weather level, crew count, and result state.
2. Validate start and restart on the authority.
3. Scale crew requirements from the active authoritative roster.
4. Keep UI and camera state out of replicated game state.

**Exit gate:** One server and four PIE clients observe identical phase and roster state through join, leave, start, and restart tests.

## Milestone 2 — first-person player and interaction

### Task 2.1: Build the player controller

Create:

- `Source/ReelProblems/Public/Player/ReelCharacter.h`
- `Source/ReelProblems/Private/Player/ReelCharacter.cpp`
- `Content/ReelProblems/Input/IMC_Player.uasset`
- `Content/ReelProblems/Input/Actions/`
- `Content/ReelProblems/Characters/BP_ReelCharacter.uasset`

Work:

1. Implement grounded first-person movement, look, jump, mantle, crouch, and swimming using Unreal Character Movement.
2. Add visible first-person hands through a presentation mesh that does not affect authority.
3. Add keyboard/mouse and controller mappings through Enhanced Input.
4. Add sensitivity, inversion, camera sway, camera shake, and hold/toggle settings.
5. Keep heavy head bob disabled.

**Exit gate:** Keyboard/mouse and controller complete the movement test map at stable frame pacing with no camera clipping through the first-person body.

### Task 2.2: Add stable contextual interaction

Create:

- `Source/ReelProblems/Public/Interaction/ReelInteractable.h`
- `Source/ReelProblems/Public/Interaction/ReelInteractionComponent.h`
- `Source/ReelProblems/Private/Interaction/ReelInteractionComponent.cpp`
- `Source/ReelProblems/Private/Tests/ReelInteractionTests.cpp`
- `Content/ReelProblems/UI/WBP_InteractionPrompt.uasset`

Work:

1. Select the centered eligible target using forgiving traces and target volumes.
2. Hold target identity stable during held interactions.
3. Send compact interaction requests to the server and validate distance, state, verb, ownership, and rate.
4. Clear held input and target state after interruption, respawn, possession change, or disconnect.
5. Expose plain prompt text, progress, failure reason, and accessibility outline state to UMG.

**Exit gate:** Repeated, simultaneous, interrupted, out-of-range, and duplicated requests resolve once and never trap input.

## Milestone 3 — sessions and replication skeleton

### Task 3.1: Isolate session management

Create:

- `Source/ReelProblems/Public/Online/ReelSessionSubsystem.h`
- `Source/ReelProblems/Private/Online/ReelSessionSubsystem.cpp`
- `Content/ReelProblems/UI/WBP_MainMenu.uasset`
- `Content/ReelProblems/UI/WBP_Lobby.uasset`

Work:

1. Wrap create, find, join, leave, reconnect, and destroy operations behind the subsystem.
2. Use the local session provider for PIE and LAN packaged tests.
3. Keep provider-specific identifiers out of gameplay actors and checkpoints.
4. Display actionable failure states and restore input focus after every callback.

**Exit gate:** Two packaged clients can create, discover, join, leave, and rejoin a session without restarting either executable.

### Task 3.2: Add network test fixtures

Create:

- `Source/ReelProblems/Private/Tests/ReelReplicationTests.cpp`
- `Content/ReelProblems/Tests/FTEST_NetworkShell.umap`

Work:

1. Test late join, roster scaling, duplicated RPC rejection, restart, and disconnect cleanup.
2. Add repeatable network-emulation profiles for latency, jitter, loss, and reordering.
3. Record baseline bandwidth and correction counts before boat or fishing traffic is added.

**Exit gate:** The empty gameplay shell remains correct under the approved test profiles with two and four clients.

## Milestone 4 — stable shared boat

### Task 4.1: Implement controlled boat motion

Create:

- `Source/ReelProblems/Public/Boat/ReelBoatPawn.h`
- `Source/ReelProblems/Private/Boat/ReelBoatPawn.cpp`
- `Source/ReelProblems/Public/Boat/ReelBoatMovementComponent.h`
- `Source/ReelProblems/Private/Boat/ReelBoatMovementComponent.cpp`
- `Source/ReelProblems/Private/Tests/ReelBoatTests.cpp`
- `Content/ReelProblems/Boat/BP_ReelBoat.uasset`
- `Content/ReelProblems/Tests/FTEST_MovingBoat.umap`

Work:

1. Sample a low-frequency gameplay water surface at several buoyancy points.
2. Apply bounded lift, roll, pitch, steering, load, hooked-fish force, impacts, and storm modifiers on the server.
3. Replicate a compact boat state and smooth it on clients.
4. Clamp dangerous roll, acceleration, and correction without hiding readable impacts.
5. Keep visible high-frequency wave motion cosmetic.

**Exit gate:** The boat follows an authored route for ten minutes without divergence, tunneling, unbounded roll, or repeated corrections.

### Task 4.2: Ground players on the moving deck

Work:

1. Use the boat as an Unreal moving base while characters are aboard.
2. Preserve deck-local position through steering, waves, jumps, and corrections.
3. Add forgiving ladders, edge mantles, water entry, swimming, and safe reboarding.
4. Add authority-controlled safe spawn points aboard and ashore.

**Exit gate:** Two networked players can walk, jump, interact, fall overboard, swim, and reboard throughout a rough-water test without persistent jitter or launch forces.

## Milestone 5 — complete fishing loop

### Task 5.1: Implement the authoritative fishing state machine

Create:

- `Source/ReelProblems/Public/Fishing/ReelFishingComponent.h`
- `Source/ReelProblems/Private/Fishing/ReelFishingComponent.cpp`
- `Source/ReelProblems/Public/Fishing/ReelFishingLineState.h`
- `Source/ReelProblems/Private/Tests/ReelFishingStateTests.cpp`

Tests first:

1. Validate every allowed and forbidden state transition.
2. Verify bite timing, hook window, safe tension, warning grace, line break, slack escape, fatigue, landing, interruption, and reset.
3. Verify cast targets, inputs, and landing requests against server distance and state.
4. Verify equivalent server inputs produce deterministic outcomes.

Implementation:

1. Add `Idle`, `Aiming`, `Cast`, `Waiting`, `Bite`, `Hooked`, `Landing`, `Landed`, `Escaped`, and `Broken` states.
2. Calculate authoritative tension from fish pull, reel intensity, rod direction, line length, boat motion, and bounded modifiers.
3. Replicate state, normalized tension, line endpoints, hook target, and terminal outcomes at bounded rates.
4. Reconstruct spline line visuals, rod flex, haptics, particles, and audio locally.

**Exit gate:** A headless automation test can catch and lose fish through normal state transitions; no result depends on client frame rate.

### Task 5.2: Add authored fish behavior

Create:

- `Source/ReelProblems/Public/Fishing/ReelFish.h`
- `Source/ReelProblems/Private/Fishing/ReelFish.cpp`
- `Source/ReelProblems/Public/Fishing/ReelFishDirector.h`
- `Source/ReelProblems/Private/Fishing/ReelFishDirector.cpp`
- `Source/ReelProblems/Private/Tests/ReelFishTests.cpp`
- `Content/ReelProblems/Data/Fish/`

Work:

1. Implement cruise, investigate, bite, run, turn, dive, rest, surge, tire, land, and escape tactics.
2. Author three ordinary species and one signature storm fish as data assets and Blueprint presentation classes.
3. Drive gameplay behavior on the server while clients interpolate a compact fish presentation state.
4. Prevent fish from entering invalid navigation, shoreline, or boat volumes.

**Exit gate:** Each species creates a distinct readable fight, restores from a checkpoint-safe summary, and stays within its encounter area.

### Task 5.3: Prove fishing on the moving boat

Create:

- `Content/ReelProblems/Tests/FTEST_BoatFishing.umap`

Work:

1. Combine fishing, boat motion, player movement, and two-client replication.
2. Test simultaneous lines, crossed-line warnings, hooked-fish boat force, line break, and landing.
3. Measure perceived input latency and server correction under the network profiles.

**Exit gate:** Solo and two-player fishing remain responsive and authoritative on calm and rough water.

## Milestone 6 — voyage and checkpoint slice

### Task 6.1: Implement the voyage director

Create:

- `Source/ReelProblems/Public/Voyage/ReelVoyageDirector.h`
- `Source/ReelProblems/Private/Voyage/ReelVoyageDirector.cpp`
- `Source/ReelProblems/Public/Voyage/ReelCheckpoint.h`
- `Source/ReelProblems/Private/Tests/ReelVoyageTests.cpp`

Tests first:

1. Departure, sheltered encounter, storm transition, signature catch, return, results, and replay occur only from valid conditions.
2. Crew scaling never requires absent players.
3. Checkpoint restoration does not duplicate catches, rewards, equipment, or phase transitions.
4. Whole-crew incapacitation and boat failure restore the minimum viable state.

**Exit gate:** A data-only test completes, fails, restores, and replays the entire slice deterministically.

### Task 6.2: Block out the connected level

Create:

- `Content/ReelProblems/Maps/L_ReelProblemsSlice.umap`
- `Content/ReelProblems/World/Harbor/`
- `Content/ReelProblems/World/FishingGrounds/`
- `Content/ReelProblems/World/Storm/`

Work:

1. Build one harbor, a sheltered ground, a deep-water storm area, and a readable return route.
2. Add navigation landmarks, safe spawns, encounter volumes, checkpoints, and out-of-bounds recovery.
3. Keep critical routes readable at the Low graphics profile.
4. Use World Partition or level streaming only where profiling proves it useful for this compact slice.

**Exit gate:** The complete graybox voyage can be finished solo and by two clients without developer commands.

## Milestone 7 — cooperative jobs and solo assistance

### Task 7.1: Add repairs, landing, and rescue

Create:

- `Source/ReelProblems/Public/Boat/ReelBoatDamageComponent.h`
- `Source/ReelProblems/Private/Boat/ReelBoatDamageComponent.cpp`
- `Source/ReelProblems/Public/Player/ReelRescueComponent.h`
- `Source/ReelProblems/Private/Player/ReelRescueComponent.cpp`
- `Source/ReelProblems/Private/Tests/ReelCrewJobTests.cpp`

Work:

1. Add visible repair points, limited carried repair material, net-assisted large-fish landing, ropes, ladders, and teammate hauling.
2. Make every held action interruptible and idempotent.
3. Return lost critical equipment visibly to its rack after a delay.
4. Record repair, landing, rescue, and loss events for the results screen.

**Exit gate:** Every job succeeds with one player and becomes faster or safer with multiple players; no critical item can be lost permanently.

### Task 7.2: Add bounded solo assistance

Work:

1. Engage auto-helm only while the solo player is fishing and disengage it clearly on manual steering.
2. Allow a started emergency repair to progress slowly while the solo player addresses another urgent task.
3. Trigger safety-rope recovery only after normal ladder and swimming recovery remain available for a reasonable window.
4. Disable or reduce assistance as human crew size increases.

**Exit gate:** Solo can complete the slice without an AI companion, and two-player play does not feel automated.

## Milestone 8 — presentation, accessibility, and performance

### Task 8.1: Build the stylized cinematic look

Create production assets under:

- `Content/ReelProblems/Art/Environment/`
- `Content/ReelProblems/Art/Boat/`
- `Content/ReelProblems/Art/Fish/`
- `Content/ReelProblems/Materials/`
- `Content/ReelProblems/Lighting/`

Work:

1. Establish the Harbor Ink, Sea Glass, Lantern Amber, Rain Blue, Clay Coral, and Moon Foam palette.
2. Replace graybox geometry in order of gameplay importance: hands/rod, fish, boat/stations, route landmarks, harbor, then scenery.
3. Use Nanite only for suitable static scenery.
4. Use emissive materials and one principal dynamic light for the signature fish.
5. Validate silhouettes, prompts, line tension, and routes in bright water, fog, rain, and the darkest storm.

**Exit gate:** No required action depends on fine texture detail, color alone, or the High graphics profile.

### Task 8.2: Add effects and sound

Create:

- `Content/ReelProblems/VFX/`
- `Content/ReelProblems/Audio/MetaSounds/`
- `Content/ReelProblems/Audio/Mixes/`

Work:

1. Add pooled spray, cast splash, bite, line strain, fish breach, rain, impact, repair, rescue, and catch effects.
2. Layer water, hull, reel, line, fish, weather, harbor, and music with MetaSounds and sound mixes.
3. Duck ambience beneath important fishing cues and voice communication.
4. Provide directional subtitles and visual equivalents for gameplay-critical sounds.

**Exit gate:** Every major action has distinct feedback, and the slice remains playable with audio muted.

### Task 8.3: Implement UI and settings

Create:

- `Content/ReelProblems/UI/WBP_HUD.uasset`
- `Content/ReelProblems/UI/WBP_Settings.uasset`
- `Content/ReelProblems/UI/WBP_Results.uasset`

Work:

1. Show objective, contextual prompt, tension, boat condition, crew state, and restrained encounter messaging.
2. Add remapping, sensitivity, inversion, hold/toggle, subtitles, high-contrast outlines, camera sway, camera shake, motion reduction, and audio controls.
3. Add Low, Medium, High, and Cinematic graphics profiles plus automatic initial selection.
4. Make High the target-laptop default and reserve Cinematic for screenshots.

**Exit gate:** Keyboard/mouse and controller can configure and complete the slice without touching developer settings.

### Task 8.4: Meet the laptop budget

Work:

1. Cap normal play at 60 FPS and use TSR with bounded dynamic resolution.
2. Disable hardware ray tracing by default; tune Lumen, water, shadows, foliage, reflections, Niagara, and post-processing independently.
3. Profile solo, two clients, and a listen server hosting three additional clients.
4. Fix sustained bottlenecks before increasing art density.

**Exit gate:** Normal fishing maintains 60 FPS at 1080p High on the target laptop, and the worst storm does not remain below 45 FPS.

## Milestone 9 — recovery and network hardening

### Task 9.1: Complete checkpoint recovery

Tests first:

1. Restore before and after each encounter boundary.
2. Restore during a fight, repair, rescue, carried-object interaction, and storm transition.
3. Confirm transient held input clears and durable outcomes apply exactly once.
4. Confirm every critical item returns to a valid location.

**Exit gate:** Every checkpoint round trip produces a completable voyage with no duplicate or missing progression.

### Task 9.2: Handle disconnects and host loss

Work:

1. Keep disconnected player identity and voyage contribution reconnectable for the approved window.
2. Return held equipment safely and scale active requirements down.
3. Replicate the latest compact checkpoint to every client.
4. On listen-server loss, return remaining clients to the lobby with a clear resume action that lets a replacement host recreate the voyage from that checkpoint.
5. Do not claim live world transfer or seamless host migration.

**Exit gate:** Disconnect, reconnect, late join, host loss, replacement-host resume, and repeat completion pass under network emulation.

## Milestone 10 — packaged acceptance

### Task 10.1: Run automated validation

Use Unreal's command-line automation runner to execute the complete `ReelProblems` test namespace in an unattended editor session. Build and package through Unreal Automation Tool for Win64 Development.

Required coverage:

- data validation;
- authoritative game state;
- player interaction;
- sessions and replication;
- boat movement and deck grounding;
- fishing and fish behavior;
- voyage and checkpoint rules;
- crew jobs and solo assistance;
- recovery and host-loss resume.

**Exit gate:** Tests and packaging pass from a clean clone with no manual asset repair or editor resave.

### Task 10.2: Perform play and input acceptance

Exercise:

- complete solo voyage;
- complete two-client voyage;
- four-client network stress run;
- keyboard/mouse and controller;
- every graphics profile;
- every recovery path;
- restart and replay;
- all supported accessibility settings.

**Exit gate:** No shipped interaction requires a hidden key, console command, editor action, or unavailable second player.

### Task 10.3: Run the laptop soak and performance gate

1. Run the packaged game for at least 30 minutes through repeated calm and storm encounters.
2. Capture Unreal Insights, frame-time, memory, VRAM, network, correction, and hitch data.
3. Check temperature-driven clock reduction and frame pacing with the 60 FPS cap.
4. Investigate any crash, unbounded memory growth, repeated correction spike, or sustained performance miss.

**Release gate:** The vertical-slice completion criteria in the approved design pass on the target laptop.

## Recommended review slices

1. Clean project, test harness, data contracts, and replicated game shell.
2. First-person character and contextual interaction.
3. Session flow and network test fixtures.
4. Stable boat plus moving-deck multiplayer test.
5. One complete fish fight on the moving boat.
6. Complete graybox voyage with checkpoints.
7. Crew jobs and solo assistance.
8. Stylized presentation, sound, UI, and settings.
9. Recovery, host-loss resume, performance, and packaged acceptance.

Do not build the full environment or all four fish before the first end-to-end catch works on the replicated moving boat.

## Main risks and responses

| Risk | Response |
| --- | --- |
| Moving boat makes first-person multiplayer unstable | Controlled server motion, moving-base grounding, bounded correction, early two-client test |
| Fishing feels delayed online | Replicate compact intent and outcomes; predict only rod, line, haptics, sound, and camera feedback |
| Water and storm exceed laptop GPU budget | Separate gameplay and visual water, scalable Lumen/water/effects, TSR, dynamic resolution, profile early |
| Fully physical fish behave unpredictably | Authored server tactics with bounded forces and client interpolation |
| Solo becomes plate-spinning frustration | Temporary auto-helm, slow automatic emergency repair, safety-rope recovery, scaled objectives |
| Host loss destroys the run | Replicate compact checkpoints to all clients and support replacement-host resume |
| Blueprints become authoritative spaghetti | C++ owns rules and replication; Blueprints tune data and presentation |
| Art production delays proof of fun | Graybox end-to-end voyage before production environment work |
| Unreal generated files overwhelm source control | Separate repository, Unreal ignores, Git LFS, small commits |
| Laptop storage is exhausted | Hard 120 GB preflight gate and cache placement on the selected SSD |

## Immediate execution boundary

Implementation begins with Milestone 0 only. Installation cannot safely start while the only detected SSD has approximately 11.5 GB free. Once suitable storage exists, the first implementation review must prove:

- Unreal Engine 5.8 and the supported C++ toolchain work;
- the new project compiles, runs, tests, and packages;
- generated files are excluded from source control;
- the repository can be cloned and rebuilt cleanly;
- the selected paths leave sufficient free storage for later milestones.
