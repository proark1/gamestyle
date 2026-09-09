# Shelf Control validation

The invited-NPC extension is now live; see `shelf-control-bots-validation.md` for its seat controls, behaviour tests and public release verification. The four-human release history below is preserved.

Implemented as a separate `/shelf-control` game with an authenticated `/api/shelf-control` endpoint. The existing room store persists server simulation in a `shelf:` namespace. No migration is required. Exactly four people start a round, with one rotating guard and three anonymous player mannequins among eighteen figures.

## Verification — 7 September 2026

- TypeScript and focused lint pass.
- The complete repository test suite passes: 463 tests, including 16 new Shelf Control tests.
- The Railway production build succeeds and includes the game page and API route.
- Four independent HTTP sessions pass the real 15-second hiding countdown on both the development server and the built production server. The integration checks cover room capacity, authentication, origin rejection, pose changes, role assignment, hidden start snapshots, active snapshots and departure cleanup.
- Unit tests cover through-shelf visibility, view range/facing, removal of hidden carried items and sounds, identical public representations, forged inspection targets, ordered movement, action replay, concurrent joins, cooldowns, five wrong inspections, guard rotation, timed security interaction, both escape routes, timer outcomes, disconnected players and reachability of map objectives.
- The generated collection illustration was inspected directly. No browser visual QA or four-human playtest was performed.

The local review URL is `http://127.0.0.1:3022/shelf-control`. Run `node games/shelf-control/scripts/shelf-control-integration.mjs` against that preview, or supply a local production-server origin as its argument. The integration script cleans up its test sessions. Live verification requires the exact Jumbleyard origin and an explicit `--live` flag.

## Release scope

New files: `games/shelf-control/`, `games/shelf-control/shelf-control.test.ts`, `app/shelf-control/page.tsx`, `app/api/shelf-control/route.ts`, `public/images/shelf-control.png`, `games/shelf-control/scripts/shelf-control-integration.mjs`, and the Shelf Control design/validation documents. Shared edits add its collection card and update the collection metadata from six games to seven.

The shared checkout contains unrelated game/audio work. The user approved publication on 8 September 2026. The release adds only this scope to the hash-verified source of live Stack cinematic deployment `46808707-e648-4c40-9f44-c1ebe212c9df`, preserving that update and the preceding Blend Business work.

## Public release — 8 September 2026

Published at https://jumbleyard.up.railway.app/shelf-control. Railway deployment `ef581548-41da-4650-831f-f9157023b54f` reached `SUCCESS` on the existing production service. Its persistent `/data` volume and public address were retained.

- The isolated release at `work/shelf-control-release-20260908` preserves all 495 hash-verified baseline files except the two intended collection changes, and adds seventeen Shelf Control files. All 512 file hashes are recorded in `work/shelf-control-release-manifest.json`.
- The exact release passed TypeScript, focused lint, all 463 automated tests, a fresh production build and the four-client integration check against that built server.
- The live HTTPS integration passed with four independent authenticated players and 73 synchronized updates. It verified capacity, credentials, origin checks, the actual 15-second hidden start, anonymous/private views, poses, roles and departure cleanup. All temporary test players left their room afterward.
- The public collection includes Shelf Control. All seven game routes, the new artwork and application health endpoint returned HTTP 200.
- Compared public audio manifests before and after: all 336 existing recordings, per-cue settings and category mixes are identical (121 Stack, 76 Blend Business, 74 Uphill Delivery, 65 Tiptoe Thieves). Comparison files are `work/shelf-control-live-before.json` and `work/shelf-control-live-after.json`. No audio generation was requested or performed.
- Browser visual QA and a four-human playtest remain outside this deployment verification.
