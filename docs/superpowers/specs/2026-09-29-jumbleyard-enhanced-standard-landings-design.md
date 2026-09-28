# Jumbleyard Enhanced Standard Landings Design

**Date:** 2026-09-29
**Status:** Approved concept; awaiting written-spec review
**Routes:** `/landing4`, `/landing5`

## Objective

Create two production-quality alternatives to the current Jumbleyard homepage while leaving `/` unchanged. Both routes must preserve the standard page's complete product experience and familiar clay-clubhouse identity. They differ only in how cinematic motion introduces and carries that experience:

- `/landing4`: **Living Clubhouse**, an immediately usable homepage with an ambient animated world
- `/landing5`: **Clubhouse Trailer**, a short directed arrival that transforms into the standard homepage

The alternatives are complete comparison candidates, not demo reels. A visitor must retain direct access to games, party mode, account state, wardrobe, language selection, adventure progress, passport quests, and the full standard game shelf.

## Product, audience, and primary job

Jumbleyard is a browser playground of short physical-comedy games for friends and families. Its standard identity is a bright handcrafted clay clubhouse: warm, welcoming, lightly mischievous, and easy to understand.

Both pages have one primary job: move a visitor into a real game or party session without making the presentation feel like an obstacle. Higgsfield media adds life and anticipation; it must not replace product information, delay navigation, or make Jumbleyard look like a different brand.

## Scope

### Included

- Two new public routes, `/landing4` and `/landing5`
- The same functional content and data shown by the current homepage:
  - Header and Jumbleyard identity
  - Account-aware welcome and continuation state
  - Interactive crew
  - Adventure picker
  - Passport, stamps, and starter quests
  - Party-mode invitation
  - Complete standard game shelf
  - Language, wardrobe, and account entry points
- Two Higgsfield-generated motion assets plus static poster fallbacks
- Route-isolated CSS and progressive enhancement
- Desktop, tablet, and phone layouts
- Keyboard, touch, reduced-motion, media-failure, and build verification

### Excluded

- Replacing or visually changing `/`
- Changing gameplay, party logic, account behavior, wardrobe behavior, adventure persistence, translations, or the source catalogue
- Runtime calls to Higgsfield or another generation service
- Autoplay audio, narration, or sound effects
- Requiring video playback before visitors can navigate
- A global animation library or global theme change
- Deployment or publication without a separate request

## Shared brand system

Both routes retain the standard homepage's existing design language rather than creating another concept theme.

### Palette

- Clay Sky `#A8DDF0`
- Clubhouse Teal `#287C80`
- Clay Coral `#D96846`
- Yard Sun `#F5C451`
- Warm Plaster `#FFF6DF`
- Clay Ink `#244943`
- Brand Paper `#F7F3E8`

### Typography

- Display: Fredoka, matching the current clubhouse headlines
- Body, controls, and navigation: DM Sans
- Small labels retain the current uppercase, widely tracked utility treatment

### Material and shape language

Controls keep their existing clay-button depth, soft asymmetric speech bubbles, rounded cards, warm paper surfaces, and tactile shadows. Motion should feel stop-motion-adjacent and physical rather than glossy, futuristic, or interface-heavy.

## Architecture

The implementation must reuse the existing `CollectionClient` and its established stores and shared components. The current `app/page.tsx`, homepage behavior, and default styling remain unchanged.

Each new route supplies the same game ordering contract used by the standard page, then wraps `CollectionClient` in a route-specific enhancement shell:

- A shared media component renders a poster first, progressively adds video, and reports only presentation state.
- A shared motion shell observes existing page sections and applies route-scoped reveal classes.
- Pointer and scroll positions are written to CSS custom properties through refs. They must not trigger React renders on every frame.
- Existing links, buttons, dialogs, stores, translations, and account subscriptions stay authoritative.
- Route-specific styles are namespaced beneath the landing wrapper so they cannot affect `/` or game routes.

No catalogue, account, language, wardrobe, or adventure state is duplicated. If the enhancement JavaScript fails, the underlying standard page remains readable and navigable.

## Route 1: Living Clubhouse (`/landing4`)

### Thesis

The familiar clubhouse is already alive when the visitor arrives. The page should feel like stepping into the existing illustration rather than watching an advertisement for it.

### Hero composition

