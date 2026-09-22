# On the Ropes

Approved in conversation: four players, two teams, one active boxer and one
corner partner per team. Preserve the collection's Nico avatars, wardrobe,
palette, lighting, room controls, peer voice, input conventions and party flow.

Build readable arcade boxing with charged punches, directional guard, dodges,
stamina, balance, knockdowns and springy ropes. Use Cannon at 60 Hz for movement
and impulses; resolve attacks and tags in the authoritative game simulation.
Attack windups lock direction. Resolve simultaneous hits before knockdowns.
Cosmetics never change collisions. No strikes against reserves or grounded players.

Tagging requires both partners holding the tag action, an upright boxer at the
own corner, no active attack/dodge/stagger, one second without taking a hit,
and an eight-second team cooldown. A 0.45-second hand slap completes the swap;
a hit or leaving the corner cancels it. Reserves recover and can prepare a
limited towel assist for their boxer at the corner. Prototype a charged rope
assist with visible windup and cooldown. Reserves move only on their own apron.

First to three knockdowns; three-minute active fight clock. Four-second safe
stoppages reset positions and rotate fighters. Simultaneous knockdowns award
both sides; equal winning scores continue in sudden death. Tied timed matches
enter a 45-second sudden death, then draw, keeping party rounds bounded.
No voluntary tag is possible while down; rotation during a stoppage is separate.

One polished ring with soft arena details, animated ropes, shared character rigs,
readable team corners, impact effects and synthesized sound fallbacks backed by
the shared audio workshop. Desktop and touch share the same compact controls.
Use the existing renderer quality policy and reduce motion when requested.

## Implementation sequence

1. Typed world, sanitized inputs, fixed-step combat/physics, bots and peer adapter.
2. Ring and Nico boxing poses, interpolation and bounded feedback effects.
3. Shared room/voice toolbar, onboarding, HUD, controls and game audio.
4. Register browser/installed routes, collection, party, analytics and audio.
5. Test combat, tags, scoring, recovery checkpoints and registry integration;
   typecheck and lint, then inspect actual desktop/mobile browser gameplay.

Existing unrelated work stays intact. No deployment is requested. Test evidence
must distinguish automated local validation from human internet playtesting.
