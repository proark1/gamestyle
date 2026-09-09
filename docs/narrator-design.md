# Shared chaos commentator

Both game sound workshops offer one original narrator: The Chaos Commentator. Warm, lightly gravelly English voice with a light British accent, dry comic timing and playful excitement. The editable default description and audition script live in `shared/audio/narrator-config.ts`.

The workflow is describe → audition → select for both games → generate speech. Voice Design uses ElevenLabs `/v1/text-to-voice/design` with `eleven_ttv_v3`; selecting saves the audition with `/v1/text-to-voice`. Spoken lines use the existing Eleven v3 TTS implementation. Character descriptions never become spoken text.

A reserved `shared-narrator` row in the existing audio settings table persists the draft, audition metadata, created voice IDs and latest standalone speech sample. MP3 files use existing persistent audio storage. The shared row lease serializes narrator jobs across both workshops. Provider errors preserve prior auditions and sounds. Saved audition IDs are reused on repeated selection, avoiding duplicate voice creation.

Selecting updates only `voiceId` for both games atomically; mixes, prompts and keys are preserved. The source game's encrypted key is used for speech in the shared voice, including when the other game has a different account key. If a game has no own key, the chosen narrator's source key is available as a fallback. No secrets are sent to the browser.

The standalone speech box accepts arbitrary English text up to 1000 characters, with playback, transcript and download. Gameplay speech continues to use the sound library's editable cue text and generation controls. Old speech is marked outdated when the voice changes, and is excluded from the game manifest until regenerated.

Native audio players, explicit generation actions, mobile columns, 44px touch targets, and 16px mobile inputs preserve the existing workshop design. No new password gate is introduced.

Provider references: https://elevenlabs.io/docs/api-reference/text-to-voice/design and https://elevenlabs.io/docs/api-reference/text-to-voice/create.
