# Chain of Fools production release

Published September 22, 2026 to https://www.jumbleyard.com/chain-of-fools.

- Game change commit: `105e260`.
- Released commit: `92d025fddfddc2423f8d6bbf30cd797e2de179c8`, including the concurrent wardrobe and audio updates from production main.
- Railway deployment: `f77a5e48-4d53-458b-ab28-0851f457c897`, status `SUCCESS`.
- Uploaded from the clean isolated checkout `.tmp/chain-live-release` through the repository deployment guard, with HEAD matching origin/main.

## Validation

- Final combined release: 1,762 tests passed, zero failures; TypeScript and production Railway build passed.
- Earlier lint and formatting of the edited Chain of Fools files passed. The repository-wide formatting check has an unrelated pre-existing issue in `games/act-natural/Game.tsx`.
- Public `/api/health` and `/chain-of-fools` endpoints returned HTTP 200 after deployment.
- Browser start flow confirmed a 4:30 shift, 174m remaining, nine checkpoints beyond the start, and the new section guidance.
- Live desktop game rendering inspected; no browser JavaScript errors were recorded.

The implementation and collision regression coverage are documented in `chain-of-fools-polish-2026-09-22.md`. This release supersedes that report's earlier statement that the changes had not yet been deployed.
