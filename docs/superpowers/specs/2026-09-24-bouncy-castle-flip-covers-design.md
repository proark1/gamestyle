# Bouncy Castle Royale and Flip Happens collection covers

## Goal

Replace the gameplay screenshots used by the Bouncy Castle Royale and Flip Happens cards on the start page with illustrated covers that match the established all-boy clay collection artwork.

## Visual system

- Use the same four recognizable boy characters, youthful proportions, expressive faces, sculpted hair, and tactile handmade clay rendering as the existing images in `public/images/court-cast-v1/boys/`.
- Use bright daytime lighting, cheerful saturated team colors, softly modeled scenery, and an energetic medium-close 3:2 composition.
- Keep all four faces readable and the central action clear when the image is cropped by the start-page card.
- Do not include titles, UI, player labels, logos, borders, or watermarks.

## Bouncy Castle Royale

Show the four boys split into red and blue teams inside the inflatable castle volleyball court. Two players are airborne around the ball while another landing visibly deforms the bouncy floor. Preserve the recognizable red and blue castle halves, net, corner towers, and shared-air game equipment. The image should communicate buoyant team volleyball and playful physical comedy rather than an ordinary rigid court.

## Flip Happens

Show all four boys surrounding the mint-green wobbling table while absurd household objects are being flipped. Feature a washing machine landing and a black top hat in flight, with the table visibly tilted and the cast reacting or trying to control it. Preserve the game's clean tabletop arena and playful object-flipping premise without reproducing its UI.

## Integration

Save the final images as new standard collection assets beside the other all-boy covers. Update only the two corresponding start-page card image paths and descriptive alternative text. Keep the party-voting gameplay screenshots unchanged because those intentionally depict actual gameplay.

## Verification

- Inspect both generated images for cast consistency, gameplay fidelity, clean cropping, and forbidden text/UI.
- Confirm both asset files load from their public URLs.
- Run the relevant TypeScript or production build check for the start-page configuration.
- Visually inspect the start page at desktop and narrow/mobile widths to confirm the artwork crops correctly and no card layout regresses.
