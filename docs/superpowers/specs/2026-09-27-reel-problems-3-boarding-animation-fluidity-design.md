# Reel Problems 3: Boarding, Deck Space, Animation, and Fluidity Design

**Date:** 2026-09-27  
**Status:** Approved design  
**Scope:** Reel Problems 3 boat and crew presentation

## Problem

The boat currently has four connected usability problems:

1. The dock gangway meets an unbroken hull wall and rail, so there is no visible or believable boarding entrance.
2. The oversized orange cabin cover and nearby equipment leave too little navigable deck space, particularly along the starboard side.
3. Crew walk animation is inferred from input. Bots move by changing their world position directly, so their legs and feet remain static while they travel.
4. The local simulation renders at the display refresh rate, but scene transforms and character poses are refreshed from a roughly 24 Hz published snapshot. Walking therefore looks stepped even when the renderer itself is maintaining a higher frame rate.

## Goals

- Make the route from dock to deck immediately legible.
- Give four players enough room to board, circulate, pass, fish, and handle chaos events without becoming trapped by scenery.
- Keep the current warm, chunky Reel Problems 3 art direction.
- Animate every moving avatar, including bots, with convincing leg, foot, arm, and body motion.
- Make local movement visually fluid without increasing React, audio, analytics, or network work to the display frame rate.
- Preserve solid collision around the rest of the hull and equipment.
- Retain acceptable performance on mobile hardware.

## Chosen Direction

Use a targeted boat-layout rebuild plus a render-path correction. This is more complete than a cosmetic opening, but it avoids replacing the boat and its established style.

### 1. A Real Boarding Portal

The starboard hull wall, gunwale, and top rail will be split into forward and aft sections, leaving a wide opening centered on the existing gangway. Posts will be removed from the opening.

The entrance will include:

- a supported gangway that visibly lands on the deck;
- a shallow threshold or short step that communicates the height transition;
- short handrails on both sides of the approach;
- an open hinged safety gate or secured rope section;
- warm plank and trim accents, plus small boarding lights or a compact `BOARD` marker.

The opening must be wide enough for an avatar capsule with visible clearance, rather than merely appearing open from one camera angle.

### 2. More Usable Deck Space

The boat hull may grow modestly in beam if necessary, while retaining its current proportions. The orange cabin/engine cover will be reduced and shifted so it no longer dominates the center and starboard passage.

The final deck layout will provide:

- a clear circulation lane from the boarding gate into the main deck;
- a continuous route around the cabin where practical;
- passing space for two avatars in key work areas;
- unobstructed access to fishing positions and mission equipment;
- safe spacing between the mast, cabin, rail, and interactive props.

Decorative props will be grouped near edges or work stations rather than scattered through the main path. The visual density remains, but the playable floor reads clearly.

### 3. Collision Matching the Artwork

The physical boundaries will be rebuilt to match the revised geometry:

- the boarding opening and gangway remain traversable;
- the rest of the hull and rails remain solid;
- the cabin, mast, work stations, and major equipment block the player at their visible edges;
- no invisible collider closes the new entrance;
- no gap permits walking into the ocean or through the hull.

The spawn and task positions on the boat will be checked against the new circulation lanes.

### 4. Movement-Derived Crew Animation

Each rendered crew member will keep a small runtime motion record containing its previous position, smoothed speed, facing direction, and walk-cycle phase. Movement state will be determined from actual displacement over time, not only from input fields.

This allows local players, remote players, and bots to share the same animation rules. When speed crosses a small threshold:

- hips and torso receive restrained vertical movement;
- legs alternate from the hips;
- knees and feet follow the stride rather than remaining rigid;
- arms counter-swing naturally;
- the cycle slows and settles cleanly when the avatar stops.

Interaction-specific poses, such as fishing or carrying an item, may override the relevant arms while the lower body continues to respond to movement.

### 5. Smooth Visual Updates

Gameplay state publication and visual animation will be separated.

For local play, the scene will receive or reference the current authoritative world every animation frame. React state, sound triggers, analytics, and normal snapshot publication can remain at their existing lower cadence.

For snapshot-driven players and boat transforms, the scene will retain previous and target transforms and interpolate between them during `requestAnimationFrame`. Character pose evaluation will also occur during this visual frame loop.

This fixes the visible 24 Hz stepping without raising network traffic or repeatedly rendering the interface at 60+ Hz. Per-frame work must reuse vectors and motion records to avoid allocation spikes.

### 6. Performance Safeguards

The primary performance fix is frame interpolation and removal of visual dependence on the 42 ms publication interval. Graphics quality will not be reduced preemptively.

If profiling still shows sustained slow frames, the renderer can lower its pixel-ratio cap gradually on slower devices while preserving geometry and gameplay. Any adaptive scaling must use hysteresis so resolution does not oscillate during play.

## Rejected Alternatives

### Cosmetic gate only

Removing a rail segment would make the entrance visible but would not create sufficient deck space, correct collisions, animate bots, or resolve stepped movement.

### Publish the full game snapshot every display frame

This would make local movement appear smoother, but it would also drive React, sound, analytics, and potentially network work far more often than necessary. It treats the symptom rather than separating simulation, presentation, and interface responsibilities.

### Complete boat replacement

A new vessel could solve the layout, but it would introduce unnecessary visual and gameplay risk. The existing boat can be made functional while retaining its identity.

## Validation

Implementation is complete when:

1. A player can identify and enter through the side gate without instruction.
2. The dock-to-deck route is continuous and collision-safe in both directions.
3. Four crew members can occupy and move around the working deck without the cabin creating a dead-end trap.
4. Bots visibly animate their legs and feet whenever their world position changes, even when their input fields are zero.
5. Walk cycles update at visual-frame cadence and settle correctly when movement stops.
6. Local movement no longer advances in obvious roughly 42 ms steps.
7. Desktop and mobile controls, fishing, missions, boat movement, and chaos events continue to work.
8. Automated tests cover the boarding gap, collision boundaries, and movement-derived animation state.
9. Desktop and mobile browser checks verify the entrance, usable deck space, camera clearance, and sustained movement fluidity.

