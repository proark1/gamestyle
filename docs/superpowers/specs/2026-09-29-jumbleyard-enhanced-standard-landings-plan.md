# Jumbleyard Enhanced Standard Landings Implementation Plan

**Date:** 2026-09-29
**Design:** `docs/superpowers/specs/2026-09-29-jumbleyard-enhanced-standard-landings-design.md`
**Routes:** `/landing4`, `/landing5`

## Outcome

Add two route-isolated alternatives to the standard Jumbleyard homepage:

- `/landing4` — Living Clubhouse: the complete standard experience with an ambient Higgsfield hero loop, yard-path navigation, section reveals, and playful card depth.
- `/landing5` — Clubhouse Trailer: an accessible, skippable Higgsfield arrival shot that transitions into the complete standard experience.

The existing `/` route and its behavior remain unchanged. Both alternatives reuse `CollectionClient`, its established stores, and the shared clubhouse components.

## Planned file structure

```text
app/
  landing-enhanced/
    EnhancedStandardShell.tsx
    EnhancedMedia.tsx
    YardPath.tsx
    order.ts
    order.test.ts
    copy.ts
    enhanced-standard.css
  landing4/
    page.tsx
    landing4.css
  landing5/
    page.tsx
    landing5.css
public/
  videos/
    landing-enhanced/
      living-clubhouse.mp4
      living-clubhouse-poster.webp
      clubhouse-trailer.mp4
      clubhouse-trailer-poster.webp
scripts/
  enhanced-standard-landings-smoke.mjs
```

The final media extension may change only if the connected generator supplies a more suitable browser-native format. The route contract and poster fallbacks do not change.

## Task 1 — Capture the standard-page contract

**Inspect without modifying**

- `app/page.tsx`
- `app/CollectionClient.tsx`
- `app/collection.css`
- `shared/clubhouse/ClubhouseWelcome.tsx`
- `shared/clubhouse/AdventureDesk.tsx`
- `shared/clubhouse/InteractiveCrew.tsx`

**Create**

- `app/landing-enhanced/order.ts`
- `app/landing-enhanced/order.test.ts`

**Work**

1. Mirror the standard route's pinned and shuffled slug sets in a small route-local order adapter. Do not copy game titles, descriptions, images, translations, or state behavior.
2. Preserve the pinned order and randomize only the same standard-page subset.
3. Add focused tests that assert:
   - Every standard slug appears exactly once.
   - Pinned games remain at the front in the existing order.
   - Shuffling does not change membership.
   - The two new routes can receive the same `string[]` contract as `CollectionClient`.
4. Keep `app/page.tsx`, `app/CollectionClient.tsx`, and `app/collection.css` untouched because they already contain unrelated user work.

**Exit gate**

- Focused order tests pass.
- A source diff confirms the standard route files are unchanged.

## Task 2 — Generate and prepare Higgsfield media

**Create**

- `public/videos/landing-enhanced/living-clubhouse.mp4`
- `public/videos/landing-enhanced/living-clubhouse-poster.webp`
- `public/videos/landing-enhanced/clubhouse-trailer.mp4`
- `public/videos/landing-enhanced/clubhouse-trailer-poster.webp`

**Work**

1. Use the existing private Jumbleyard Higgsfield project when available; otherwise create one private project for these two assets.
2. Generate the Living Clubhouse master:
   - 6–8 seconds, wide 16:9
   - Seamless or visually forgiving loop
   - Bright clay playground and clubhouse atmosphere
   - Nearly locked camera with a slow breathing push
   - Negative space for the existing copy and room for the real interactive crew
   - No prominent generated cast, text, logos, UI, branded products, audio, or rapid motion
3. Generate the Clubhouse Trailer master:
   - 8–10 seconds, wide 16:9
   - One gentle forward camera arrival from the yard gate toward the play space
   - Stable final composition suitable for dissolving into the existing hero
   - The same sky, teal, coral, yellow, plaster, and clay material language
   - No text, logos, UI, dialogue, audio, aggressive motion, or third-party imagery
