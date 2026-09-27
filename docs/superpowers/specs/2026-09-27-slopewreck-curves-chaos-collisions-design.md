# Slopewreck Curves, Chaos, and Solid Collisions

## Goal

Make Slopewreck feel like an energetic snowboard race instead of a straight descent with late obstacles. The course must bend through readable banked turns, the four riders must jostle and react to moving hazards, snowboards must have a convincing rounded silhouette, and solid objects must physically stop or deflect riders rather than allow them to pass through.

The result remains an accessible arcade game. Chaos must create choices and funny reversals without turning the race into unreadable noise or introducing unstable rigid-body behavior.

## Chosen Direction

Use deterministic course-space physics rather than visual-only bends or a general-purpose rigid-body engine.

- Rider `z` remains distance travelled along the run.
- Rider `x` remains lateral distance from the local course center.
- A shared pure course module converts `(x, z)` into a world position and orientation.
- Rendering, the chase camera, scenery, bots, hazards, boundaries, and collision checks consume the same course definition.
- The host-authoritative simulation continues to advance in fixed bounded steps and serialize plain game state.

This keeps controls responsive and multiplayer behavior predictable. A visual-only bend was rejected because it would make the visible course disagree with steering and collisions. A full physics engine was rejected because it would add weight and nondeterministic edge cases without improving the intended arcade feel.

## Curved Course Model

Add a focused `course.ts` module that owns the authored run geometry. At any distance it returns:

- centerline lateral displacement and downhill height;
- tangent and side vectors in the horizontal plane;
- turn curvature and a bounded bank angle;
- legal half-width;
- a world-space transform for a course-local position.

The course uses broad, continuous S-curves, two tighter banked turns, and short recovery straights. Position, tangent, and bank functions must be continuous at segment boundaries. Curves begin gently near the start, intensify through the middle of the run, and open before the finish so new players can establish control and recover.

Existing gameplay coordinates remain compact and network-friendly. The simulation resolves boundaries in course-local coordinates, while the scene uses the course transform to place riders, trees, edge markers, natural kickers, player-built features, hazards, and the finish structure. The chase camera uses the transformed tangent at the rider and at a forward look point so it looks through bends rather than across the outside snowbank.

## Chaos Rhythm and Hazards

Chaos is structured into course sections. Each section has one dominant threat and at least one safe outer line so the player can read and choose a response.

The initial hazard set is:

- **Rolling snowballs:** cross the racing line on deterministic time-based paths. They are solid circles in course space and cause a wipeout on a direct hit or a strong deflection on a glancing hit.
- **Slalom gates:** form narrow fast lines. Gate poles are solid capsules; clipping one deflects the rider and costs speed.
- **Collapsing snowbanks:** begin as marked soft walls and collapse after the first rider passes their trigger distance. Their state derives from the host simulation and remains the same for every client.
- **Rider contact:** nearby riders receive equal bounded lateral separation and a small speed exchange. Direct rear contact cannot launch either rider or reverse their downhill motion.
- **More built features:** bots attempt tricks more often, placing additional ramps and rails while retaining the existing feature limit and lifetime.

Hazards are authored at fixed course distances and seeded phases. No randomness is sampled per frame. Moving positions are derived from world clock and stable hazard identifiers, making replays and multiplayer snapshots reproducible.

## Collision System

Add a pure collision layer inside the simulation. Every solid obstacle exposes a course-local collider and a response category. The layer performs continuous or swept checks from the rider's previous position to the proposed position so a fast rider cannot tunnel through a narrow obstacle during one tick.

Riders use a compact circular footprint. Static and moving obstacles use circles, capsules, or oriented boxes chosen to match their visible silhouette. Collision resolution follows this order:

1. Find the earliest intersection along the rider sweep.
2. Move the rider to the contact boundary with a small separation margin.
3. Classify impact severity from the approach direction and contact normal.
4. For a glancing impact, remove inward lateral motion, deflect the rider away from the surface, and apply a moderate speed loss.
5. For a direct impact, trigger the existing wipeout state and apply a strong speed loss.
6. Continue only the safe remainder of movement, capped to one additional resolution pass to avoid jitter loops.

The response is arcade-authored, not a general rigid-body solver. Downhill speed remains non-negative, lateral impulses are bounded, and all resolved positions are clamped inside the course boundary.

Natural and player-built ramps remain traversable through a defined entry face. Crossing that face while aligned triggers the existing jump. Rails reward a centered approach; hitting their sides or supports is a solid collision. Trees, edge posts, gates, snowbanks, finish supports, and moving snowballs are always solid. Airborne riders ignore low ground obstacles only when their height clears the obstacle's authored clearance.

## Snowboard and Rider Polish

Replace the current box-composed deck with a custom low-poly snowboard mesh built from a symmetric outline:

- semicircular rounded nose and tail with no square corners;
- wider contact points and a subtle concave sidecut at the waist;
- visible thickness and a contrasting continuous edge;
- raised nose and tail created in the mesh profile rather than separate rectangular blocks;
- a dark base and seat-colored topsheet graphic;
- two angled bindings with base plates, heel cups, ankle straps, and toe straps aligned to shared-avatar boot anchors.

