# Giant body and movement revision — 2026-09-06

The requested change makes the existing giant read as a large human, especially when standing. Preserve the cottage, sleeping climbing route, warning, treasure and 25-second escape. Rebuild the procedural character in the existing Three.js renderer rather than adding an asset dependency or a new pursuit mechanic.

Replace rigid lower-body rotation with two fixed-length leg chains and individual ankles. Derive every joint from the shared escape clock. Stage the rise as a short anticipation, sit-up, staggered foot tucks, forward weight transfer, leg extension and a small settling motion. Both feet finish planting before the upward push and remain locked to the mattress. Smooth the render clock, then solve the rig, so rendering cannot independently stretch the bones or drag planted feet.

Use articulated shoulders, elbows and wrists for both arms. Hands move from their resting positions to support the sit-up, release during the rise, then make slow asymmetric reaching gestures. Retain the sleeping left-arm crossing. Once awake, both arms cease being climbing platforms, avoiding the false horizontal shelves produced by a box surrounding a bent elbow. Derive separate awake thigh, shin and foot bounds from the joint positions; retain the torso's shared transform and existing sleeping collision proxies.

Give the giant tapered limbs, connected smooth clothing, a pelvis, flatter soles, insteps, graded toes and a smaller head. Keep his existing face, beard, nightcap and palette. The result remains a stylized procedural human in the game's visual style.

Validate fixed bone lengths, continuous joints across the full escape, planted soles and matching rendered ankles, reconnect/restart behavior and degenerate inverse-kinematics targets. Preserve the existing route, treasure, escape and multiplayer regression checks. Use reproducible offline geometry renders to inspect key poses; these are not browser screenshots and do not validate WebGL lighting or real-device animation.
