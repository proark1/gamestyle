# Jumbleyard Alternate Landing Suite — Implementation Plan

Date: 28 September 2026  
Status: approved design translated into an execution plan  
Design: [Jumbleyard Alternate Landing Suite](2026-09-28-jumbleyard-landing-concepts-design.md)

## Outcome

Deliver three complete alternate Jumbleyard landing pages at `/landing1`, `/landing2`, and `/landing3`. The routes share the real game catalogue and existing header controls while presenting three genuinely different visual systems: Cinematic Toybox, Party Broadcast, and Arcade Cabinet.

The current `/` route and its existing landing implementation remain unchanged. This plan does not deploy or publish the alternatives.

## Execution rules

- Treat the approved design as the source of truth.
- Preserve all unrelated local changes in the heavily modified working tree.
- Add new route and feature files wherever possible. Do not refactor `app/CollectionClient.tsx` or `app/collection.css` to support the alternatives.
- Reuse `CARDS_TRANSLATIONS`, `GAME_IDS`, existing production artwork, `LanguageSwitcher`, `WardrobeButton`, and `AccountButton` rather than creating parallel product behavior.
- Keep shared landing data server-safe and place interactive enhancement in narrow client components.
- Store generated atmosphere plates locally and treat them as decorative. Pages must remain complete when those images fail.
- Use semantic links for navigation and buttons only for local state changes.
- Respect `prefers-reduced-motion` in every concept.
- Keep each concept's stylesheet scoped under its route root so no styles leak into games or the current landing page.
- Stage and commit only files created or modified for this work.

## Planned source layout

```text
app/
  landing1/
    page.tsx
    landing1.css
  landing2/
    page.tsx
    landing2.css
  landing3/
    page.tsx
    landing3.css
  landing-concepts/
    catalog.ts
    copy.ts
    LandingHeader.tsx
    LandingFooter.tsx
    GameArtwork.tsx
    FeaturedSelector.tsx
    ArcadeSelector.tsx
    landing-shared.css
public/images/landing-concepts/
  cinematic-toybox.webp
  party-broadcast.webp
  arcade-cabinet.webp
scripts/
  landing-concepts-smoke.mjs
```

The exact number of small components may change to keep responsibilities clear. Concept-specific composition stays in its route; product data and repeated accessible controls stay shared.

## Milestone 1 — Build the shared catalogue and shell

### Task 1.1 — Create a stable landing catalogue adapter

**Create**

- `app/landing-concepts/catalog.ts`
- `app/landing-concepts/catalog.test.ts`

**Read from**

- `shared/games/identity.ts`
- `shared/language/translations/cards.ts`
- the existing production artwork map in `app/CollectionClient.tsx`

**Work**

1. Define a typed `LandingGame` model containing slug, href, artwork, alternative text, and localized card copy.
2. Build one explicit artwork/alternative-text map for every game in `GAME_IDS` represented by the current collection.
3. Derive titles and descriptions from `CARDS_TRANSLATIONS`; do not duplicate translated prose.
4. Define concept-specific featured orders as stable slug arrays.
5. Add validation that catches missing translations, missing artwork mappings, duplicate slugs, broken local hrefs, and featured slugs absent from the catalogue.

**Exit gate**

- The adapter returns every current game exactly once in canonical order.
- All three concepts can consume the same catalogue without importing the current landing component.

### Task 1.2 — Create shared landing controls and resilient artwork

**Create**

- `app/landing-concepts/LandingHeader.tsx`
- `app/landing-concepts/LandingFooter.tsx`
- `app/landing-concepts/GameArtwork.tsx`
- `app/landing-concepts/landing-shared.css`

**Work**

1. Build a shared semantic header with concept-provided class names, brand link, catalogue jump, `LanguageSwitcher`, `WardrobeButton`, and `AccountButton`.
2. Build a compact footer that links back to `/` and repeats the no-download promise.
3. Add a client-side artwork wrapper whose error state shows a styled title fallback without breaking the link or layout.
4. Scope shared control adjustments beneath the alternate-landing root class.
5. Preserve existing dialogs and state stores; do not copy their logic.

**Exit gate**

- Header controls open their existing interfaces.
- A forced image error leaves a readable, navigable card.
- Shared CSS does not change the current landing page.

## Milestone 2 — Produce and integrate atmosphere assets

### Task 2.1 — Generate the three Higgsfield plates

**Create**

- `public/images/landing-concepts/cinematic-toybox.webp`
- `public/images/landing-concepts/party-broadcast.webp`
- `public/images/landing-concepts/arcade-cabinet.webp`

**Work**

1. Generate one 16:9 or wider atmosphere plate per approved concept through the connected Higgsfield image capability.
2. Keep central/side negative space appropriate to each route's responsive copy placement.
3. Prohibit text, logos, UI, branded controllers, and imitations of third-party game art in the prompts.
4. Preserve the approved palettes and lighting language.
5. Convert or optimize the delivered images to repository-friendly WebP assets if necessary.

**Exit gate**

- Each plate supports responsive cropping and remains subordinate to real Jumbleyard game art.
- Removing the image still leaves an intentional CSS-only hero.

## Milestone 3 — Implement the three routes

### Task 3.1 — Cinematic Toybox at `/landing1`

**Create**

- `app/landing1/page.tsx`
- `app/landing1/landing1.css`

