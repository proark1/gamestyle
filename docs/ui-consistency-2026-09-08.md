# Collection artwork and game controls

Shelf Control's collection art now uses the five reference games' faceted toy proportions, bright teal/mustard/terracotta accents and simple matte surfaces. The scene keeps the furniture showroom, wooden mannequins carrying a ladder and distracted guard. The collection card and showroom fallback both request `shelf-control.png?v=toy-style-2` so cached artwork refreshes.

The final asset is `public/images/shelf-control.png` (1536 × 1024). Built-in imagegen produced the illustration and one corrective edit to keep the ladder carriers as mannequins. Exact prompts and provenance are in `games/shelf-control/docs/shelf-control-toy-style-art.txt`.

All seven game pages use `shared/ui/GameToolbar.tsx`. The common controls are Voice chat, Mute game sound, How to play, All games and Sound workshop, in that order. The workshop destination is required and stays visible after joining a room. The duplicate Leave button has been removed; All games retains the existing room-exit handling, with collection navigation added to the delivery and giant exit dialogs. Separate building-game settings and game-menu controls remain available.

Permit Pending's voice button opens its existing Crew Jobs voice panel. Brick by Hand now has a help dialog and the same common toolbar. Shelf Control's workshop opens Blend Business's existing editor because Shelf Control already plays that library's recordings. In-game voice is still unavailable in Shelf Control and Brick by Hand; their voice dialogs explain this. No microphone transport, audio library, gameplay rules or provider configuration was added by this UI change.

## Validation

- Production Node/Railway build passed.
- TypeScript and lint passed; formatting passed for all 13 changed source files.
- `scripts/check-collection.mjs` passed against an isolated local production server: all seven cards and game pages, exact toolbar labels/order, reachable workshop destinations, images, invite redirects, audio namespaces and origin checks.
- The latest full suite passed 648 of 650 tests. Two Tiptoe Thieves audio tests failed (catalog generation limits and a dialogue cue naming mismatch), outside the edited UI code. An initial Stack or Sink timing-test failure passed on its isolated rerun and in the subsequent full suite.
- Repository-wide format checking reported an unrelated existing issue in `games/dont-wake-the-giant/level.ts`.
- The final illustration was visually inspected. Browser interaction and viewport screenshot testing were not performed.

## Live verification

On the user's subsequent request to publish, the existing production release was found to already contain these changes. Railway deployment `639ef064-2e4f-400a-9a79-fb7ff8230932`, created on 2026-09-08 at 17:32 UTC, is active with status `SUCCESS` at https://jumbleyard.up.railway.app. No redundant deployment was made.

Live collection checks passed for all eight current game pages, matching toolbar labels/order and reachable sound workshops. At 17:52 UTC the landing page referenced the versioned Shelf Control artwork and the served PNG exactly matched the final local file (SHA-256 `7ba3e749d6a957fc88131a687f266a16b8b986e76bfeddd10703677eed5437fa`). Verification records are retained in `.tmp/ui-consistency/`.
