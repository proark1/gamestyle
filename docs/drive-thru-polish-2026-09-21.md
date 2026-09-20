# Drive-Thru polish verification

Implemented the approved cartoon sedan and diner overhaul in the existing game.

- Unified clockwise heading across movement, rendered car, passenger reach, seated avatars, and camera.
- Added smooth signed-speed steering, stronger braking, bounded integration, oriented body collisions, and complete lane bounds.
- Built a teal/ivory sedan with an open cabin, seats, steering wheel, round rolling/steering wheels, mirrors, glass, and trim. Existing wardrobe support is retained.
- Added a cutaway diner kitchen, tiled floor, striped pickup awning, framed windows, signs, trees, road markings, and stopping bay.
- Added a paused opening/help dialog, keyboard hints, held touch driving buttons, speed/parking guidance, and missing barista pour control. A passenger pickup click now performs a full reach.
- Clear held controls on blur, hiding, restart and role changes. Reuse tray geometry until its contents change, dispose replaced models, remove stale workers, and isolate patty materials.
- Bot reverse steering follows the new physics. Sideways recovery uses short bounded rollout planning. Ordinary recovery retains its 10-second delivery check; crosswise handovers allow 22 seconds for a full-size three-point turn, tested at 30/60/144 Hz without pole damage.

## Verification

- 33 Drive-Thru gameplay, audio, controls, physics, model and action regressions pass.
- TypeScript check passes.
- Scoped Oxlint and formatting pass.
- Architecture check passes.
- Vite production client build passes (existing shared bundle-size advisory remains).
- Browser checked at desktop and 390×844: opening/help dialog, car proportions, HUD/control fit, role switching, bot drive to pickup, passenger click, and ORDER SERVED result with 750 points. No browser console errors observed.

Local preview: http://127.0.0.1:5183/drive-thru

Not deployed. Unrelated working-tree edits were preserved. The game remains the existing local four-role simulation with bots; this change does not introduce multiplayer networking.
