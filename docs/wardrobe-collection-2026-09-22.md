# Woodland, Snack Time and Cosmic wardrobe items

Approved: implement all 12 concepts proposed in the wardrobe conversation.

Implemented and validated for the production release on 22 September 2026.

| Item | Slot | Coins |
| --- | --- | ---: |
| Frog Bucket Hat | Hat | 180 |
| Mushroom Cap | Hat | 220 |
| Bear Paw Shoes | Shoes | 200 |
| Leaf Dungarees | Legs | 220 |
| Strawberry Beret | Hat | 240 |
| Toast Puffer | Top | 260 |
| Ducky Boots | Shoes | 200 |
| Watermelon Shorts | Legs | 160 |
| Saturn Hat | Hat | 320 |
| Cloud Jacket | Top | 280 |
| Comet Sneakers | Shoes | 280 |
| Moon Glasses | Face | 180 |

The catalog feeds the existing purchase, equipment, saved-look and game-avatar paths. Detailed clay models are shared by the avatar and standalone thumbnails. Worker-compatible models remain available for other avatar types. Watermelon Shorts explicitly keep the short leg silhouette, including in games whose kit normally has long trousers. Native hats report precise height for preview framing. Moon lenses retain transparency after shading and batching.

The scuba flipper blade now extends forward along +Z and stays above the floor.

Validation:
- 37 existing/scoped avatar, cosmetic, wardrobe and game-avatar tests passed, including the flipper direction regression.
- Four new integration/geometry tests passed: purchasing and restoring outfits, visible knees with shorts, native hat framing and centered previews, transparent lenses in a combined outfit.
- TypeScript, scoped lint, formatting and architecture checks passed.
- Inspected front, back, side and item-only renders of all 12 items.
- Local browser exercised all 12 purchases, try-on, equip, reload, item inspection, walking, rotation and mobile preview; no JavaScript errors.

Evidence: `docs/wardrobe-collection-qa/` contains rendered lineups, desktop/mobile shop captures and `shop-results.json`. Reproduce with `node scripts/wardrobe-collection-preview.mjs` and `node scripts/wardrobe-shop-smoke.mjs`.
