# Siege and Desist — design and validation

A cooperative medieval siege for one to four players, at `/siege-and-desist`.
The crew shares one enormous trebuchet and has four minutes to bring the keep's
banner to the ground.

The brief was a Medieval Empires mini game built in the style of the rest of the
collection. The theme comes from [medievalempires.com](https://medievalempires.com):
thirteenth-century Anatolia, the Kayi tribe, a keep flying a red banner, and
crews of archers, cavalry and swordsmen. The chrome borrows that site's house
style — charcoal panels, a single gold rule, parchment text, and Cinzel small
caps for headings — while the playfield keeps Jumbleyard's chunky toy look.

## The loop

One trebuchet is deliberately too big for one person:

| Station       | Where                  | Key                         |
| ------------- | ---------------------- | --------------------------- |
| Winch         | behind the frame       | hold `R`                    |
| Supply pile   | behind and to the left | `E`                         |
| Sling         | front of the frame     | `E` (carrying), `C` to ride |
| Frame         | either side            | hold `Q`                    |
| Release lever | right of the frame     | `F`                         |

Winding sets the range. Every extra pair of hands on the winch winds faster, so
a full crew reloads roughly twice as quickly as a lone player. The counterweight
is the only range control: about two fifths of a wind reaches the gate, three
quarters reaches the keep behind it, and a full wind sails over everything.

The engine never opens pointed at the keep. Each assault starts with the aim
swung 0.16–0.32 radians off centre, and someone has to lean on the frame to
bring it round. Pushing from the left swings the throw right, as a shove should.

Defenders on the battlements answer with clay pots roughly every seven seconds.
A pot near the frame costs both the wind and the aim, so a crew under fire keeps
having to go back to the winch. A beehive over the battlements clears them for
twenty-six seconds.

## Ammunition

Stocked in a fixed order, so a crew can plan the cow rather than fish for it.

- **Boulder** — heavy and reliable, the workhorse.
- **Fire pot** — sets nearby stone and timber alight; burnt courses are removed
  outright, dropping whatever they were holding up.
- **Beehive** — scatters the defenders instead of doing damage.
- **The cow** — rare, enormous, absurd.
- **A crewmate** — `C` climbs into the sling. Solo players cannot launch
  themselves: somebody else has to be at the lever, which is the joke.

## The castle is real

The keep is a stack of ninety-odd rigid bodies on a Cannon solver, not a mesh
that swaps to a broken version. Courses are laid in a running bond, the keep
tapers from a four-by-four base to a narrower tower, and the banner is set into
a well left by the top battlement ring.

Three shaping decisions came out of measurement rather than intention:

- **The blast radius was doing the work.** A 2.9 m impulse sphere shoved twenty
  blocks at once, so one boulder detonated a whole wing. Tightened to 1.5 m, a
  hit punches a hole instead.
- **A bare banner pole was the cheapest win in the game.** Standing on a flat
  roof it tipped off at the first tremor and fell six metres to the ground,
  winning the siege without a breach. It now sits in a plinth inside the
  battlement ring and can only come down with the keep.
- **Loose cubes fold.** A straight-sided tower collapses completely to the first
  solid hit. The taper buys the structure enough stability to be worth shooting
  at more than once.

Shots strike at a flat 38 degrees on purpose. An earlier 48-degree lob dropped
almost vertically past the wall — every shot cleared the battlements and landed
in the courtyard, and the castle was decoration. The flatter arc means a light
wind hits the gate face and a heavy one clears the wall to reach the keep.

## Snapshots

The castle is around a hundred blocks. Sending all of them ten times a second
would swamp a data channel, so `buildCastle` is deterministic and a snapshot
carries only masonry that has actually moved, plus the ids of blocks fire has
burnt away. Each guest rebuilds the untouched remainder locally in
`hydrateSiege`. Guests are accurate to the same 15 mm epsilon the filter uses,
not bit-for-bit, which is well inside a block's own size.

## Validation

- `node scripts/test.mjs games/siege-and-desist` — 28 tests covering the castle
  layout, station proximity rules, the shared winch, aiming and its stops,
  ballistics against the aiming ring, boulder and fire damage, the beehive,
  riding the sling, host authority, both endings, rematches, and the
  delta-snapshot round trip including burnt blocks.
- `node scripts/peer-integration.mjs siege-and-desist` — four real local WebRTC
  clients: a shared winch two guests turn together, an aim swung the same way on
  every client, lever proximity enforced across the mesh, and wind, aim and
  castle all surviving an abrupt host loss with join-order handover.
- `npm run check` — formatting, TypeScript, lint, architecture boundaries and
  the full 791-test suite pass with the game registered.
- Ran locally and inspected in a browser: menu, HUD, castle, trebuchet, crew
  models, camera framing, the winch turning under load, and clay pots knocking
  the counterweight back.

Two layout bugs were found by looking rather than by testing. The action dock is
absolutely positioned; anchored only by `left: 50%` it could never be more than
half the viewport wide, so it wrapped onto three rows and collided with the
trebuchet readout. It is now pinned on both edges. The overview camera was also
effectively a top-down plan with the engine looming in the foreground; it now
sits behind and above the frame so the crew, the trebuchet and the keep share
one frame and a throw reads as an arc.

## Known gaps

- The sound catalog is written but no clips are generated. The game is fully
  playable silently; the workshop at `/siege-and-desist/admin` produces the
  audio when someone runs it with a provider key.
- The chrome names Cinzel and EB Garamond first and falls back to a classical
  serif. Adding `@fontsource/cinzel` and `@fontsource/eb-garamond` to the root
  layout would match medievalempires.com exactly, at the cost of two new
  dependencies.
- The simulation advances on `requestAnimationFrame`, as every game here does,
  so a backgrounded host tab pauses the round for the crew. That is existing
  collection behaviour rather than anything specific to this game.
- Not playtested by four people over the internet.
