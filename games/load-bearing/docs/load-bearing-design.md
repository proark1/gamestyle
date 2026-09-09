# Load Bearing

Approved direction: a one-to-four player demolition game in Jumbleyard. A condemned two-storey house must come down inside three minutes. The client's upright piano sits on the upper floor and has to survive. The collection has two building games and no destruction; this is their counterpart.

The tension is that the two goals fight each other. Every support removed brings the house closer to the ground and the piano closer to a fall it cannot take. Cutting a column under the piano bay drops the upper slab immediately.

## Structure and collapse

The house is a graph of rigid parts: footings, columns, beams, walls, the upper slab, and roof panels. Support is computed from geometry rather than authored, so editing the house cannot desynchronise the graph. A part rests on another when their footprints overlap and the lower part's top meets the upper part's underside within a small tolerance.

Parts connected to the ground through that graph stay static and do not drift or jitter. When a part is destroyed the graph is recomputed by flood fill from the footings; every part that lost its path to the ground becomes a dynamic cannon-es body in the same tick and falls under gravity. Static parts never enter the solver, so a settled house costs nothing and a collapse is the only thing being simulated.

Falling parts damage what they land on. The piano has integrity and takes damage scaled by impact speed and the mass of what hit it. Players caught underneath are knocked down and revived by a teammate.

## Play

- Sledgehammer with E. Three hits destroy a wall panel, five a column. Each hit is telegraphed by cracks so the crew can see what is about to give.
- The wrecking ball is shared, taken with C, and reuses the existing crane controls. It destroys any part on contact and carries far more momentum than a hammer.
- Q marks a part with spray paint so the crew can agree on a plan before swinging.
- F helps a downed teammate back up. G calls the crew over.
- Structural stress is visible: a part carrying load that has lost neighbours creaks and shows strain before it goes.

## Winning and losing

The crew wins when no part remains above the ground threshold and the piano's integrity is above zero. The crew loses when the piano is destroyed, or when the three minutes end with the house still standing. Solo practice runs the same rules without a database and without the timer.

## Boundaries

Rounds are three minutes. Four players maximum, matching the rest of the collection. Peer-hosted simulation with the shared engine adapter, direct WebRTC voice, and host recovery. This is rigid-body demolition, not deformable material, fracture or dust simulation: parts are destroyed whole rather than broken into fragments.

Visual direction: the collection's flat-shaded rounded geometry and warm sunlight. Dusty brick (#b06a4e), bare concrete (#cfc6b8), exposed timber (#c49a63), hi-vis orange (#f58b39), mustard machinery (#eaa43c), cream paper controls. Fredoka display and DM Sans interface type.
