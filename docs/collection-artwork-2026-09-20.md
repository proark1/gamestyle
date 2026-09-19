# Consistent Court Clash cast for the overview

All 23 overview cards now use `public/images/court-cast-v1/*.jpg`. Generated with built-in ImageGen using the user-approved basketball reference and its bright, tactile clay world style.

The recurring cast preserves the reference's faces, skin tones, proportions, and four hair silhouettes: dark brown swept waves; black tight curls; dark brown ponytail with red tie; copper curls with blue headband. Clothing and props vary by game. Shelf Control adapts the cast into jointed display mannequins; Blend Business uses cow costumes; Four Brain Cells shows the cast piloting one robot; Brick by Hand retains its first-person perspective with three visible teammates.

Twenty new illustrations complete the set. Court Clash reuses the supplied canonical reference. Uphill Delivery and Reel Problems reuse the approved second-round samples. No gameplay or 3D avatar models were changed.

## Assets and reproducibility

- Production images: `public/images/court-cast-v1/`, 23 JPEGs, 1024 pixels wide, original proportions preserved, quality 85. Combined size: 4,081,236 bytes; largest image: 203,781 bytes.
- Full-resolution masters: `output/imagegen/court-cast-masters/`.
- Canonical reference: `output/imagegen/style-trials/court-cast-reference.png`.
- Exact generation prompts: `output/imagegen/style-trials/collection-prompts.json` and `prompts-court-cast-v2.md` in that directory for the two approved samples.
- Source-to-output mapping: `output/imagegen/style-trials/collection-manifest.json`.
- Dimensions and byte audit: `output/imagegen/style-trials/collection-asset-audit.json`.

The versioned URLs avoid stale cached artwork. Earlier images and trial variants are preserved. Alternative image descriptions were updated to match the new scenes.

## Validation

- TypeScript type checking passed.
- Targeted lint and formatting for `app/CollectionClient.tsx` passed.
- `git diff --check` passed.
- Local overview browser check: all 23 card images reference the new directory and loaded successfully after scrolling through the page (`complete` and nonzero `naturalWidth`). Card cropping inspected in the existing two-column layout.
- Local preview returned HTTP 200. Its unrelated account cleanup logged a missing local `account_sessions` table; it did not prevent the overview or images from rendering.

This change updates the local project; it does not deploy the site.
