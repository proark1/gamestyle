# Stack or Sink cinematic audio

Approved on 2026-09-07: stronger cinematic music and effects, grounded in natural coastal ambience and believable materials.

Keep the 70 existing recordings and their saved workshop edits. Add independently editable coastal details, material landing variations, secondary material movement, impact alternatives, cable strain, two cinematic gameplay tracks and a brief rescue accent. New cues fall back to existing recordings while generation is incomplete. No provider calls occur in gameplay.

Implement a Stack-specific audio director driven by confirmed snapshots. Surf recedes with height, wind becomes more exposed, and close flood detail follows distance above the water. Music responds to flood progress and player danger with smooth transitions. Nearby material movement produces restrained, rate-limited creaks and rattles; stationary stacks stay quiet. Wet objects drip only when lifted out of water. Gulls and palm movement occur at irregular intervals with quiet gaps.

Reuse the shared loop seam treatment and distance filtering for Stack. Preserve per-cue and workshop category volume controls, speech ducking, mute, hidden-tab suspension, reconnect resets and disposal. Select available variants without immediate repeats. Warm Stack action cues within a bounded cache, prioritizing nearby contacts during multiplayer activity.

Implementation order: add catalog and acoustic director; connect snapshots and local movement; extend shared playback only where needed; verify event timing, range, mixing, fallback, cleanup and generation constraints; run type checking, relevant tests and the production build. Prepare a resumable generation script that skips existing files and never retries an uncertain paid request. Verify actual generated audio separately from code tests.

Publishing to the current shared site is a separate final step after validation. Do not include unrelated workspace work in a release or claim recordings were auditioned without listening.
