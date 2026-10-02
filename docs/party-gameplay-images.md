# Party voting gameplay images

Each voting candidate displays `/images/party-gameplay/<game-id>.webp`. All 24 games in `platform/party/playlist.ts` have their own image. These are actual browser screenshots captured from running games on the local development server. The original set was captured on 2026-09-20; Course Correction, Slopewreck and On the Ropes were captured again on 2026-10-02 after starting standalone rounds with bots. The collection's illustrated cover art remains separate.

All voting images decode at 960x540 and retain the game scene. The original Bouncy Castle Royale capture uses a taller frame, fitted with side padding to retain the full castle. The three new captures include their HUD and are encoded as WebP at quality 82. Original PNG captures are kept locally under `output/party-gameplay-originals/`; the 2026-10-02 source captures and the earlier Bouncy image are retained under `.tmp/platform-audit/`.

The three candidates' images preload during the podium. The same images remain on the boards through voting, tie-break, and reveal. Mobile displays each image beside its game's text; desktop displays it above the text. Explicit dimensions reserve space while loading, and `object-fit: contain` avoids hiding parts of the scene.

When adding a party game, capture it after its start screen has closed and save an optimized screenshot under its exact game ID. When a game's visuals change substantially, refresh its capture. Do not substitute generated artwork or a different game's image.

Validation: `platform/games/images.test.mjs` checks that every party game uses its own image path and that all 24 files fully decode at 960x540. The same regression suite decodes every collection cover and game start illustration, and enforces the collection card's 250 KB download budget. The new captures were visually inspected after the start screen closed.
