# Reel Problems 3 Fishing Guidance Implementation Plan

1. Add a pure `nextStepFor` presentation helper and focused tests for preparation, navigation, rod pickup, cast, wait, bite, tangle, safe reel, dangerous tension, landed-fish pickup, catch storage, and touch labels.
2. Replace the generic bottom prompt and separate held badge in `Game.tsx` with a single semantic next-step card. Preserve the strategic objective, contracts, urgent incident alert, and tension meter.
3. Build the Deck Order card styling in `style.css`: nautical hierarchy, action keycap, urgent bite/tension treatment, responsive touch placement, reduced-motion handling, and no crosshair/control overlap.
4. Rebuild the procedural rod model in `scene.ts` with a tapered blank, cork grip, compact spool, crank, small aligned guides, and a local line. Add state-driven first-person poses without per-frame geometry allocation.
5. Extend rendering and browser checks so the full rod-to-secured-fish loop proves the guide transitions correctly at desktop and mobile sizes.
6. Run Reel Problems 3 tests, lint, TypeScript, production build, and local visual QA. Fix regressions before handing off; production publishing remains separate.
