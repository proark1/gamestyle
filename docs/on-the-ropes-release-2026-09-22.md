# On the Ropes — implementation and validation

Implemented `/on-the-ropes`: four seats, red and blue teams, one fighter and one
corner partner per team. Bots fill empty seats and yield their state to joining
humans. A reserve can request their bot partner's return by holding Tag.

Combat includes quick/charged punches, directional guard, dodging, stamina,
balance, safe knockdowns, springy rope impulses and simultaneous-hit resolution.
Tags require both partners, the own corner, disengagement and a cooldown. Towels
restore stamina at the corner; charged rope assists launch the active boxer.
Focus loss cancels charges without firing them. First to three knockdowns wins;
tied matches use bounded sudden death. Knockdown stoppages rotate the fighters.

Uses the collection's Nico/wardrobe builders, palette, light and renderer quality
policy, shared rooms and peer voice, shared sound workshop with procedural
fallbacks, desktop/controller-compatible keys and touch joystick/buttons.
Registered in the web and installed app, collection, party playlist/guides,
analytics, audio and admin avatar lineup. English/German interface included.

## Validation

- 15 boxing tests: sanitized input, frame-rate independence, punches, guard,
  dodge, same-tick defense fairness, invalid/interrupted tags, cancellation,
  bot tag requests, assists, scoring, simultaneous knockdowns, bounded matches,
  detached snapshots and checkpoint recovery.
- 38 related checks passed: collection identity and registry, all peer adapters'
  party startup/delta reconstruction/recovery, and avatar/wardrobe integration.
- `npm run typecheck`, boxing lint and formatting, and architecture check passed.
- `npm run build:client` and final `npm run build:railway` passed. The latter
  production build was served locally and its actual boxing route inspected.
- Four real local WebRTC clients passed both in-memory coordinator and HTTP
  server runs: generated direct audio, abrupt host recovery, preserved match,
  surviving voice links, and join-order handover. The HTTP run used the local
  preview database, not production.
- Browser: actual lobby/ring, practice countdown and play, knockdown/rotation,
  match result/rematch, 390 × 844 phone layout, shared room creation/connection,
  and standard voice mode/shortcut panel. No captured browser errors in the
  final production lobby. Fixed initially hidden joystick and portrait framing.
- Screenshots: `on-the-ropes-qa/desktop.png`, `on-the-ropes-qa/mobile.png`.
  The collection card uses a capture of the game itself.

The development RSC server timed out compiling its route graph; the production
build route loaded successfully. A subsequent production restart exposed browser
bundles from another preview under `app/installed/.tmp/party-improvements` being
included in the server build. Those generated files were preserved outside the
source tree at `.tmp/preserved-installed-party-improvements` before rebuilding.
Local WebRTC uses generated audio; physical
microphones, real four-person internet latency and subjective balance still
need human playtesting. No deployment was performed.

Approved design is in `superpowers/specs/2026-09-22-on-the-ropes-design.md`.

## Ringside polish

Replaced the placeholder spectators with seated Nico fans in varied wardrobe
outfits. Selected fans wave pennants and react to hits, tags, knockdowns and
the bell; reduced-motion preferences suppress animated reactions. Added wooden
bleachers, backrests, central steps, team bunting, planters, speakers, and a
timekeeper's table with a brass bell and score sheet. Static fans and furniture
are batched together; animated fans retain separate arms and body transforms.
Combat and network state are unchanged.

Validated desktop and 390 × 844 layouts in the production preview. Typecheck,
boxing lint, architecture checks and the production build pass. No captured
browser errors. Physical-device performance still needs human verification.

## Combat and tag-team refinement

Reserve players now tap E or Call/Tag once to request and accept a swap. The
request stays queued through travel and cooldown; a second tap cancels it.
NPC partners cancel charged punches, evade blocking opponents, and return to
the corner. The reserve also meets them at the apron handoff point. Valid tags
atomically exchange roles, clear combat/assist state, then animate both boxers
through a protected 0.65-second entry/exit. Starting in the corner is available
in the lobby when the teammate is an NPC. Status shows the pending call,
teammate role/stamina, and the committed handoff.

Jab–cross combinations, heavy hooks, feints, timed parries, one-use counter
windows, low-stamina guard breaks, and longer recovery on misses replace the
original uniform exchange. Strike timing and punch poses use the same profiles.
Defense decisions are gathered before resolution to preserve simultaneous
trades. NPCs use spacing, circling, delayed defense, combinations and selective
heavy attacks. Added distinct defensive feedback and sound cues.

27 boxing tests pass, including both teams' one-tap NPC recalls under pressure,
reverse and repeated swaps, cancellation, cooldown queuing, inactive-player
protection, host recovery during requests/transit, and real adapter input
packets. 49 additional peer/adapter checks pass (76 total targeted checks).
Typecheck, lint, architecture checks and production build pass. Four real local
WebRTC clients pass against the HTTP preview, including generated audio and
abrupt host recovery. Browser verification confirmed the actual Call/Tag button
returns the NPC, changes the player to the ring, and places the NPC outside.
Boxing rules version is now 2; old boxing checkpoints are rejected cleanly.
