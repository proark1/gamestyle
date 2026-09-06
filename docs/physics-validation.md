# Stack or Sink physics validation — 2026-09-06

The physics release contains 39 passing tests. It covers every salvage kind on a crate, exact preview commitment, stale or obstructed preview rejection, rotation, shed collision from five directions, roof and overhead contacts, falling loads, crane sweep blocking, player collision, rescue, win/loss, concurrent room admission, authentication and idempotency. Eight balanced crates remain stable for one simulated minute. A settled stack wakes and falls after its support is removed, including after room serialization. Fixed-step motion is consistent across differently split HTTP ticks.

The production build passes TypeScript and builds successfully. Four HTTP clients create and join a crew, move, carry a bathtub, place its exact preview onto a crate, and observe the settled object from another client. The existing four-client capacity/authentication/control tests also pass locally.

Browser checks exercise practice, movement, pick-up, rotation, the Place button, mouse placement and displayed object identity. These checks identified side-face aiming and a footer blocking the practice button at 1280 × 720; both were corrected. The preview has an outline, and meshes are rebuilt when an object's kind changes after reset.

Physics uses compound cuboids for solid geometry and an upright player controller. Rounded edges and small cosmetic trim are visual details. This is game rigid-body physics, not deformable-material or fluid simulation. Four HTTP clients are automated checks, not a four-person human playtest. No claim is made that every possible bug has been eliminated.

The deployment is packaged from the last published revision plus the owned physics files in `work/physics-release`. Unrelated collection/Act Natural work in the shared checkout is excluded from this release.

Railway deployment `3b32010a-2abb-44cd-9286-01dfd01f444d` is live at https://stack-or-sink-production.up.railway.app. The four-client carry-and-stack integration test passes at that public URL. The corrected practice button was verified by clicking it at 1280 × 720, and the final mouse-placement check visibly stacked a rotated bathtub on a crate with matching x/z coordinates and the expected support height.

The concurrent GameStyle task subsequently published deployment `25424767-257d-49ec-8a3f-1f261cc889d4`, retaining these physics changes and moving the game's page to https://stack-or-sink-production.up.railway.app/stack-or-sink. Both public four-client suites were rerun successfully against that combined deployment. The transient 502 during its service switch cleared when deployment completed.
