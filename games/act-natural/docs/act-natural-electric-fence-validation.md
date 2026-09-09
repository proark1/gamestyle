# Electric fence validation — 8 September 2026

Implemented the approved contact hazard in the shared farm simulation. A live fence pushes a player cow inward, interrupts grazing/sabotage, stuns it for 650 ms, and exposes it for five seconds. Contact has a 1.5-second cooldown. The practice farmer observes the public marker. Turning the power off prevents further shocks and stops the warning hum. Existing round/escape rules and hidden player ownership remain intact.

The renderer shows the upward recoil, stiff legs, raised head, blue electrical arcs and an EXPOSED marker. Reduced motion uses a restrained pose without arcs. If the farmer immediately captures the cow, its final hit and sound can finish. Energized wires are blue; unpowered wires stay visible in grey.

The game ships original deterministic 48 kHz mono PCM WAV files: a two-second warning loop and a 650 ms zap. The files have finite, unclipped samples, audible RMS levels, and a smooth loop seam. Existing workshop recordings and saved volume settings take precedence. No paid generation or external audio samples were used.

## Automated checks

- Full `npm test`: 473 passed, zero failures.
- TypeScript: `npm run typecheck` passed.
- Focused Oxlint on the simulation, renderer, audio modules, scripts and tests passed. A wider check also encountered two existing `no-meaningless-void-operator` errors in unrelated audio-unlock calls in `games/act-natural/Game.tsx`; the help-copy edit did not change those calls.
- Cloudflare production build: passed, with the existing Vite configuration, chunk-size and route-classification warnings.
- Node/Railway production build: passed, with the existing build warnings.
- HTTP checks: `/act-natural` and the public audio manifest returned 200 in the local Node preview.

New tests cover all four edges and corners, stationary contact, safe approach, stun recovery, cooldown/repeat contact, exposure expiry, powered-off contact, safe sabotage, gate escape, old-room compatibility, snapshot privacy, rematch reset, the practice farmer, stale/duplicate audio events, simultaneous cow zaps, fallback playback, loop stopping, and saved mixer/recording precedence.

## Browser checks

The actual game opened and entered solo practice without browser errors. The local fixture in `games/act-natural/scripts/fence-preview.html` uses the real renderer, simulation and audio player:

- Live approach reached the contact boundary, then produced one shock, x=8.90 recoil, an active exposure marker, and visible arcs.
- The held hit pose visibly showed lifted/stiff legs and a raised head. The marker and wire contrast were improved after inspecting the first render.
- Reduced motion preserved the exposed state and restrained pose while hiding arcs.
- Powered-off approach reached x=9.40 with zero shocks, no exposure and no arcs; wires remained visible.
- Browser error logs were empty.

Run the main preview on port 3014, then `node games/act-natural/scripts/fence-preview.mjs` to reopen the local validation fixture on port 3015. The fixture is outside `public` and is not included in the production game.

Audio playback routing and lifecycle were checked with Web Audio tests; subjective listening on speakers/headphones and a real multi-person internet playtest were not performed. This task changes the local checkout and does not publish a new live deployment.

## Live release — 8 September 2026

The electric fence shipped with the two farmer modes in Railway deployment `94cf205d-2fe9-4e17-af32-e6a6468e499a`, verified `SUCCESS` at https://jumbleyard.up.railway.app/act-natural. Both electrical WAV files match the released assets byte for byte, and the public manifest includes the shock cue. Existing recordings and volumes were preserved. See [the combined release validation](act-natural-player-farmer-validation.md) for the frozen source, file hashes and public mode checks.
