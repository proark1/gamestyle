# Chain of Fools gauntlet release

Published September 22, 2026 at https://www.jumbleyard.com/chain-of-fools.

- Commit: `1c503f7003d161856d24cd05c81c8e1fc66e7751` on production main.
- Railway deployment: `87734245-d90b-4d48-88f1-9660f4ea53f7`, status `SUCCESS`.
- Clean release checkout: `.tmp/chain-gauntlet`. Existing unrelated workspace changes were preserved.
- Changes: harder routes, narrow turning catwalk, moving cargo deck, suspended loads, tall cargo barriers, richer animated site scenery, and full gate restarts after unrecoverable falls. Recoverable rope hangs still allow rescue.
- Verification: full site suite 1,768 passing tests; final targeted suite 66 passing tests after the finished-round freeze regression; TypeScript, lint and production build passed.
- Live health and game endpoints returned HTTP 200. Live startup showed no checkpoints, attempt count, best distance and a 4:30 shift. Desktop and 390×844 phone rendering checked; no JavaScript errors recorded.

The approved design and implementation report are committed under `docs/superpowers/specs/2026-09-22-chain-gauntlet-design.md` and `docs/chain-gauntlet-2026-09-22.md` in the release checkout.
