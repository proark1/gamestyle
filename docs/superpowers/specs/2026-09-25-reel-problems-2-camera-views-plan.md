# Reel Problems 2 Camera Views — Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-25-reel-problems-2-camera-views-design.md`  
**Goal:** Add a persistent per-player Isometric/First-person choice that works before and during both Classic and Campaign play.

## Guardrails

- Do not change simulation, room actions, snapshots, scoring, or game-mode rules.
- Keep camera preference local to the device and compatible with existing saved preferences.
- Preserve keyboard, touch, controller, casting, and multiplayer behavior.
- Reuse the rendered local angler pose so first-person follows boat motion and swimmer/dock movement.
- Do not disturb unrelated changes in the dirty working tree.

## Task 1 — Add camera-mode primitives and tests

**Files**

- Create: `games/reel-problems-2/camera.ts`
- Create: `games/reel-problems-2/camera.test.ts`

**Steps**

1. Define the two camera modes, default mode, display names, safe preference parsing, and toggle order.
2. Add a pure first-person pose helper that transforms a local eye and forward offset by a rendered angler's world position and quaternion.
3. Test malformed preference fallback, toggling, identity pose, yawed pose, and a tilted boat-relative pose.
4. Run the focused camera tests.

## Task 2 — Integrate explicit camera modes in the Three.js scene

**Files**

- Modify: `games/reel-problems-2/scene.ts`

**Steps**

1. Replace the normal/wide boolean with an explicit `CameraMode`.
2. Add `setCameraMode`, keep `changeCamera` as the `V` shortcut toggle, and report scene-driven changes to React.
3. Preserve the current elevated camera as Isometric.
4. Build First-person from the rendered local angler transform, use a wider perspective FOV, and hide only the local avatar while in first person.
5. Snap cleanly when modes change, fall back to Isometric when no local angler exists, and retain event shake and pointer raycasting.

## Task 3 — Add selection UI and persistence

**Files**

- Create: `games/reel-problems-2/CameraSelect.tsx`
- Modify: `games/reel-problems-2/Game.tsx`
- Modify: `games/reel-problems-2/style.css`

**Steps**

1. Add an accessible EN/DE radio selector styled to fit the existing menu and lobby.
2. Load and save `cameraView` in `reel-problems-2-prefs-v1` without breaking older values.
3. Synchronize menu, lobby, button, and keyboard changes through one local camera-selection path.
4. Show the selector before starting and for every player in a lobby.
5. Make the in-game button name the active view and announce the target view.
6. Check narrow-screen placement against mission and touch controls.

## Task 4 — Verify both views in both modes

1. Run focused Reel Problems 2 tests and the new camera tests.
2. Run TypeScript, focused lint/format checks, architecture checks, and the production build.
3. Browser-check Classic and Campaign in Isometric and First-person, including pre-game selection, in-game button/`V` switching, movement, casting, and a narrow touch viewport.
4. Record any environment-limited verification explicitly without changing unrelated files.
