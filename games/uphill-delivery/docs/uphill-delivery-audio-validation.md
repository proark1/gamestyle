# Uphill Delivery audio validation — 2026-09-07

Implemented the approved natural sound direction in the local checkout.

- Authoritative supporting collider IDs select stone, ice, bridge timber,
  customer floor, turf and sofa upholstery footsteps for every crew member.
- Actual sofa collision events produce strength-dependent impacts. Releasing a
  grip produces cloth Foley. Contact events are bounded and resting contacts
  remain quiet; restart clears the contact state.
- Grounded movement drives material-specific sofa scrapes; carrying and loading
  the rope bridge drive occasional creaks. Goats have positional hoofsteps and
  sparse bells, and nearby pines provide irregular bird calls.
- Elevation and proximity blend mountain, pine, ridge and room ambience. Entering
  the cottage lowers outdoor layers. Ambience buffers overlap their seam; distant
  Foley loses high frequencies and repeated takes vary slightly in playback rate.
- Late joins, old packets, reconnect gaps and restarts suppress historical effects.
- Existing 30 cue IDs and saved mixes remain supported. Added 44 cue definitions
  for a 74-cue workshop; all prompts fit provider limits. Existing saved clips are
  not overwritten. Music is lowered during play and existing speech ducking stays.

## Verification

- 56 tests passed across delivery audio, actual physics, camera, motion,
  connections, shared audio storage/generation, and giant audio compatibility.
- TypeScript and targeted lint passed.
- Default production build passed. Node/Railway production build passed.
- Local game route returned HTTP 200; the workshop exposes all 74 cues.
- Generation dry-run identified 44 missing details, 109.2 seconds total, with no
  billable requests. `games/uphill-delivery/scripts/generate-delivery-details.mjs` fills only missing
  detail cues, preserves saved files, and can resume after interruption.

## Initial handoff, before live activation

The live Railway workshop was inspected read-only: it has its original 30 saved
clips and an available generation key. The local preview has neither clips nor
a key. No deployment or paid generation was performed in this task.

After publishing the new catalog, run the generation script with the live origin
and `--generate` using `node --import tsx`. Then audition every new clip, check
onsets and loop seams, and balance on headphones and speakers in multiplayer.
Code tests do not constitute listening validation. No claim of acoustic sign-off
is made until those files exist and have been auditioned.

## Live activation

After the user requested “bring live”, verified the Railway production service
and its active successful deployment `2b0222b3-0215-4a14-9d2a-8729f69be918`.
The shared release already contained the complete final delivery implementation:
the delivery controller, Game integration, physics, types, simulation, catalogs,
shared player, seam blending and generation script matched the frozen deployed
source in `work/farm-audio-release-20260907` byte for byte. No redundant deployment
or service restart was needed.

- Generated all 44 missing recordings with the saved live ElevenLabs key. The
  published delivery manifest now contains all 74 playable cues.
- Downloaded and decoded all 44 new MP3s: durations 0.52–24 seconds, finite samples,
  audible signal and no excessive clipping. Measurements are saved in
  `work/uphill-audio-media-validation.json`.
- Before/after checks preserved all 229 existing saved clips across the four game
  libraries, including their file references, gains, categories and loop flags.
  All saved mixer settings were unchanged.
- The live four-player delivery integration check passed, covering routes,
  artwork, authenticated room access, capacity, shared carrying and idempotent
  release. Temporary test players left in cleanup.
- Replaced this task's local preview tab with the live game at
  https://jumbleyard.up.railway.app/uphill-delivery.

Audio integrity and live availability are verified. A subjective full-round
listening review on headphones and speakers is still not claimed.