4. Display each submitted generation once and wait on the returned job identifiers without resubmitting timed-out jobs.
5. Download the completed masters into the repository, inspect them visually, remove audio tracks if present, and encode web-ready MP4 files.
6. Extract representative poster frames and convert them to WebP.
7. Verify duration, dimensions, codec, file size, and absence of audio with local media inspection.

**Exit gate**

- Both assets match the existing clubhouse identity.
- Each poster is attractive and functional without its video.
- The Living Clubhouse loop has no visible hard cut during normal viewing.
- The trailer ends on a calm frame that supports the planned transition.

## Task 3 — Build the shared progressive-enhancement shell

**Create**

- `app/landing-enhanced/EnhancedStandardShell.tsx`
- `app/landing-enhanced/EnhancedMedia.tsx`
- `app/landing-enhanced/YardPath.tsx`
- `app/landing-enhanced/copy.ts`
- `app/landing-enhanced/enhanced-standard.css`

**Work**

1. Build `EnhancedStandardShell` as a client wrapper that accepts:
   - `variant: 'living' | 'trailer'`
   - Media source and poster source
   - The fully rendered `CollectionClient` child
2. Keep the child in normal document flow from the first render so media or hydration failure cannot hide the standard page.
3. Add a route-scoped `IntersectionObserver` that marks the existing welcome, adventure, party, shelf-heading, and shelf regions when first revealed.
4. Disconnect completed observations and disable reveal travel when reduced motion is active.
5. Schedule pointer CSS-variable writes through one animation frame and a wrapper ref. Do not store pointer coordinates in React state.
6. Build `EnhancedMedia` with:
   - Poster-first rendering
   - Muted, inline video
   - Conservative preload behavior
   - Media-ready and media-failed presentation states
   - No semantic content or alternative text
7. Build `YardPath` from real page anchors. The active checkpoint follows the nearest visible section, and every checkpoint remains a normal anchor link.
8. Add English and German labels for new controls and checkpoint names using the existing language hook. Do not add a second language store.
9. Namespace every selector beneath `.enhanced-standard`, `.living-clubhouse`, or `.clubhouse-trailer`.

**Performance rules**

- No animation dependency.
- No state updates on scroll or pointer frames unless the discrete active section changes.
- Existing lazy image behavior remains intact.
- The two variants do not import one another's video.

**Exit gate**

- Rendering the shell with media blocked leaves the child fully usable.
- Reduced-motion mode produces a stable poster-first page.
- Pointer movement does not cause repeated React renders.

## Task 4 — Implement `/landing4` Living Clubhouse

**Create**

- `app/landing4/page.tsx`
- `app/landing4/landing4.css`

**Work**

1. Build a server route that creates the standard collection order and renders `CollectionClient` inside the shared shell with `variant="living"`.
2. Import the standard collection styles through `CollectionClient`; import only route-scoped enhancement styles from the route.
3. Place the generated scene behind the right side of the hero while retaining the existing interactive crew as the primary foreground character layer.
4. Implement the four-stop yard path: Welcome, Next adventure, Party mode, Game shelf.
5. Add one short hero entrance sequence, shallow pointer depth, one-time section reveals, and restrained game-card depth.
6. Enable card tilt only for fine pointers. Keyboard focus receives an equivalent non-tilting lift and play-badge response.
7. On phone layouts, contain media behind or below the hero copy, flatten card motion, and convert the path to a compact horizontal checkpoint strip.
8. Under reduced motion, show the poster and remove parallax, reveal travel, and card tilt.

**Exit gate**

- The page is recognizable as the standard homepage before animation begins.
- Every original homepage capability remains available.
- The hero is usable while the video is still loading.

## Task 5 — Implement `/landing5` Clubhouse Trailer

**Create**

- `app/landing5/page.tsx`
- `app/landing5/landing5.css`

**Work**

