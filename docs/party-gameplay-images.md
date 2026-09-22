# Party voting gameplay images

Each voting candidate displays `/images/party-gameplay/<game-id>.webp`. All 20 games in `platform/party/playlist.ts` have an image. These are actual browser screenshots captured from running games on the local development server on 2026-09-20, using party mode's normal automatic start. They are not the collection's illustrated cover art.

The screenshots retain the complete 16:9 game scene and HUD, resized to 960x540 and encoded as WebP at quality 82. The complete set is approximately 695 KiB. Original PNG captures are kept locally under `output/party-gameplay-originals/`.

The three candidates' images preload during the podium. The same images remain on the boards through voting, tie-break, and reveal. Mobile displays each image beside its game's text; desktop displays it above the text. Explicit dimensions reserve space while loading, and `object-fit: contain` avoids hiding parts of the scene.

When adding a party game, capture it after its start screen has closed and save an optimized screenshot under its exact game ID. When a game's visuals change substantially, refresh its capture. Do not substitute generated artwork or a different game's image.

Validation: all 20 assets successfully decoded at 960x540; TypeScript, scoped lint and formatting checks passed. Browser inspection confirmed all three candidate images load and a vote can be submitted from an image board. Desktop and phone layouts were checked.
