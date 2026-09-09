# Electric fence implementation

The approved design is in `act-natural-electric-fence-design.md`. The referenced writing-plans skill is not installed; this plan follows the existing farm architecture.

1. Add optional shock timestamps and shared contact, stun, and exposure rules. Apply them in the authoritative simulation, interrupt actions during the stun, and let the practice farmer observe exposure.
2. Extend existing cow models with recoil, electrical arcs, and a visible exposure marker. Keep idle fence wires visible and distinguish energized wires. Explain the hazard in the game help and contextual hint.
3. Publish a positional shock cue and retain the proximity warning loop. Bundle original generated WAV files as defaults, preserving workshop replacements and mixer settings. Deduplicate shock events across snapshots.
4. Test powered and unpowered contacts, edges/corners, timing, objectives, privacy, legacy snapshots, audio events, fallback assets, and mixer behavior. Run the farm/audio tests, typecheck, lint on affected files, and production builds. Inspect the playable preview when browser access is available.
