# Course Correction Backyard Open Implementation Plan

## Objective

Implement the approved Backyard Open redesign without changing Course Correction gameplay, physics, networking, scoring, or course geometry.

## Visual implementation contract

### Palette

- Sky blue `#72cde3`: clear outdoor atmosphere and distant haze.
- Turf green `#3fa66c`: playable surface and primary field identity.
- Garden green `#5f815c`: trees, shrubs, fences, and venue framing.
- Clubhouse cream `#fff6df`: shared HUD cards and painted venue details.
- Workshop navy `#17354a`: structure, readable ink, rails, and equipment.
- Tournament amber `#eaa43c`: shared HUD accent, bunting, and active status.

### Type

- Fredoka: hole names, timer figures, score figures, short result titles.
- DM Sans: player names, statuses, instructions, controls, and dialogs.

### Layout

The visual center remains the playable lane. The venue creates a shallow U-shaped frame: clubhouse and trees behind the cup, spectators and benches along the outside edges, and only low details in the foreground.

```text
┌─────────────────────────────────────────────────────────┐
│ COURSE                    HOLE / TIME          TOOLBAR   │
│                                                         │
│ [scores]       trees · clubhouse · bunting              │
│                 spectators / benches                    │
│              ╭──────────────────────╮                   │
│              │   changing course    │                   │
│              │  golfers + four balls│                   │
│              ╰──────────────────────╯                   │
│                      [shot card]                        │
└─────────────────────────────────────────────────────────┘
```

On portrait screens the centered match card moves below the compact top row, the player cards become a horizontal strip, and the higher camera keeps the full lane visible behind them.

### Signature

The memorable element is the **living garden gallery**: the audience, bunting, and clubhouse form a handmade tournament frame that reacts as the course itself changes. This is specific to the game's household-object mini-golf premise and not generic stadium decoration.

### Self-critique

Cream glass cards, a centered score panel, and a bright outdoor arena could become generic collection styling on their own. The implementation therefore avoids treating the HUD as the personality. The distinctive work goes into the garden-club venue, asymmetrical spectator groups, physical clubhouse scoreboard language, and camera framing that shows golfers and their audience together. HUD chrome stays deliberately quiet and shared.

## Task 1: Pure camera and crowd presentation logic

Create `camera-presentation.ts` and `spectator-presentation.ts` with focused tests.

- Select aim, follow, and celebrate camera states from authoritative world state and recent event IDs.
- Derive bounded position/look targets for desktop and portrait layouts.
- Deduplicate crowd reactions and map event kinds to idle, course, major, and celebration intensity.
- Define presentation detail profiles for desktop, mobile, and reduced motion.
- Test stable aim framing, moving-ball follow bias, cup celebration bias, fallbacks, deduplication, and profile limits.

## Task 2: Backyard environment

Create `environment.ts`.

- Build a persistent ground plane, worn path, clubhouse shed, fencing, benches, planters, equipment, signs, bunting, trees, and shrubs.
- Keep the course corridor visually open and place tall silhouettes behind the cup or beyond the side rails.
- Reuse shared primitive helpers and batch static geometry after construction.
- Expose the environment root and an explicit disposal path.

## Task 3: Spectator gallery

Create `spectators.ts`.

- Build eight to twelve shared avatars with varied existing wardrobe looks and course-adjacent clothing.
- Arrange seated and standing clusters beside the lane.
- Keep a limited animated subset with staggered idle/wave/cheer motion; freeze and batch the rest.
- Feed new authoritative course events into the crowd reaction controller.
- Scale crowd and animation detail with the presentation profile and reduced-motion preference.

## Task 4: Scene and camera integration

Update `scene.ts`.

- Separate persistent venue/spectators from hole-specific course contents so rebuilding a hole does not duplicate the world.
- Add the venue and audience before the first course build.
- Forward snapshots and unseen events to the spectator system.
- Blend camera presentation targets with the existing impact impulse.
- Preserve stable aiming and use the active perspective camera for raycasting.
- Dispose environment, spectators, course contents, characters, and transient effects correctly.

## Task 5: Shared-house HUD conversion

Update `Game.tsx` and `style.css`.

- Preserve the existing lazy scene import, transient refs, paced snapshot state, and peer lifecycle.
- Add shared house classes to the match card, player cards, shot card, overlays, dialogs, buttons, and event messages.
- Keep status derivation in render and avoid new high-frequency React state.
- Replace bespoke dark score blocks with light player cards and compact state labels.
- Add semantic round progress and improve mobile score-strip behavior.
- Retain the existing course palette only for gameplay identity and player/event accents.

## Task 6: Verification and visual critique

- Run new pure tests plus all existing Course Correction tests.
- Run formatting, focused lint, typecheck, and the production build.
- Inspect the game at desktop, 390×844 portrait, and short landscape sizes.
- Exercise opening volley, wall, bridge, platform, cup, assist, and multi-cup states.
- Confirm the course remains unobstructed, characters stay readable, camera movement never fights aiming, and the mobile HUD does not cover the playable lane.
- Review screenshots against the approved spec, remove any decoration that competes with play, and rerun checks after the final polish pass.

## Constraints

- No changes to simulation rules, course definitions, physics, scoring, checkpoint data, or peer protocol.
- No new external visual dependencies or generated raster assets.
- Use existing avatars, wardrobe pieces, rendering primitives, house lighting, toolbar, dialogs, and HUD tokens.
- Optional scenery must degrade safely; the course and HUD remain playable if it is unavailable.
