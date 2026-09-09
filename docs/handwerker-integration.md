# Handwerker in Jumbleyard

Imported from the local `handwerker` checkout on 2026-09-06. Both current variants are part of the same Jumbleyard application and Railway service:

- **Permit Pending**: `/chaos`, audio workshop `/chaos/admin`.
- **Brick by Hand**: `/first-person`, audio workshop `/first-person/admin`, material credits `/first-person/credits`.
- Saved builds and challenges: `/build/:id`. Root invitations using `?raum=CODE` open Permit Pending; existing `?room=CODE` links still open Stack or Sink.

The landing page keeps the existing illustrated two-column shelf, now with six games. Imported game rules, physics, controls, construction tools, saved builds, challenges and audio catalogs live under `games/`. Full page navigation gives each WebGL game its own lifecycle. Shared global game styles exclude the Handwerker routes; imported global styles and theme apply only while a Handwerker route is active, including portalled dialogs.

## Shared hosting, separate game state

All imported endpoints live under `/api/handwerker/`. They use the existing database adapter and persistent volume. The additive migration creates `handwerker_rooms`, `handwerker_players`, `handwerker_fp_rooms`, `handwerker_fp_players`, and `handwerker_saved_builds`. The original games' `rooms` table is unchanged. Audio uses the existing tables with separate `chaos` and `first-person` game IDs and storage folders. SQLite foreign keys enforce cleanup for the imported player tables. Keep one Railway replica.

The existing `PUBLIC_GAME_ORIGIN` setting also applies to imported room, build, audio and voice requests. Permit Pending retains its optional LiveKit voice integration; `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` must be configured to enable it. Provider room names use `handwerker-chaos-` so its cleanup cannot affect another deployment's rooms. The original four games retain their peer voice. Audio generation uses the imported admin workflow and the shared `AUDIO_MASTER_KEY` or existing local master-key file.

This imports source code, static assets and tests. The original checkout and its Railway deployment are untouched. Existing Handwerker production rooms, saved builds, generated sound files, stored provider keys and environment secrets have not been transferred. Their preservation would require a separate data migration, including decrypting and re-encrypting stored keys for the destination master key.

## Validation

`npm test` includes both game families. `npm run test:handwerker` runs the imported rules and storage checks alone. Game-specific HTTP checks are under `games/chaos/scripts/` and `games/first-person/scripts/` and target the namespaced endpoints; pass a running server origin as their first argument. Historical audio migrations live under `shared/audio/construction/fixtures/upstream-migrations/` solely for isolated regression tests, outside the production migration chain.

Use `npm run build:railway` for the shared Node deployment and `npm run build` for the existing Sites target. No second Railway service is needed.

Completed checks on 2026-09-06:

- `npm test`: 424 tests passed, including importing into an existing Jumbleyard database, preservation of its room/audio records, duplicate room-code isolation and player cleanup.
- `npm run typecheck`, `npm run build:railway`, and `npm run build`: passed. Existing large-chunk and Vite configuration warnings remain.
- `check-collection.mjs`: all six links and game routes, imported admin pages, texture/card assets, legacy invite redirects, separate audio manifests and rejected foreign origins passed.
- `check-multiplayer.mjs`: four Permit Pending players, room limits, authentication, concurrent construction, shared state and host transfer passed.
- `check-first-person.mjs`: 26 checks passed over 84 HTTP requests, including material pickups, mixing time, concurrent placement, replay protection, structural support and reconnection.
- `check-growth.mjs`: saved builds, private shelf isolation, public preview privacy, independent copy modes, remix attribution and rescue flow passed.
- The original four games each passed real WebRTC data/audio and host-handover checks against the shared local server. Uphill Delivery initially timed out while other checks/builds were active; its separate rerun passed, followed by Tiptoe Thieves.

HTTP integration used a separate local test database. Browser interaction, physical device rendering, external networks, real LiveKit voice and paid audio generation were not exercised. Neither hosting target was deployed by this import.

## Live deployment — 2026-09-07

Published the combined application to the existing Railway `stack-or-sink` service in production: https://stack-or-sink-production.up.railway.app. Deployment `77ad0d8d-0779-499e-b62d-437dc771e927` reached `SUCCESS`; startup applied migrations using the existing `/data` volume and served on port 8080.

Live verification passed for all six game cards and routes, imported admin pages, static assets, invite redirects, audio namespace isolation and origin rejection. Permit Pending passed the four-player multiplayer/host-transfer check. Brick by Hand passed all 26 integration checks across 84 requests, including construction, shared state, replay protection and reconnecting. Temporary test players left their rooms afterward. Existing Handwerker production data, provider credentials and generated audio were not migrated.

## Permit Pending audio restored — 2026-09-07

The live Permit Pending playback manifest was empty because the original import
had not copied generated audio. Restored all 259 existing recordings (19,026,399
bytes) and their saved audio settings from the original Handwerker deployment
to Jumbleyard's persistent volume. This was a data repair; no application
redeployment or paid generation was needed. Other games, rooms, provider keys,
and the original deployment were unchanged.

`games/chaos/scripts/restore-chaos-audio.mjs` defaults to a read-only plan and
refuses to overwrite saved destination cues. It copies files before publishing
their records atomically, preserves stale-recording status, and records a backup
and SHA-256 inventory under `/data/audio-migrations/chaos-1788787069700`.
An isolated database check covered file restoration, metadata, preservation of
other games and existing keys, and refusal to overwrite an existing library.
Live verification passed for all 265 published cue URLs (including six stair
fallbacks), with join/UI sounds, every music phase, site ambience, and footsteps
available. No browser listening test was performed.
The source still had 85 ungenerated cues and 10 stale recordings; this recovery
preserves that state. Brick by Hand's original audio has not been migrated.

## Card illustrations

Generated with built-in ImageGen: `public/images/permit-pending.png` shows four toy-like builders, sofa delivery, crane and house; `public/images/brick-by-hand.png` shows a first-person brick and trowel with builders and a mixer beyond. Both use warm sunshine, cream, forest green, yellow hard hats and orange brick, without image text or interface chrome.
