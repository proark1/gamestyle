# Reel Problems 3 Physics and Presentation Polish

**Date:** 2026-09-27
**Status:** Approved design

## Goal

Make Reel Problems 3 feel physically credible and visually finished without changing its first-person cooperative voyage structure. Players must collide reliably with the environment, the island boat must float clear of land and remain easy to board, the beacon bell must read immediately as a mounted bell, and the local first-person arms must look like one coherent character rig.

Reel Problems 2 remains unchanged.

## Physics Architecture

Reel Problems 3 will use the repository's existing `cannon-es` dependency. A dedicated `AdventurePhysics` unit will own a Cannon world, player bodies, and phase-specific static bodies. The serializable `AdventureWorld` continues to contain only gameplay data; physics instances are cached in a `WeakMap` keyed by the world object, following the multiplayer-safe pattern already used by other Jumbleyard games.

Each human player receives an upright dynamic body with rotation locked and vertical movement disabled. Input sets a desired horizontal velocity, with separate walk and sprint speeds. Cannon resolves contact against static scenery, allowing natural sliding around corners while preventing tunneling through trees, props, buildings, the tower, the boat hull, and other solid objects. Player positions are copied back into `AdventureWorld` after each fixed physics step so snapshots, reconnects, and host migration retain authoritative positions.

The physics environment is rebuilt when the phase or island index changes. Player bodies are synchronized when members join, leave, reconnect, or change phase. Rebuilding preserves player identifiers and uses the phase reset positions as safe spawn points. The physics cache is disposed and recreated when an adventure restarts.

Physics advances with a fixed 1/60-second step and a bounded accumulator. Long browser frames are clamped to prevent a player from crossing thin colliders. The existing world limits remain a final safety boundary.

## Phase Collider Layouts

Collider definitions will be data-driven and shared between physics construction and tests. They do not need to match every decorative polygon; each collider should match the readable footprint of the visible object while leaving comfortable navigation clearance.

### Harbor and Homecoming

- Harbor buildings use box colliders matching their ground-level footprints.
- Supply stations and dock posts use compact box or cylinder colliders.
- The boat hull uses compound box colliders around its perimeter, leaving its boarding opening usable.
- Dock edges and the playable boundary prevent walking out into open water.
- Required interaction markers remain reachable within the current five-metre interaction range.

### Beacon Islands

- The tower uses a circular collider sized to its stone base.
- Tree trunks use cylinder colliders; foliage remains non-solid so branches do not snag the player.
- Large shoreline rocks use conservative circular colliders.
- The shoreline is bounded so players cannot walk indefinitely across the water plane.
- Clear paths remain between the spawn, lens crank, bell, and boat gangway.

### Storm and Sanctuary

- The playable boat uses compound hull and fixture colliders while keeping the working deck open.
- Storm rocks and sanctuary formations use conservative static colliders where they intersect the walkable area.
- Helm, repair, rescue, lantern, and tone interactions remain unobstructed.

## Offshore Boat and Gangway

On each beacon island, the boat will move fully beyond the island shoreline so no part of its hull intersects the ground. A wooden gangway with visible planks, side ropes, support posts, and a slight rise will connect the island landing to an opening in the boat rail. Its physics surface is represented by a safe, broad walkable route bounded by side rails rather than by a decorative-only bridge.

The boat's waterline and hull proportions will be adjusted so it reads as floating instead of resting on the terrain. The helm marker will move onto the accessible deck. Spawn and reset positions remain on land, facing the gangway.

## Beacon Bell

The existing open cone will be replaced by a recognizable bell model:

- a shaped bronze shell with a crown and flared lip;
- a dark inner mouth and visible clapper;
- a timber yoke and freestanding bracket anchored beside the tower;
- a hanging pull rope that identifies how the player uses it;
- subtle warm metal variation while preserving the handcrafted clay style.

The complete assembly will sit outside the tower footprint and outside its collider. Its interaction root will cover the bell, rope, and nearby marker so looking at any obvious usable part selects `beacon-bell`. The bell remains reachable after lens alignment and disappears only through the existing beacon activation state change.

## First-Person Arms and Hands

The local view model will use one grouped limb per side rather than disconnected capsules and spheres. Each limb contains a cuff, tapered forearm, palm, thumb, and softly indicated fingers. The palm is attached at the forearm endpoint and rotated into a natural relaxed pose.

The arms will occupy the lower left and right corners of the camera view without covering the centered interaction target. A subtle opposing walk sway and small vertical bob provide presence; reduced-motion mode removes the sway. The rig uses camera-local geometry and cannot collide with the world or appear as a duplicate third-person avatar.

## Rendering and Performance

Physics code loads with Reel Problems 3 and does not affect other games. Static Cannon bodies are created once per phase rather than per frame. Visual geometry remains low-poly and flat-shaded to match the chosen handcrafted maritime style. Repeated materials and small geometries will be reused within the scene where practical, and the existing dynamic scene import remains intact so the heavy WebGL bundle is not added to the main page.

## Failure Handling

If a restored player position overlaps new scenery, physics initialization moves that player to the phase's safe spawn before stepping. Non-finite positions or velocities also trigger a safe reset. Physics teardown removes bodies and listeners when the world is replaced or the component unmounts.

Interaction logic remains authoritative in the existing adventure simulation. Physics changes movement only; it cannot activate objectives or bypass the lens-before-bell sequence.

## Validation and Acceptance Criteria

Automated tests will verify:

- players cannot cross the tower, representative tree trunks, large rocks, supply stations, harbor buildings, or boat hull walls;
- diagonal movement slides along colliders without sticking or penetrating;
- large frame deltas do not tunnel through thin obstacles;
- every phase reset and restored invalid position produces a valid spawn;
- the island boat footprint is outside the land footprint and its gangway route reaches the deck;
- the crank, bell, helm, repair, rescue, lantern, and tone targets remain reachable;
- the complete solo voyage and existing multiplayer invariants still pass.

Browser validation will play through the voyage in first person at desktop and touch-sized viewports, inspect the bell and offshore boat, verify the arms at rest and while moving, and record any console or network failures. Type checking, focused tests, the registry tests, and the Railway production build must pass before release.

The work is complete when scenery consistently blocks players, all objectives remain completable, the boat floats clear of land with a usable gangway, the bell is unmistakable and does not intersect the tower, and the first-person limbs look connected and natural.
