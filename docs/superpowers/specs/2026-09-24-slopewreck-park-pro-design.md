# Slopewreck Park Pro and Forward Visibility

## Goal

Polish Slopewreck without separating it from the rest of Jumbleyard. Riders must remain the shared Nico character used by the other games, visibly stand on their snowboard, wear a convincing winter-sport kit, and read clearly from the chase camera. Course objects must enter the frame early enough for deliberate steering instead of appearing only when the rider is almost on top of them.

This work changes presentation and camera composition. It does not change race rules, collision thresholds, feature ownership, multiplayer messages, or deterministic simulation state.

## Chosen Direction

Use the shared-first Park Pro direction approved in the visual companion.

- Keep `dressedGameAvatar`, the shared Nico rig, equipped wardrobe look, seat palette, renderer helpers, cleanup, and multiplayer simulation.
- Add a Slopewreck-specific outerwear treatment, snowboard, bindings, and riding pose around that shared avatar.
- Extend the existing pure camera framing function so the course is visible roughly 80–120 metres ahead at racing speed.
- Improve distant presentation with later fog and stronger feature silhouettes rather than adding a minimap or duplicating objects.

Alternatives were rejected deliberately. A custom snowboard character would break collection consistency and duplicate avatar infrastructure. A global winter wardrobe would broaden the task beyond one game and mix permanent cosmetics with equipment that exists only while racing.

## Rider Model

`riderModel` continues to create the character through `dressedGameAvatar`. The returned shared body remains the source of the face, hair, proportions, limb rig, local equipped look, and player colour.

Slopewreck adds a small equipment layer:

- a coral or seat-coloured technical shell with a high collar and cuff details;
- a deep teal/navy snow bib and boots supplied through the existing game outfit parameters;
- dark mittens attached to the shared hand grips;
- a thin goggle band and amber visor when the face slot is unused;
- a shaped low-poly snowboard with a contrasting teal edge and raised nose and tail;
- two visible bindings aligned with the shared avatar's boots.

The sport layer must not replace a user's face, hair, costume, hat, or face accessory. Game-supplied goggles are omitted when `worn.face` is true. The jacket silhouette and bindings remain visible even when compatible wardrobe items recolour or augment the base avatar.

The board and equipment are rendering-only children of the rider root. They do not alter the rider collision body or serialized state.

## Snowboard Stance and Motion

The shared body rotates sideways over the board so the left and right legs become the rear and front stance. The body is raised by the board thickness, placing the boot soles on the deck instead of intersecting or floating above it. Binding positions derive from the transformed boot anchors rather than arbitrary board coordinates.

`poseRider` keeps using the shared rig but applies snowboard-specific targets after clearing the generic pose:

- grounded: knees flexed, torso slightly forward, arms spread for balance;
- tuck: deeper torso lean with arms closer to the body;
- steering: hips and shoulders counter-rotate subtly while the entire rider leans into the carve;
- airborne: legs extend slightly and arms open without changing the existing trick spin;
- landing: knees compress briefly based on time since ground contact;
- wipeout: the existing root roll remains, with limbs opened enough to read as a fall.

Pose values are bounded and derived only from existing rider state. No extra network fields are required.

## Forward Course Visibility

The camera remains a pure speed-aware frame calculation followed by frame-rate-independent smoothing in the scene.

The revised composition:

- moves the camera slightly farther behind while keeping the rider large enough to read;
- increases the downhill target from the current 34–40 metres to 70–88 metres;
- widens field of view gently with speed without producing a sudden zoom;
- keeps the local rider in the lower quarter to lower third of the frame;
- keeps a feature 100 metres ahead inside the view frustum at normal and tuck speeds on desktop and mobile aspect ratios.

Fog begins beyond the useful decision range and fades gradually. The far plane remains comfortably beyond the fog end. Natural kickers, ramps, and rails receive higher-value edge or cap materials so they remain recognizable when small. Geometry and collision dimensions stay unchanged.

The scene already creates natural kickers for the whole course and creates player-built features as soon as they arrive in a snapshot. Therefore this polish does not add speculative spawning or client-only gameplay objects. The perceived pop-in is solved through line of sight, projection, fog, and distant contrast.

## Boundaries and Data Flow

1. The simulation advances the existing `Rider` and `Feature` state.
2. `SlopeScene.render` stores the latest snapshot exactly as before.
3. `riderModel` builds a shared avatar plus local snowboard equipment.
4. `poseRider` maps existing rider state to the shared rig and equipment transform.
5. `slopeCameraFrame` maps existing rider position, height, and speed to a bounded frame.
6. The scene smooths camera position and lens values, updates visible models, and renders.

The new model and camera logic remain independent: visual equipment never influences physics, and camera framing never mutates world state.

## Failure Handling and Compatibility

- If an optional rig anchor or wardrobe slot is unavailable, omit that accessory and keep the shared avatar playable.
- Mobile keeps the same model detail; existing adaptive rendering and scenery batching remain responsible for performance.
- Camera values are clamped at extreme speed and near the finish so malformed or late snapshots cannot create an invalid projection.
- All additions are disposed through the rider root and existing `disposeObject` path.
- No new assets, network requests, or remote dependencies are introduced.

## Verification

Automated checks cover:

- board and binding construction, including two bindings and boots positioned at deck height;
- shared-avatar preservation and wardrobe-safe goggle behavior;
- bounded grounded, tuck, airborne, and steering pose targets;
- camera bounds at slow, normal, tuck, and extreme speeds;
- projection of the rider plus course points 80, 100, and 120 metres ahead at desktop and mobile aspect ratios;
- unchanged simulation and multiplayer suites.

Browser verification covers desktop and mobile race starts, no console or request failures, the rider visibly standing in the bindings, readable winter clothing, smooth chase motion, and at least two upcoming course decisions visible with useful reaction time. The production release must also pass typecheck, lint, the focused Slopewreck tests, the full test suite, the Railway build, and a public live smoke test.

## Acceptance Criteria

- The rider is recognizably the shared Jumbleyard character.
- Both boots visibly meet the snowboard at bindings in lobby and racing views.
- The Park Pro outfit reads as snowboard clothing without hiding the player's identity.
- The rider has a sideways, flexed snowboard stance rather than an upright standing pose.
- Natural and player-built course objects enter view materially earlier, with a 100-metre reference point visible at racing speed.
- Camera motion remains smooth, the rider remains readable, and no gameplay or multiplayer behavior changes.
