# Cage Clash

Play at `/cage-clash`. This independent copy of the On the Ropes foundation has
two fighters, four private fighting styles, an octagonal cage, kicks, clinches,
takedowns, guard/mount transitions, reversals, escapes and timed submissions.
Solo practice starts without a database. Multiplayer uses the shared peer rooms
and direct voice, with a two-human capacity. Bots occupy empty seats and take
over departed fighters. The four-player party playlist excludes this duel.

Three 60-second rounds end in KO, submission or a points decision. Points are
actual damage dealt, eight per takedown and five per positional advance. Between
rounds, stamina resets and health recovers by eight, capped at 100. Ties draw.

## Controls

WASD/arrows move, Space charges/releases punches, F kicks, E grapples, Shift guards,
and Q dodges. Touch uses a joystick and five contextual buttons. During clinches,
hold E to drive a takedown, Shift to defend or Q to break away. On the ground,
Space strikes; hold F to advance/reverse, E initiates a submission, and Q escapes
or stands up. A submission's gold pulse shows when to hold E; defenders guard or
escape. Under mount, escape first returns to guard. Five seconds of inactivity
stands both fighters up. Submission attempts expire after ten seconds.

## Ownership and recovery

All game implementation stays in this folder. `signage.ts`, `ringside.ts`, audio
playback and input handling originated from boxing and now evolve independently.
Scene loading is deferred; rendering and snapshots bypass React, with a paced HUD.
The scene uses the collection's Nico avatar, wardrobe, renderer quality and reduced
motion policies. Near cage fencing is translucent for readability.

Human selections use SHA-256 commitments salted with 128 random bits and bound to
selection generation and player identity. A commitment is immutable; identical
replays are harmless. Reveals require both locks and must match their commitments.
Public snapshots hide all styles until the countdown and never include bot secrets.
Browser session storage retains a player's own secret across a reload. Thirty-second
selection timeouts reset abandoned locks. Bot choices are made before human locks.
This protects pre-match selection fairness within the existing player-hosted model;
it does not turn the shared peer engine into a cheat-proof competitive server.

## Validation on 2026-09-22

- 21 focused game tests cover native SHA-256 equivalence, commit/reveal privacy,
  immutable/replayed locks, timeout, octagon containment, input sanitization and
  touch buffering, style strengths, guards/parries/dodges, missed-attack recovery,
  knockdowns, clinches, takedowns, ground transitions, all-style submissions,
  defenses, all match endings, all 16 bot matchups, JSON checkpoint recovery,
  rematches and two-seat room admission.
- Full repository suite: 1,850 tests passed after integrating the new game. Shared
  adapter tests now honor room capacity; Cage Clash also joins peer invariant tests.
- Two real local WebRTC clients passed private selection, simultaneous reveal,
  direct synthesized voice audio, strike damage, guest-initiated takedown, abrupt
  host recovery and bot replacement. This is local transport evidence, not a
  physical-device or restrictive-network test.
- TypeScript and architecture checks passed. Cage Clash and modified peer test
  files passed scoped lint. The Node/Railway production build completed with both
  `/cage-clash` and `/cage-clash/admin` routes.
- Browser inspection covered selection, solo starts, phone touch strike input,
  standing/ground HUD, results and rematching at desktop and 390×844 layouts. No
  browser errors were recorded during those checks.
- The combined `npm run check` remains blocked by existing formatting differences
  across the working tree. Full lint reports two unrelated issues in
  `shared/wardrobe/WardrobeView.tsx` (status element and unhandled promise).
- Shared tests also exposed existing boxing analytics keys `switch_team` and
  `switch_role`; these were normalized to kebab case without changing boxing rules.

Commands:

```sh
node scripts/test.mjs games/cage-clash
node scripts/peer-integration.mjs cage-clash
npm run typecheck
npm run check:architecture
npm test
npm run build:railway
```

Local preview: `node scripts/dev-peer.mjs --port 5183`, then `/cage-clash`.
No deployment was performed.

## Immersive audio pass — 2026-09-22

Cage Clash includes 38 original procedural stereo WAV recordings (about 10 MB),
with no external samples or generation service required. The bank adds glove and
kick impacts, canvas footwork, cage rattles, mat landings, grappling cloth, local
low-stamina breathing, round bells, a ten-second warning, crowd ambience and
reactions, result flourishes, and optional percussion music.

`audio/director.ts` derives cues from authoritative snapshots for solo and peer
matches. It retains copied values rather than mutable simulation references,
suppresses old event backlogs on join/reset/time rewind, limits crowd reactions,
and stops submission and grappling loops outside active fights. Hit events carry
an optional move so kick, jab and heavy punch impacts can differ. The shared
SiteAudio mixer owns all playback, preferences, visibility suspension and cleanup;
there is no separate oscillator context bypassing the game's volume controls.
Workshop recordings and saved cue volumes take precedence over bundled defaults.

Regenerate the bank from the repository root:

```sh
node --import tsx games/cage-clash/scripts/generate-audio.mjs
node scripts/test.mjs games/cage-clash platform/audio/expansion.test.ts
```

Audio validation: 45 focused game and audio tests passed, including PCM format,
audibility, headroom, distinct recordings, loop seams, saved mix overrides,
move-specific sounds, countdown/round/results, deduplication, reconnects,
reaction cooldowns, footsteps, breathing and grapple loop state. TypeScript,
scoped lint and architecture checks passed. Browser checks decoded all 38 WAVs
through the real player and verified effects plus loops, mute, master volume,
music off/on, the shared ducking mechanism, hidden-tab suspension/resume, reset
and AudioContext disposal. These are playback and signal checks, not a subjective
listening review or a physical-device speaker test.
