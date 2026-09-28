# Reel Problems Unreal — first-person co-op vertical slice

## Status and scope

The user approved this design section by section on 28 September 2026. It defines the product direction and the first implementation milestone for a Windows PC remake of Reel Problems in Unreal Engine.

The north-star game is a replayable 15–20 minute first-person cooperative fishing expedition for one to four players. The first implementation milestone is an 8–10 minute vertical slice that proves the complete experience on the user's laptop before the project expands.

This is a new Unreal project. It does not replace or embed itself in the existing browser implementation.

## Product decisions

- Use the stable Unreal Engine 5.8 binary distributed through the Epic Games Launcher.
- Target Windows PC with keyboard, mouse, and controller support.
- Use a hybrid implementation: C++ owns authoritative rules and reusable systems; Blueprints own content, tuning, effects, and presentation.
- Build server-authoritative gameplay for one to four players from the beginning. The first acceptance test covers solo and two-player networked play.
- Use first person throughout normal play, including visible hands, rods, carried objects, and interactions.
- Use a stylized cinematic visual direction: detailed water, weather, light, and materials without pursuing photorealism.
- Center the voyage on fishing rather than the beacon story from Reel Problems 3.
- Use an arcade tension system rather than quick-time events or a fishing simulation.
- Give solo players contextual assistance instead of an AI deckhand.
- Develop a playable vertical slice before expanding the complete voyage.

## Experience

The complete voyage has five connected acts:

1. **Harbor departure.** The crew gathers rods, bait, repair timber, and fuel, then launches. Physical interactions introduce movement and boat stations without a detached tutorial.
2. **Sheltered fishing grounds.** Easy fish teach casting, bites, rod direction, reeling, and line tension.
3. **Deep water.** More valuable fish fight harder. Lines can cross, catches affect the boat, and players alternate between steering, fishing, repairs, and rescues.
4. **Storm and legendary catch.** Worsening weather turns the final catch into a cooperative climax. One player can fight the fish while others steer, secure equipment, repair damage, manage the line, or perform a rescue.
5. **Return to harbor.** The catch only counts after the crew gets home. A dockside summary celebrates catches, rescues, repairs, broken lines, and comic accidents.

The first vertical slice compresses this structure into 8–10 minutes:

- A short harbor departure.
- One sheltered fishing encounter.
- A transition into rough weather.
- One difficult storm catch.
- A return to the same harbor and an end-of-voyage summary.

The slice contains one boat, one harbor, two connected fishing areas, three ordinary fish species, one difficult signature fish, one escalating storm, and one results screen. These are production-shaped systems and content, not disposable prototypes.

## Moment-to-moment fishing

Fishing is a continuous skill interaction with the world.

1. The player aims the rod at the water and casts to a chosen location.
2. Lure placement, fish interest, and bait affect the wait for a bite.
3. A readable audiovisual cue gives the player a short window to set the hook.
4. Once hooked, mouse or right-stick movement directs the rod. The player pulls against the fish and reels when the line has safe tension.
5. High tension risks a line break after a brief warning window. Excess slack lets the fish recover and can lose the hook.
6. Fish alternate between runs, turns, dives, rests, and surges. Their behavior is authored per species rather than selected from unrestricted physics.
7. A tired fish can be brought alongside and landed. Large fish may require another player at the net or a longer solo landing interaction.

The replicated fishing state machine is:

`Idle → Aiming → Cast → Waiting → Bite → Hooked/Fighting → Landing → Landed`

`Bite`, `Hooked/Fighting`, and `Landing` can transition to `Escaped` or `Broken`; recovery returns the rod to `Idle` without leaving it unusable.

Tension is calculated authoritatively from fish pull, reel input, rod direction, line length, boat motion, and short authored modifiers. Clients predict rod animation, line rendering, controller feedback, and audio so input feels immediate, but they do not decide catches or breaks.

## Player controls and feedback

- WASD and left stick move the character; mouse and right stick look and direct the rod.
- The primary action casts, sets the hook, and reels according to fishing state.
- The contextual interaction uses the helm, rod racks, repair points, ladders, catches, and carried equipment.
- Jump also mantles forgiving ledges and the boat edge.
- A dedicated ping marks fish, damage, equipment, and destinations for the crew.
- Controller actions use the same state model and do not receive simplified fishing rules.

The HUD remains restrained. It shows the current objective, line tension, essential catch information, boat condition, crew state, and contextual prompts. Directional subtitles and non-color tension cues are available. Camera sway, camera shake, sensitivity, inversion, and hold/toggle interactions are adjustable.

## Cooperation and solo scaling

Players have no fixed classes. Anyone can fish, steer, repair, carry, land a catch, or rescue a crewmate.

The voyage scales with active crew size:

- Fish stamina and simultaneous hazards scale within bounded ranges.
- Large-fish landing interactions accept either a second player or a slower solo sequence.
- Solo fishing temporarily engages a visible auto-helm that holds the current heading; it does not navigate the voyage.
- Solo emergency repairs progress slowly after the player starts them. Multiplayer repairs remain manual.
- Solo overboard recovery uses a safety rope after a delay. Friends can perform a faster physical rescue.
- Objectives never require more simultaneous participants than the active crew provides.

