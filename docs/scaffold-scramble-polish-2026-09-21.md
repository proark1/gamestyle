# Scaffold Scramble polish — 2026-09-21

Approved scope: polish the existing game with a clearer briefing, compact HUD, contextual cleaning guidance, reliable touch input, cleaning feedback, and a useful results summary.

## Design
Keep the existing Fredoka / DM Sans type system and the game's cream, teal, amber, and glass-blue palette. The spirit level remains the central instrument. Make the lobby a short shift briefing: objective, duration, three cleaning steps, role choices, and the selected role's explanation. Hide play-only controls until the shift starts. On narrow screens prioritize cleaned windows, tilt, and time; omit secondary floor and wind readouts. Use the existing three-dimensional game scene as the visual backdrop.

## Implementation
- Game.tsx: briefing, contextual prompts, progress, urgent timer, results, semantic status outputs, and pointer capture.
- controls.ts: combine held touch controls with keyboard input, with an explicit disabled state.
- guidance.ts: choose safety, role, and cleaning prompts using the simulation's reachable-window function.
- simulation.ts: expose the existing reach calculation so guidance and cleaning share the same geometry.
- scene.ts: clear keys on focus/visibility loss, suspend input outside play, reserve Tab for navigation, use T for tool switching.
- ui-copy.ts: English and German copy.
- style.css: responsive HUD, briefing, results, feedback, reduced-motion treatment.

## Verification plan
Run the Scaffold Scramble simulation/audio suites and input/guidance regressions, targeted lint, project typecheck, and desktop/mobile browser checks. Preserve unrelated edits, including concurrently added peer-room integration. No production deployment is included.

## Verification results
- 22 Scaffold Scramble tests passed, including audio, simulation, held-touch cancellation, combined keyboard/touch input, and context guidance through the soap/squeegee cycle.
- Project TypeScript check passed after integrating the concurrent peer-room changes.
- Targeted lint and git whitespace checks passed.
- Browser reviewed at 1280px desktop, 390px and 320px portrait, and 844×390 landscape, with English and German copy.
- Confirmed touch tool switching, readable HUD, help dialog, portrait camera framing, and toolbar wrapping. No browser errors observed in the focused preview.
- Preview harness: `.tmp/scaffold-polish` (temporary development files only); local server port 5184. Production has not been deployed.
- Confirmed a full timed round reaches the results summary, restart resets progress and time, T changes tools, and Tab moves focus without changing tools.
