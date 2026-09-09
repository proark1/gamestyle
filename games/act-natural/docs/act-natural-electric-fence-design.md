# Act Natural electric fence

Status: approved by the user and implemented. See `act-natural-electric-fence-validation.md` for checks.

Touching a powered fence shocks a player cow and visibly exposes it to the farmer. Approaching the fence produces an electrical warning sound. Turning off the existing west switch disables further shocks and the warning sound immediately.

## Proposed behavior

- Detect actual fence contact at the existing movement boundary on all four sides, including corners. Approaching the power switch or using an objective from within its interaction range is safe unless the cow touches the fence.
- On contact, interrupt grazing and switch sabotage, push the cow a short distance back into the field, and briefly stun it for 0.65 seconds. Use a 1.5-second shock cooldown to prevent repeated hits every simulation tick.
- Expose the cow with an obvious marker visible to all players for five seconds. The cow remains playable after the stun; the farmer still catches it through the existing inspection action. The practice farmer can respond to this visible clue.
- Animate a short upward recoil, stiff legs, a head jerk, and electrical sparks. Provide a restrained hit pose and steady exposure marker with reduced motion enabled.
- Play one positional electrical zap for each shock. Keep the existing powered-fence hum, with proximity volume that warns a player before contact. Both cues must work with the game's audio settings; verify whether the existing hum asset is actually available during implementation.
- Keep fence wires visible when power is off, but remove their energized appearance. Existing key, ladder, and power-switch requirements remain in effect.

## Approach

Recommended: authoritative contact detection and timestamped shock/exposure state, projected through the existing snapshots. Both solo practice and multiplayer use the same rules; renderers and audio consume the same event state. This prevents duplicate sound playback and inconsistent exposure between players.

A purely cosmetic shock would not provide the requested gameplay exposure. Immediate capture would make any fence contact eliminate the player; the proposed temporary reveal gives the farmer a chance to react.

## Implementation scope and validation

Extend the existing farm simulation, cow snapshot state, cow/fence rendering, HUD, and farm audio event handling. Treat missing shock fields in older saved rooms as inactive. Reset the new state between rounds and preserve hidden player identity for cows that have not been exposed.

Check live contact on every edge and at corners, safe proximity, powered-off contact, cooldown, stun recovery, reveal expiry, round reset, safe switch sabotage, and snapshot privacy. Check that each shock plays once, the proximity hum stops after power-off, and reconnecting does not replay old shocks. Run relevant farm/audio tests and TypeScript checks, then inspect the animation and sound in a playable browser session when available.
