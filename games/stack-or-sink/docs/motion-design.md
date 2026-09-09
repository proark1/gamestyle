# Smooth motion and immediate stopping

The requested behavior is continuous object motion and no horizontal avatar drift after releasing movement, including during jumps and while standing on salvage. Gravity continues during jumps and falling supports.

Practice runs advance the authoritative simulation on the animation loop, with persistent physics bodies and no second player prediction fighting the local result. The fixed 60 Hz simulation interpolates moving salvage between steps; the local avatar reads current input directly. React receives HUD snapshots at a lower rate.

Multiplayer uses a short buffered snapshot timeline for remote avatars and salvage. The local avatar remains responsive through prediction. Small network corrections never move a stationary avatar; larger corrections while moving are applied gradually. Essential discontinuities (restart, rescue, ownership and exact placement) apply immediately. Movement changes send immediately and input ordering prevents delayed requests from restoring stale controls.

The concurrent island task replaces the old overlapping floor surfaces. Preserve that island rendering, and verify there is only one visible ground surface. Verify input release, midair stopping, sloped supports, packet jitter, falling objects, exact placement and physics reuse with regression tests, then check production browser frame timing and both games' HTTP suites before publishing.
