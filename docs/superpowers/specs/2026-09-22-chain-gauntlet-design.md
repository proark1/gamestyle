# Chain of Fools: construction gauntlet

Approved in conversation September 22, 2026. Preserve the four-worker safety line and rescue mechanics. Replace the easy lower route and cargo yard with a more demanding authored course, moving machinery and distinct construction-site surroundings.

## Rules

A recoverable rope hang remains rescuable. Any worker lost below the fall boundary, or the whole unanchored crew hanging without support, resets everyone to the gate. Reset movement, anchors, hazard phases, section progress and the 4:30 attempt timer together. Retain wipe count and best distance. Section markers grant no respawn advantage. A short input lock gives the crew time to orient after a wipe.

## Course and presentation

Keep the 174m finish. Offset narrow opening beams, constrain the lower route, stagger scaffold platforms, preserve the balance bridge and wrecking ball, replace the flat cargo yard with a translating cargo deck and tall alternating barriers, and add timed suspended loads to the final crossing. Provide stable staging areas and warning paint/lights. Moving colliders and visuals use the same deterministic time function; there is no random invisible damage.

Add layered site detail, machinery, animated background crane loads, service lights, structural supports, safety signs, cables, rubble, equipment and section-specific color. Decorative objects stay beyond the playable bounds. Large effects must preserve visibility and respect reduced motion. Reuse existing construction sound cues for moving hazards and impacts.

## Implementation sequence

1. Define authored geometry and deterministic moving boxes in course.ts.
2. Thread explicit collider sets through support, movement, rope, hauling and hazard collision. Carry standing workers with the moving deck, resolve swept machinery contacts, and keep safe platform recovery.
3. Replace checkpoint recovery with atomic gate resets; revise instructions and HUD in English/German.
4. Adapt bot route choice and hazard timing. Build visual machinery from the same bounds and add scenery.
5. Test resets, rescued hangs, dynamic collisions, independent worlds, frame rates and full bot traversal; inspect desktop/mobile rendering. Run typecheck, lint and production build.
6. Publish a clean release including current production changes, then verify live health and game flow.

## Acceptance

The main route demands lateral movement and timed crossings. The lower route cannot simply bypass the jumps on a broad floor. A failed run never respawns mid-course. Machinery does not pass through workers, carry them through static walls or desynchronize between rendering and simulation. Bots can finish and assist a human. All existing collision regressions remain covered, updating only assertions whose intentional rules changed.

The writing-plans skill is not installed in the available skill directories; this document includes the implementation sequence directly. The user's approval authorizes implementation without another design gate.
