# Clay clubhouse implementation

The landing and overview now use the canonical four clay characters as standalone guides. The same component supports sign-in, email-code entry, account confirmation, wardrobe entry, and party entry/readiness. Google/email authentication and game rules retain their existing behavior. Shared toolbar buttons use the same tactile treatment.

Four illustrations were created with the built-in image_gen tool using the approved Court Clash reference. Production assets are `public/images/clubhouse/{wave,point,cheer,mail}.webp`, each 560 × 840 with preserved alpha, totaling 255,616 bytes. Full-resolution PNGs and the source manifest remain under ignored `output/imagegen/clubhouse/`. Exact prompts are in `docs/clubhouse-artwork-prompts.json`.

## Verification

- Production Railway build completed successfully; existing Vite configuration/chunk-size warnings remain.
- Type checking, targeted lint, formatting, and architecture checks passed.
- 78 existing account and party tests passed.
- Visually reviewed landing and overview at desktop and phone widths, and narrow layouts at 320px. Fixed clipped header controls, narrow dialog inputs, and party-form overflow.
- All 23 overview images and all four character assets loaded in the browser.
- Reviewed English and German guidance. Temporary local mock authentication exercised welcome, code entry, invalid-code feedback, resend/reset, successful sign-in celebration, and account dialog. Escape restored focus to the account button. No real email or account was used.
- Reviewed the wardrobe guide while preserving its existing 3D preview. The waiting-room guide follows the existing player's ready state; tournament state-machine behavior is covered by the existing party tests.
- Temporary mock route removed before production build. Browser viewport and language restored after review.

This redesign has not been deployed. Separate party podium/voting work is present in the same checkout and was preserved; its gameplay changes are not part of this visual redesign.
