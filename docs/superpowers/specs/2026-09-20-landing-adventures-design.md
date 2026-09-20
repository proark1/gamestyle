# Landing adventures

User approved the interactive crew, game shuffle, passport, and starter quests on 2026-09-20. Implement within the current clay clubhouse, preserving unrelated in-progress party work.

## Experience

Keep the existing hero and game grid. Make its four characters keyboard-accessible buttons with localized tips. Replace the static how-to section with a two-part adventure desk: a surprise-game picker and a paper passport. The picker reveals an existing game card with image, title, player count, and explicit play link. Repeated picks avoid the previous result and favor unexplored games. No automatic navigation.

The passport shows stamps for distinct game pages visited, explicitly described as visits, not finished rounds. It tracks three starter quests: choose an outfit, visit one game, and visit three games. Outfit completion uses the existing wardrobe's selected items. Quest actions open the wardrobe or lead to the games. A short, dismissible celebration acknowledges new stamps or the outfit quest once. Expand the passport to see all stamps without forcing a long landing page.

## Visual design

Retain sky #A8DDF0, teal #287C80, coral #D96846, sun #F5C451, plaster #FFF6DF, ink #244943; Fredoka headings and DM Sans copy. The signature is an illustrated passport with collected game stamps, a stitched spine, and a progress seal. Motion is brief and triggered by interaction; reduced motion skips shuffle delay and motion. Compact layouts stack below 800px, with readable focus indicators and 44px controls.

## State and boundaries

A versioned browser-local store records unique visited slugs, chosen-look completion, and acknowledged celebrations. A tiny root client tracker observes real known game routes, covering direct links and navigation in new tabs. It never records a shuffle or link click as a visit. Validate persisted data, tolerate unavailable storage, refresh subscribers across tabs and back/forward restoration, and use a stable SSR snapshot. No account/backend changes, currencies, or claims of cross-device progress. State is labeled as saved in this browser; unavailable storage shows a session-only note.

The adventure desk receives game data from the same card configuration as the grid. Wardrobe UI is loaded only when opened. English/German copy follows the current language system. Keyboard, mobile layout, reduced motion, persistence, duplicate visits, invalid storage, and navigation will be checked. Run focused state tests, typecheck, lint, and architecture validation.

## Implementation sequence

1. Implement and test the validated browser progress store and route tracker.
2. Add localized interactive crew and adventure desk with shuffle, passport, quests, and celebrations.
3. Integrate into the landing page and check browser interactions on desktop/mobile.

The writing-plans skill is unavailable in this environment; this sequence serves as the implementation plan. The user's “ok do it” authorizes implementation of the proposed design. Deployment is not part of this turn.
