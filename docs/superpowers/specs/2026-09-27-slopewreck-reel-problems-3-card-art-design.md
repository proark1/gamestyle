# Slopewreck and Reel Problems 3 card artwork

## Goal

Replace the temporary SVG artwork on the Slopewreck and Reel Problems 3 homepage cards with finished raster illustrations that match the established collection.

## Shared art direction

- Create one full-bleed 3:2 landscape illustration for each game.
- Match the existing premium handcrafted 3D clay style and reuse the same four-boy cast seen in the current collection artwork.
- Keep the main action readable at small card sizes and safe inside the collection's wider crop.
- Use distinct faces, hairstyles, clothing colors, and poses so the four characters do not read as duplicates.
- Do not include titles, lettering, logos, interface elements, borders, watermarks, extra people, or unrelated props.

## Slopewreck scene

Show all four boys racing downhill on snowboards in a bright winter-sports setting. One rider launches from a freshly formed ramp while the others carve around a rail and follow close behind. Use pale snow and sky, deep blue shadows, teal course accents, and warm orange equipment details. The image should communicate speed, playful competition, and the game's signature mechanic of leaving ramps and rails for trailing riders.

## Reel Problems 3 scene

Show a dramatic first-person view from the small clay fishing boat during the storm pursuit. First-person hands and part of the boat frame the foreground; the other crew members remain visible working together on deck. A large legendary fish glows beneath or beside the waves and leads the boat toward a moonlit sanctuary passage. Use Harbor Ink, Sea Glass, Lantern Amber, Rain Blue, Clay Coral, and Moon Foam while keeping characters and navigation readable rather than dark or threatening.

## Integration

- Save the final project assets under `public/images/court-cast-v1/boys/` with descriptive game-specific filenames.
- Update the homepage card configuration to use the new raster files and retain accurate alternative text.
- Update the party-game image reference for Slopewreck so the generated artwork is used consistently there as well.
- Leave the existing SVG files in place unless they are proven unused; do not delete unrelated assets.

## Verification

- Inspect both generated images for cast consistency, composition, artifacts, unwanted text, and crop safety.
- Confirm the homepage resolves both new files and displays them in the intended cards.
- Confirm the Slopewreck party entry resolves the same finished artwork.
- Run focused static checks and a production build if the repository state permits it.
- Capture the rendered overview page and show the completed cards to the user.
