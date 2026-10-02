# Approved lunch-rush design

Replace instant serving and pickup with one three-order shift. Keep the existing visual and driving overhaul.

- Recipes progress from one to three patties and drinks. Validate layer order, cooked/flipped patties, cups and fries before serving. Preparation uses elapsed time, not frame counts.
- Barista holds to pour and releases in the marked fill band. Holding past it spills the cup. Hold then release the tray control in the launch band; insufficient force stops short, excessive force spills. Both can be retried with time/score cost.
- Passenger holds reach to secure an offered tray, then releases to pull it into the cabin while steering balance left/right. Distance, acceleration and announced disturbances affect stability. Dropping loses drinks and time, not the whole shift.
- Driver parks in range, faces along the window and holds Space/handbrake on the sloped pickup bay. Movement interrupts the handoff.
- Three escalating orders, with a short intermission between cars. Full shift completion is the only win. Expiring an order ends the shift with an explicit reason.
- Bots use the same preparation and transfer mechanics, with bounded response cadence. They support the chosen human role without bypassing it.
- Show recipe progress, cooking state, pour/launch bands, grip, balance, warnings and recovery instructions. Provide held pointer/keyboard controls and clear input on pause, role change and blur.
- Verify that clicks cannot bypass timing or recipes, spills recover, all three orders are required, bots finish at different frame rates, snapshots remain compatible, and desktop/mobile layouts work.

Implementation: add a dedicated rush mechanics module and serializable rush state; integrate with simulation, bots, scene and role HUD. Preserve unrelated working changes. User approved this direction with “ok”.
