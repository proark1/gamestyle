# Boxing punch polish

Approved refinement: keep the existing game and surroundings, remove the damage-driven left/right sway, make punch trajectories visibly distinct, and shrink the gloves.

Implementation: no balance-based torso or model roll; smaller gloves with articulated arms; straight jab and cross, rising uppercut as the third timed tap, and a charged sweeping hook. The free hand remains in guard. Punch animation contact uses the same timing profiles as damage. Uppercuts have shorter reach and cost more stamina than straight punches. Misses, interruptions, depleted stamina, and expired combo windows reset the sequence. English and German control hints describe the combination. Boxing rules revision is 3 so old peers cannot silently simulate different combat.

Validation: 80 targeted tests passed, including animation trajectories, no damage sway, combo damage and reset behavior, uppercut reach, NPC tag handoffs, and shared peer adapters/recovery. Type checking, lint, architecture boundaries, and production build passed. Browser practice rendered articulated guards and smaller gloves without console errors.

Release: commit `46389f9`, isolated from unrelated workspace changes. Railway deployment `0b865139-df76-4114-80b9-27b4ad2a5942`.

Deployment succeeded. The public game's help shows the new uppercut sequence with no browser console errors. Four real WebRTC clients passed direct generated audio, abrupt recovery, preserved round state, surviving voice links, and join-order handover (1,216 ms). Live URL: https://www.jumbleyard.com/on-the-ropes.
