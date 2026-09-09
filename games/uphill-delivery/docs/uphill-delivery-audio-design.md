# Uphill Delivery sound design

Approved direction, 2026-09-07: natural mountain ambience, tactile material Foley,
positional world detail, quiet variation, and contact-driven impacts.

Implementation sequence:

1. Publish supporting collider IDs and bounded sofa contact events from physics.
2. Add a delivery audio controller with snapshot discontinuity guards, all-player
   footsteps, positional interactions, and contact-only sofa scrapes and impacts.
3. Extend the existing workshop catalog with three-take effects and separate
   valley, pine, exposed-wind and indoor layers. Preserve saved cue IDs and gains.
4. Validate collision timing, surface mapping, reconnects, catalogue coverage,
   audio lifecycle and multiplayer compatibility, then run typecheck and builds.

Keep music subordinate to the environment; smoothly lower outdoors inside the
customer room. Schedule birds, bells and creaks irregularly with quiet intervals.
Only moving goats make hoofsteps, only loaded bridge planks creak, and only a
moving, supported sofa scrapes. Release is cloth movement, never a landing.

Use the existing saved-file workshop and speech ducking. Missing audio remains
silent; gameplay never generates assets. Generated clips require listening for
clean onsets, seamless repeats, believable material weight and comfortable levels.
The local preview initially has no saved clips or provider key, so acoustic QA
must be reported separately from code and physics verification.
