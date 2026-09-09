# Tiptoe Thieves sound workshop

The Giant uses the collection’s existing audio workshop at `/dont-wake-the-giant/admin`, with a music-note menu button, editable prompts and dialogue, previews, per-cue and category volumes, and the existing generation and cancellation controls.

Its default speech voice is the already selected collection narrator, The Chaos Commentator. The saved voice ID and owning account key are inherited when the Giant has no selected voice; an explicitly saved Giant voice is preserved. Selecting a new collection narrator includes all four games. No new voice audition is necessary.

The library describes indoor cottage Foley: three footstep takes for wood, books, fabric, skin and metal; every treasure and tool pickup/placement; the teaspoon turning; banking, tickling, falling, rescue and escape; the giant’s arm, sneeze and awakening; room ambience, breathing, five music states and short contextual narrator lines.

Playback uses confirmed world changes and movement distance. Late joins, reconnect gaps and old packets do not replay accumulated sounds. Crouching quiets footsteps. Breathing stops when the giant wakes; urgent music follows escape, high wakefulness or approaching sunrise. Leaving returns to menu music. The shared player supplies autoplay unlocking, distance attenuation, speech/crew voice ducking, mute, hidden-tab suspension and disposal.

As in the other games, gameplay only reads saved clips. Workshop generation creates the audio files; adding the route and prompts does not itself call ElevenLabs. Existing procedural tones are replaced by the managed library so the workshop mix governs all game audio. Missing clips stay silent until generated.

Validation covers prompt/provider limits, material coverage, event transitions and duplicates, reconnects, narrator/key inheritance and preservation, generated-file publication, route responses, type checking and production builds. Listening and hardware playback require generated clips and are separate from automated verification.
