# Immersive game audio

The requested scope is Crane Clash, Load Bearing, Panic Curling, Zorb Clash,
One More Button and Siege and Desist. The user confirmed “Claw Clash” means Crane Clash.

Use original, reproducibly synthesized bundled WAVs and the existing sound
workshop. Alternatives were provider-generated recordings (requires service
availability) or more live oscillators (bypasses existing mix controls). Bundled
files make the complete sound set immediately available with no credentials.
Existing recordings and workshop replacements take precedence.

Add mechanical motion, footsteps, material contact, action feedback, hazards,
quiet environmental beds and end-of-round cues according to each game's state.
Detect edges from snapshots, suppress stale/repeated events, cap frequent cues,
and stop loops on reset, departure and results. Use the shared player for mute,
saved mixes, voice ducking and background-tab suspension. Preserve existing
gameplay and unrelated working-tree edits.

Validate catalog/file coverage, PCM levels and seams, trigger behavior, repeated
snapshots and resets, manifest replacement precedence, typecheck and game tests.
Device listening remains separate from automated waveform checks.
