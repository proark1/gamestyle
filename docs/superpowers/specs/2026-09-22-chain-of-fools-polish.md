# Chain of Fools: collision and course polish

The requested improvement keeps the four-worker safety-line game and its construction-site style. A targeted collision repair plus a final obstacle section provides more variety without replacing the game or introducing a new physics dependency. A cosmetic-only pass would leave the reported fault; a physics-engine rewrite would unnecessarily disrupt the rope and multiplayer simulation.

All movement, rope corrections and rescue movement must respect full-height workers and solid course geometry, with small movement increments preventing tunnelling. Moving hazards must separate workers from their volume. Preserve walking headroom in the duct and make net release work. Recompute support after rope movement. Finish requires reaching the actual office pad, and completed workers must remain useful anchors for the rest of their crew. Reset all transient run state on replay.

Extend the finish from 146m to 174m (19%). Add staggered cargo barriers, a narrow final bridge with a jumpable gap, clip rings and two checkpoints. Keep bot navigation and recovery viable. Give the longer course 4:30. Preserve the warm timber, rust, steel and hazard-yellow palette, house typography and chain-shaped progress display. Add concise localized section guidance and distance remaining, with route markings on the new section.

Verification: existing game/audio tests, collision regressions for full-body walls, high-speed movement, ceilings, rope and rescue correction, net release, finish bounds, reset and bot completion. Run scoped lint, TypeScript and a production client build, then inspect the local rendered game in the browser. Preserve all existing unrelated workspace changes. Deployment is outside this local implementation.
