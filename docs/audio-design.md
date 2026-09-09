# Jumbleyard sound and voice

Adapt Handwerker's existing ElevenLabs workshop and LiveKit voice architecture, as requested. Keep independent Stack or Sink and Blend Business libraries, saved prompts, encrypted provider keys, preview files, per-cue and category gain, voice selection, missing/outdated generation queues and cancellation. Existing working files survive failed regeneration. Gameplay reads published files only and never calls a paid generator.

Use realistic outdoor Foley, restrained instrumental music and layered ambience. Describe physical material, contact, weight, environment and decay in every effect prompt. Footsteps have three variations per surface. Stack uses coast, surf, wind, water, salvage and crane; Blend Business uses pasture, foliage, hoofsteps, grazing, cows, gate locks, electricity and ladders. Narration uses short English lines consistent with the existing game UI.

Use actual movement and confirmed snapshot changes, with distance attenuation, bounded polyphony, repetition limits, smooth loop transitions and speech ducking. Reset comparisons on round changes, rejoin and long snapshot gaps. Pause audio on hidden tabs and release all audio on navigation. Farm sounds treat every cow identically; voice never exposes cow ownership or position.

Microphone chat is optional, initially off, with listen-only joining, device selection, open mic, hold-to-talk, participant volume and speaking indication. Rooms and credentials are isolated by game. Verify stored room membership before issuing short-lived microphone-only LiveKit grants; revoke departed and expired members. Do not add recording.

The workshop permits public browsing, editing and generation without an administrator password, as requested by the user. Writes still require the game's origin. Provider credentials stay encrypted on the server. Node retains audio beside the existing SQLite database; Cloudflare uses D1 and R2.

Validate catalog limits and coverage, storage/encryption/cancellation, movement and event transitions, room authorization, voice grants and cleanup, type checking, lint and both production builds. Real generation and acoustic review require an ElevenLabs key; remote voice testing requires a configured LiveKit service and multiple microphones.

Sources checked: [ElevenLabs sound effects](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), [music](https://elevenlabs.io/docs/api-reference/music/compose), [LiveKit grants](https://docs.livekit.io/frontends/reference/tokens-grants/).
