# Uphill Delivery performance — 2026-09-06

The rendering pass preserves the existing village, cargo physics, hazards, controls and delivery rules.

- Canvas size changes only on actual viewport resize. A gameplay update no longer resets its drawing buffer.
- Static parts of the sofa, goats, gate and worker torso share draw calls. Animated limbs retain their pivots.
- Solo physics runs from requestAnimationFrame at the existing fixed 60 Hz simulation step, with interpolation for higher refresh rates. The dashboard refreshes at 10 Hz; gameplay transitions and controls update immediately.
- Multiplayer poses use a short, continuous buffered timeline. Cargo, avatars, grip lines, bridges, goats, gates and follow camera stay on the same timeline. Reconnects discard obsolete trajectories, and missing packets cannot extrapolate objects through walls.
- Movement changes send immediately and coalesce during an in-flight sync. Polling accounts for request duration. Jump taps survive until sent; input does not bypass reconnect backoff.
- Camera mode and zoom changes ease smoothly. Keyboard camera changes also update the button's accessible label. Hidden pages release controls and suspend rendering.
- Sustained slow frames lower rendering resolution, with a cooldown and a second fallback that disables shadows. Short stalls do not change quality. The interface remains at native CSS resolution.

## Measurements

Instrumented through the page's read-only `read_uphill_delivery_performance` WebMCP tool. Each steady sample covers the latest 600 rendered frames.

| Scenario                                                                     | FPS | p95 frame interval | p95 frame work | Frames over 34 ms | Draw calls |
| ---------------------------------------------------------------------------- | --: | -----------------: | -------------: | ----------------: | ---------: |
| Original local development build, solo, 1280 × 720, DPR 1.5                  |  60 |            16.8 ms |         2.3 ms |                 0 |        241 |
| Updated local development build, solo, same viewport/DPR                     |  60 |            16.8 ms |         2.8 ms |                 0 |        178 |
| Updated local development build, carrying, 390 × 844, DPR 1.5                |  60 |            16.8 ms |         2.7 ms |                 0 |        147 |
| Updated production build, multiplayer, 390 × 844, DPR 1                      |  60 |            16.8 ms |         1.5 ms |                 0 |        148 |
| Live Railway release, solo after joystick movement/release, 390 × 844, DPR 1 |  60 |            16.8 ms |         2.6 ms |                 0 |        148 |

The updated frame-work number includes solo simulation, which previously ran in a separate interval; these two work figures are not directly comparable. Draw calls in the matching desktop scene fell by 26%. Canvas resize count stayed at one until changing the viewport. No quality downgrade was needed during these measurements.

Browser checks exercised solo grab/carry, joystick movement/release, multiplayer create/start/movement, camera modes, help and room exit. The production page produced no browser errors. Development hot reload briefly reported an import error while files were being edited; the rebuilt production page was verified separately.

These measurements use the desktop in-app browser at desktop and phone-sized viewports, not physical phones. They establish the measured result on this machine; performance still depends on hardware and network conditions.

## Automated verification

- Full suite: 138 passing tests, including six new motion/network/quality tests.
- TypeScript and targeted Oxlint: passed.
- Railway production build: passed.
- All four game HTTP integration scripts: passed against the local production server on port 3005; temporary crews were left afterward.
- Existing physics tests still cover uphill carrying, turns, bridge and ice traversal, cushion bounces, falling cargo, the outward door and persisted multiplayer state.

Railway deployment `a015d77e-3163-4422-bc70-0cd93da89001` reached SUCCESS on the existing production service. All four HTTP integration scripts passed against the public origin and left their temporary crews. The live page exposed the new diagnostics, and the phone-sized solo movement check recorded the result above with no browser errors. Local verification servers were stopped and the temporary browser tab was closed; the user's existing game tab was preserved.
