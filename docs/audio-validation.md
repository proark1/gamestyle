# Audio and voice verification — 6 September 2026

Implemented Handwerker's persistent ElevenLabs workshop and adapted its LiveKit speaking client for both Jumbleyard games. Catalogs contain 70 Stack or Sink and 43 Blend Business prompts. No existing Handwerker files or provider credentials were modified or copied. The local non-secret LiveKit executable was reused; runtime credentials in its local YAML are the provider's public development values.

- 96 combined automated tests pass, including the existing motion, physics, island, multiplayer and farm checks. Audio coverage includes key encryption and game binding, saved-file persistence, custom prompts, per-cue volume, provider limits/errors, duplicate requests, generation locking and cancellation. Voice coverage includes real game-pass validation, game isolation and microphone-release/leave races.
- Type checking and targeted audio/voice/API lint pass.
- Cloudflare and Node/Railway production builds pass. Existing Three.js bundle-size and Vinext route-classification warnings remain.
- Local production HTTP verification on port 3012 checks both admin pages, exact catalog counts, public manifests, forbidden unauthenticated writes, successful authenticated volume saves and invalid file/game paths.
- A real local LiveKit server on port 18880 accepted room creation for both games. Four game sessions per game received correctly signed, room-scoped, microphone-only grants with 120-second validity. Forged tokens, cross-game sessions and departed players were rejected. This checks authorization and signaling setup, not WebRTC media quality.
- The game runtime loads generated files only, with no provider calls during play. All prompt defaults meet ElevenLabs limits. Existing generated files are retained on failed regeneration. No paid generation was performed, and no API keys were transferred from Handwerker.

The local workshop preview is available at `http://127.0.0.1:3012/stack-or-sink/admin` and `http://127.0.0.1:3012/act-natural/admin`. Its isolated integration database has no ElevenLabs key. The local-only test workshop password is `local-audio-check-only`; it is not a production credential.

Not yet validated: generated clips by listening, music/ambience seams in actual media, microphone audio across physical devices/networks, complete mobile workshop interaction or public hosted voice. Per-game ElevenLabs keys and selected voices, and Node LiveKit server variables are still required for those services. See [setup](audio-setup.md).

## Live sound workshop publication

Railway deployment `4f4a039a-2290-4823-87d4-6f04f6d53297` reached SUCCESS on 6 September 2026. Both `/stack-or-sink/admin` and `/act-natural/admin` are published at `https://stack-or-sink-production.up.railway.app`. The combined package passes TypeScript, all 96 tests and the production build.

The initial publication configured a production-only `AUDIO_ADMIN_PASSWORD`; that requirement was subsequently removed at the user's request. API keys and MP3s use the existing persistent `/data` volume, with the encryption master key created there on first use. No provider credentials or generated sounds were copied from local preview, and no paid generation was performed.

Live checks confirm both admin pages return 200, all 113 prompts load, unauthenticated writes return 403, authenticated saves succeed, public playback manifests omit admin metadata, and invalid file paths return 404. The existing four-player room, exact physical stacking and Blend Business suites pass against the published service. Browser verification confirms the live Stack or Sink workshop heading and password field, and the existing browser tab now shows its public URL.

## Password removal requested by the user

The user explicitly requested removal of the workshop/admin password for now. The password field, client header, voice-picker credential prop, server password comparison and Railway password variable have been removed. Same-origin checks and JSON validation remain; the ElevenLabs API key remains encrypted. Anyone using the public workshop can now save settings and request generation with the saved provider key. No paid generation was used for verification.

TypeScript, focused lint, all 96 tests and the production build pass. The updated access regression verifies hosted saves without credentials and rejects foreign or missing origins. Deployment `40154e7e-3e5a-444f-9d1b-55328f2a71a6` reached SUCCESS. Both live libraries accept volume saves without a password header, still reject foreign origins, load all 113 cues, and return valid manifests. Railway confirms the password variable is absent. The existing live browser tab was refreshed and its password field is gone; the ElevenLabs API-key field remains available.
