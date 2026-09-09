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

## Phones and tablets

The touch layout was rebuilt after measuring it rather than assuming it worked,
and it did not: the shared skin parks the joystick at `bottom: 160px`, which is
exactly where this game's trebuchet readout sits. Both thumb controls were
underneath a panel and hit-testing at their centres returned the readout, so the
game could not be played on a phone at all. The thumbs now own the bottom
corners at `z-index: 8`, with the action dock above them and the readout above
that.

Two absolutely positioned elements had the same latent bug, which is worth
knowing about before adding a third: an element pinned only by `left: 50%` has an
available width of half the viewport, so it can never be wider than that no
matter what `max-width` says. It made the action dock wrap onto three rows on a
laptop, and it squeezed the event banner to 180px on a phone, where it wrapped to
five lines and grew down over the readout. Both are now anchored `left: 0;
right: 0` and centred, the dock with `justify-content`, the banner with `margin`.

Layout is verified by measuring every HUD box and reporting any pair that
actually intersects, plus hit-testing each control's centre through
`elementFromPoint`. Because the dock's height now depends on how many actions
are available, each viewport is measured with the dock forced to two buttons and
to four — the widest a real position can offer. Eight viewports pass with zero
intersections, nothing off-screen, no page scroll and every control reachable:
320x568, 360x640, 393x660, 375x812, 768x1024, 667x375, 812x375 and 1440x900.
Landscape needed its own rules — the 600px minimum height is taller than a
handset on its side, which pushed the dock below the fold and made the page
scroll — and there the dock is held clear of the thumb corners with
`left: 134px; right: 104px`.

Two collisions were caught only by measuring the four-button dock: it wrapped
over the readout in portrait, which is why the readout moved to the top, and it
covered the event banner in landscape, which is why those buttons lost their
icons.

Fitting the desktop HUD onto a phone was not enough — everything fitted and the
game was still unreadable, because six panels and six buttons left about 130px
of actual playfield. The compact layout is a different layout rather than a
smaller one, and it starts from the position that on a handset the playfield is
the interface:

- **Only the actions you can take.** Disabled dock buttons are hidden outright,
  so standing at the winch offers Wind and Swing aim rather than six buttons
  with four of them dead. `Haul up` had to learn the reach the simulation
  already enforced for it — it was permanently enabled and threw an error when
  pressed, which on a phone would have meant a button that never went away. In
  open ground, where nothing is available, a single line takes the dock's place
  rather than leaving it bare.
- **Every panel is one line.** The scoreboard is the stones still standing and
  the clock; the stone breakdown, the volley count and both column headings are
  gone. The trebuchet readout is the counterweight bar, the range it reaches and
  what is in the sling on one row — the two reference distances and the swing
  direction are dropped, because the gold ring on the ground shows both.
- **The wordmark collapses to its tile**, as it does everywhere else in the
  collection. At full width it pushed the sound button off the right edge of a
  393px screen, so two of the six toolbar buttons were unreachable.
- **The readout sits at the top, not above the dock.** Four actions can be
  available at once — at the winch, within reach of the lever, beside a
  flattened crewmate — and four wrap onto a second row. A dock that grows
  upwards would have climbed straight over a readout placed above it.

That is 393x660 with roughly 350px of playfield instead of 130px.

Landscape has only the gap between the two thumbs to put a dock in, so its
buttons drop their icons to keep four on one row, and the event banner moves
into the empty band above them where it can grow upwards into the sky. The
banner is also `pointer-events: none` everywhere: it is never interactive, it
can pass over the dock on a short screen, and it must not be able to swallow a
tap meant for a button underneath it.

Beyond layout: held actions listen for `pointercancel` as well as `pointerup`
and `pointerleave`, since a cancelled touch would otherwise leave a crewmate
winding forever with no way to stop; dock buttons are at least 44px tall on a
coarse pointer and suppress text selection and the iOS callout; and a hundred
rigid bodies with soft shadows is too much for a handset GPU, so touch devices
and small screens drop antialiasing, render at a 1.3 pixel ratio instead of 1.7
and halve the shadow map to 1024.

Emulated viewports and a hit-test are not a real device. Frame rate on actual
handset hardware is unmeasured.

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
- Not playtested by four people over the internet, and not run on a physical
  phone — the mobile work above is verified against emulated viewports.
