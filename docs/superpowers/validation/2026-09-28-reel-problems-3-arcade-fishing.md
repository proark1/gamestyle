# Reel Problems 3 Arcade Fishing Validation

## Automated verification

- `node scripts/test.mjs games/reel-problems-3` — 44/44 passing.
- `npm run typecheck` — passing.
- `npm run lint` — passing.
- `npm run check:architecture` — passing.
- `npm run build` — production build complete.

## Browser verification

The game-specific Playwright check passed against the local production build at desktop (1440×900) and touch-mobile (390×844) sizes.

Verified in both modes:

- WebGL canvas visible;
- no browser page errors;
- no failed same-origin requests;
- no horizontal overflow;
- next-step card remains distinct from objective and contracts;
- mobile next-step card stays above the touch controls;
- active contract and objective do not overlap;
- touch actions remain inside the viewport;
- one human and three bot crew positions initialize correctly.

The shared browser smoke check found the Reel Problems 3 canvas and reported no page errors. In headless SwiftShader, renderer work stayed approximately 5–9 ms while the adaptive renderer selected a lower quality tier as needed. Headless display FPS is not treated as hardware FPS.

## Gameplay coverage

Automated deterministic gameplay now covers:

- cast charge start, cap, cancellation, release, and bait consumption;
- visible-duration casting before the waiting phase;
- exact line endpoints, casting lift, waiting sag, tension straightening, and landing arc;
- bounded rod charge and tension poses;
- safe reeling, burst tension, line recovery, landing, pickup, and storage;
- bot reaction delays, imperfect cast power, deliberate reel/rest windows, tangle recovery, net assistance, and full seeded round completion;
- exactly-once fish storage and scoring;
- desktop, touch, English, and German control language;
- secured fish excluded from visible item rendering.

## Known unrelated warnings

The production build reports the existing Vite native-config JSON import warning and existing large-chunk advisory. Neither warning is introduced by this Reel Problems 3 change, and the build completes successfully.
