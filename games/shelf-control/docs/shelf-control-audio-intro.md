# Shelf Control audio and opening explanation — 8 September 2026

The game now includes an original 40-second looping score with soft keys and bass,
plus four short shoe sounds built from heel contact, toe contact and sole brushing.
These are locally synthesized assets, not recordings of real shoes. Their source
is `scripts/generate-showroom-audio.mjs`; no external samples or generation services
are needed. All five WAVs ship in `public/audio/shelf-control/`.

The score uses half the saved music category level (0.09 before master gain with
the default mixer). Footsteps use 0.20–0.24 strength, a 1.1-unit stride, and fade
to silence within seven units. The four takes avoid immediate repeats. Only
positions supplied by the player's private snapshot can produce a step; stationary
figures, newly visible figures and reconnect jumps do not. Workshop interaction
sounds and saved category mixes are retained.

One audio player lives from entrance to exit, independent of scene reloads. It
preloads the five bundled clips, unlocks on interaction, respects mute and hidden
tabs, and clears positional effects on leaving or changing rounds. The score is
available even when the workshop API has no published library.

Creating or joining a room first opens a readable explanation of both roles,
hiding time, escape routes, controls and winning conditions. “Got it” continues
the requested create/join action; cancelling makes no room request. This occurs
before room membership so reading cannot consume a player's hiding countdown.
The explanation is required once per page visit and remains available through
Help. Restored sessions resume directly. Failed joins return to the code form.

Validation includes PCM format, non-silence, headroom, distinct steps, loop seam,
first-interaction playback without a workshop, duplicate-loop prevention, mute,
visibility suspension, disposal, private movement, reconnects and round resets.
The Shelf Control and shared audio suites pass 86 tests. TypeScript, focused lint,
formatting and the production build are also checked. No browser interaction or
headphone/speaker listening test was performed.

## Public release

Published at https://jumbleyard.up.railway.app/shelf-control on 8 September 2026.
Railway deployment `d2331718-7ad5-4614-a088-9c5f24af001f` reached `SUCCESS`.
The release starts from the hash-verified live deployment
`5b1ff32b-d598-469a-b0da-08d2e13d9699`, changing only four Shelf Control files
and adding eight files. All 860 release source hashes are retained in
`.tmp/shelf-audio-live/source-manifest.json`.

The isolated release passed all 716 repository tests, formatting, TypeScript,
lint, architecture checks and the production build. Public verification at
20:09 UTC confirmed twelve routes, the new briefing and audio client modules,
and exact hashes for all five bundled WAVs. All nine existing public audio
libraries and their mixer settings remained identical. The existing service,
public address and persistent data volume were retained.
