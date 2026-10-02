# Jumbleyard identity / direction 03

The selected round-three **J/Y Gesture** has been redrawn as a single-color vector. Its looseness carries the party-game energy; the supporting system stays simple so the detailed clay game art remains the focus. [Identity preview](identity.png) and [color comparison](color-study.png) show it against landing artwork.

## Core colors

| Role | Color | Use |
| --- | --- | --- |
| Lake Blue | `#1B718D` | Mark, primary actions, main accent |
| Night Ink | `#203C49` | Wordmark, text, dark surfaces |
| Mist | `#D7E9E7` | Pale blue-green background |
| Warm Paper | `#F7F3E8` | Neutral background and card surface |
| Clay Red | `#C96B4B` | Small highlight drawn from the characters and props |

Blue comes from the water and sky in **Stack or Sink** and **Reel Problems**. Warm Paper echoes the stone and sand in **Uphill Delivery** and **Chain of Fools**. Clay Red is a small counterpoint; it should not appear inside the mark. For small white text on a clay-colored badge, use the deeper `#AD4A35` variant for legibility.

## Type and use

- **Wordmark and navigation:** DM Sans Bold, lowercase, close tracking. The symbol should lead the name, with no tile or full stop.
- **Expressive game headlines:** Fredoka may remain in game-facing content, paired with DM Sans for controls and body copy.
- **Mark:** Use the blue SVG on light ground and the white SVG on Lake Blue or Night Ink. Keep the shape flat, with no shadow, gradient, outline, rotation, or extra game symbols.
- **App icon:** White gesture on a Lake Blue rounded square. Check at 32 px before release.
- **Photography:** Give the mark a quiet area beside artwork; avoid placing it on top of characters or busy scenes.

## Assets and application

- Primary mark: `public/images/brand/jumbleyard-mark.svg`
- Reversed mark: `public/images/brand/jumbleyard-mark-white.svg`
- App icon: `public/favicon.svg`
- Landing header and accents: `app/CollectionClient.tsx`, `app/collection.css`
- Browser theme color: `app/layout.tsx`

The board is a presentation of the system, while the SVGs are the production assets. The original generated `03-gesture-jy.png` remains in `docs/brand/logo-round-3/` as the selected concept reference.
