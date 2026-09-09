# Crane impact physics — 2026-09-08

Crane movement now requests a destination rather than teleporting the cargo. The fixed-step solver drives a dynamic load with its salvage mass, a horizontal speed limit of 3.5 m/s, vertical limit of 3.75 m/s, and a capped motor force. The hoist supports gravity and keeps the existing upright rotation controls. Its contact material reduces grip while suspended; ordinary cargo grip returns on release.

Loose salvage is excluded from the route rejection check, so physical contact can transfer linear and angular momentum and wake a sleeping box. The actual position and velocity are saved in each snapshot. Target changes retain the solver and do not wake distant stacks. A released load retains its momentum. Local cargo rendering shares fixed-step interpolation with the boxes it strikes, so the connected crane rig follows the visible impact pose.

Six new regression cases cover a sleeping ground crate tipping onto its side, the same collision through serialized room updates, the top of a three-crate tower falling, a near miss leaving sleeping salvage untouched, bounded travel and momentum on release, and a crate trapped against the shed. In the trapped case the motor stalls while both objects remain outside the wall. Existing static route, placement, crate-band, rig-attachment and four rescue-entry tests are retained.

Workspace TypeScript, targeted lint and all 80 Stack or Sink tests pass. A browser fixture uses the actual renderer, authoritative actions and host ticks to strike a ground crate and a prepared three-crate stack. A separate check rehearsed a collision using the normal 28-piece initial yard so the same sequence can be checked with live clients.

The release is based on successful deployment 24f25167-1bea-404b-a538-9b79b68cd6de, preserving the latest Permit Pending controls and both crane models. Existing changes are limited to physics, simulation, cargo interpolation and the cargo placement test's new travel timing.

Published as Railway deployment `4eeb06d7-8d5f-44fc-a7c0-d4c1060f7811` (`SUCCESS`, 2026-09-08). The frozen release in `work/crane-impact-release-20260908` passed TypeScript, all 558 release tests and a production build. All 565 source checksums were verified before publishing. The browser ground-box and tower-impact scenarios both displayed PASS using this exact source.

A live two-player test used the normal initial yard: the captain lifted the crate at (7.4, 3.7), then moved it into the crate at (0, 3.7). The observer and captain both saw the struck crate move to x ≈ -1.18 and tip approximately 90 degrees. The saved result is `work/crane-impact-live-collision.json`. Both existing four-client HTTP suites passed for room authentication, movement and exact placement/settled stacking; temporary test players left their rooms afterward.

The live route references the updated physics module. Its force-limited motor code matches the tested module; the platform build produces a different overall world chunk hash. Shared crane geometry is byte-identical to the validated build, all game routes and health respond successfully, and audio manifests are unchanged. Public checks are recorded in `work/crane-impact-live-after.json`.
