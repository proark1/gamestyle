# Carry-On Carnage repair design — 20 September 2026

Scope authorized by the user: fix all findings in the Carry-On Carnage QA report.

Keep the current game, visual language and simulation. Reuse the shared movement pad instead of adding a separate gesture system. Reserve distinct space for HUD, playfield and actions. Fit the terminal camera to the available canvas aspect ratio and mark the local player with a gold ring.

Use native modal dialogs for instructions and results, with constrained height, scrolling, focus containment and inert background. Show instructions before starting the timer. Pause the local simulation when help or shared toolbar dialogs are open or the document is hidden. Ignore movement while paused and when editing text; clear held keys on blur/orientation changes.

Translate event messages from their semantic type/detail/item metadata. Translate primary toolbar accessible labels while preserving caller-supplied labels. Charge $150 per unapproved bag once at departure, in addition to any prior rejected-sizer fees, and block item interactions after departure.

Implementation sequence: input and dialog plumbing; responsive regions and camera; translation and fee corrections; scoring/input regression tests; browser sizing and interaction checks; updated QA evidence. Preserve concurrent changes already present in the working tree. Production deployment requires a reviewed coherent revision because the repository deploy script refuses dirty trees.

Acceptance: usable movement without a keyboard; visible countdown and bag quota at narrow/landscape sizes; 44px or larger primary controls; working help and restart; stable timer during dialogs; correct once-only departure fee; English/German gameplay feedback; passing targeted tests and type checking.
