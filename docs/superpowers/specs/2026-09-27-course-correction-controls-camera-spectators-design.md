# Course Correction Controls, Camera, and Spectator Correction

## Goal

Make every follow-up putt fully aimable after the golfer reaches a stopped ball, let players adjust the field view without fighting the shot gesture, correct both spectator-bank orientations and seating, and reduce the golf-ball scale. Preserve the established Backyard Open art direction, authoritative multiplayer simulation, and automatic action framing.

## Interaction model

The course stage classifies each pointer gesture when it begins.

- A one-pointer drag that starts inside a generous screen-space hit zone around the local player's stationary, unholed ball is a shot gesture. Moving the pointer updates angle and power continuously. The authoritative `player.aim` preview, aim guide, and golfer staging position all follow the preview angle before release. Releasing sends the existing `lock` or `shoot` action.
- A one-pointer drag that starts outside that ball hit zone is a camera-orbit gesture. It changes yaw and pitch but never fires a shot.
- Mouse wheel zooms. On touch, a two-finger gesture orbits and pinches to zoom; a single finger near the ball remains the shot gesture.
- `V` and a compact View control cycle Broadcast, Low, and Overview presets. Cycling establishes a new orbit/zoom baseline that can still be fine-tuned.
- Pointer cancellation clears shot and camera gestures without dispatching an action.

The input classifier is pure and independently tested. Transient gesture values remain in refs rather than React state so pointer motion does not rerender the HUD.

## Follow-up aiming and golfer movement

The current simulation already accepts a new angle for every `shoot` action. The presentation layer must expose that freedom before the shot:

- The local preview angle is stored separately from the latest network snapshot.
- When the local ball becomes stationary and playable, the preview starts from the player's authoritative aim.
- Pointer or keyboard aiming changes the preview immediately. The golfer walks around the ball toward the new staging point and turns toward the intended line.
- The preview is reset from authority after a hole change, rematch, local-player change, or accepted shot; it is not overwritten every render by an unchanged snapshot.
- Bots and remote players continue to use snapshot aim values only.

This changes presentation and input only. The shot action payload, host authority, replay safety, scoring, and room protocol remain unchanged.

## Camera presentation

The automatic modes remain `aim`, `follow`, and `celebrate`, but they produce a base target rather than an immutable camera pose. A bounded user view offset is layered on top:

- yaw orbits around the current base look target;
- pitch is clamped so the camera cannot cross the ground or become a near-flat horizon;
- zoom is clamped to keep the whole active play area readable;
- follow and celebration may move the look target, but preserve the user's chosen orbit and zoom;
- once the ball stops, the camera returns to the user's last aim view instead of a single forced direction.

Broadcast is the existing elevated three-quarter composition. Low brings the camera closer to golfer height for lining up banks. Overview raises and widens the view for understanding moved walls and bridges. Reduced-motion mode keeps immediate camera transitions while still allowing manual view changes.

## Ball scale and physics

Use one exported ball-radius constant for simulation, scene meshes, shadows, lie recovery, obstacle contact, and ball-to-ball collision. Reduce its radius from `0.24` to `0.12`, halving both its rendered diameter and physical collision size. Cup capture and course clearances are rechecked with the new radius so the smaller ball remains easy to sink and cannot rest invisibly inside barriers.

## Benches and spectators

Bench construction receives an explicit side-facing transform. Left-side benches rotate to face inward toward the course; right-side benches retain their inward orientation. Seat anchors are generated from the same bench transform so furniture and people cannot disagree.

Spectators are divided into seated and standing anchors:

- seated spectators occupy the bench seat, face the course, lower their hips, bend their legs, and keep feet below the seat edge;
- some fans sit toward a bench end or slightly behind another seated fan to avoid a rigid row;
- standing reaction fans remain beside or behind benches, never inside the playing boundary;
- the existing mobile and reduced-motion detail budgets remain authoritative.

## UI and accessibility

Add a small View button using the shared toolbar/card language. Its accessible label includes the current preset. Help copy documents drag-to-aim, drag-away-to-orbit, wheel/pinch zoom, and `V` preset cycling. Camera manipulation remains available during ball movement; shooting remains disabled until the local ball is playable.

## Testing and acceptance

Pure tests cover gesture classification, orbit clamps, preset cycling, user-offset preservation across automatic camera modes, preview-aim lifecycle, and the shared smaller ball radius. Existing Course Correction simulation, peer, presentation, character, and spectator tests remain green.

Browser QA covers desktop mouse, keyboard, touch-sized mobile viewport, one-finger aiming, two-finger camera input where automation permits, view cycling, follow-up shots from changed angles, bench orientation, seated fans, and visual ball scale. Typecheck, focused lint, formatting, registry tests, and the Railway production build must pass before any deployment.

## Out of scope

- No scoring, course-layout, bot-strategy, or multiplayer-protocol redesign.
- No free walking of the golfer away from the ball; the golfer moves around the ball as a readable representation of the selected shot angle.
- No replacement of the established Backyard Open visual style or shared Jumbleyard HUD.
