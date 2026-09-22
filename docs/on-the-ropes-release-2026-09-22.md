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
