# Chain of Fools gauntlet

Approved design: `superpowers/specs/2026-09-22-chain-gauntlet-design.md`.

The 174m course now has offset beams, a narrow lower catwalk with two turns, staggered scaffold widths, a suspended scaffold load, a moving cargo deck over a new gap, tall alternating cargo barriers, and a narrower final bridge swept by a second load. The existing balance bridge and wrecking ball remain.

An unrecoverable fall resets every worker to the gate, including workers who already finished. The attempt clock and machinery phase reset together; anchors, velocities, progress, rescue state and rope display reset. Best distance and attempt count persist. Recoverable rope hangs still permit rescues. Section markers do not grant respawns. The HUD and English/German instructions explain this, and the obsolete recorded checkpoint announcement is no longer played.

Moving objects share their transforms and bounds between rendering and collision. Dynamic collider sets pass through walking, rope corrections, hauling, support queries and forced movement without shared mutable geometry. The moving deck carries idle/braced workers; swept body collision prevents thin-wall tunnelling. Bot routing anticipates the load timing, waits at the cargo gap and turns around the barriers.

Scenery adds freight containers, service decks, pallets, equipment, support structures, gantries, animated crane loads and warning lamps. Static props and rigid moving groups are batched. Reduced motion disables decorative crane movement and lamp pulsing. Wipes snap the camera back to the gate.

## Verification

- Full site suite passed: 1,768 tests before the final finished-round freeze regression was added.
- Chain of Fools tests cover full bot runs at 30/60/120 Hz with per-frame static and dynamic overlap assertions, full gate resets, recovery of rope hangs, moving deck transport, moving-load pushes, fast forced collisions and isolation between worlds.
- TypeScript, lint and production Railway build passed.
- Browser inspection covered the actual game startup and HUD, 390×844 phone layout, freight/de­molition machinery, and a forced fall in a temporary scene fixture. The fixture showed the crew back at x≈3m with an incremented wipe count; both previews had no JavaScript errors. The temporary fixture was removed before release.
- Separate-device multiplayer play was not manually exercised; shared engine/snapshot tests are part of the full suite.
