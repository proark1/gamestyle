# Uphill Delivery

The third Jumbleyard game shares the existing Fredoka/DM Sans typography, sage and cream interface, mustard sofa, hard-hat character models, Three.js rendering, Cannon rigid-body physics, and room database. Its own route and API keep existing games intact.

One to four delivery workers carry a single compound-body sofa up a continuous switchback mountain village. Every hand has a physical spring grip; several workers share the weight. Solo play assists grip strength so the complete route remains playable. Walk into the sofa to push; grab and walk backward to pull; release to set it down. Rotation applies torque instead of teleporting the cargo. Gravity and collisions continue after release.

The route includes swaying rope bridge planks, a narrow alley, a free-hand gate, roaming goats, a gap shorter than the sofa, low-friction stairs, and a customer room. Players can stand on the same sofa collision shapes they see, bounce from the cushions, and land on them safely. There are no automatic checkpoints or cargo resets. A catchment at the actual mountain bottom keeps fallen players and cargo reachable; restarting explicitly begins again at the depot.

The customer door swings outward as a moving collider. Merely reaching the summit does not win: open the door, bring the whole sofa inside, release it, and let it settle. The camera can follow the player, the sofa, or show the route. Keyboard, mouse orbit/zoom, touch movement, and action buttons are available.

Rooms use a separate delivery namespace, hashed membership tokens, four-player capacity, authoritative fixed-step simulation, ordered controls, idempotent actions, optimistic concurrency, and host reassignment. Validate physical support, carrying/releasing, climbing, gates, door impulse, victory bounds, persistence, authorization, and four-client HTTP synchronization, plus the existing suite, typecheck, and production builds.
