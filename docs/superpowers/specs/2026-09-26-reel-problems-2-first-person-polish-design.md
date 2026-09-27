# Reel Problems 2 First-Person and Presentation Polish

## Goal

Make first-person view comfortable, predictable, and fully usable in both Classic Tournament and Last Boat Home, while applying a focused presentation pass to the camera controls and in-game HUD. The result should preserve Reel Problems 2's toy-fishing identity and chaotic gameplay without making the camera itself chaotic.

## Product decisions

- First-person automatically aligns with the local angler's movement direction. It does not use free mouse or touch look.
- The horizon remains mostly stable. Boat pitch and roll appear only as gentle, damped sway.
- Isometric remains the default and both views remain selectable before play and switchable during play.
- Camera choice remains a local preference. One player's selection does not change another player's view.
- The scope is limited to camera comfort, camera-related feedback, and targeted HUD/UI polish. It does not redesign game rules, networking, or the overall art direction.

## Camera behavior

### Follow model

The scene derives a camera target from the already-interpolated local angler transform so the camera follows what the player sees on screen rather than raw simulation snapshots. A small first-person camera state owns smoothed eye position, forward direction, and sway. Smoothing must be frame-rate independent.

The horizontal forward direction follows the angler's rendered movement heading. Pitch and roll from the angler or boat are attenuated before they influence the view. This keeps steering and walking legible while retaining a subtle sense of being on a moving boat.

### State-specific positioning

- **Aboard:** eye position sits above the angler's shoulders and follows their movement heading.
- **Swimming:** the eye stays above the water surface, follows swim heading, and uses softer vertical movement.
- **Jumping or falling:** vertical motion is damped enough to avoid a sharp snap while still communicating the action.
- **Dock and rebuilding states:** the camera follows the local angler normally and avoids nearby geometry.
- **Missing local avatar or lobby transition:** first-person falls back safely to the isometric camera until a valid local rendered angler exists.

### Comfort and clipping

- First-person uses a stable horizon with a small configurable sway contribution.
- Camera trauma and event shake are reduced in first-person but remain unchanged in isometric view.
- Near-plane and eye offsets are chosen to avoid intersecting the avatar, boat rail, and deck.
- The local avatar is hidden only while first-person is active and becomes visible immediately after switching back.
- Switching modes resets interpolation state so the camera never travels across the world from the previous viewpoint.
- Projection changes are applied only when a mode transition changes field of view or near plane.

### Aiming and casting

A subtle center reticle appears in first-person during active play. Pointer and touch casting continue to raycast through the selected screen point; keyboard casting remains unchanged. The reticle is feedback, not a new gameplay mechanic. It must disappear in isometric view, menus, and non-playing states.

## Interface polish

### Camera selection

The pre-game selector keeps the two explicit choices, with clearer active, hover, focus-visible, and disabled states. Copy stays direct:

- **Isometric — See the whole boat**
- **First-person — Follow your angler**

The same selector remains available in a multiplayer lobby so each player can choose independently.

### In-game camera control

The camera button shows the active view and its tooltip/accessible name describes the action that will happen next. The `V` shortcut remains supported and is included in the movement hint where space permits. A short visual confirmation appears after a view switch without blocking gameplay.

### HUD cleanup

The polish pass will improve spacing, contrast, focus indicators, button hierarchy, and overlap handling for the camera button, line panel, action controls, crew panel, and mission panel. Mobile layouts must keep the camera control clear of touch controls and safe-area insets. Reduced-motion preferences disable decorative camera-transition feedback while retaining immediate state changes.

### Visual direction

The existing palette and typography remain the source of truth. Camera controls use the same paper-card surfaces, lake teal, warm cream, coral accent, rounded toy-like geometry, and compact utility text already present in the game. The signature element is the calm, centered first-person reticle paired with a small view-status chip: it should look like part of the fishing game rather than a generic shooter HUD.

## Component boundaries

- `camera.ts` owns pure camera math, configuration, parsing, and interpolation helpers that can be unit tested without Three.js rendering.
- `scene.ts` owns rendered camera state, state-specific pose selection, projection updates, local-avatar visibility, event shake scaling, and reticle visibility signals.
- `CameraSelect.tsx` owns the accessible pre-game and lobby selector.
- `Game.tsx` owns the local preference, view-switch feedback, button copy, and rendering of camera-related HUD elements.
- `mission.css` and `style.css` own selector and in-game presentation, including responsive and reduced-motion rules.

These boundaries keep high-frequency camera state outside React while React handles low-frequency preference and UI changes.

## Data flow

1. The saved camera preference is parsed when the game initializes.
2. `Game.tsx` passes the selected mode into the scene.
3. Menu, lobby, button, or `V` input requests a mode change.
4. The scene resets camera interpolation and reports the accepted mode through the existing callback.
5. React persists the accepted mode and updates accessible labels and view feedback.
6. Each render frame computes a state-aware target pose, smooths toward it, applies comfort-limited sway and shake, and renders.

## Failure handling

- Invalid saved values fall back to isometric.
- Missing player or avatar data never leaves the camera at an invalid transform; the scene uses isometric until first-person can be computed.
- Non-finite camera inputs are rejected by pure helpers and replaced with the last valid pose or safe defaults.
- WebGL context failure continues through the existing scene failure callback.
- Camera preference persistence remains optional and never prevents play.

## Accessibility and responsive requirements

- Radio choices have unique grouping semantics wherever more than one selector can exist.
- All camera actions remain keyboard accessible with visible focus indicators.
- Labels expose the current mode and the next action without relying on color.
- Touch targets remain at least 44 CSS pixels where space allows.
- Mobile portrait and short desktop layouts avoid HUD overlap.
- `prefers-reduced-motion` reduces transition animation and camera-response flourish.

## Verification

### Automated

- Unit tests cover preference parsing, mode cycling, movement-aligned heading, stable-horizon attenuation, smoothing at multiple frame rates, swimming eye height, invalid input fallback, and reduced first-person shake.
- Existing Reel Problems 2 tests must remain green.
- Type checking, lint, formatting, architecture validation, and the production Railway build must pass.

### Browser QA

Verify both Isometric and First-person in Classic Tournament and Last Boat Home on desktop and mobile portrait. Exercise walking, steering, reeling, casting, jumping, swimming, rescue/rebuild interactions, view switching by button and `V`, preference persistence, reduced-motion behavior, and HUD overlap. Confirm no browser errors and no visible local-avatar, rail, or deck clipping during ordinary play.

## Acceptance criteria

- First-person consistently follows the angler's movement direction without manual camera look.
- The horizon remains readable and boat motion feels gentle rather than nauseating.
- Core actions remain usable in both modes and both game types.
- Switching is immediate, smooth, and free of clipping or stale avatar visibility.
- Camera controls are clear, accessible, persistent, and mobile-safe.
- The focused HUD polish improves readability without changing Reel Problems 2's established identity.
