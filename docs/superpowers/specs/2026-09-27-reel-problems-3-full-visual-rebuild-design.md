# Reel Problems 3 Full Visual Rebuild Design

**Date:** 2026-09-27
**Status:** Approved design awaiting written-spec review

## Goal

Rebuild the visible 3D presentation of Reel Problems 3 so it feels like a finished Jumbleyard game rather than a prototype. Preserve the existing eight-minute party-fishing round, missions, scoring, bots, multiplayer model, and procedural ocean streaming while replacing the scene presentation, character treatment, first-person scale, and collision coverage.

The finished game must use the same Nico character system as the rest of Jumbleyard, maintain one believable world scale, prevent players from walking through visible solid objects, and remain practical on mobile hardware.

## Chosen Direction

This is a full visual rebuild, not a cosmetic patch. The work will replace the current boat, harbor, ocean presentation, placeholder crew figures, first-person limb presentation, and incomplete collision layout. It will retain the established soft-clay Jumbleyard visual language and the current gameplay simulation.

## Art Direction

The world uses rounded silhouettes, tactile clay-like surfaces, warm saturated colours, readable forms, strong but soft-edged shadows, and small handmade irregularities. Detail supports gameplay readability: interactive equipment must remain distinct from decoration, navigation routes must remain visually obvious, and important stations must be recognizable without relying on floor rings.

All assets use the shared Nico character as the scale reference. Nico's established bare-head body height is 1.68 metres. Boat rails, doors, tools, furniture, harbor structures, vegetation, and interaction heights will be rebuilt around that reference instead of being scaled independently by eye.

## Characters

Every human-controlled player and bot uses the shared `dressedGameAvatar` Nico rig. Seat colour and nautical clothing distinguish the crew without changing body proportions. The rig receives movement and activity poses for:

- idle breathing and looking;
- walking and sprinting;
- carrying light, long, and bulky equipment;
- casting, reeling, bracing, and landing fish;
- steering and operating deck stations;
- ringing the harbor bell;
- repairing, bailing, rescuing, stumbling, and celebrating.

Held tools attach to the rig's established hand anchors. Two-handed equipment receives explicit left- and right-hand alignment instead of floating near the torso. Remote players and bots turn their head and upper body toward their current target while their feet follow movement direction.

## First-Person Presentation

The camera height derives from Nico's dimensions and the physical surface underfoot. The standing eye height is 1.56 metres above the current walking surface. The calculation applies consistently to the boat deck, gangway, dock, and shore, including boat pitch and roll.

The first-person view uses one coherent pair of arms and hands based on the shared character proportions. It does not display a second disconnected pair of hands. Contextual poses cover empty hands, carried objects, rods, wheel operation, the bell, repair tools, and rescue actions. Held items occupy physically credible positions and do not intersect the camera.

Camera motion remains restrained: small walking motion, damped boat sway, short landing response, and action-specific tool movement. Motion is reduced or removed when reduced-motion mode is active. The field of view and near plane must preserve a human sense of scale without clipping hands or nearby equipment.

## Fishing Boat

The existing primitive boat is replaced by a cohesive stylized fishing vessel with:

- a shaped hull with a raised bow and a clear waterline;
- a working deck with planks, drainage, and readable walking space;
- a compact cabin or wheelhouse with a correctly scaled helm;
- rails, posts, lamps, rigging, ropes, cleats, fenders, and safety equipment;
- physical racks for rods, bait, repair tools, fuel, landing nets, and the ice box;
- an integrated live well, engine housing, storage hatches, and mission equipment;
- visible wake, prop wash, spray, and motion response while travelling.

Interaction stations are part of the vessel rather than floating markers. Highlighting uses restrained rim light, material response, or small diegetic indicators. The boat always remains visibly afloat and clear of shore geometry.

## Harbor and Shore

The harbor becomes a compact handcrafted location containing a properly scaled lighthouse or harbor tower, a freestanding working bell, fishing sheds, a supported dock, pilings, ropes, buoys, signs, crates, vegetation, rocks, and a shaped shoreline.

The supported gangway is the single clear route between dock and boat during preparation. Its slope, width, rails, and endpoints must support the character collider without snagging or gaps. Shoreline foam and shallow-water colour communicate where walking ends. Distant structures and vegetation enrich the composition without becoming navigable or expensive collision targets.

The bell must have a recognizable bell profile, visible mounting hardware, a clapper, and enough clearance to swing without intersecting the tower or frame.

## Ocean, Weather, and Lighting

The ocean remains procedural and streamed around the active play area. The rebuilt material combines broad swells, smaller wind waves, directionally moving highlights, depth-based colour, shore and hull foam, wakes, and limited spray. Distant cells reduce mesh density and visual complexity.