## Technical architecture

### C++ authority layer

- `AReelProblemsGameMode` validates joins, starts and ends the voyage, and applies server-only rules.
- `AReelProblemsGameState` replicates voyage phase, objectives, weather, crew-level catch state, checkpoint identity, and results.
- `AReelPlayerController`, `AReelPlayerState`, and `AReelCharacter` own input routing, identity, first-person movement, safe spawn, and reconnect state.
- `AReelBoatPawn` owns authoritative movement, steering, buoyancy response, damage, equipment stations, and deck-local grounding.
- `UReelFishingComponent` owns the fishing state machine, input validation, tension, line condition, and catch outcome.
- `UReelInteractionComponent` owns stable target selection and contextual interactions.
- `AReelFish` owns server-side fish state and exposes replicated presentation state rather than raw per-bone or per-frame data.
- `AReelVoyageDirector` owns the five-act flow, encounter gates, checkpoints, failure recovery, and completion.
- `UReelSessionSubsystem` isolates development sessions from the eventual shipping session provider.

Gameplay Tags identify interaction verbs, fishing states, damage types, fish tactics, and voyage phases. The Gameplay Ability System is not used in the vertical slice because its additional framework is not justified by the current scope.

### Blueprint and data layer

- Blueprint children tune the boat, fish, rods, interactions, encounters, animation, weather, and effects.
- Primary Data Assets define fish speed, stamina, tactics, safe tension range, value, bait preference, audiovisual presentation, and catch size.
- Encounter Data Assets define fish pools, weather escalation, objectives, checkpoints, and completion conditions.
- Niagara owns spray, splashes, rain, line-contact effects, and catch feedback.
- MetaSounds owns adaptive water, hull, reel, line-strain, weather, and fish audio.
- Enhanced Input provides keyboard, mouse, and controller mappings.
- UMG provides menus, settings, in-world prompts, HUD, and results.

### Data flow

1. A client reads local input and immediately updates first-person presentation where prediction is safe.
2. The client sends compact intent to the listen server: movement, steering, interaction request, cast target, reel intensity, and rod direction.
3. The server validates range, state, ownership, rate, and current voyage rules.
4. Authoritative boat, fish, fishing, interaction, and voyage systems update.
5. Replicated state and multicast gameplay cues drive remote animation, effects, sound, and UI.
6. Durable events such as a catch, repair, checkpoint, or phase change enter the compact checkpoint snapshot.

High-frequency cosmetic information is not replicated. Fish tactics, fishing state, important positions, and results replicate at bounded rates; line curves, rod flex, small waves, particles, and most audio are reconstructed locally.

## Boat and water

The boat uses controlled server-authoritative motion rather than unconstrained replicated Chaos physics. Several authored buoyancy samples respond to the water surface, steering, load, hooked-fish force, impacts, and storm intensity. The controller clamps extreme roll, acceleration, and correction so the deck remains playable.

Characters use the boat as a moving base and retain stable boat-local positions while aboard. Clients smooth the replicated boat transform and presentation-only rocking without allowing visual motion to change authoritative collision.

The Unreal Water system provides the ocean surface and shoreline integration. Expensive visual waves are decoupled from the lower-frequency gameplay surface used for buoyancy and fishing calculations.

## Networking and sessions

The first slice uses a listen server. Development and packaged LAN tests use Unreal's local session provider. Gameplay code does not depend on that provider; the shipping Windows milestone can integrate Steam sessions without replacing the replicated game systems.

The server is authoritative for boat motion, fish, fishing outcomes, interactables, damage, weather phase, checkpoints, and results. Unreal character movement handles ordinary player prediction and correction. Custom prediction is limited to first-person rod presentation and other cosmetics.

Every client receives the latest compact checkpoint snapshot. If a normal player disconnects, their equipment returns safely and their state remains reconnectable for a bounded window. If the listen-server host disappears, remaining players return to the lobby with the last replicated checkpoint available for a replacement host to resume. The design does not attempt to transfer a live Unreal world between hosts.

## Art direction

The selected direction is **Stylized Cinematic**.

- Materials and lighting have richer detail than the browser game, while proportions and silhouettes stay deliberately stylized.
- Water, rain, fog, wet surfaces, foam, and the signature fish glow create the dramatic range.
- The visual language retains Reel Problems colors: Harbor Ink, Sea Glass, Lantern Amber, Rain Blue, Clay Coral, and Moon Foam.
- First-person hands and equipment are readable against both bright water and the darkest storm.
- The signature fish becomes a moving underwater light source, but essential gameplay does not depend on seeing color alone.
- Photorealistic assets, dense film-quality environments, and unrestricted destruction are outside the slice.

## Laptop baseline and performance

The measured development laptop has:

- Windows 11 Pro.
- AMD Ryzen 7 5800H, 8 cores and 16 logical processors.
- 31.9 GB RAM.
- NVIDIA GeForce RTX 3070 Laptop GPU with 8 GB VRAM.

