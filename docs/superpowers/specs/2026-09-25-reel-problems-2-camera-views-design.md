# Reel Problems 2 Camera Views

## Goal

Let every Reel Problems 2 player choose between isometric and first-person camera views before play and switch views during play. Both views must work in Classic tournament and Campaign/Last Boat Home without changing game rules or multiplayer state.

## Player experience

- A two-option camera selector appears on the main menu and in the multiplayer lobby.
- Isometric is the default and preserves the current elevated follow camera.
- First-person places the camera at the local angler's eye level and points it in the angler's current facing direction.
- The existing in-game View button switches directly between Isometric and First-person and identifies the active view accessibly.
- The chosen view is saved in the existing local preferences and restored on the same device.
- View choice is local to each player. One player's choice never changes another player's camera and is not added to snapshots or room actions.

## Camera behavior

The scene exposes an explicit camera mode instead of the current normal/wide zoom boolean. Isometric retains the existing follow target, survival framing, swimmer/dock following, smoothing, responsive portrait adjustment, event focus, and camera trauma.

First-person derives its pose from the rendered local angler after the avatar has been updated. This keeps it aligned with the boat's translation, yaw, roll, and pitch while aboard, and with the angler's world position while swimming or standing at the dock. The camera uses a small eye offset, follows the angler's facing direction, and smooths only enough to avoid network jitter. It hides first-person-obstructing parts of the local avatar without hiding the avatar in isometric view or for remote players.

If the local angler is temporarily unavailable, the scene falls back to the isometric target for that frame instead of rendering from an invalid pose. Switching views resets the camera interpolation target so the transition is prompt and does not fly across the map.

## Controls and interaction

This change is camera-only. Keyboard, controller, touch movement, actions, and simulation input remain unchanged. The angler's current facing direction drives the first-person heading, so moving changes the view naturally and stopping retains the last heading. Existing pointer casting continues to raycast through the active perspective camera onto the lake plane.

The `V` shortcut and in-game View button toggle the two explicit modes. The pre-game selector calls the same scene camera-mode API, so starting either Classic or Campaign uses the selected view immediately.

## State and UI boundaries

React owns the selected `CameraMode` and synchronizes it to `ReelScene`. The scene owns only rendering details. The mode is included in `reel-problems-2-prefs-v1` alongside name and muted state, with defensive parsing so old or malformed preferences fall back to isometric.

A small reusable selector component presents radio controls for Isometric and First-person. It is independent of `ContractSelect`: game mode and camera mode are separate choices. In a shared lobby, every player sees and can change their own camera selector, while only the captain can change the contract.

## Accessibility and responsive behavior

The selector uses native radio semantics with a visible selected state. The in-game button has an explicit label such as `Switch to first-person view`, and its visible text names the active view instead of the ambiguous `View`. Controls must remain usable at the existing narrow mobile breakpoint and must not overlap the mission or touch controls.

## Verification

- Unit-test preference parsing and camera-mode fallback behavior.
- Unit-test pure first-person pose calculations for boat-relative and world-relative anglers.
- Run Reel Problems 2 tests, TypeScript checking, lint/format checks for changed files, and the production build.
- Browser-check Isometric and First-person in both Classic and Campaign, including switching before start and during play, desktop keyboard controls, pointer casting, and a narrow touch viewport.

## Out of scope

- Mouse-look, free-look, aim sensitivity, or separate first-person movement rules.
- Synchronizing camera choice over multiplayer.
- Changing the original Reel Problems game.
- Rebalancing either game mode or restoring the old wide-zoom camera as a third option.
