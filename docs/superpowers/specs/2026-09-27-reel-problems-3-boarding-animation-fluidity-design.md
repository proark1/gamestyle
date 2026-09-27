# Reel Problems 3: Boarding, Deck Space, Animation, and Fluidity Design

**Date:** 2026-09-27  
**Status:** Approved design  
**Scope:** Reel Problems 3 boat, crew movement, bot behavior, and catch presentation

## Problem

The boat currently has eight connected usability problems:

1. The dock gangway meets an unbroken hull wall and rail, so there is no visible or believable boarding entrance.
2. The oversized orange cabin cover and nearby equipment leave too little navigable deck space, particularly along the starboard side.
3. Crew walk animation is inferred from input. Bots move by changing their world position directly, so their legs and feet remain static while they travel.
4. The local simulation renders at the display refresh rate, but scene transforms and character poses are refreshed from a roughly 24 Hz published snapshot. Walking therefore looks stepped even when the renderer itself is maintaining a higher frame rate.
5. Avatars cannot perform a physical jump, which makes the rebuilt deck and its small height changes feel restrictive.
6. Bots complete tasks with uniform, near-perfect timing. They can also reconsider targets too often and visibly walk back and forth when no useful action is available.
7. Fishing lines are rendered as straight two-point segments, so casts, slack, tension, and fish pulls lack weight.
8. A landed catch appears directly on the deck. The fish does not visibly clear the rail, react on landing, or complete a believable journey into cold storage.

## Goals

- Make the route from dock to deck immediately legible.
- Give four players enough room to board, circulate, pass, fish, and handle chaos events without becoming trapped by scenery.
- Keep the current warm, chunky Reel Problems 3 art direction.
- Animate every moving avatar, including bots, with convincing leg, foot, arm, and body motion.
- Make local movement visually fluid without increasing React, audio, analytics, or network work to the display frame rate.
- Preserve solid collision around the rest of the hull and equipment.
- Retain acceptable performance on mobile hardware.
- Let players jump naturally on the boat without using jumping to bypass the outer rail or leave the playable deck accidentally.
- Make bots useful but recognizably imperfect, deliberate crew members.
- Make the complete fishing result readable: line behavior, fish landing, deck movement, pickup, carrying, and storage.

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

### 7. Physical Avatar Jumping

The player controller will gain vertical position and velocity, gravity, grounded detection, and a short jump impulse. Jumping is available while moving around the dock and boat, including while the boat is underway.

The jump remains deliberately modest: it clears the gangway threshold and small deck obstacles, but the outer rail keeps enough effective height to prevent an ordinary jump from becoming an accidental overboard shortcut. Landing returns cleanly to the local surface height and drives a brief compression/recovery pose rather than snapping the avatar to the floor.

`Space` becomes Jump. Brace moves to `B` on keyboard. Touch controls expose separate Jump and Brace actions so neither behavior is hidden on mobile. Jump requests are edge-triggered, preventing a held button from repeatedly jumping on every landing.

Remote players and bots replicate or derive vertical movement consistently. Jump height and vertical velocity are presentation and gameplay state, not a camera-only effect, so collision and third-person animation agree.

### 8. Human-Paced Bots

Bots remain competent enough to finish a round without human players, but they will no longer act with identical speed or certainty. Each bot receives deterministic personality parameters derived from the seeded round, including reaction delay, preferred walking pace, task confidence, reel rhythm, and a small accuracy range. The seed keeps tests and multiplayer simulation reproducible.

Bot decisions use a small task lifecycle:

1. notice a need after a short reaction delay;
2. select and commit to a useful task for a minimum period;
3. travel through a small set of safe deck approach points;
4. perform the action for a believable duration;
5. pause briefly, look toward the result, then choose again.

Task commitment prevents rapid target switching. Progress monitoring detects a bot that is blocked or has made no meaningful positional progress. It then tries another approach point or yields the task after a cooldown. When no task is useful, the bot chooses a nearby idle/work position, faces relevant activity, and waits; it does not shuttle between targets merely to appear busy.

Imperfection is controlled rather than destructive. Bots may reel less efficiently, hesitate, take a longer route, or need a second attempt, but they do not deliberately sabotage essential equipment or make a solo round unwinnable.

### 9. Fishing-Line Presentation

Each line will be a reusable segmented curve whose first point follows the visible rod tip rather than the avatar center. Its shape responds to state:

- casting produces a forward arc;
- waiting creates a small gravity sag and a clear water-contact point;
- biting adds a localized twitch at the rod and surface;
- hooked lines straighten as tension rises, retain some natural curve when slack, and vibrate subtly during a strong pull;
- high tension changes the line color without turning the entire effect into a flat warning beam.

The curve is updated in place to avoid allocating and disposing geometry every snapshot. Its interpolation shares the visual-frame loop used by avatars and boat transforms.

### 10. Catch Landing and Storage Loop

Landing a fish becomes a short stateful sequence rather than an instant item spawn:

1. once stamina, distance, and any net requirement are satisfied, the hooked fish rises to the surface beside the correct rail;
2. it follows a visible curved arc over the rail toward a clear landing zone on deck;
3. it contacts the deck, bounces once, and settles into a restrained flop animation;
4. it remains a loose physical catch that can slide slightly during boat chaos;
5. a human or bot picks it up, carries it to the ice hold, and explicitly places it inside;
6. only placement in the ice hold secures and scores the catch.

The angler's line follows the fish through the landing arc and then releases. Large species still require a teammate and landing net; the helper animation leads the fish over the rail rather than allowing it to teleport.

Bots notice landed fish after a human-scaled delay, reserve one catch to prevent several bots chasing the same target, navigate to a clear pickup point, and spend visible time lifting and storing it. If a human reaches the catch first, the bot releases the reservation and chooses another useful task.

## Rejected Alternatives

### Cosmetic gate only

Removing a rail segment would make the entrance visible but would not create sufficient deck space, correct collisions, animate bots, or resolve stepped movement.

### Publish the full game snapshot every display frame

This would make local movement appear smoother, but it would also drive React, sound, analytics, and potentially network work far more often than necessary. It treats the symptom rather than separating simulation, presentation, and interface responsibilities.

### Complete boat replacement

A new vessel could solve the layout, but it would introduce unnecessary visual and gameplay risk. The existing boat can be made functional while retaining its identity.

### Scripted jump and catch animations only

Camera-only jumping and a canned fish animation would look acceptable from one viewpoint, but collision, multiplayer state, and item interaction would disagree with the visuals. Vertical motion and catch states must exist in the simulation.

### Full navigation-mesh and rope-physics rebuild

A navigation mesh, utility-AI planner, and dynamically simulated rope could add more depth later, but they are unnecessary for the current deck scale. Safe approach points, deterministic task commitment, and a state-responsive curve provide the required behavior with less runtime and synchronization risk.

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
10. Players can jump over small deck thresholds and land smoothly, while the outer rail still prevents an ordinary jump from leaving the boat.
11. Keyboard and touch controls expose both Jump and Brace without input conflicts.
12. Bots show varied reaction and work timing, commit to tasks, recover from blocked paths, and remain still or observant instead of oscillating when idle.
13. A bot-only seeded round remains reliably completable despite the added hesitation and imperfect execution.
14. Lines originate at rod tips and visibly distinguish casting, slack, biting, hooked, and high-tension states without per-frame geometry churn.
15. A landed fish visibly clears the rail, bounces and flops on deck, remains interactable, and scores only after a player or bot carries it to the ice hold.
