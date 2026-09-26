# Reel Problems 3 — First-Person Cooperative Adventure

## Goal

Build Reel Problems 3 as a separate game at `/reel-problems-3`: a polished, continuous 15–20 minute first-person voyage for one to four friends. The crew prepares a boat, explores an archipelago, activates three sea beacons, survives a storm alongside a legendary glowing fish, guides the fish into a protected sanctuary, and returns home for a shared ending.

Reel Problems 2 remains unchanged. Reel Problems 3 uses a purpose-built adventure engine rather than inheriting Reel Problems 2's simulation or scene code. It may reuse platform-level accounts, rooms, voice, wardrobe avatars, toolbar, audio playback, and rendering utilities.

## Experience principles

- First person is the primary and only gameplay camera. Players see their clay arms, held objects, shadows, and reflections.
- The voyage is one connected experience with a real conclusion, not a playlist of short rounds.
- Friends cooperate through movement and physical actions instead of fixed classes.
- Setbacks create stories and recovery work but do not erase the entire run.
- The legendary fish is a creature to understand and protect, not a boss to defeat.
- The environment carries guidance and story wherever possible; conventional HUD remains restrained.

## Adventure structure

### 1. Departure

The crew begins in a living harbor village and loads rope, lanterns, repair timber, and a hand-drawn chart onto its small fishing boat. This space introduces movement, carrying, the wheel, pings, and contextual interaction without a detached tutorial.

### 2. The search

The boat enters an open archipelago. Players disembark on compact islands, explore sea caves and abandoned fishing structures, and activate three old beacons. Each beacon involves climbing, aligning a physical mechanism, and ringing it cooperatively. Each one adds a tone and a new mark to the boat's chart.

### 3. The pursuit

The legendary fish appears beneath the boat as a storm builds. It swims beside and below the crew rather than fighting them. Players navigate reefs, manage sails and lanterns, repair storm damage, secure equipment, and rescue friends swept into the sea.

### 4. The sanctuary

The crew follows the fish into a narrow moonlit passage. Players place lanterns around the boat, hold formation through rocks and currents, and sound the three collected beacon tones in sequence. Success guides the fish into the protected cove and reunites it with its school.

### 5. Homecoming

The storm clears in the sanctuary, then the voyage resolves at the harbor at sunrise. The entire crew appears in a dockside photograph. Small awards describe real events from the completed run, such as rescues, repairs, navigation, beacon work, and mishaps.

## Cooperation and interaction

No player has a fixed role. Anyone can steer, sail, navigate, carry, repair, climb, swim, activate beacons, or rescue another player.

- Two players carry bulky objects faster and with greater stability.
- The wheel, sail controls, chart, repair stations, and deck equipment are separate physical positions.
- Repairs require retrieving a visible material, holding the damaged section in place, and fastening it.
- Overboard players swim and grab ropes; friends haul them onto the deck.
- Friends can place world-space pings for locations, hazards, and requests for help.
- Solo play supplies a small clay deckhand controlled through direct ping commands. Multiplayer remains the intended experience.

Interactions use forgiving target volumes, snapping, and animation-assisted placement. Important tools cannot be permanently lost. Fully loose object physics are not used for progression-critical actions.

## First-person controls and comfort

Desktop controls use WASD to move, mouse to look, Space to jump or mantle, and one primary contextual button to grab, use, climb, revive, pull, or place. Controllers use the corresponding twin-stick layout. Touch uses a left movement stick, a right look region, and a large contextual action button.

The crosshair changes shape to communicate the available action. Movement feels grounded and playful, with restrained boat sway and character reactions. Heavy head bob is excluded.

Settings include:

- Look sensitivity and axis inversion.
- Hold or toggle interaction modes.
- Camera sway and camera shake levels.
- Reduced-motion behavior.
- Remappable keyboard and controller controls.
- Directional subtitles.
- High-contrast interactable outlines.
- Color-independent objective symbols.
- Independent voice, music, and effects levels.

## World and art direction

The game extends the project's sculpted-clay style into first-person range. Characters and scenery use rounded handmade forms, faint fingerprints and tool marks, soft roughness, chunky readable silhouettes, and warm imperfections. The result should feel handcrafted and premium rather than like placeholder low-poly art or photorealism.

The connected world moves through four visual moods:

- A working harbor with nets, buoys, painted boats, gulls, chimney smoke, wet cobbles, and residents on shore.
- Wind-shaped islands with dense grass, tide pools, rope bridges, crooked beacon towers, caves, and fishing sheds.
- Open water with rolling swells, distant cliffs, rain curtains, lightning behind clouds, foam trails, and reactive wildlife.
- A luminous sanctuary with blue-green plants, floating pollen, waterfalls, reflected moonlight, and schools of glowing fish.

