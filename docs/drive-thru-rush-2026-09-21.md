# Drive-Thru lunch rush — 2026-09-21

Implemented the approved three-order gameplay overhaul in the local workspace. The previous visual/driving polish is already live; this gameplay update has not been deployed.

## Gameplay
- Three escalating tickets: cheeseburger/soda, double burger/two shakes/fries, triple burger/three shakes/fries. Brief intermissions preserve score and reset preparation and inputs.
- Cook and flip actual patties before consuming them into the exact recipe. Layer cooldown prevents instant stacking; later orders need multiple patties. Fries must be lifted in their golden cooking window.
- Hold pour and release within the fill band for each cup. Underfilling and overflowing cost time. Vent pressure with a held control.
- Complete the ticket, charge the tray slide, release within the force band, then wait for its visible movement to the ledge.
- Passenger holds reach until the grip is secured, then releases to retract while balancing left/right. Driver holds the handbrake at the sloped pickup bay.
- Later tickets announce back-seat disturbances. Spills, overcooked food, collisions and shake blowouts have recoverable penalties. Wipers clear splats.
- Bots use the same held inputs and timing windows, with a reaction cadence. No instant preparation or pickup shortcuts.
- Role-specific timing meters, recipe progress, mobile held controls and revised help. Tray sliding/retraction is animated; consumed patties disappear from the grill.

## Validation
- 40 Drive-Thru tests passed, including fill/slide timing, exact recipe consumption, staged handoff, next-ticket state, recovery and no one-click bypass.
- Bots completed three orders at 30, 60 and 144 Hz and recovered cars from several difficult parking positions.
- Full repository suite: 1,537 passed.
- TypeScript, scoped lint, architecture boundary check and Vite production client build passed.
- In-app browser checked desktop (1280×720) and mobile (390×844) help, role switching, preparation/passenger panels, visible timing meters and held control layout. No browser console errors observed.
- Continuous human hold/release play was not automated through the browser API; deterministic simulation tests cover the timing and recovery logic.

Preview: http://127.0.0.1:5183/drive-thru
