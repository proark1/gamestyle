# Two farmer modes: validation

Implemented locally on 2026-09-08 from the approved design.

- Full suite: 502 tests pass. This includes twelve new mode, privacy, visibility, collision, room authorization and browser-transport tests. Existing electric-fence, audio, room and peer compatibility tests pass.
- Full-project TypeScript checking passes, as does the isolated Act Natural check with `work/farmer-tsconfig.json`. An intermediate check encountered a concurrent Shelf Control edit; the final full-project check passed after that separate work changed. No Shelf Control implementation was changed here.
- Focused Oxlint checks pass for the new/changed farm rules, renderer, mode picker, audio events, integration script and tests. Existing unrelated Game.tsx unlock calls are outside this focused lint set.
- Real HTTP integration against the local Node app passes: four human players receive one restricted farmer view and three cow views; four cooperative players all receive cow roles while the computer patrol advances. Room authentication, private role assignment, independent herd behaviour, routes and legacy invite redirects pass. Test members leave their rooms afterwards.
- Node and Cloudflare production builds pass, with existing Vite configuration, bundle-size and route-classification warnings.

No browser visual playtest, speaker listening test, internet multiplayer playtest or deployment was performed for this change. Balance values (seven-metre sight, five inspections and three-minute rounds) are initial settings; tests verify rules, not human win rates. Shared-TV controls are outside this separate-screen implementation. Old peer-room invites remain compatible, but only newly created server rooms remove the host's access to the authoritative hidden state.

Logs are in `work/farmer-full-tests.log`, `work/farmer-node-build.log` and `work/farmer-cloudflare-build.log`.

## Live release — 8 September 2026

Published at https://jumbleyard.up.railway.app/act-natural after the user requested “bring it live”. Railway deployment `94cf205d-2fe9-4e17-af32-e6a6468e499a` reached `SUCCESS` on the existing public service, retaining its persistent volume.

- The frozen release at `work/act-natural-modes-release-v2-20260908` starts from the hash-verified latest Shelf Control style release `903aaf49-b344-4017-8a80-b4deb4ac2980`. A pre-upload check caught that concurrent publication and prevented the earlier package from rolling it back.
- All 537 release-file hashes are recorded in `work/act-natural-modes-release-v2-manifest.json`; the owned file list and baseline are in `work/act-natural-modes-release-v2-scope.json`.
- The exact release passed all 502 tests, full TypeScript checks and a fresh Node production build. Logs: `work/farmer-release-v2-tests.log` and `work/farmer-release-v2-build.log`.
- Public HTTPS integration passed with one human farmer and three cow players, restricted farmer snapshots, four cooperative cows and an advancing computer patrol, independent herd behaviour and authentication. Temporary test players left their rooms afterward.
- The live menu exposes both mode choices. All game pages and the database health endpoint return HTTP 200. Both bundled electrical WAV files match the released assets byte for byte.
- All 336 existing recording entries, URLs, cue volumes and category settings match the pre-release manifests. The new bundled shock cue brings the total to 337. Comparisons are saved in `work/farmer-live-before.json` and `work/farmer-live-after.json`; no paid sound generation was performed.
- Create a new farm after refreshing to use the new server-authoritative modes. Old peer-room invites remain compatible. No browser visual QA or human balance playtest is claimed by this deployment verification.