The board remains a child of the existing shared Nico rider root. It does not replace the shared avatar, wardrobe, face, hair, or rig. Geometry is rendering-only and never becomes a network payload.

The snowboard pose becomes more athletic and responsive. Grounded riders keep a wider flexed stance; torso and shoulders counter-rotate through carves; tuck pulls the arms in; impacts compress and twist the body briefly; wipeouts open the limbs clearly. The board rolls into turns according to steering and course bank, but all presentation angles are bounded and smoothed.

## Camera and Presentation

The chase camera follows the course transform rather than the global axis. Its target samples a point ahead along the centerline and adds a small bounded lead toward steering input. The camera retains the earlier long forward visibility while rotating early enough to reveal the exit of upcoming bends.

Course banking produces only a gentle horizon roll. Camera roll and position smoothing are frame-rate independent, and the local rider remains in the lower third of the frame. Obstacle silhouettes receive contrasting caps, flags, and snow shadows. Particle work is limited to short carve trails, powder spray, and impact bursts so it communicates speed and contact without hiding the racing line.

Impact feedback is proportional:

- glancing obstacles create a skid, compact snow burst, lateral deflection, and small camera nudge;
- direct hits create a larger burst, wipeout pose, strong slowdown, and firmer camera impulse;
- rider contact creates a smaller shoulder impact and clearly separated paths;
- close hazard passes award a compact style bonus through the existing score presentation, without adding a new HUD panel.

## Components and Data Flow

1. `course.ts` maps deterministic course-local coordinates to world transforms.
2. `hazards.ts` declares stable hazard definitions and evaluates their state at a given race time.
3. The simulation gathers course boundaries, hazard colliders, feature colliders, and rider colliders for the current fixed step.
4. The collision layer sweeps and resolves proposed rider movement, then emits existing or narrowly extended race events for impacts and near misses.
5. Snapshots carry only state that cannot be derived deterministically, such as collapsed snowbank identifiers and awarded style changes.
6. The scene places all visible objects using the same course and hazard helpers and maps collision events to short-lived effects.
7. The camera consumes the local rider and course samples without mutating simulation state.

Modules remain intentionally bounded: the course module owns geometry, the hazard module owns authored hazard behavior, collision helpers own intersection and response, the simulation owns authoritative state changes, and the scene owns visual interpolation and effects.

## Failure Handling and Compatibility

- Invalid or non-finite movement inputs remain sanitized by the existing input boundary.
- Course helpers clamp samples before the start and beyond the finish to valid endpoint tangents.
- Collision helpers return the proposed position unchanged for malformed or disabled colliders rather than producing `NaN` state.
- Hazard state uses stable identifiers and bounded trigonometric motion; late snapshots cannot generate random phase changes.
- A rider found inside geometry after a network correction is moved to the nearest valid separation point before the next movement step.
- Existing multiplayer actions and shared wardrobe behavior remain compatible.
- Feature and effect counts stay capped, scenery remains batched where static, and particles use pooled or strictly time-limited objects.

## Verification

Automated tests cover:

- continuous course position, tangent, bank, width, and world transforms at every segment boundary;
- course-local to world-space placement for riders, scenery, features, hazards, and finish elements;
- legal curved-course boundaries and recovery from invalid overlap;
- swept collision against thin poles and moving snowballs at maximum speed;
- glancing deflection versus direct-impact wipeout classification;
- bounded rider-to-rider separation and speed exchange;
- valid ramp entry, rail reward, and solid side/support collisions;
- deterministic hazard positions and snowbank collapse state;
- bots navigating curves and completing the race;
- rounded snowboard outline, sidecut, thickness, two bindings, and boot alignment;
- camera framing through left and right bends at desktop and mobile aspect ratios;
- unchanged multiplayer snapshot, wardrobe, analytics, and full repository suites.

Browser verification covers desktop and mobile race starts, visible course curvature, readable upcoming hazards, four riders separating during contact, no pass-through at trees/gates/rails/snowballs, usable ramps, convincing rounded boards, stable camera motion, and no console or request failures.

## Acceptance Criteria

- The run visibly snakes left and right and includes banked turns that affect rider and camera orientation.
- The racing line and every collision match the visible curved course.
- Solid objects stop or deflect riders; maximum-speed riders cannot pass through them.
- Side impacts cause a glancing deflection, while direct impacts cause a wipeout and stronger speed loss.
- Riders physically separate and jostle without overlapping, reversing, or launching unrealistically.
- Snowballs, gates, collapsing snowbanks, additional built features, and rider contact create frequent but readable chaos.
- Every course section retains a viable safe line.
- Snowboards have rounded nose and tail geometry, visible sidecut, thickness, edges, and detailed bindings rather than four square corners.
- The shared Jumbleyard Nico character and wardrobe identity remain intact.
- Desktop and mobile retain early obstacle visibility, smooth performance, deterministic multiplayer behavior, and clean console output.
