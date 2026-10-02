# Bungee Doubles repair design

The user approved all repairs in the Bungee Doubles audit. Preserve the existing art and arcade doubles rules. Repair the simulation instead of suppressing repeated sounds, and reuse the shared joystick rather than introducing another gesture implementation. A wholesale game rewrite is unnecessary.

- Simulation owns one accepted return per team possession, cooldowns, unique events, point deadlines, frozen end states, roster balancing, and serve ownership.
- Solo and peer adapters use the same fixed-step runner. Physics orders floor and wall contacts and scales damping by elapsed time.
- Touch uses a left movement stick and right shot/jump buttons, with a compact utility dock. Camera framing fits the court across viewport shapes. Desktop retains keyboard and mouse controls.
- Help is a keyboard-accessible modal, pauses local play, and explains serving, movement, scoring, and bungee mechanics. Focus loss releases all held input.
- Audio respects shared volume/mute and lifecycle; events and owned scene resources have bounded lifetimes.
- Regression tests cover the audit reproductions, fixed-step parity, match completion, and peer point transitions. Verify responsive layouts and controls in a local browser, then run type, lint, architecture, and applicable tests.

Implementation order: simulation/roster; fixed stepping and audio; input/UI/camera; regression tests and browser validation. Real-device Safari/Android validation and deployment are separate from locally verified fixes. The page remains the existing solo game; the peer adapter is repaired without inventing a new multiplayer lobby.
