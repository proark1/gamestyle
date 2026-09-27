# Reel Problems 3 Physics and Presentation Polish Plan

**Date:** 2026-09-27
**Design:** [2026-09-27-reel-problems-3-physics-polish-design.md](2026-09-27-reel-problems-3-physics-polish-design.md)

## Outcome

Ship an authoritative Cannon-based first-person character controller for Reel Problems 3, phase-specific solid scenery, a fully offshore island boat with a physical gangway, a rebuilt beacon bell, and a connected first-person arm rig. Preserve the current adventure rules, multiplayer snapshot format, and all other games.

## Task 1 — Define and test the physical world

Create `games/reel-problems-3/physics-layout.ts` as the single source of truth for safe spawns, world boundaries, boat placement, gangway placement, and phase-specific box/cylinder colliders. Keep definitions serializable and independent from Three.js and Cannon so tests can inspect layout invariants directly.

Create `games/reel-problems-3/physics.ts` with `AdventurePhysics`. Build static bodies from the layout and one locked, upright dynamic body per human player. Step at 1/60 second, cap catch-up work, drive desired horizontal velocity from player input, copy resolved positions back to the adventure world, and safely reset non-finite or overlapping restored positions.

Add tests proving that the tower, a representative tree, a rock, harbor props, buildings, and boat rails block movement; diagonal movement slides; large deltas do not tunnel; and valid routes remain open.

**Exit gate:** focused physics tests pass and no physics object enters an adventure snapshot.

## Task 2 — Integrate physics with simulation and multiplayer

Replace direct coordinate mutation in `simulation.ts` with a cached `AdventurePhysics` instance. Synchronize players before each step, rebuild static bodies after phase and island changes, and destroy/reset the cache on a new adventure. Keep `advanceWorld` and the peer adapter signature unchanged.

Update phase reset positions to use the layout's safe spawn. Add regression coverage for joining, leaving, restarting, checkpoint-style cloning, phase transitions, and world bounds.

**Exit gate:** the complete deterministic voyage tests and peer invariants pass with collision-aware movement.

## Task 3 — Rebuild the island arrival

Move the island boat completely beyond the shoreline using the shared layout constants. Open the shore-facing rail, lower the boat to a credible waterline, and add a timber gangway with planks, rope rails, posts, and visible support. Move the helm target onto the deck and keep it within interaction range after boarding.

Make visible trees and rocks use the same deterministic placement data as their colliders so rendering and physics cannot drift apart.

**Exit gate:** layout tests prove land/hull separation and gangway continuity; browser inspection confirms the route is visually obvious and walkable.

## Task 4 — Rebuild the bell and first-person rig

Replace the cone marker with a dedicated handcrafted bell assembly using a lathed flared bronze shell, dark mouth, clapper, crown, timber yoke, bracket, and pull rope. Put the assembly beside the tower outside both footprints. Preserve a generous interaction target on the bell and rope.

Replace detached arm capsules and hand spheres with left/right view-model groups. Each group gets a tapered forearm, cuff, attached palm, thumb, and finger mass. Pose them in the lower corners, tune camera-local depth, add restrained opposing sway, and disable sway under reduced motion.

**Exit gate:** the bell never intersects the tower, remains interactable, and the arms read as two connected limbs at rest and in motion.

## Task 5 — Full verification and release readiness

Run:

```text
node scripts/test.mjs games/reel-problems-3 platform/games/registry.test.ts shared/games/identity.test.ts platform/peer/invariants.test.ts
npm run typecheck
npm run build:railway
git diff --check
```

Run the local production preview and browser-check script. Extend browser checks where necessary to capture desktop and touch-size evidence for the island, bell, boat/gangway, movement collisions, and first-person rig. Inspect console errors and failed same-origin requests.

Commit the implementation only after all gates pass. Deployment remains a separate release action unless the user explicitly asks to publish this polish.
