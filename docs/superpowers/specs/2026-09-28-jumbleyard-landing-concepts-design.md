# Jumbleyard Alternate Landing Suite Design

**Date:** 2026-09-28  
**Status:** Approved concept; awaiting written-spec review  
**Routes:** `/landing1`, `/landing2`, `/landing3`

## Objective

Create three complete, production-quality alternate landing pages for Jumbleyard while leaving the existing `/` landing page unchanged. Each page must present the same real product—31 browser party games, party mode, player identity, wardrobe, language selection, and direct game entry—through a deliberately different gaming aesthetic.

The three pages are comparison candidates, not partial mood boards. A visitor must be able to discover the catalogue and enter a game from any route.

## Product and audience

Jumbleyard is a browser playground of short, physical-comedy party games for groups of friends. The audience includes families, younger players, and friend groups who want to begin playing quickly without downloading software or creating an account.

Every page has one primary job: move a visitor from curiosity to a real game or party-mode session. The interface should feel game-native without implying a competitive esports product or abandoning Jumbleyard's tactile clay-character identity.

## Scope

### Included

- Three new public routes:
  - `/landing1`: Cinematic Toybox
  - `/landing2`: Party Broadcast
  - `/landing3`: Arcade Cabinet
- Working navigation to the real game routes and `/party`
- Existing language, wardrobe, and account controls
- A hero, curated featured-games area, complete game catalogue, party-mode section, and footer on each route
- Responsive layouts for desktop, tablet, and phone
- Keyboard navigation, visible focus states, semantic headings, useful alternative text, and reduced-motion behavior
- Three concept-specific atmosphere assets created through the connected Higgsfield capability and stored locally in the repository
- Build, type, runtime, responsive, interaction, and visual verification

### Excluded

- Replacing or restyling the current `/` landing page
- Changing gameplay, game routes, party-mode behavior, account behavior, wardrobe behavior, or translations
- Deploying or publishing the alternatives
- Runtime calls to Higgsfield or any other generative service
- Video backgrounds, WebGL hero scenes, autoplay audio, or other heavy presentation layers
- A shared global theme change that could affect game screens

## Architecture

The work will be isolated in new route and feature files. The current `app/page.tsx`, `app/CollectionClient.tsx`, and `app/collection.css` remain functionally and visually unchanged.

Each route owns its page composition and concept-specific stylesheet. A small shared landing-concept layer provides:

- A catalogue adapter sourced from existing game metadata and translations
- Brand/header primitives
- Account, wardrobe, and language controls wired to existing components
- Shared accessible link and card behavior
- Shared content order and fallback handling

The three routes share product data and interaction contracts, not their visual shell. This preserves meaningful comparison between concepts and prevents concept-specific CSS from leaking into another route.

The route components should remain server-renderable wherever possible. Client code is limited to existing account/language/wardrobe behavior and concept-specific progressive enhancement. A failure to load enhancement JavaScript must not prevent navigation to a game or party mode.

## Shared page anatomy

All three pages use the same information hierarchy while expressing it differently:

1. **Header** — Jumbleyard identity, game-library jump, language, wardrobe, and account controls.
2. **Hero** — one concept-specific promise, primary “Pick a game” action, party-mode action, and factual product proof: 31 games, 1–4 players, short rounds, no download.
3. **Featured games** — a small curated group using real production artwork and direct game links.
4. **Complete catalogue** — all available games with title, short description, player/round metadata where available, and a direct action.
5. **Party mode** — explains room-based multi-game play and links to `/party`.
6. **Footer** — compact brand close, product reassurance, and a route back to the current landing page.

The complete catalogue remains available on the page rather than hiding games behind an inaccessible carousel. Visual carousels may enhance the featured area, but links remain reachable in document order.

## Visual direction 1: Cinematic Toybox

### Thesis

Jumbleyard is a handcrafted world staged like the opening shot of a playful adventure film. The characters and physical game props are the spectacle; interface chrome stays disciplined.

### Palette

- Backstage Ink `#06131B`
- Deep Lake `#0B2A38`
- Electric Mist `#7EE3E0`
- Trophy Gold `#FFB649`
- Clay Red `#C96B4B`
- Warm Paper `#F7F3E8`