Weather changes reuse the same system by adjusting wave amplitude, fog, sky colour, light direction, and surface highlights. Lighting uses a stable key light, soft environmental fill, local practical lights where useful, and contact-rich shadows around the boat and harbor. Repeated scenery shares geometry and materials, and distant decoration uses instancing or level-of-detail substitutions.

## Equipment and Fish

Every gameplay item receives a recognizable silhouette, believable construction, grip point, ground pose, rack pose, and first-person pose. Items may use simplified geometry, but they must not read as labelled boxes. Fish receive species-specific body proportions, fins, colouring, scale variation, and lightweight swimming, struggle, landed, and stored animation.

The visual state of an item must match its simulation state: loose, racked, held, floating, submerged, secured, consumed, or stored. Collision geometry follows only states that should block a player.

## Collision and Navigation

Every visible solid object in the playable space receives collision geometry appropriate to its shape. Coverage includes:

- the boat hull boundary, rails, cabin, engine housing, live well, storage, racks, and large loose equipment;
- dock edges, pilings, supported gangway rails, sheds, bell frame, tower, rocks, and trees;
- shoreline and water boundaries during the preparation phase;
- state-dependent mission objects that become solid while deployed.

Rounded or compound colliders approximate curved objects. Movement must slide along obstacles and recover from corners instead of sticking. Thin barriers must not be tunneled through during sprinting or a long frame. Spawn and phase-transition positions are validated against the active collision layout and moved to a deterministic safe location if invalid.

All required stations remain reachable. Tests must cover a navigable path from each spawn to loading racks, the bell, gangway, helm, fishing positions, repair equipment, rescue equipment, and storage.

## Architecture

The current monolithic scene renderer will be divided into focused modules:

- character creation, pose selection, held-item attachment, and first-person limbs;
- boat construction and boat-local visual effects;
- harbor and shore construction;
- ocean, weather, sky, wakes, and streamed scenery;
- equipment and fish model factories;
- interaction highlighting and targeting;
- camera placement, surface height, motion, and reduced-motion behavior;
- collider descriptions shared by rendering tests and physics.

Gameplay simulation remains authoritative. Rendering consumes snapshots and interpolates presentation without changing scoring, missions, fishing outcomes, bot decisions, or multiplayer state. Model factories expose stable roots and named anchors so animation and collision code do not depend on mesh traversal accidents.

## Mobile Performance Budget

The rebuild preserves the streamed 3-by-3 ocean neighborhood and avoids loading an unbounded world. It additionally uses:

- shared materials and cached geometry;
- instancing for repeated trees, rocks, posts, ropes, and small harbor decoration where practical;
- lower-detail distant ocean and scenery cells;
- a capped pixel ratio;
- one primary shadow-casting light and a controlled shadow range;
- disabled shadows and reduced particles on low-capability or touch devices;
- pooled wake, foam, and spray effects;
- no per-frame geometry allocation for characters, fishing lines, or repeated props.

Visual quality may scale down on mobile, but character proportions, collision, interaction readability, and gameplay state must remain identical.

## Failure Handling

Unsupported WebGL or renderer creation failure must leave the surrounding game UI usable and show a clear recovery message. Visual-effect failure must degrade safely without interrupting simulation. Missing optional decoration is ignored; missing required anchors or character rigs is treated as a development error covered by tests.

Invalid player positions, non-finite transforms, and phase transitions into blocked areas recover to deterministic safe spawns. The collision world rebuilds only when its structural key changes, not every render frame.

## Verification

Automated coverage will include:

- shared Nico rig creation, expected anchors, and character scale;
- camera eye height on each walkable surface and under boat rotation;
- collision presence for every solid environment category;
- sprint and diagonal collision behavior without penetration or corner sticking;
- safe spawning and phase-transition recovery;
- reachability of every required station;
- item visual-state and collision-state mapping;
- existing fishing, mission, scoring, bot, multiplayer, and party-rotation behavior;
- type checking, linting, focused tests, the broader platform suite, and the Railway production build.

Browser playthroughs run at desktop and touch-sized viewports. They cover preparation and boarding, open-water travel, fishing, held equipment, chaos events, mission completion, returning to harbor, and the results screen. Visual checkpoints capture the harbor overview, boat deck, first-person empty hands, representative held items, open-water fishing, storm or fog conditions, and populated crew views.

## Completion Criteria

The rebuild is complete when:

- all players and bots visibly use the shared Nico character;
- first-person scale feels human and the arms form one connected, correctly proportioned presentation;
- players cannot pass through visible solid gameplay geometry;
- the boat, harbor, ocean, equipment, and fish share a coherent production-quality Jumbleyard style;
- all objectives and interactions remain reachable and functional;
- the game completes correctly alone with bots and in multiplayer;
- desktop and mobile browser validation pass without console errors, failed local requests, or severe clipping, and the mobile validation scene sustains at least 30 rendered frames per second after its five-second warm-up on the existing test machine.
