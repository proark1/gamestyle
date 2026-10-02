# Last Boat Home validation

The approved survival redesign is implemented as the default campaign in Reel Problems 2. It replaces the delivery objective in the menu; legacy delivery checkpoints and Classic tournament still work.

## Implemented gameplay

- Immediate giant fight with calm/surge timing, steering, rock collisions, and a catch-or-escape outcome.
- Sheltered or storm route choice. The risky route is shorter, has stronger waves, and offers salvage on the right.
- Rowing competes with bracing and repair. Three announced wave encounters can spill cargo, damage the hull, and put a teammate overboard.
- Contextual rescue, cargo salvage, and bailing/patching. The harbour escape requires every present player to be aboard; saving the fish is optional.
- A four-part raft assembled on floating wreckage at the actual sinking position. The countdown continues, essential materials recover safely, and a warning window follows relaunch.
- Four-minute deadline, local completion record, replay, solo deckhand, desktop/touch HUD, giant/tether/rocks/waves/gate visuals, checkpointed route and encounter state.

## Verification

- 95 game tests passed, including ten survival scenarios: normal-input victory, ignored surges, locked route choice, wave consequences, rescue, bracing, afloat rebuilding, deadline, checkpoint restore, and the rowing/bracing trade-off.
- TypeScript, scoped lint and architecture checks passed in the isolated release checkout, which avoids unrelated concurrent edits in the main working tree.
- Actual Chrome keyboard playthrough completed the giant fight, route selection, rowing/bracing voyage and harbour escape with no page errors.
- Actual Chrome keyboard recovery check gathered/carried/attached all four components at floating wreckage and launched a raft.
- Four real Chrome WebRTC clients caught the giant, shared the risky-route decision, and preserved that state through host loss. Held controls reset on restoration.
- Desktop and 390×844 touch-viewport screenshots were inspected. The giant, nearby rocks, mission prompts and action controls remain visible.

These checks establish function, not fun or viral appeal. Human solo/two-player feedback, physical controller testing, and geographically separated online play remain valuable. Balance values are initial tuning. This is one redesigned adventure, not a complete campaign of distinct levels.

Browser evidence is local in `.tmp/reel2-qa/`. The production build result is recorded in the task's completion message. This document does not claim a deployment of the redesign.
