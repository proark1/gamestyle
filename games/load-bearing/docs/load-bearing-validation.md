# Load Bearing validation

Completed on 2026-09-09.

## Automated

- 31 tests for this game pass: the support graph, blow counts and the hammer cooldown, host authority, collapse propagation, the piano riding its bay down and taking damage, win, both loss conditions, practice having no clock, crane ownership and handback, the cable staying taut through a full swing, debris pinning a worker and a teammate freeing them, marks leaving with their owner, wall collision, standing on rubble, peer checkpoint recovery, and the audio catalogue.
- The whole suite passes: 793 tests, up from 762 before this game.
- TypeScript passes. `npm run lint` passes. `npm run check:architecture` passes: 542 files, 1637 local imports, boundaries hold.
- `npm run build` succeeds and lists `/load-bearing` and `/load-bearing/admin`.

## Browser

Checked against the local dev server at 1280 × 720 in the built-in browser.

- The lobby renders the site with the crane, hoarding and skip, and the three entry buttons work.
- Practice starts without a database and draws the whole 32-part house: brick walls, concrete columns, timber ring beams, the upper slab and roof.
- The HUD reports time, standing parts, piano integrity and crew size.
- Swinging with nothing in reach is refused with "Get closer to something worth hitting."
- Taking the wrecking ball emits the crew message, swaps the dock button to Park ball and shows the crane key hints.
- Driving the hoist into the house destroyed four parts through real contact and the standing count fell from 32 to 28, with each break reported in the event log.

Three defects were found in the browser and fixed:

- The practice player was named "You", so third-person event text read "You has the wrecking ball". The practice default is now "Wrecker", matching the multiplayer default.
- The cable hung from empty air because the hoist position was unrelated to the crane model. The cable is now drawn from the jib tip, through a visible trolley at the hoist, out to the ball.
- The piano was completely hidden inside the house, so the crew could not plan around the one thing they must protect. A beacon above the piano now draws through the walls.

## Scope limits

Animated play could not be watched in this environment: the browser pane runs with `requestAnimationFrame` stalled at zero frames per second while it is hidden, so frames only advance when a screenshot forces a paint. Rendering, input, actions, crane control, ball contact and destruction were all confirmed this way, and the movement, collapse and physics behaviour is covered by the automated tests, but nobody has yet watched the game run at frame rate or played it with four people.

No four-person internet playtest has been performed. No WebRTC peer integration script exists for this game yet, so host recovery is covered only by the checkpoint unit test rather than by four real clients.

Generated audio has not been produced. The catalogue and profile are in place and the workshop route at `/load-bearing/admin` is live, but the cue files 404 until someone generates them, which the shared player already tolerates.

The collection card draws its own scene in inline SVG. Every other card uses a painted 1536 × 1024 illustration made with one imagegen request, and this one still needs generating to match; the prompt direction is in `docs/game-illustrations.md`.

`npm run format:check` fails across 646 files on this checkout, including files this change never touched. The repository is checked out with `core.autocrlf=true`, so every file has CRLF endings while `oxfmt` expects LF. That is a pre-existing environment condition, not a property of this change, and reformatting the tree was deliberately avoided.

## Production release — 2026-09-09

Live at [Jumbleyard](https://jumbleyard.up.railway.app/load-bearing). Railway deployment `877befef-0217-4fd7-aed5-0ca10f2fe47d` reached `SUCCESS` on the existing `jumbleyard` service, retaining the persistent `/data` volume.

- All 15 checked routes return 200, including `/load-bearing`, `/load-bearing/admin` and every pre-existing game.
- The live game loads, starts practice without a database, and draws the whole 32-part house with the piano beacon.
- The collection page reports 12 games and the new card renders its inline scene: 20 shapes, a 384 × 256 viewBox, correct tag, meta and title.

The first attempt, deployment `576ddd9d`, built and reported `SUCCESS` while containing none of this game. The Railway CLI resolves its project link by walking up from the working directory to the repository root, so running it inside a worktree under `.claude/worktrees/` uploaded the root checkout, where `.railwayignore` excludes `.claude` and therefore the worktree itself. The build succeeded because both the route and its game folder were absent together, so nothing failed to import. The release was redone from a clean `git archive` export of commit `cd3e88a` with an explicit `--project`, and the build log was checked for the new route before the result was trusted. That trap is now recorded in the README.

Because that first attempt uploaded the root checkout's working tree, it also published the uncommitted Reel Problems live-well changes that another session had in progress there. The corrected release replaced it with the committed tree, so production no longer carries that unfinished work.

`https://www.jumbleyard.com` does not serve this deployment. Its DNS resolves to Railway, but the TLS handshake fails with a hostname mismatch and the edge returns 404 even when the certificate is ignored. That is a custom-domain configuration problem which predates this release and is unaffected by it; the `up.railway.app` origin serves everything correctly.
