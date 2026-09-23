# Funny mix-and-match wardrobe items

## Goal

Add ten original cosmetic pieces to Jumbleyard's existing wardrobe: six bought with earned coins and four individual premium purchases. They should be funny or striking at thumbnail size, combine freely across slots, and fit the established soft, playful 3D style. They do not change movement, collisions, or game rules.

## Lineup

| ID | Name | Slot | Visual design | Unlock |
| --- | --- | --- | --- | --- |
| `ramen-nest` | Ramen Nest | Hat | Warm ceramic bowl, curled noodles, and two chopstick antennae | 240 coins |
| `mini-volcano` | Mini Volcano | Hat | Charcoal stone cap with raised coral lava and rounded smoke puffs | Premium, standard tier ($0.99) |
| `sharkfin-zip-up` | Sharkfin Zip-Up | Top | Teal zip jacket, small gill details, and a sculpted dorsal fin down the back | 300 coins |
| `arcade-bomber` | Arcade Bomber | Top | Indigo bomber jacket with bright geometric buttons and light panels; no branded game symbols | Premium, special tier ($1.99) |
| `balloon-twist-pants` | Balloon Twist Pants | Legs | Peach and cyan inflated tubes, round knees, and small twist knots | 280 coins |
| `lava-flow-joggers` | Lava Flow Joggers | Legs | Charcoal joggers with amber crack seams and chunky stone cuffs | Premium, special tier ($1.99) |
| `banana-peel-slides` | Banana Peel Slides | Shoes | Banana-shaped toes with peeled yellow flaps and pale soles | 220 coins |
| `wind-up-stompers` | Wind-Up Stompers | Shoes | Oversized copper boots, side-mounted clockwork keys, and blue soles | Premium, special tier ($1.99) |
| `side-eye-specs` | Side-Eye Specs | Face | Large clear frames with offset googly pupils pointing in opposite directions | 190 coins |
| `bubble-beard` | Bubble Beard | Beard | Opaque pearl and mint foam bubbles clustered around the chin | 170 coins |

The four premium pieces are sold individually. No new bundle is part of this release. These are original designs without recognizable character marks or licensed game motifs.

## Wardrobe behavior

Use the existing `hat`, `top`, `legs`, `shoes`, `face`, and `beard` slots. A player can combine one item from each slot. The existing costume behavior still takes precedence visually over ordinary pieces. Keep current coin balances, owned items, and premium entitlements intact. Append the ten new IDs without changing existing IDs or ownership rules.

Every item appears in the All view and its slot filter. Players can inspect and try on both coin and premium items before purchase. Coin purchases use the current balance and insufficient-funds handling. Premium offers use the existing checkout and entitlement flow at the price tiers above. When production checkout is disabled, premium items remain previewable with the existing unavailable state; the client must not grant them locally.

## Rendering

Create each piece for both avatar paths: the detailed clay kid used in the wardrobe and the lightweight shared worker model used in play. Follow the current item model and anchor patterns so items track head, body, leg, and facial movement. Keep construction close to the body: the jacket fin, chopsticks, smoke puffs, banana flaps, and boot keys should read clearly without crossing the face or intersecting typical poses. Side-Eye Specs deliberately overlay the eyes but leave the rest of the face visible. Use solid colors and sculpted shapes; the foam bubbles and lava are opaque, with no particle, glow, physics, or gameplay effects. Pairable pieces should remain legible when mixed with existing items.

## Acceptance

- Exactly ten items appear in the intended slots, with the six specified coin prices and four individual premium offers.
- Coin items can be bought, equipped, removed, saved, and restored through the existing wardrobe flow. Premium preview and ownership follow the current checkout gate.
- All ten render in the shop thumbnail, item inspection, and try-on. For owned items, saved looks and representative gameplay poses render on both avatar paths.
- Items remain recognizable from the front and side; hats and clothing leave the face visible, Side-Eye Specs leave the mouth visible, and no piece causes conspicuous clipping during ordinary animation or changes gameplay.
- Existing cosmetics, costume precedence, balances, entitlements, and purchase behavior continue to work.
- Desktop and mobile wardrobe views remain usable; catalog, commerce, rendering, and purchase tests cover the new entries where those behaviors are already tested.
