# Jumbleyard clay clubhouse

Approved by the user and implemented locally, 2026-09-20.

## Direction

Extend the approved Court Clash clay cast and sunny miniature world into the website interface. Preserve all four characters' faces, skin tones, sculpted hairstyles, and proportions. Use separate transparent character illustrations with web-rendered speech bubbles, so the cast can stand beside buttons and lean over panels rather than remain inside game thumbnails.

The recommended approach is an illustrated clubhouse: stronger presence than a decorative refresh, faster and easier to navigate than a fully interactive 3D lobby.

## Page experience

- Landing hero: a sunny playground stage with the four characters arranged around the headline and two clear actions, Pick a game and Play party mode. Keep the game collection close enough to reach immediately.
- Getting started: three compact character-led steps explaining choosing a game, sharing a room code, and playing together. Use brief practical dialogue and ordinary selectable HTML text.
- Overview: retain the approved 23 images and existing game destinations. Add a cast guide beside the collection heading, tactile card edges, and consistent play buttons. Any player counts and game facts come from existing content.
- Party entry and waiting room: a guide explains creating or joining a room and readiness using actual room state. Coordinate with the separate party podium/voting design; do not alter its tournament rules.
- Sign-in and registration: frame the existing unified Google/email-code flow as joining the crew. A character welcomes players, changes to a mail-checking pose for the code step, and celebrates successful sign-in. Keep field labels, verification, resend, errors, and dismissal clear. Guest play stays immediately available.
- Account and wardrobe entry: use the same cast framing and small hints to connect identity and dressing a character with the rest of the site. Preserve the functioning wardrobe preview.
- Shared game chrome: carry the palette and controls into shared account/toolbar surfaces, keeping guidance away from active gameplay controls.

## Visual system

Sky blue #A8DDF0, pool teal #287C80, clay coral #D96846, sunshine #F5C451, plaster #FFF6DF, and deep ink #244943. Use existing locally hosted Fredoka for display text and DM Sans for controls and paragraphs. Build raised rounded controls, soft grounded shadows, and restrained scenic details inspired by the basketball court.

The signature is the cast crossing panel boundaries with short contextual speech bubbles. Characters wave or settle gently on entry; buttons press down on interaction. Avoid continuous distracting animation. Mobile compositions reduce cast size and stack instructions without covering controls. Respect reduced-motion preferences.

## Implementation boundaries

Create a reusable cast illustration and guide component with explicit pose, character, text, and sizing inputs. Generate transparent artwork using the canonical Court Clash reference and verify consistent identities and real transparency before installation. Keep authored full-resolution masters outside production assets and ship optimized derivatives with dimensions reserved to prevent layout shift.

Use shared style tokens while scoping page layouts and account-specific presentation. Existing account APIs, party state, game routes, and wardrobe behavior remain the source of truth. Add English and German copy through the language system. Do not invent XP, rewards, achievements, or progress claims unsupported by game state.

## Verification

Review desktop and narrow mobile screenshots of hero, overview, party entry, sign-in, code entry, account, and wardrobe entry. Check keyboard dialog operation, focus visibility, readable contrast, reduced motion, overflow, character clipping, and all 23 image loads. Run type checking and lint for changes, architecture checks, and relevant existing account/party tests. Verify guest play and existing navigation still work. Test authentication presentation without sending real email or changing an account unless specifically needed and authorized.

## Delivery

Implement a locally reviewable coherent redesign across these surfaces after design approval. Publishing is a separate action unless the user requests deployment of this redesign.