**Work**

1. Build the asymmetric stage hero with the approved copy, product facts, real game artwork, and generated atmosphere plate.
2. Implement a CSS-variable-based diorama response driven by a small pointer/scroll enhancement. Keep the server-rendered composition complete without it.
3. Build wide theatrical featured scenes and the complete catalogue.
4. Add the party-mode section and shared footer.
5. Disable parallax and coordinated motion under reduced motion.

**Exit gate**

- The route reads as a cinematic handcrafted game world, not a dark SaaS template.
- Every catalogue game and `/party` is reachable.

### Task 3.2 — Party Broadcast at `/landing2`

**Create**

- `app/landing2/page.tsx`
- `app/landing2/landing2.css`
- `app/landing-concepts/FeaturedSelector.tsx`

**Work**

1. Build the channel-ident header, on-air hero, ticker, and featured matchup lower third.
2. Implement a keyboard-accessible featured selector that changes artwork, metadata, and presentation together only after explicit input.
3. Pause the ticker on hover/focus and stop it under reduced motion.
4. Present the complete catalogue as an editorial game schedule/poster wall.
5. Add the party-mode special and shared footer.

**Exit gate**

- Featured selection works with pointer and keyboard and never auto-advances while reading.
- The route reads as a live party-game channel without implying an actual livestream.

### Task 3.3 — Arcade Cabinet at `/landing3`

**Create**

- `app/landing3/page.tsx`
- `app/landing3/landing3.css`
- `app/landing-concepts/ArcadeSelector.tsx`

**Work**

1. Build the perspective arcade-aisle hero and three highlighted cabinet choices.
2. Implement pointer, touch, and arrow-key selection with roving focus or equivalent predictable tab behavior.
3. Update the explicit game description/action panel when selection changes.
4. Flatten the perspective treatment into a compact cartridge wall for the complete mobile catalogue.
5. Remove perspective travel under reduced motion while preserving focus contrast and state.

**Exit gate**

- Selection is perceivable without color alone and usable without a pointer.
- The arcade framing supports rather than obscures the clay-game artwork.

## Milestone 4 — Test behavior and performance

### Task 4.1 — Add focused data and accessibility tests

**Create or modify**

- `app/landing-concepts/catalog.test.ts`
- focused component tests only where the repository's current test harness supports them cleanly

**Work**

1. Validate catalogue completeness and unique slugs.
2. Validate all featured sets against the catalogue.
3. Validate route hrefs and local artwork paths.
4. Exercise selector state rules as pure helpers when DOM testing would add a new test dependency.
5. Verify no concept stylesheet uses unscoped generic selectors that could leak globally.

**Exit gate**

- Focused tests pass and fail meaningfully when catalogue wiring is incomplete.

### Task 4.2 — Add a browser smoke check

**Create**

- `scripts/landing-concepts-smoke.mjs`

**Work**

1. Load `/landing1`, `/landing2`, and `/landing3` at desktop and representative phone viewports.
2. Fail on page errors, console errors, horizontal overflow, missing `h1`, missing game links, missing party link, or inaccessible primary controls.
3. Open the existing language, wardrobe, and account entry points where available without mutating account state.
4. Exercise broadcast and arcade selectors with keyboard input.
5. Capture full-page screenshots for final visual review.

**Exit gate**

- All three routes pass twice from a clean local session.
- Screenshots show three unmistakably different pages with complete responsive content.

## Milestone 5 — Release-candidate review

Run the focused validation first, then the project checks proportional to the isolated route work:

```text
node scripts/test.mjs app/landing-concepts
npm run typecheck
npm run check:architecture
npx oxlint app/landing1 app/landing2 app/landing3 app/landing-concepts scripts/landing-concepts-smoke.mjs
npx oxfmt --check app/landing1 app/landing2 app/landing3 app/landing-concepts scripts/landing-concepts-smoke.mjs
npm run build
node scripts/landing-concepts-smoke.mjs
```

Manual review:

- `/` before and after, confirming no visual or functional change
- `/landing1`, `/landing2`, and `/landing3` at desktop and phone sizes
- language menu, wardrobe dialog, and account entry point
- game and party links
- keyboard-only navigation
- reduced-motion mode
- simulated failed atmosphere and game images
- browser console and network errors

## Suggested commit sequence

Use commits only when they can exclude unrelated working-tree changes safely:

1. `docs: plan alternate Jumbleyard landing suite`
2. `feat: add shared alternate landing catalogue`
3. `feat: add cinematic toybox landing`
4. `feat: add party broadcast landing`
5. `feat: add arcade cabinet landing`
6. `test: validate alternate Jumbleyard landings`

## Completion criteria

Implementation is complete only when:

- `/` remains unchanged.
- All three new routes build and render.
- Every canonical game is reachable from every new route.
- Party mode, language, wardrobe, and account entry points are available.
- The three concepts match the approved palette, hierarchy, copy, and signature interaction.
- Desktop and phone screenshots have no overflow, clipping, or unreadable content.
- Keyboard navigation and reduced-motion behavior work.
- Generated plate failure and game-art failure preserve a coherent, functional page.
- Focused tests, typecheck, architecture check, lint, formatting, build, and browser smoke checks pass, or unrelated pre-existing failures are documented with evidence.
- No deployment or publication occurs without a separate request.