### Typography

- Display: Fredoka, heavy and tightly set, used only for the central promise
- Body and controls: DM Sans
- Utility labels and small statistics: a system monospace face

### Layout

The opening viewport is an asymmetrical stage. Copy occupies the left/lower portion; an oversized clay-game composition breaks the right edge. Product facts appear as quiet stage marks rather than generic floating metric cards. Below the fold, featured games become wide theatrical “scenes,” followed by a calm, readable catalogue grid.

### Signature interaction

The **living diorama**: subtle pointer and scroll response changes the relationship between the atmosphere plate, real game artwork, and a controlled spotlight. Motion is slow and bounded. With reduced motion enabled, the hero becomes a static layered composition with identical hierarchy.

### Hero copy

- Kicker: “The yard is open”
- Headline: “Chaos looks good on you.”
- Supporting line: “Thirty-one tiny worlds. One crew. Pick a bad idea and make it memorable.”
- Primary action: “Pick a game”
- Secondary action: “Start party mode”

## Visual direction 2: Party Broadcast

### Thesis

Jumbleyard is tonight's live game-night channel: immediate, social, colorful, and always moments away from another ridiculous matchup.

### Palette

- Broadcast Purple `#5424A8`
- Signal Red `#EB4E38`
- Scoreboard Yellow `#F8DB45`
- Replay Teal `#25B5A8`
- Studio Navy `#172334`
- Studio Paper `#F4EFE4`

### Typography

- Display: an impact-style condensed system face for broadcast headlines
- Body and controls: DM Sans
- Tickers and scoreboard data: a system monospace face

### Layout

The header behaves like a channel ident. The hero combines a dominant headline, an “on air” status, a short information ticker, and a large featured matchup. Sections resemble a broadcast rundown: now playing, next up, full schedule, and party-mode special. The complete catalogue uses poster-like editorial cards rather than a conventional application grid.

### Signature interaction

The **live channel takeover**: selecting a featured game changes the hero's headline color, matchup art, metadata, and lower-third treatment as one coordinated transition. It never auto-advances while the visitor is reading. Tickers pause on hover/focus and stop entirely under reduced motion.

### Hero copy

- Kicker: “Jumbleyard live · on air”
- Headline: “Bring the noise.”
- Supporting line: “Tonight's lineup: quick games, loud friends, and absolutely no plan.”
- Primary action: “See tonight's games”
- Secondary action: “Open party mode”

## Visual direction 3: Arcade Cabinet

### Thesis

Jumbleyard is a neon social arcade whose machines contain tactile clay worlds. The retro language belongs to the navigation and spatial framing; the game art remains recognizably Jumbleyard.

### Palette

- Cabinet Black `#0E0920`
- Cabinet Plum `#241049`
- Laser Cyan `#36F2E0`
- Pixel Magenta `#D932FF`
- Token Yellow `#F9E650`
- Screen White `#F7F5FF`

### Typography

- Display and utility: a bold system monospace stack with intentionally compact tracking
- Body and longer descriptions: DM Sans for readability
- Jumbleyard wordmark: existing DM Sans treatment

### Layout

The hero is a perspective arcade aisle. Three highlighted games form the front row while the headline anchors the ceiling plane. The featured section behaves like a cabinet selector, with a clearly visible focused machine and adjacent choices. The catalogue becomes a flat, highly legible cartridge wall below the immersive opening so every game remains easy to scan on phones and with a keyboard.

### Signature interaction

The **walkable game aisle**: pointer, touch, or arrow-key focus brings one cabinet forward, brightens its marquee, and updates a nearby description/action panel. Selection is represented by focus and content order rather than color alone. Reduced motion removes perspective travel but keeps the focus change and marquee contrast.

### Hero copy

- Kicker: “Jumbleyard.exe · four players ready”
- Headline: “Insert friends.”
- Supporting line: “Press any bad idea to start. No download, no account, no quarters.”
- Primary action: “Choose a cabinet”
- Secondary action: “Load party mode”

## Higgsfield asset plan

Higgsfield is used for atmosphere rather than text, controls, logos, or invented product screenshots. Each concept receives one wide background plate:

1. A deep miniature soundstage with theatrical pools of light and practical toy-scale set details
2. A bright game-show studio package with modular color fields and broadcast framing
3. A neon arcade tunnel with cabinet silhouettes and a clean central perspective lane

The prompts prohibit words, logos, UI, controllers with brand marks, and identifiable third-party game imagery. Existing Jumbleyard production art is composited above these plates in HTML/CSS so characters stay consistent with the shipped games. Generated images are decorative, have empty focal areas for responsive cropping, and receive empty alternative text.

If a generated plate is unsuitable, the corresponding CSS color-and-light treatment is the approved fallback; asset generation must not block a functional page.

## Interaction and data flow

- Catalogue content is derived once through the shared adapter and passed to each concept presentation.
- Game cards link directly to their existing route. No intermediate modal is required to start a game.
- Featured-game selectors change local presentation state only; the selected game's direct link remains explicit.
- Header controls reuse existing state stores and dialogs rather than introducing parallel account, language, or wardrobe implementations.
- Primary hero actions either jump to the page's catalogue or navigate to `/party`.
- No analytics schema changes are required. Existing link navigation remains observable by current platform behavior.

## Responsive behavior

Desktop layouts may use layered composition and horizontal featured treatments. At tablet sizes, overlap is reduced and controls receive larger hit areas. On phones:

- Header controls collapse to icon-led actions with accessible names
- Hero artwork moves behind or below the copy without reducing text contrast
- Featured choices become horizontal snap lists or stacked cards
- The full catalogue becomes one column or a compact two-column grid depending on available width
- Primary actions remain visible without requiring precise pointer input
- No essential content depends on hover

## Accessibility and motion

- One `h1` per route and logical section heading order
- Semantic links for navigation; buttons only for local state changes
- Visible focus treatments with sufficient contrast in every palette
- Minimum 44px touch targets for primary controls
- Real alternative text for game artwork; empty alternative text for generated atmosphere plates
- Color contrast checked for body copy, controls, and metadata
- `prefers-reduced-motion` disables parallax, ticker movement, perspective travel, and large coordinated transitions
- No autoplay sound or video

## Failure handling

- Missing or failed atmosphere assets fall back to concept-specific CSS backgrounds.
- Missing game artwork renders a branded color panel with the game title, preserving the link and layout.
- Empty optional metadata is omitted rather than displayed as a blank label.
- Client-side enhancement failure leaves server-rendered headings, copy, catalogue links, and party-mode links usable.
- Existing account, language, or wardrobe errors continue to use their established component behavior.

## Performance constraints

- Generated atmosphere plates are stored in modern web formats and sized for the intended viewport.
- Only above-the-fold artwork is loaded eagerly; catalogue imagery is lazy-loaded.
- CSS transforms and opacity are preferred for animation.
- No new animation library is required.
- Concept client bundles stay separate so visiting one alternative does not load the other two presentations.
- The full catalogue must remain usable before all images finish loading.

## Verification

### Automated

- TypeScript typecheck
- Production build
- Existing architecture and relevant unit tests
- Route-level smoke checks for `/landing1`, `/landing2`, and `/landing3`
- Link checks for featured games, catalogue games, `/party`, and `/`

### Browser and visual

- Desktop review at approximately 1440×900
- Mobile review at approximately 390×844
- No horizontal overflow or clipped controls
- Real header controls open their existing interfaces
- Featured selectors work with pointer and keyboard input
- Reduced-motion review
- Image-failure fallback review
- Console error review
- Side-by-side screenshots to judge whether the concepts are unmistakably distinct while still reading as Jumbleyard

## Acceptance criteria

The work is complete when:

1. The current `/` page is unchanged.
2. All three new routes render a complete, functional landing experience.
3. Every shipped game represented in the source catalogue is reachable from each route.
4. Party mode, language, wardrobe, and account entry points are usable from each route.
5. The three pages clearly match their approved visual theses and do not look like palette swaps of one template.
6. Desktop and mobile layouts pass visual review without overflow or unreadable content.
7. Keyboard navigation and reduced-motion behavior work as designed.
8. The production build and relevant checks pass, or any pre-existing unrelated failure is documented with evidence.