1. Build a server route that creates the standard collection order and renders `CollectionClient` inside the shared shell with `variant="trailer"`.
2. Add an opening layer with HTML-rendered brand, existing homepage promise, `Pick a game`, `Play party mode`, `Enter the yard`, and `Skip` controls.
3. Start the muted inline video where autoplay is allowed. Keep the poster visible beneath it.
4. Trigger entry when:
   - `Enter the yard` is activated
   - `Skip` is activated
   - The user scrolls beyond the opening threshold
   - The video ends
5. Use one bounded transform/opacity transition to resolve the trailer into the standard clubhouse hero.
6. Keep the underlying standard page in normal document flow. The opening layer must not create a second copy of the catalogue or account controls.
7. Do not steal focus on automatic entry. If a focused disappearing control is used to enter, move focus safely to the standard hero heading.
8. Keep post-entry reveals quieter than `/landing4` so the trailer remains the route's single strong gesture.
9. In reduced-motion mode, bypass the timed trailer and present the standard page immediately with a static poster accent.

**Exit gate**

- Visitors can reach a game or party mode before video completion.
- Skip and enter work with mouse, touch, and keyboard.
- Video failure and reduced-motion mode never expose a blank or blocked screen.

## Task 6 — Add focused browser verification

**Create**

- `scripts/enhanced-standard-landings-smoke.mjs`

**Work**

1. Load `/landing4` and `/landing5` at approximately 1440×900 and 390×844.
2. Mock only environment-bound account-session calls when the local production runtime cannot provide its Cloudflare binding; do not mock page content.
3. Fail on:
   - Page or console errors
   - Horizontal overflow
   - Missing or duplicate `h1`
   - Missing standard game-shelf links
   - Missing `/party` entry points
   - Missing language or wardrobe controls
   - Inaccessible yard-path or trailer controls
4. Exercise all yard-path anchors with keyboard input.
5. Exercise trailer `Enter` and `Skip` in separate contexts.
6. Abort video requests and verify the poster and controls remain visible.
7. Run reduced-motion contexts and verify videos are not autoplaying and trailer content is not blocking the standard page.
8. Capture viewport and full-page screenshots for both routes on desktop and phone.
9. Run the smoke suite twice from a clean local session.

**Exit gate**

- Every viewport, input, fallback, and motion-preference case passes twice.
- Screenshots show two clearly different motion experiences in the same standard Jumbleyard style.

## Task 7 — Release-candidate verification

Run focused checks first, then the project-level checks proportional to these isolated routes:

```text
node scripts/test.mjs app/landing-enhanced
npm run typecheck
npm run check:architecture
npx oxlint app/landing4 app/landing5 app/landing-enhanced scripts/enhanced-standard-landings-smoke.mjs
npx oxfmt --check app/landing4 app/landing5 app/landing-enhanced scripts/enhanced-standard-landings-smoke.mjs
npm run build
node scripts/enhanced-standard-landings-smoke.mjs
```

Manual review:

- Compare `/`, `/landing4`, and `/landing5` at desktop and phone sizes.
- Confirm `/` is unchanged.
- Confirm media never reduces text contrast or covers controls.
- Confirm the generated scenes visually match the existing clay clubhouse.
- Confirm card motion is playful but not distracting.
- Confirm route transitions and focus behavior with keyboard only.
- Confirm reduced-motion behavior and media-failure fallback.

## Commit boundaries

Use small recoverable commits while preserving all unrelated work:

1. `test: define enhanced standard landing contract`
2. `assets: add enhanced clubhouse motion media`
3. `feat: add shared enhanced landing shell`
4. `feat: add living clubhouse landing`
5. `feat: add clubhouse trailer landing`
6. `test: add enhanced landing browser coverage`

If the working tree remains heavily modified, stage only the exact files created for this plan. Do not include unrelated existing changes.

## Completion criteria

- `/` is unchanged.
- `/landing4` and `/landing5` preserve the complete standard homepage experience.
- Both routes use distinct approved Higgsfield motion assets with poster and CSS fallbacks.
- Account, language, wardrobe, adventure, passport, party, and game-shelf behavior remains authoritative in existing components.
- Desktop, phone, keyboard, reduced-motion, media-failure, type, lint, architecture, build, and browser checks pass.
- No deployment or publication occurs without a separate request.
