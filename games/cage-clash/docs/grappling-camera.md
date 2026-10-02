# Close grappling view

The selected design is an automatic close third-person camera for clinches and
ground fighting. It keeps a stable diagonal angle through positional reversals,
frames both fighters on desktop and phone, and returns to the arena view when
the grapple ends or the round stops. Reduced motion uses immediate framing.
Foreground fence panels fade during the close view. Camera state is local to
rendering and does not change the authoritative simulation or peer protocol.

The grappling panel shows positional advantage from the local player's point of
view. Submissions instead show completion/danger and a timing strip with the
actual gold window and time remaining. Labels distinguish resisting a clinch,
recovering guard from mount, reversing from guard, and standing up from top.
Existing combat balance and input bindings remain unchanged.

Validation covers portrait/landscape framing, edge-of-cage positions, reversals,
return to the arena, reduced motion, game regression tests, and browser checks.

Completed validation: all 36 Cage Clash tests pass, including the three new camera
regressions. TypeScript, scoped lint, architecture checks and the production build
pass. Browser checks cover the close ground view, submission timing display and
foreground fence fading at desktop and 390 × 844 phone sizes. The full game is
available in the local production preview; this update has not been deployed.

Pose correction: the lower fighter now faces upward; the upper fighter kneels
astride the body facing toward the opponent's head. Ground legs use bent knees
and folded feet, with raised legs in guard and extended legs under mount. The
camera is tighter and more side-on. Verified guard, mount and reversed roles in
browser previews, including 390 × 844 phone framing. All 38 game tests, scoped
lint, typechecking, architecture checks and the production build passed.
