# Voice, multiplayer and efficiency production release

Live at [www.jumbleyard.com](https://www.jumbleyard.com).

- Source commit: `299bbb855b80aba26c81cd30c0a0f3e6dc147621`, pushed to `origin/main` without force.
- Railway deployment: `ee185814-ca19-4c76-83d3-5235eef018ef`, status `SUCCESS`.
- Existing `jumbleyard` production service and persistent `/data` volume retained. Startup confirmed database readiness and the production server on port 8080.

The original working checkout had extensive uncommitted work and was behind remote main. A separate release worktree captured the tested source and merged the latest main, preserving the newer kid-specific wardrobe models. The original working files and index were left intact. The release used the normal deployment script with a clean checkout, an exact match to origin/main and no competing deployment; no force override was used.

The merged release passed architecture checks, all 1,700 tests, TypeScript, lint, the Railway build, the installed-client build and the two-browser shared-party regression for Four Brain Cells. See the [implementation report](voice-multiplayer-efficiency-implementation-2026-09-22.md) for the broader performance, voice, relay and recovery evidence and its limits.

After Railway reported success, live verification passed:

- Database health endpoint.
- 26 HTML routes: home, party and all 24 games.
- 225 referenced JavaScript/CSS assets, with successful responses and no HTML fallback.
- Incompatible peer requests receive HTTP 426; compatible clients can create/join a two-player room and exchange signaling state.
- Two authenticated party members receive seats in the same game room; both join the peer coordinator.
- Party voice signaling recognizes both members.
- All temporary verification participants leave cleanly.

Live API checks do not claim a physical microphone or cross-network audio playthrough. Existing tabs should refresh and create a new room because the peer protocol changed. The repository-wide formatting issues and hardware/network limitations described in the implementation report remain.

Release source and local logs: `C:/Users/assad/.codex/worktrees/voice-multiplayer-release/gamestyle/.tmp/`. The source worktree is retained for reproducibility.
