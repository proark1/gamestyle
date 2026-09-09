# Four Brain Cells

Four players. One functioning adult. A shared robot must serve three cooked pancakes and a full cup of coffee within six minutes.

The new route is `/four-brain-cells`, with a card on the Jumbleyard collection and a matching start screen. Its cream, teal, coral, mustard and lavender miniature kitchen uses the collection's Fredoka/DM Sans typography, shared Three.js primitives, soft shadows, common toolbar and illustrated card treatment. The robot's four colored limbs and the ownership panel make responsibility visible.

## Play

- Each network player owns exactly one limb. A player can claim a free limb with 1–4 or its button. Occupied limbs cannot be stolen. A disconnected hand keeps its grip, allowing the crew to take over without losing food.
- In the lobby and between rounds, the host can add an NPC to an individual empty player slot, fill all remaining slots, and remove NPCs to admit friends. Seat colors remain stable when a human changes limbs. NPCs own one available limb each and never count as network/voice participants or host candidates.
- NPC hands reach for actual cookware, grab it, cook both pancake sides, serve and pour using ordinary controls. NPC feet follow a human foot's direction; if both feet are NPCs, they carry the robot between stations, prioritizing unfinished human-hand work. They remain subject to the same reach limits, spills, collisions and falls.
- WASD/arrows move the selected limb. Arms reach horizontally; R/F raise/lower, E grabs/releases, Space operates the held utensil, Shift moves carefully, and Q centers the limb. Feet take steps with WASD and kick with Space. An empty partner foot follows for smaller crews.
- Legs push the same damped body. Alternating directions and timing keeps it upright; conflicting input builds wobble and causes tumbles. Spills reduce floor friction. Tables respond to body collisions and kicks.
- Hold the pan over the hob, use Space for batter, cook three seconds, flip, and cook the second side for three seconds. Serve from the pan over the plate. An ignored first side burns after twelve seconds; new batter is always available. Served pancakes remain safe.
- The coffee pot starts full. Hold Space over the cup to pour or at the brewer to refill. Pouring elsewhere wastes coffee and creates a spill. Table kicks displace the cup and spill part of its contents.
- Reaching above shoulder height into the ceiling fan throws held cookware. The robot stands up after a tumble. Utensils dropped on the floor return to their stations after five seconds; counter/table landings remain retrievable.
- Solo / NPCs opens a local lobby and runs the identical simulation without a database. Players can add NPC helpers or switch between free limbs to transport and serve the complete order themselves. Touch devices use the shared joystick and game-specific action buttons. V/View changes camera distance.

## Boundaries

`types.ts` owns serializable state, `simulation.ts` owns rules and fixed steps, `peer.ts` injects the game into the shared authoritative peer engine, `models.ts` builds the kitchen and robot, `scene.ts` owns input/rendering/disposal, and `Game.tsx` owns the menu, lobby and HUD. Rendering is lazy loaded. The HUD receives snapshots at approximately ten updates per second; rendering and held controls use refs.

Rooms use the `four-brain-cells` peer namespace with existing membership authorization, input ordering, idempotent actions, checkpoints and host succession. NPC management uses the shared coordinator's host-only roster operation, combined human/NPC capacity, request receipts and revision fences. NPC inputs are computed only by the authoritative game simulation; clients cannot impersonate them. Reconciliation releases departed humans before assigning their limbs to NPCs, and checkpoints preserve their grips and progress. No new schema or transport was introduced. Shared voice uses the same mesh. Eleven immediate synthesized cues work without generated recordings; `/four-brain-cells/admin` manages the optional recorded versions through the existing audio workshop. Paid generation was not run.

## Scope and verification

This is one complete breakfast challenge with replay, solo practice and one to four network players. It does not include a later assignment campaign, matchmaking, local split keyboard multiplayer, or a video recorder. Validation covers the complete solo input route, cooking/spill/fan/tumble rules, ownership and recovery, four local WebRTC clients and transport of voice. Internet latency and physical phone play require a separate human playtest.
