# Giant noise and cooperative descents — 2026-09-06

The requested difficulty comes from consequences of height and carrying, with cooperative handoffs as a practical way to reduce risk. This extends the existing shared wake meter, reactions, pillows, routes and 25-second escape. It uses gameplay noise; microphone volume remains independent.

Alternatives considered: merely raising every noise value would make quiet traversal disproportionately punishing; mandatory two-person carrying would break solo play and change every route. Height-sensitive impacts and optional handoff chains preserve both play styles while rewarding cooperation.

## Mechanics

- Landing noise uses impact energy as a fall-height estimate, adding a steeper penalty beyond an ordinary jump. Carried bulk/rattle multiplies the impact: crowns and the teaspoon are heaviest, then cups, necklaces, coins, gems and pouches. Running with these objects also makes more noise. Crouching reduces landing noise by 40%; pillows and the mattress cushion it further. Landing directly on the giant still disturbs him more than a placed pillow.
- Loose-item impacts also scale with fall height and material. A gentle placement on the current surface stays quiet. Releasing in midair preserves momentum, so dropping an item just before landing cannot remove the crash. Pillows themselves are quiet.
- E prioritizes banking at the door, helping a nearby dazed friend, then passing a carried item to an eligible teammate. Q explicitly places/releases the item. The dock shows Pass and the hint names the recipient. The dedicated pass action refuses an invalid transfer without releasing anything.
- Both players must be grounded, active and not dazed, and the receiver must have empty hands. Reach is 1.8 units horizontally, up to 2.7 down and 0.65 up. A hand-to-hand segment cannot cross solid furniture. Eligible recipients below are preferred, then proximity and a stable ID tie-break. Transfers change ownership atomically without a free-fall frame or wake-meter increase. Existing room request IDs provide replay protection.
- At full wakefulness, the existing three-second warning starts a 25-second escape. The giant sits over 2.6 seconds, then raises his hips and straightens his legs over 2.4 seconds to stand on the mattress. All body passengers, including nested tool passengers, are released first. Rendering, collision bounds and alarm placement derive from the same serialized escape deadline. Restart restores the sleeping pose.
- The wake HUD shows the last substantial impact and its amount. Event creation copies only position coordinates from its source, preserving unique numeric event IDs and the noise kind even when the source is a player or treasure item.

## Boundaries and verification

Noise formulas and handoff reach checks live in small modules; the existing authoritative simulation owns mutations and event creation. No database migration or new world-state field is needed. Server room validation and the peer engine both accept pass actions. Existing saved games remain structurally compatible.

Verification covers fall-height and carrying penalties, crouching, cushioning, quiet placement versus high drops, midair momentum across serialization, waking from an actual impact, valid/blocked handoffs, chained ledges, departure cleanup, concurrent request replay, unique event metadata, standing geometry and restart. Existing crown/necklace route tests ensure solo traversal remains possible. The four-client HTTP check exercises quiet passes and retries before banking. Browser visual QA and physical device playtesting are separate, unperformed checks.
