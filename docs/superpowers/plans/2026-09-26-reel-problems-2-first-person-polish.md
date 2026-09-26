# Reel Problems 2 first-person polish implementation

Design approved by the user on 2026-09-26. Implement directly; no further design approval is pending. The referenced writing-plans skill is not installed, so this document records the equivalent execution plan.

1. Extend pure camera helpers with finite-value guards, horizontal movement-aligned heading, stable-horizon pose construction, exponential smoothing factors, state-aware eye height, and first-person shake scaling. Add focused unit tests before scene integration.
2. Replace the direct first-person camera snap in `scene.ts` with persistent smoothed eye and forward state. Attenuate pitch/roll, handle aboard/swimming/jumping transitions, reset cleanly on mode switches, maintain local-avatar visibility, and reduce camera trauma only in first-person.
3. Add a first-person center reticle and short non-blocking view-switch confirmation. Keep pointer/touch raycasting and keyboard casting intact. Make selector radio groups unique and clarify first-person copy.
4. Polish camera selector, camera button, focus-visible states, HUD stacking, mobile safe-area placement, compact layouts, contrast, and reduced-motion behavior without changing the established palette or typography.
5. Run all Reel Problems 2 tests, type checking, focused lint and formatting, architecture validation, and the Railway production build. Perform browser QA in Classic and Last Boat Home at desktop and mobile sizes, including movement, casting, jumping, swimming/recovery where reachable, both switching methods, persistence, and error logs.
6. Commit the scoped implementation. Refresh `origin/main`, reconcile any concurrent changes, push only after all checks pass, deploy through the guarded Railway workflow, and verify the public route and production behavior.

## Safety and scope constraints

- Camera selection remains local and never enters shared simulation or peer state.
- High-frequency camera interpolation remains in the render scene, not React state.
- No game-rule, scoring, networking, or account behavior changes are included.
- Isometric behavior stays unchanged except for shared UI polish.
- Invalid or missing avatar data always falls back to a safe camera pose.
