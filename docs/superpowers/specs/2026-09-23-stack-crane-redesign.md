# Stack or Sink crane redesign — 2026-09-23

## Decision

Keep one visible, controllable cargo crane. Replace the unrelated rescue crane silhouette with narrow fixed supports for the existing rescue deck. The deck stays at 13.5 m, keeps its four open approaches, and remains the win target. Its collision geometry and rendered structure must agree.

## Operator view

Taking the cargo crane opens a stable oblique work camera that frames the held load and the surfaces below it. This is the default because stack height must remain visible. The view button switches to a wider oblique yard overview; it never switches to a full-screen top-down view. Both camera poses have the same horizontal orientation, so screen directions keep the same meaning. Orbit dragging is disabled during crane operation, while zoom remains available.

A compact overhead XY map shows the platform, salvage footprints, current load position, and a selected destination. Clicking or tapping the map sets a horizontal destination. The client sends bounded crane movement steps until that destination is reached; manual WASD, arrow or joystick input cancels the destination and fine-tunes position. A stalled or rejected move stops automatic movement and reports that the load is blocked. The authoritative server keeps all collision and range checks.

The work HUD shows load-bottom height, surface height directly below it, and their vertical gap. A ring and a vertical guide in the 3D scene indicate the point directly under the load. They do not predict the final landing point after release. Height uses Q/Z or clearly labeled hold buttons; release remains a separate action.

## UI layout

Desktop: compact XY map and height readout beside the existing crane controls, without covering the stack. Mobile: a small map below the top HUD, a concise height readout in the crane panel, joystick for fine control, and separate height and release buttons. All active controls remain at least 44 CSS pixels on touch devices.

## Verification

- Unit tests for camera direction, destination stepping/cancellation, and height readout.
- Existing rescue, crane, physics and room tests updated for the new fixed deck supports without weakening the entrance or win-condition checks.
- Desktop and mobile browser runs covering map destination, fine adjustment, raising, lowering, view switch and release.
- Typecheck, lint, production build and full test suite before a guarded live release.

## Considered alternatives

Keeping both crane silhouettes and adding labels would preserve the visual confusion. A permanent split-screen top and side view would reduce the playable scene too much on phones. The work camera plus small XY map gives depth and precise horizontal placement in one layout.