The standard two-column hero remains recognizable. A seamless Higgsfield playground loop sits behind the right side and softly extends into the sky-colored page background. The generated scene contains no text, logos, controls, or close character duplicates; the existing interactive crew remains the primary character layer.

Copy, product actions, guest reassurance, and facts retain their current hierarchy and wording. Video contrast treatment must preserve the current text colors rather than switching the hero to a dark cinematic theme.

### Signature interaction

The **yard path** is a quiet progress rail that marks four real destinations:

1. Welcome
2. Next adventure
3. Party mode
4. Game shelf

It reflects the section nearest the reading position and provides direct anchor links. It does not create a new task system or store progress.

### Motion behavior

- The ambient video loops silently and inline.
- Pointer movement produces shallow depth across the video, existing crew, speech bubble, and nearby decorative props.
- The hero copy arrives in one short orchestrated sequence rather than many unrelated effects.
- Adventure, passport, party, and shelf sections reveal once using opacity and bounded vertical movement.
- Game cards use restrained pointer tilt on capable devices and the same lift treatment on keyboard focus.
- Play badges and selected actions receive small spring-like transitions using CSS timing, not a runtime physics library.

The page is fully usable from the first rendered frame. Animation never blocks controls.

## Route 2: Clubhouse Trailer (`/landing5`)

### Thesis

The visitor arrives through a short clay-world establishing shot, then the cinematic frame becomes the standard clubhouse page. The transition is the spectacle; the application underneath stays familiar.

### Opening composition

An 8–10 second Higgsfield shot begins at the yard gate and travels toward the clubhouse play space. Real interface copy and controls are HTML layered above the video, never generated into its pixels.

The opening includes:

- The standard Jumbleyard mark
- The existing homepage promise
- Direct `Pick a game` and `Play party mode` links
- An explicit `Enter the yard` control
- An always-visible `Skip` control
- A subtle time/progress indicator that is not required to understand the page

The video is muted, inline, and non-looping. It may begin automatically where allowed, but failure to autoplay must not hide the poster or controls.

### Transition into the page

The transition begins when any of the following occurs:

- The visitor activates `Enter the yard`
- The visitor scrolls beyond the opening threshold
- The video reaches its end
- The visitor activates `Skip`

The video frame expands slightly, the warm plaster foreground rises, and the standard clubhouse hero resolves beneath it. The effect must use transforms and opacity and must not move keyboard focus unexpectedly.

After the transition, the complete standard homepage remains available in normal document flow. The trailer does not replay during the same route visit. No persistent cross-session preference is required.

### Motion behavior after entry

Post-entry motion is deliberately lighter than `/landing4`. Section reveals and card interactions use the same shared primitives, but the trailer remains the single bold gesture. This avoids turning the route into a sequence of competing cinematic effects.

## Higgsfield media plan

Higgsfield is used to create two related but distinct clay-world videos in the established Jumbleyard palette.

### Living Clubhouse loop

- Duration: 6–8 seconds
- Format intent: seamless loop, wide 16:9 master
- Camera: nearly locked with a very slow breathing push
- Scene: bright handcrafted clay playground and clubhouse environment, open negative space for interface copy, subtle flags/props/light movement
- People: no prominent hero characters, preventing conflict with the real interactive crew layer
- Prohibited: text, logos, branded products, UI, controller imagery, audio, rapid motion, dark cinematic grading

### Clubhouse Trailer shot

- Duration: 8–10 seconds
- Format intent: single directed shot, wide 16:9 master
- Camera: gentle forward arrival from the yard gate toward the familiar play space
- Scene: the same handcrafted clay materials, sky, coral, teal, yellow, and plaster palette
- Ending: a stable composition that can visually dissolve into the standard hero
- Prohibited: text, logos, generated interface, dialogue, audio, aggressive camera motion, third-party game imagery

Each video receives a representative poster frame. Final web assets are stored locally and encoded in browser-friendly formats. The routes do not depend on Higgsfield at runtime.

## Data and interaction flow

- Route pages provide the same game-order input contract as `/`.
- `CollectionClient` continues to derive localized catalogue and adventure data.
- Existing external stores continue to own account, wardrobe, language, and adventure state.
- The enhancement shell owns only transient presentation state: media readiness, trailer entered/skipped state, current visible section, and pointer-derived CSS variables.
- Primary hero and trailer actions navigate directly to the real catalogue anchor or `/party`.
- The yard path uses anchors to existing sections and never rewrites browser history unnecessarily.
- Media events do not write to account or adventure persistence.

