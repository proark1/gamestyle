# Reel Problems: shared catches and rough water

Scope follows the user's three requested changes: allow multiple people to pull the same fish, make steep decks cause real falls, and introduce wind, rain, thunder and sea creatures. Extend the existing toy lake, controls, equipment and multiplayer architecture.

## Shared catches

Each angler's line identifies its own target. Derive a fish's attached anglers from those lines instead of keeping an exclusive owner on the fish. Every reeling angler contributes stamina depletion and an independent physical line force. A tangled line contributes less effort. The fish fights once against the attached crew's average position, so adding a helper does not multiply the fish's own strength.

Clicking an occupied fish joins the catch; Space prioritizes nearby large fish already being fought. Converging lines attached to that same fish do not tangle with each other. Cutting, snapping, falling or disconnecting only releases the affected angler. Landing increments the team score and haul once, credits all attached anglers, clears their lines together and starts one respawn timer. The HUD shows attached and actively reeling anglers.

## Falling

Use accumulated downhill sliding velocity for both roll and pitch. Rain reduces grip; bracing increases grip and damping. At significant tilt, allow movement through the rim margin instead of clamping it away each frame. Normal rails still hold players on level water, while sufficiently extreme tilts can overcome bracing. Falling converts the tilted deck position to lake coordinates and clears only the swimmer's line. Animate the transition to water. Boarding resets slide velocity and grants 1.8 seconds of protection; existing swimming, F rescue and twelve-second safety rope continue working.

## Weather and visitors

The authoritative simulation schedules calm water, strong wind, rain and thunderstorms with varying durations and wind direction using checkpointed randomness. Gusts push and rock the boat; rain makes the deck slippery. Thunder produces a visible lightning strike, an audible rumble and a wave impulse. Transitions ramp in, with calm spells for recovery.

One shark periodically approaches and circles the boat, bumping the hull with a cooldown and an arrival warning. Two glowing jellyfish periodically drift nearby; hooks entering their tentacles tangle and can be freed with R or cut with Q. Visitors despawn and return after a rest. Their position, lifetime and cooldowns survive host handover.

Extend the existing Three.js scene with fixed rain and wind buffers, darker water and sky, a short lightning fade, and low-poly shark and jellyfish models. Reduced-motion users do not receive lightning flashes. New event sounds work immediately through synthesized fallbacks and can later be replaced by workshop clips. A compact weather and wildlife display and help text explain the new effects.

## Compatibility and validation

No database or transport changes. Existing player lines migrate without needing the obsolete single-owner fish field. Old checkpoints receive default weather, visitors and slide velocities; held controls still clear after host recovery.

Test joining and landing one fish with two to four lines, added force and stamina depletion, isolated line loss, every deck edge, bracing limits, rain grip, rescue grace, deterministic tournament events, shark impacts, jellyfish tangles and old/new checkpoint restoration. Exercise shared catches and host loss through four real WebRTC clients. Run game checks, repository tests, type checking and production builds. Keep unrelated existing workspace edits intact. This change request does not include publishing an existing deployment.
