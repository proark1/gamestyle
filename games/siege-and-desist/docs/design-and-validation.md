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

Stand at the engine and hold `R`, then press `F`.

| Key      | Does                                     |
| -------- | ---------------------------------------- |
| hold `R` | wind the counterweight — this is the aim |
| `F`      | loose                                    |
| `Q` `E`  | swing the aim left and right             |
| `C`      | climb into the sling, at the sling       |
| `H`      | haul up a flattened crewmate             |

All of it works from anywhere within six metres of the frame. This is the second
version of the loop. The first one had four stations — supply pile, sling,
winch, release lever — and firing a single shot meant walking to the pile,
pressing `E`, walking to the sling, pressing `E`, walking to the winch, holding
`R`, walking to the lever and pressing `F`. It read as a nice bit of co-op
choreography and played as a chore list, so the errands are gone: the sling
restocks itself from the pile in order, and winding, aiming and loosing are all
one reach.

What survives is the part that was actually cooperative. Winding is shared, so
every extra pair of hands winds faster and a full crew reloads roughly twice as
quickly as a lone player. The counterweight is still the only range control:
about two fifths of a wind reaches the gate, three quarters reaches the keep
behind it, and a full wind sails over everything. And the sling still cannot be
loosed by the person sitting in it.

The engine now opens pointed at the keep. It used to open swung 0.16–0.32
radians off centre so that somebody had to lean on the frame first, which meant
the opening move of every siege was undoing a random number.

Defenders on the battlements answer with clay pots roughly every seven seconds.
A pot near the frame costs both the wind and the aim, so a crew under fire keeps
having to wind back up and straighten out. A beehive over the battlements clears
them for twenty-six seconds.

## Ammunition

Stocked in a fixed order, so a crew can plan the cow rather than fish for it.

- **Boulder** — heavy and reliable, the workhorse.
- **Fire pot** — sets nearby stone and timber alight; burnt courses are removed
  outright, dropping whatever they were holding up.
- **Beehive** — scatters the defenders instead of doing damage.
- **The cow** — rare, enormous, absurd.
- **A crewmate** — `C` climbs into the sling, displacing whatever it had
  restocked. Solo players cannot launch themselves: the one thing you still
  cannot do alone is loose a sling you are sitting in, which is the joke.

## The engine was built backwards

The trebuchet threw the right way and animated the wrong way, and it took a
player noticing to catch it. The counterweight hung behind the pivot on the
crew's side and the sling reached out toward the castle, so winding _lifted_
the payload on the target side and the release flung the beam back over the
crew — while the stone flew forward regardless. Measured through a release, the
sling end travelled from z 11.27 to z 14.49, directly away from the keep.

A counterweight trebuchet is the other way round. The throwing end is winched
down _behind_ the pivot, which lifts the weight on the target side; the weight
then falls and the beam whips the sling up and over toward the target. So the
beam is mirrored, the three arm angles are negated, and the frame moved from
z 15 to z 7.7 so that the sling end still comes down on the loading spot when
fully wound. The sling stays at z 11.4 and every range in the game is measured
from there, so no ballistics changed: the gate is still 20m and the keep 28m.

Mirroring the beam puts the sling and the winch on the same side of the pivot,
which is where a real windlass lives. The winch keeps its place on the frame
instead — now the castle-facing end — so winding is done underneath a raised
counterweight. That mattered more when the winch was a station you had to stand
on; now that the whole engine is one reach it is a piece of staging.

The test for this used to assert on the raw angle, which is why a mirrored
engine passed it. It now converts the angle into where the throwing end
actually is, and asserts that winding brings it down onto the loading spot
behind the pivot and that a release carries it toward the castle.

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

- `node scripts/test.mjs games/siege-and-desist` — 29 tests covering the castle
  layout, the engine's reach, the self-stocking sling, the shared winch, aiming
  and its stops, ballistics against the aiming ring, boulder and fire damage,
  the beehive, riding the sling and who may loose it, host authority, both
  endings, rematches, and the delta-snapshot round trip including burnt blocks.
- `node scripts/peer-integration.mjs siege-and-desist` — four real local WebRTC
  clients: a shared winch two guests turn together, an aim swung the same way on
  every client, sling reach enforced across the mesh, and wind, aim and castle
  all surviving an abrupt host loss with join-order handover.

One long-standing flake was fixed rather than retried: the winding-rate test
winds fully, which is forty seconds of simulated time, and a clay pot landing on
the frame in that window knocks the counterweight back 0.22 and flattens the
winder. It failed about one run in six for reasons that had nothing to do with
how many hands were on the winch. The defenders now sit that test out.

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
320x568, 375x812, 393x660, 667x375, 768x1024, 880x700, 1100x720 and 1440x860.
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
of actual playfield. Then it turned out the desktop layout had the same disease
in a roomier house: four stacked bars across the bottom, sitting on top of the
trebuchet they were describing. Three of the rules below are not really phone
rules and now apply at every width — only the actions you can take, the readout
on one line, and nothing on screen that repeats what the scene already shows.

The compact layout is a different layout rather than a smaller one, and it
starts from the position that on a handset the playfield is the interface:

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

On a desktop the same three rules take the bottom of the screen from four
stacked bars down to two, and two more things stop being permanent: the status
line now appears only when it has something to say rather than reporting that
the banner is still flying, and the movement hint retires once the crew has
actually thrown something. The event banner also moved below the scoreboard,
having been centred where it collided with it at every width under about
1400px.

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
