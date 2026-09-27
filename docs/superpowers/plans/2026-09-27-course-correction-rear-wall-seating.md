# Course Correction Rear Wall and Seating Implementation Plan

1. Add focused physics coverage for a rear-edge rebound, retained velocity, impact feedback, and no recovery penalty.
2. Add shared bench geometry measurements and pure spectator-placement helpers with tests for hip-on-seat height and end-of-bench standing anchors.
3. Implement the rear boundary collision before obstacle processing and recovery.
4. Use the shared avatar hip measurement to place each scaled seated spectator precisely on the bench; move standing anchors to alternating bench ends.
5. Run Course Correction tests, type checking, linting, formatting checks, and the production build.
6. Rebase onto the latest `origin/main`, push the verified branch to `main`, deploy to Railway production, and smoke-test the public game.
