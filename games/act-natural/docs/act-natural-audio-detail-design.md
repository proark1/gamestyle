# Blend Business natural detail pass — 7 September 2026

The user approved the mix polish plus twelve recordings proposed in the audio review.

## Scope

- Add three independent takes each of moving legs brushing grass, a carried wooden ladder flexing, wind-driven water laps in the existing trough, and small bird wing flutters in the trees. The farm catalog grows from 64 to 76 cues.
- Keep existing recordings, cue IDs, saved prompts and mixer settings. Apply downward-only level conditioning to farm animal/environment details and the new carried-ladder family, based on decoded samples. Never boost quiet recordings or change music, narration or another game's sound.
- Track audible farm sources while the listener or cow moves, smoothing gain, pan and distance filtering. Remove attached sound when a cow is captured, escapes or disappears. Reset clears pending and active playback.
- Use one slow breeze envelope for the background and sparse foliage, timber and trough details. Leave space around bird/insect foreground details because the pasture bed already contains these sounds.
- Trigger movement details from measured displacement, excluding teleports, stale snapshots, stationary bodies and inactive cows. Use only public world state; ownership never changes animal sounds.

## Implementation and checks

1. Extend the catalog and a separate list for the twelve additions; scope the generation queue to those additions by default, preserving an explicit option for the earlier pass.
2. Add decoded-buffer measurement and bounded playback gain; test silence, quiet recordings, loud variants, peaks and stereo preservation.
3. Add source tracking to farm playback and test moving listeners/sources, cleanup, refreshed mix and other-game isolation.
4. Extend the farm director with sparse movement details and correlated breeze events; test actual displacement, source positions, privacy, quiet periods and resets.
5. Export prompts, run focused and full tests, type checks, lint and the existing production build. Check workshop availability for generation; never treat missing recordings or a successful build as a listening playtest.

No simulation, visuals, identity, networking or database changes are required. New cue files must be generated through the existing workshop with its saved provider configuration. If that configuration or the current hosting service is unavailable, report exactly what remains before publication and listening validation.