## Responsive behavior

### Desktop

- `/landing4` keeps the two-column clubhouse hero with the media concentrated behind the crew side.
- `/landing5` uses a full-width opening frame with copy positioned in a protected low-detail region.
- Game-card tilt is enabled only for fine pointers.

### Tablet

- Media crop favors the clubhouse destination and reduces parallax depth.
- The yard path becomes a compact top or side navigator according to available width.
- Trailer controls remain fully visible without overlapping the header.

### Phone

- Generated media becomes a contained scene behind or below the copy, matching the standard mobile stacking order.
- The yard path becomes a small horizontal checkpoint strip.
- Trailer actions stack into full-width touch targets.
- Card tilt is removed; focus/pressed feedback remains.
- No essential action depends on hover, autoplay, or precise pointer movement.

## Accessibility and reduced motion

- The underlying standard page retains one `h1`, logical headings, semantic links, button roles, and accessible names.
- Trailer controls precede the underlying content in focus order and expose explicit action names.
- Entering or skipping does not steal focus. If a control removes itself, focus moves to the standard hero heading only when needed to avoid loss.
- Generated media is decorative and has no alternative text. The HTML copy communicates all meaning.
- Videos are muted and contain no audio track.
- With `prefers-reduced-motion: reduce`:
  - Videos do not autoplay.
  - `/landing4` shows its poster with no parallax or reveal travel.
  - `/landing5` bypasses the timed trailer transition and shows the standard page immediately with a static poster accent.
  - Card tilt, large transforms, and scroll-linked motion are removed.
- Focus indicators retain the current high-contrast clubhouse treatment.

## Failure handling

- Poster images render before videos and remain beneath them.
- Video loading, decoding, or autoplay failure leaves all HTML controls and the standard page usable.
- A timed media-readiness guard prevents a blank opening frame.
- Missing poster or video assets fall back to the existing sky/plaster CSS background.
- Client enhancement failure leaves the standard page in normal document flow.
- Existing account, wardrobe, language, and adventure errors continue to use their current behavior.

## Performance constraints

- Posters load eagerly; videos use metadata-oriented or conservative preload behavior.
- Motion assets are compressed and sized for web delivery. Mobile may use the poster instead of downloading the full video when bandwidth or motion preferences advise restraint.
- The two routes load only their own motion asset.
- No new animation framework is added.
- Transforms and opacity are preferred for animation.
- Intersection observers disconnect after one-time reveals where possible.
- Pointer movement updates CSS variables through animation-frame scheduling and refs rather than React state.
- Below-the-fold game imagery keeps existing lazy-loading behavior.

## Verification

### Automated

- Focused route tests verify both routes use the standard game ordering and preserve all standard entry points.
- Browser smoke checks load both routes at desktop and phone sizes.
- Checks fail on page errors, console errors, horizontal overflow, missing `h1`, missing catalogue links, missing party links, or inaccessible primary controls.
- Keyboard checks exercise trailer skip/enter controls and yard-path navigation.
- Reduced-motion checks verify autoplay and large motion are disabled.
- Video-failure checks verify posters and controls remain usable.
- TypeScript, architecture, lint, formatting, focused tests, and production build pass.

### Visual review

- Desktop review at approximately 1440×900
- Phone review at approximately 390×844
- Above-the-fold screenshots with normal and reduced motion
- Review of the trailer before, during, and after entry
- No content duplication, unreadable video contrast, clipped controls, or layout shift
- Side-by-side comparison confirms both routes remain unmistakably the standard Jumbleyard style while offering genuinely different motion experiences

## Acceptance criteria

The work is complete when:

1. `/` remains functionally and visually unchanged.
2. `/landing4` presents the complete standard experience as an immediately usable living clubhouse.
3. `/landing5` presents an accessible, skippable trailer that transitions into the complete standard experience.
4. Both routes preserve account, wardrobe, language, adventure, passport, party, and full game-shelf behavior.
5. Both generated media assets match the standard clay-clubhouse identity and have robust poster/CSS fallbacks.
6. Desktop and phone layouts have no overflow, clipped controls, or unreadable content.
7. Keyboard and reduced-motion behavior work as specified.
8. Relevant tests and the production build pass, or unrelated pre-existing failures are documented with evidence.
9. No deployment or publication occurs without a separate request.
