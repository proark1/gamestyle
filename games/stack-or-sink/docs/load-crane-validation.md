# Independent cargo crane — 2026-09-08

The movable load cable previously began at `(load.x, 16, load.z)`, independently of the rescue crane. It could appear suspended in empty air, and its start height could fall below a high load's hook.

The new cargo crane stands at the left yard edge, x = -9.3 m, z = 0. Its jib rotates at y = 21 m, above the highest point of the fixed rescue crane. The 20.5 m rail covers the full existing ±8 m cargo control range. A trolley moves directly above the displayed load; rope and hook track the rendered, interpolated cargo pose. A released hook retracts under that trolley. The platform crane and its suspended rescue deck stay fixed.

The new mast, turntable and footing use the same SCENERY shapes for rendering and collision. Moving overhead machinery and cable are visual rigging; existing authoritative cargo collision and lift rules are retained. Rigid truss meshes are batched separately from the moving trolley, rope and hook. Crane control and overview use a wider camera framing to keep the supporting crane visible.

Verification in the workspace: TypeScript, targeted lint and all 74 Stack or Sink tests pass. Five new regressions check actual rope/trolley/hook/jib attachment across yard edges, maximum lift heights, fractional rendered positions and initial salvage; connected idle hook; clearance between jibs; mast collision; and authoritative raise/move/lower/release onto a crate. Existing tests still verify all four nine-crate jumps and successful rescue, platform collision and crate bands.

A temporary browser fixture using the production GameScene and authoritative actions/ticks confirms the initial connection, far corner (8, -8), opposing camera angles, and lifting/moving/releasing a crate on a prepared two-crate stack. The resulting three-crate stack stands and the hook retracts. This is a prepared cargo scenario, not a full manual round from the initial yard.

The publish candidate preserves the latest successful live baseline c0f783e2-6118-409b-b6b2-9508316b1f1e. Only geometry and scene integration change among existing files; the cargo rig, its tests and these two documents are added.

Published successfully as Railway deployment `3c282e89-36f0-44f6-ba80-600ef34fa87b` on 2026-09-08. The frozen release `work/load-crane-release-20260908` passed TypeScript, all 552 release tests and the production build; all 559 source checksums match `work/load-crane-release-manifest.json`. The same browser lift/move/stack scenario also passed using this frozen release.

Post-deployment checks confirmed the live scene contains the moving cargo rig and its geometry/rendering bundles match the validated build byte for byte. All seven game routes, collection and health return successfully, and audio manifests are unchanged (`work/load-crane-live-after.json`). A two-client live check successfully attached, raised, moved, lowered and released one shared crate. Both existing four-client room and placement/settling integration suites also passed; all temporary test players left their rooms.

The actual live practice UI was opened, a visible crate selected and crane control activated. The wider camera visibly showed both cranes and the load cable connected through its trolley to the new left-hand crane.
