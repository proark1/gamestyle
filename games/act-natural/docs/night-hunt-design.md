# Smooth movement and the night hunt

Player-farmer rounds take place at night. Cool moonlight preserves static landmarks; a warm handheld flashlight identifies the searchable area. The existing seven-metre cone, small pool at the farmer's feet, hay occlusion and five-second shock exposure remain authoritative. Cow players see the nighttime world and the approaching beam; the farmer receives only the existing restricted snapshot. The computer-farmer mode and lobby keep their daylight setting.

The flashlight uses analytic lighting on existing materials with exactly the server's cone/range/cover constants. It has soft edges inside the valid visibility area and an illuminated physical lens. The farmer, beam and selection ring share a single display pose. The flashlight keeps working after fence power is cut. No new HUD windows or graphics assets are needed.

The movement defect has three code-level contributors: HTTP polling waits an extra 100 ms after every response, the farmer's facing and sight geometry snap to packets, and every snapshot disposes/triangulates a new sight mesh. Local farmer controls now predict movement using the same collision and speed rules as the server, with bounded smooth reconciliation. Other actors interpolate on a shared clock. Prediction stops during connection stalls and input cancellation. Changed controls are sent promptly without parallel sync requests; ordered control sequences prevent a delayed request from undoing a later turn or stop. Only the player's own acknowledged movement is returned.

Camera-relative controls are normalized before transmission. This prevents the server's per-axis clamp from changing diagonal direction relative to local prediction, including combined touch and keyboard input.

Sight geometry reuses a dynamic GPU buffer. Night illumination uses four fixed hay intersection checks instead of an additional shadow-map pass, including on touch devices. Walking animates the farmer's legs and free arm while the flashlight arm stays raised. Reduced motion removes decorative gait, but retains smooth navigational movement.

Checks cover irregular network timing, starts/stops/turns, collision agreement, reconciliation and reconnect behavior, control ordering, private snapshots, persistent sight buffers and beam/visibility agreement. Existing NPC escape/security tests, production builds and disposable HTTP rooms remain part of release validation. Human/device frame-rate and appearance checks must not be claimed without actually performing them.
