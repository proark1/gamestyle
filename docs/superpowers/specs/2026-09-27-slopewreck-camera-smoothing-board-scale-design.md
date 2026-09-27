# Slopewreck Camera Smoothing and Board Scale Design

## Goal

Keep steering responsive while removing the brief whole-screen snap that occurs when the player changes directly from left to right or right to left. Reduce the snowboard so its proportions fit Nico more naturally without losing its rounded twin-tip silhouette, sidecut, bindings, or visual polish.

## Camera behaviour

The rider continues to use the current steering input immediately for movement and pose changes. The camera does not consume that raw input directly.

`SlopeScene` will maintain a separate smoothed camera-steer value. It will approach the player's steering input with frame-rate-independent damping and will cross through neutral gradually when the input changes sign. `slopeCameraFrame` receives this filtered value, so the forward look target moves gently while the rider remains responsive.

The final look target will also be interpolated over time before calling `camera.lookAt`. Position, field of view, course banking, and the look target therefore use continuous values. The course centreline and its authored banking remain the primary camera orientation; steering contributes only a restrained lateral look offset. Collisions may retain their small camera nudge, but it must not reintroduce a steering-direction snap.

## Snowboard proportions

The board outline will be reduced by 11 percent in length and 8 percent in width. Its rounded nose and tail, raised tips, sidecut, deck thickness, edge material, and decoration remain intact.

Bindings, trails, impact spray, and boot anchors will be adjusted with the board so both boots still visibly meet their bindings and the board remains centred under the rider. The player collision shape and gameplay handling do not change; this is a visual proportion correction only.

## Scope and boundaries

- No change to steering acceleration, maximum lateral speed, hazards, collision rules, or multiplayer state.
- No change to the shared Nico character or wardrobe system.
- No new camera mode or settings control.
- Existing course visibility targets on desktop and mobile remain valid.

## Verification

- Add a deterministic camera smoothing test that simulates an abrupt full-left to full-right input change and proves the camera contribution changes continuously rather than jumping in one frame.
- Extend model tests to constrain the smaller board dimensions and confirm both boot anchors remain aligned with their named bindings.
- Run the focused Slopewreck test suite, architecture check, typecheck, lint, and production build.
- Perform desktop and mobile browser smoke checks, including repeated rapid left-right steering, before deployment.
