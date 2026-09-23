# Full mascot suits

## Goal

Add five premium mascot suits alongside the existing five costumes. A mascot suit is a padded, single-piece silhouette: a closed hood hides all hair and ears, an oval opening exposes only the familiar face, and sleeves, mitts, legs, and booties cover the rest of the avatar. The avatar keeps its expressions and gameplay poses.

## Lineup

| Suit | Silhouette and details | Palette |
| --- | --- | --- |
| Cluck Cloud | Round chicken body, wing sleeves, comb, tail feathers, three-toed booties | Warm cream, coral, teal |
| Patchwork Moo | Spotted cow body, floppy ears, short horns, tail, hoof mitts and feet | Oat cream, soft plum, charcoal |
| Wobble Cone | Tapered foam traffic cone, reflective bands, cone hood, padded gloves and shoes | Tangerine, warm white, slate |
| Steam Bun | Plump pleated dumpling, crimped hood, steam tuft, rounded mitts and feet | Butter, pale lilac, plum |
| Nimbus Nib | Puffy cloud creature, rounded nubs, scalloped hood, oversized mitts | Sky blue, lilac, mint |

All five are original designs without recognizable superhero marks or signature color schemes.

## Rendering

Use a shared mascot definition with variants for both the clay kid and shared worker. Build padded torso shells and attachments on the existing head, body, arm, and leg anchors so walking, waving, and other poses continue to work. Build a closed hood shell with a real oval face aperture and a soft rim. Omit hair geometry when constructing a kid in a mascot suit; omit the worker's hair patches. Keep facial geometry and expressions. Underlying garments are visually covered, and equipping ordinary clothing follows the existing costume removal behavior. Cosmetic geometry does not alter hitboxes or movement.

## Wardrobe and commerce

Use the existing costume slot so only one costume is worn at a time. Add the five new individual premium offers at the current costume price. Keep the original five and their existing bundle grants fixed. Add a separate five-suit mascot bundle at the current bundle price. Show both collections by name in the Costumes filter and in the All view. Do not silently expand an earlier customer's bundle purchase. The existing production checkout gate remains in effect until Stripe is configured.

## Acceptance

- Each new suit reads as a complete costume from front, side, and back; no hair, ears, neck, bare arms, hands, legs, or shoes protrude. Only the face is exposed.
- Face opening keeps eyes, brows, nose, cheeks, and mouth visible on both avatar paths without a cutout artifact.
- All five render in thumbnails, item-only view, try-on, saved looks, and representative gameplay poses; animations and collisions remain unchanged.
- The original five still render and retain ownership, IDs, prices, and bundle grants. The new bundle grants exactly the new five.
- Wardrobe layout and controls work on desktop and mobile, and a disabled checkout clearly indicates its availability.
