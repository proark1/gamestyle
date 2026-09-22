# Nico as the standard human avatar

Approved scope: use Nico for human avatars in every game. Cows, robots and
other special non-human characters remain exceptions. Preserve existing work.

Reuse the existing Nico and wardrobe builders through one game adapter. Keep
feet at zero, a bare-head height of 1.68 game units, and uniform proportions.
Apply this normalization inside an outer root so existing game-specific scales
continue to work. Hair and hats must not change body scale or physics.

Migrate shared worker consumers and custom human builders. Retain the legacy
worker for non-human mannequins and the admin character catalogue. Keep Court
Clash on its existing Nico builder and dimensions. Refit game equipment to the
head, torso and hand coordinates of Nico. Keep existing physics and controls.

Implementation sequence:
1. Add the common human avatar adapter and stable hand anchors.
2. Migrate human game builders, previews and the first-person remote builder.
3. Preserve non-human paths and refit game-specific accessories.
4. Test identity, height, wardrobe, scaling and attachments; run typechecking
   and relevant game regressions, then inspect a browser preview if available.

## Implementation and validation

Implemented a shared Nico adapter in `shared/rendering/game-avatar.ts` and
migrated all human game avatar paths, including farmer, store guard, Zorb
interior, first-person remote builders, and game previews. Court Clash retains
its existing Nico size. Cows, the shared robot, wooden mannequins and other
non-human creatures remain unchanged.

The adapter uses a uniform inner scale for a 1.68-unit bare-head height. Existing
outer scales remain in force (including the 0.52 miniature thief and 0.72 Zorb
interior). Wardrobe hats do not affect body size. Game hats, bands, harnesses,
hand anchors, tools and the scaffold tether were fitted to the Nico rig.
First-person hand colour now matches Nico; existing controls and physics remain.

Validation completed:
- 1,081 game, rendering and avatar-catalog checks passed on the initial migration.
- 220 affected checks passed after the final equipment refinements, including
  tests for height, ground contact, wardrobe, hand grip and non-human exceptions.
- Typechecking, changed-file lint/format checks, and architecture checks passed.
- All 29 game avatar variants rendered in a local browser without runtime errors;
  inspected the lineup and corrected the scaffold harness and sweatbands.
- Visual evidence: `docs/nico-avatar-lineup-2026-09-20.png`.

The browser check covers avatar previews and poses, not complete multiplayer
rounds in every game. No deployment was performed.
