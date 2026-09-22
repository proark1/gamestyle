# Game audio expansion

The user confirmed that “Claw Clash” means Crane Clash. This change covers six games.

| Game | Previous catalog | Expanded catalog | New bundled files |
| --- | ---: | ---: | ---: |
| Crane Clash | 10 | 18 | 18 |
| Load Bearing | 15 | 28 | 28 |
| Panic Curling | 8 | 23 | 23 |
| Zorb Clash | 8 | 22 | 22 |
| One More Button | 28 | 38 | 10 |
| Siege and Desist | 18 | 32 | 32 |
| Total | 87 | 161 | 133 |

The 133 new files contain original synthesized stereo Foley, ambience and music.
The 28 existing One More Button files are preserved. All six catalogs now have
bundled playback, including the previously absent Crane Clash and Load Bearing
defaults. Published workshop recordings replace bundled files, and saved cue
volumes and category mixes remain authoritative. No provider account is needed.

Crane Clash adds moving winches, cable strain, swinging air, separate concrete
and metal impacts, countdown bells, a draw result and a quiet score. Load Bearing
adds hammer swishes, rotating gravel footsteps, jumping and landing, strained
supports, falling debris, piano danger and crane control feedback. Panic Curling
adds continuous stone and broom friction, gadget bursts, banana tosses, stone
exits, turn and match feedback, rink ambience and a score. Zorb Clash adds
snapshot-based multiplayer effects, dash/brace/turtle/recovery transitions,
ball contacts, rolling rubber, footsteps, charge ambience and a stadium bed.
One More Button adds distinct hazard startups, closing exits, prize accents,
last-heart warnings, alternate footsteps and studio air. Siege and Desist adds
crew movement, sustained winch and bee beds, full-charge feedback, engine turning,
projectile flight, relief horns and a separate loss cue.

Panic Curling and Zorb Clash now use the shared player, including volume, music
preferences, mute, voice ducking, background suspension and disposal. Directors
follow simulation time, suppress repeated snapshots, rate-limit frequent sounds,
and reset their history on a new round. Curling's short crowd cheer is categorized
as an effect so it is valid in the workshop and remains audible with music off.

Regenerate missing originals with:

```sh
node --import tsx scripts/generate-immersive-audio.mjs
```

Existing files are skipped. The generator uses seeded synthesis, retains headroom,
and smooths loop endpoints. The complete cue set is about 161 recordings; the new
files total approximately 50 MB of uncompressed stereo PCM.

Validation commands:

```sh
node --import tsx --test platform/audio/expansion.test.ts games/one-more-button/audio/audio.test.ts
node scripts/audio-expansion-smoke.mjs
node node_modules/typescript/bin/tsc --noEmit
```

All 244 selected game and shared-audio regression tests pass, including the 24 focused audio checks. They check catalog validity, file duration, channel
format, audible energy, peak headroom, unique data, seamless endpoints, saved mix
and replacement precedence, gameplay transitions, repeated snapshots and reset.
Chromium decoded all 161 cues and verified playback, mute, background suspension,
reset and closed AudioContexts for all six banks. TypeScript, targeted lint and architecture checks passed. These are
automated checks; a subjective headphone/speaker listening session has not been
performed. No deployment was performed for this change.
