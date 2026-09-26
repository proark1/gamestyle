# Reel Problems 3 homepage card design

## Goal

Make the full Reel Problems 3 game discoverable from the Jumbleyard homepage without removing or replacing the earlier Reel Problems games.

## Experience

- Add `reel-problems-3` to the pinned homepage collection directly after `reel-problems-2`.
- Render it as a standard game card so it feels native to the existing collection rather than like a temporary promotion.
- Link the card to `/reel-problems-3`, the full first-person cooperative adventure.
- Use the existing `/images/reel-problems-3.svg` artwork and Reel Problems card treatment.
- Describe the first-person boat journey and show the established multiplayer and timed-game metadata.
- Keep `/reel-problems-3/lookdev` available through its direct URL; the homepage card does not open the lookdev.

## Implementation boundaries

The change is limited to the homepage game order, the static card configuration, and the existing localized card copy needed by the collection renderer. It does not redesign the homepage or alter the other Reel Problems entries.

## Verification

- Confirm the card data and localized copy resolve for every supported language.
- Run the focused collection or registry tests if present, then TypeScript and a production build.
- Verify the homepage card appears in the intended position and opens `/reel-problems-3` on desktop and mobile.
- Publish the verified committed state while preserving the current site access settings.