The packaged game target is 1920×1080 at 60 frames per second with a 60 FPS cap. High is the default profile on this laptop. The worst storm should not remain below 45 FPS, and normal fishing should maintain 60 FPS with consistent frame pacing.

- Use TSR and a bounded dynamic-resolution range.
- Use Lumen without hardware ray tracing by default.
- Use Nanite for suitable static scenery, not the boat, rods, fish, or other frequently deforming or interactive objects.
- Pool common Niagara effects and bound storm particle counts.
- Instance repeated scenery and limit shadowed movable lights.
- Give water, reflections, shadows, foliage, effects, and post-processing independent scalability controls.
- Keep the signature fish to one principal dynamic light plus emissive and local effects.
- Profile both a solo client and a listen-server host with three additional clients.

The editor, toolchain, project, caches, and packaged builds require an SSD with at least 120 GB available before setup begins. The current C drive has about 11.5 GB free and cannot safely host the installation. No personal files will be deleted automatically. The engine and the `UnrealProjects\ReelProblems` project directory will be placed on an SSD that satisfies the storage requirement.

## Setup baseline

- Install the stable Unreal Engine 5.8 binary through the Epic Games Launcher, including Starter Content and editor symbols needed for useful crash diagnostics.
- Install the supported Visual Studio toolchain with Game Development with C++, the Windows SDK, and Unreal integration components.
- Create a new C++ First Person project named `ReelProblems`.
- Keep the Unreal project in its own Git repository with Unreal-appropriate ignores and Git LFS tracking for binary assets such as `.uasset` and `.umap`.
- Enable only the plugins used by the design, including Enhanced Input, Water, Niagara, and MetaSounds.
- Use Development Editor for daily work and Development packaged builds for acceptance testing.

Epic account authentication and acceptance of Epic or Microsoft license terms must be performed by the user when their installers request it. Those legal acknowledgements are not automated on the user's behalf.

## Failure and recovery

- A broken line returns the rod to an empty state; replacement tackle is always available aboard.
- Lost progression-critical equipment visibly returns to its rack after a short delay.
- Ordinary escaped fish are lost. The signature storm encounter resets nearby in a weakened but recoverable state.
- Overboard players can swim, use the ladder, catch a rope, or be rescued. Solo safety recovery activates after a delay.
- If the entire crew is incapacitated or the boat becomes unusable, the latest voyage checkpoint restores the minimum state required to continue.
- Late joiners spawn safely aboard with the current durable state.
- Interaction and network failures display a plain explanation and a retry, resume, or return-to-harbor action. No error leaves input captured by a dead interaction or traps the voyage in an incomplete phase.

## Verification

Automated tests cover:

- Fishing state transitions, tension, line breaks, hook loss, landing, and catches.
- Fish tactics and crew-scaled stamina.
- Voyage phases, encounter gates, results, and checkpoint restoration.
- Interaction validation, critical-object recovery, and repeated use.
- Solo assistance and crew-scaled requirements.
- Join, leave, reconnect, checkpoint handoff after host loss, and late joining.
- Boat-local player grounding and bounded boat corrections.

Network functional tests run with two and four clients under simulated latency, jitter, and packet loss. Manual tests cover keyboard/mouse, controller, accessibility options, every graphics profile, solo play, two-player play, and four-player play.

Performance verification includes calm water, the hardest fish fight, and the worst storm. A packaged build receives a 30-minute soak test on the target laptop while recording frame pacing, CPU and GPU cost, memory, VRAM, disconnects, and recovery behavior.

Human cooperative playtesting evaluates whether fishing is readable and satisfying, whether non-fishing jobs create useful teamwork, whether solo assistance is subtle, and whether the storm catch earns its climax.

## Vertical-slice completion criteria

The slice is complete when all of the following are true:

- A player can launch a packaged Windows build, start solo, depart the harbor, catch an introductory fish, survive the storm catch, return, see results, and replay without developer intervention.
- Two packaged clients can find or join the same development session and complete the identical voyage.
- The host is authoritative without making rod input feel delayed under the tested latency budget.
- Joining, leaving, reconnecting, falling overboard, breaking a line, losing equipment, failing a catch, and restoring a checkpoint all recover cleanly.
- Keyboard/mouse and controller can complete the entire slice.
- The target laptop meets the 1080p performance target and completes the soak test without unbounded memory growth or a crash.
- Automated tests and packaged smoke tests pass from a clean checkout.

## Outside the vertical slice

- The full 15–20 minute voyage and its additional fishing grounds.
- Shipping Steam integration and store configuration.
- Dedicated servers, competitive modes, matchmaking ranks, progression economies, cosmetics, or monetization.
- Console, mobile, split-screen, VR, or cloud-streaming targets.
- Procedural oceans, an open world, unrestricted boat destruction, or photorealism.
- Direct reuse of the browser game's TypeScript simulation inside Unreal.

## References

- Epic Games, [Install Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/install-unreal-engine).
- Epic Games, [Hardware and Software Specifications for Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/hardware-and-software-specifications-for-unreal-engine).
- Existing project reference, `docs/superpowers/specs/2026-09-08-reel-problems-design.md`.
- Existing project reference, `docs/superpowers/specs/2026-09-26-reel-problems-3-design.md`.
