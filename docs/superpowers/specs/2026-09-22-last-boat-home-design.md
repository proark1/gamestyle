# Last Boat Home — approved design and implementation plan

Approved in conversation: cooperative survival, immediate giant fish, safe/risky route, readable storm hazards, afloat rebuilding and a harbour escape. Target maximum round length: four minutes. No new approval is needed for the same approved scope.

Implementation: add an optional survival state to the existing campaign checkpoint. Keep legacy First Delivery checkpoints and tests compatible; new UI starts Last Boat Home. A dedicated survival rules module owns the giant fight, route progress, warnings, wave consequences, rescue, and finish conditions. Existing timed work and material ownership handle rebuilding on floating wreckage at the sinking location. Classic mode remains available.

Fight: reel during calm windows, release and brace during surges; steering changes the boat's lateral position to avoid three marked rocks. Cooperative contributions accelerate the catch, scaled for crew size. The giant can escape; survival remains possible.

Voyage: crew chooses sheltered or exposed water. The exposed route offers bonus salvage and stronger waves. Three warned encounters culminate in an escape lane. Brace to protect cargo; repair/bail or rescue compete with reeling and steering. The gate closes at four minutes; a living crew can escape without its catch. Winning requires bringing every present crew member aboard, so rescuing others matters.

Recovery: wreckage stays near the sinking point. Gather and attach four pieces on the floating wreck platform, then launch a raft. No travel to a static repair dock. Essentials cannot become permanently lost. The clock continues; pressure comes from the closing gate.

Presentation: sea navy #123f50, rescue orange #ff934e, warning yellow #f4d36a, foam #f4f1df, storm blue #557e91. Existing Fredoka display and DM Sans labels. A compact storm countdown and journey strip replace the delivery ticket. Giant silhouette/tether, wave fronts and harbour gates make danger visible. Results summarize the crew's actual rescue/rebuild/cargo outcomes.

Validation: deterministic normal-input completion; ignored warnings versus bracing; route ownership; disaster recovery; material disconnect; deadline and restart; peer checkpoint restore; browser keyboard/touch smoke; scoped lint, types and existing regression tests. Fun and replayability require human feedback and are not inferred from passing tests.

Execution checklist: context/design approved; implement rules; adapt afloat recovery; scene/HUD; regression tests; browser review; preview and report. The writing-plans skill was searched for locally and is unavailable; this document provides the concrete execution plan.
