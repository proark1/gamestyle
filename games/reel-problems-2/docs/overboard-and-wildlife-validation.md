# Softer weather, climbing back aboard, and wildlife that bites — 9 September 2026

Implemented from the user's report that the wind was too strong and falling off
the boat happened too easily, together with their request that a swimmer should
hold onto the hull, take about five seconds of held E to climb up, and be at
risk from a shark or a jellyfish while they do it, with sounds for both.

## Changes

- Wind is softer. The gust force dropped from 13 to 10, and the heel it causes
  is now `WIND_ROLL`/`WIND_PITCH` scaled by the wave rather than added to it, so
  a lull can no longer tilt the boat harder than the gust itself. Thunder waves
  hit at 0.38/0.28 instead of 0.55/0.4.
- Footing improved: grip 0.24 to 0.34 unbraced and 0.66 to 0.70 braced, the
  slide threshold 0.32 to 0.46 unbraced and 0.76 to 0.82 braced, with more drag
  on accumulated slip. Steady wind now rocks the deck without clearing it;
  thunder waves are what actually throw an unbraced angler over the side.
- An angler in the water grabs the hull on contact, rides with the boat, and
  shimmies along it with WASD. Held E climbs at `CLIMB_MS` (5 s) and boards
  them; letting go bleeds the progress back. F reaches for the hull instead of
  teleporting the swimmer aboard, and the twelve-second safety rope still ends
  any swim.
- A shark abandons the hull-bumping patrol whenever anyone is in the water and
  comes straight for the nearest swimmer at 7 m/s, biting for 0.55 and backing
  off to a six-metre standoff during its cooldown. A jellyfish stings a swimmer
  for 0.2 and shocks their hands open for 1.6 s, so they cannot hold the paint.
  Either hit tears them off the hull and zeroes the climb.
- Two bites put an angler under for six seconds. The crew hauls them out and the
  boat loses fifteen points, unless a crewmate reaches them first with F or a
  hook, which costs nothing. The shark ignores a downed angler.
- New `chomp` and `sting` events with catalog entries for the workshop. The
  procedural fallback now takes a shaped-noise table, so a bite reads as two
  jaw snaps and a sting as a rising electric crackle before real clips exist.
- The renderer lifts a clinging angler up the side as the climb progresses and
  floats a downed one face down. The HUD shows condition and climb meters, the
  reel button doubles as the climb button while clinging, and the crew list
  shows `climbing` and `under!`. Old host checkpoints default the five new
  angler fields.

## Validation

- All 37 Reel Problems tests pass, including five new ones covering the grab and
  the five-second climb, shark hunting and the two-bite knockout, the jellyfish
  shock, softened weather, and the balance between the bite cooldown and the
  climb. Repository run: 815 passed, none failed. TypeScript, lint and
  changed-file formatting pass.
- Measured over eight idle five-minute player-rounds, falls dropped from 69 to
  28 and peak roll from 0.71 to 0.577. A braced angler fell zero times in those
  rounds, and zero times in a sixty-second thunderstorm; an unbraced one still
  goes over in that storm, so the hazard survives the softening.
- The balance test is not vacuous: raising `CLIMB_MS` to 7000 fails it, along
  with the two climb tests.
- Browser check at `http://localhost:3100/reel-problems`: the solo tournament
  starts with no console errors and the new help text renders.

## Scope of verification

The clinging, climbing and downed visuals were not watched at frame rate. The
Browser pane runs hidden, so the page never paints and `requestAnimationFrame`
reported zero callbacks over three seconds, which stops the render loop and the
solo simulation with it. The in-water behaviour is covered by the simulation
tests and by reading the rendering code, not by watching it play.
