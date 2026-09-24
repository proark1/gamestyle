# Course Correction Character Integration Design

## Goal

Course Correction must use the same visible, playable character language as the other Jumbleyard games. Every player is represented by a full shared avatar that aims, putts, follows the ball, relocates for the next shot, and celebrates. The existing ball and course physics remain authoritative and unchanged.

## Character flow

Each character begins behind their own ball with a putter. While the ball is stopped, the character faces the current aim direction and settles into a putting stance. A `shot` event starts a short backswing, contact, and follow-through animation synchronized to the ball launch.

While the ball rolls, the character stays near the previous lie and watches it. When the ball stops, the character walks toward a new staging point behind the ball. Characters do not collide with balls, walls, obstacles, or each other. Their movement is presentation-only and interpolated locally.

When a ball drops, its owner moves to a safe position beside the cup and celebrates. An assist produces an additional reaction from the assisting character. Chain and Everybody In celebrations use stronger synchronized hero or wave poses without changing simulation timing.

## Visual integration

The implementation reuses `dressedGameAvatar`, `poseWorker`, the shared seat colors, and the equipped wardrobe look for the local player. Remote players and bots use the same canonical avatar with course-crew clothing in their seat colors. Each character receives a proportionate putter, a soft floor shadow, and a restrained player-color marker.

Characters remain readable without hiding the shot corridor. Their staging point is calculated behind the ball along the inverse aim direction, then biased toward the nearest course edge when needed. The cup celebration positions form a small arc that keeps the cup visible.

The camera widens only enough to include the characters at the start and around the cup. Course Correction retains its current palette, lighting, typography, and detailed toy-golf materials; the character layer aligns it with the rest of the game collection rather than introducing a new style.

## Architecture

`character-presentation.ts` contains pure helpers for:

- deriving character state from the authoritative world;
- calculating safe staging and cup celebration positions;
- calculating facing direction and animation phase;
- mapping events to one-shot character reactions.

`characters.ts` owns Three.js character construction, putter attachment, local wardrobe selection, pose application, movement interpolation, and disposal. `scene.ts` passes snapshots and new events to that manager. No character state is added to checkpoints or peer messages.

The visual states are `ready`, `swing`, `watch`, `walk`, and `celebrate`. Swing and celebration transitions are event-driven and deduplicated by event ID. Position and rotation use bounded interpolation so snapshot jitter cannot make a character snap or spin.

## Responsive and accessibility behavior

Desktop renders all character details and floor markers. Mobile keeps all four characters but simplifies markers and caps shadow/detail work. Reduced-motion mode removes bounce, exaggerated follow-through, and celebration movement while preserving clear static poses and character relocation.

## Testing

Pure tests verify staging positions stay within the course, characters remain behind their ball, state changes follow authoritative ball state, and replayed events do not retrigger swings or celebrations. Existing physics and peer tests must remain unchanged and green.

Browser QA covers the lobby, simultaneous opening volley, independent follow-up shots, wall impacts, cup celebration, desktop, 390-pixel mobile width, and reduced motion. Success requires that all four characters are visible, clearly associated with their balls, and appear to perform the golf actions without obstructing aiming.

## Non-goals

- Character bodies do not affect physics or networking.
- This pass does not add character selection, new wardrobe items, emotes, or camera cutscenes.
- It does not change scoring, aiming, shot timing, course geometry, or multiplayer protocol.
