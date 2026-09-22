# Landing adventures implementation

Implemented locally following user approval. Not deployed by this turn.

## Delivered

- Four independently clickable, keyboard-operable hero characters with localized tips. Rearranged overlapping image targets after browser testing revealed clicks could reach the wrong friend.
- A surprise picker with a short reveal animation, no immediate repeat, a preference for unvisited destinations, existing artwork and localized game data, and an explicit launch link.
- A passport for all 23 games with a three-stamp preview, expandable full collection, and three starter quests tied to game-route arrival and actual selected wardrobe items.
- Versioned browser-local persistence, one-time dismissible celebrations, validation of saved data, cross-tab/back-cache refresh, and graceful session-only fallback when storage fails. Visit stamps explicitly do not imply completed rounds. No currencies or account sync added.
- The static how-to section is replaced; existing game grid and party links remain. All new copy supports English and German. Reduced motion removes animations and the shuffle delay.

## Verification

- Five state tests pass: invalid storage, validation/deduplication, repeat arrivals, shuffle choice, and persistence/subscriber/storage-failure behavior.
- Typecheck, targeted lint, architecture check (954 files), and production Railway build pass. Existing nonblocking Vite warnings remain.
- Browser review at desktop 1440×960, ordinary app width, mobile 390×844, and narrow German 320×740. No horizontal overflow at 320px.
- Confirmed a shuffle launches its revealed game; real visits to Uphill Delivery, Chain of Fools, and Scaffold Scramble advance passport to 3/23 and the exploration quests. Reload retained progress.
- Selected then removed the free Bobble Beanie through the wardrobe UI; the outfit quest completed and the original unequipped outfit was restored. All three quests reached completion. No purchases or authentication requests.
- Keyboard Enter activates character tips; Escape closes wardrobe. Restored English and default viewport after review.

Existing unrelated party changes and prior clubhouse modifications in the shared checkout were preserved. This turn changes app/CollectionClient.tsx, app/layout.tsx, shared/clubhouse/ClubhouseWelcome.tsx and adds the adventure components, store, tests, styling, and documentation.