The core palette is Harbor Ink `#173E46`, Sea Glass `#4D928D`, Lantern Amber `#F0AD55`, Rain Blue `#55778B`, Clay Coral `#D96F56`, and Moon Foam `#F4EEDB`.

The legendary fish is the signature visual. Its light first appears beneath the boat and passes through the waves, illuminating the hull, crew, rain, and nearby rocks from below. It becomes a moving environmental light source during the storm.

## Interface and writing

The opening menu resembles a voyage journal over a live harbor scene. Fredoka carries the display voice, DM Sans carries readable instructions, and a compact handwritten face is reserved for chart notes and beacon markings.

The crew's mounted physical chart is the primary progress display. Discovered routes, beacon symbols, and the fish's path appear on it during play. A wrist compass shows the boat and crew direction. A one-line objective appears only when the objective changes or a player requests help. Optional hints escalate only after repeated failed attempts.

Story beats happen while players remain in control. The shared photograph is the only brief third-person composition. Interface copy uses plain action language and never hides required information behind flavor text.

## Architecture

Reel Problems 3 lives in `games/reel-problems-3` and has its own application route, game identity, collection card, room identity, preferences, artwork, audio catalog, analytics, documentation, and tests.

The game engine is divided into clear systems:

- `AdventureDirector` owns the five voyage stages and their completion conditions.
- `WorldScene` streams and renders harbor, island, sea, storm, sanctuary, and return zones.
- `PlayerController` owns first-person movement, camera, climbing, swimming, and visible hands.
- `InteractionSystem` owns targeting, carrying, joint carries, repairs, ropes, beacons, and contextual actions.
- `BoatController` treats the vessel as a moving local space and keeps players and loose equipment stable on deck.
- `WildlifeDirector` controls the legendary fish and ambient animals through authored behaviors.
- `SessionCoordinator` synchronizes players, world state, checkpoints, reconnects, and host migration.
- `AudioDirector` blends environmental layers, spatial actions, beacon tones, storm intensity, and the fish motif.

The host is authoritative for boat motion, adventure stage, interactable objects, and wildlife. Each client predicts its local player's walking and looking, then reconciles without abrupt first-person corrections. Networked objects and actions use durable identifiers.

## State, recovery, and failure

Adventure state is checkpointed after departure, each beacon, the storm entrance, and sanctuary arrival. A room whose players disconnect can resume from its latest checkpoint for a limited period.

- A disconnected player drops carried equipment onto the nearest valid surface.
- An essential object lost in water returns to its last station.
- Multi-person requirements scale to the active crew so an absent player cannot block progress.
- Falling, going overboard, breaking equipment, or taking a wrong route creates rescue or repair work rather than an immediate restart.
- If the entire crew is incapacitated, play resumes from the latest checkpoint with the world state necessary to continue.
- Late joiners spawn at the crew's current safe location and receive the current durable snapshot.

## Performance

The targets are 60 frames per second on a typical desktop and 30 frames per second on supported phones. The implementation uses zone streaming, shared clay materials, instanced foliage, pooled spray and weather effects, baked distant scenery, bounded shadow budgets, dynamic resolution, and quality profiles.

Automatic quality reduction preserves navigation and interactable visibility. It may reduce distant density, particles, reflections, and shadow range, but it must not remove progression clues or essential environmental landmarks.

## Verification

Automated validation covers:

- Adventure progression, scaled objectives, repair and rescue work, beacons, fish behavior, checkpoints, and essential-item recovery.
- First-person movement, moving-deck grounding, swimming, climbing, camera limits, and reduced-motion behavior.
- Simultaneous interactions, carried-object ownership, durable actions, late joining, disconnect and reconnect, host migration, and completion with fewer players than the room started with.
- Keyboard, controller, touch, remapping, contrast modes, subtitles, and non-color cues.
- Zone streaming, quality reduction, and representative desktop and mobile performance budgets.

Manual validation includes complete one-player and four-player voyages, every control scheme, narrow mobile layouts, and visual review of every zone in harbor daylight, storm, moonlight, and sunrise. Review explicitly checks first-person hands, friend animation, water, lighting, scenery density, crosshair prompts, and HUD collisions.

Human cooperative playtesting is required to judge pacing, legibility, delight, and whether the sanctuary climax feels earned. Automated checks cannot establish fun.

## Completion criteria

The game is complete when a one-to-four-player crew can create or join a Reel Problems 3 room, prepare and launch the boat, activate all three beacons, survive the storm pursuit, guide the legendary fish into the sanctuary, return for the shared photograph, and start a new voyage without developer intervention.

Reel Problems 2 remains playable and unchanged at its existing route.

## Out of scope

- Reusing Reel Problems 2 simulation or scene code as the basis of the sequel.
- Fixed player classes or role-locked actions.
- Combat with or capture of the legendary fish.
- Procedural islands or an endless open world.
- A multi-session chapter campaign.
- Photorealistic rendering or fully loose physics for progression-critical objects.
