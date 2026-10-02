# Leaks, sinking, paddles and critters — 13 September 2026

Implemented from the plan the user approved:

- **Leaks:** a leak has to be patched with five held seconds of E. Otherwise the boat floods at ten seconds and sinks at twenty, putting the whole crew in the water with the sharks.
- **Paddles:** realistic one-sided paddling.
- **Small chaos ideas:** a bailing bucket, driftwood, seagull raids, crab stowaways and cannonballs.

The user decided:

- A patch during the flooding still saves the boat.
- Two patchers finish faster than one.
- Sinking washes the gear off.
- A sunk crew swims to the dock for a new boat.

## Changes

### Leaks (`hull.ts`)

- **When:** 2–3 per tournament. Never in the first 45 s or last 30 s, and never within 40 s of the previous one.
- **Unprovoked leaks:** the first is due 60 s in, then 40–80 s after each one ends.
- **Provoked leaks:**
  - a shark bumping the hull (20%)
  - a thunder wave (20%)
  - ramming driftwood
  - the Lake Manager surging into the hull
  - two anglers landing jumps within 0.3 s of each other
- **Patching:**
  - Stand within 0.9 m and hold E.
  - Five seconds alone, about three with two patchers; each extra patcher adds 0.65 of one.
  - Standing on the leak, E patches instead of reeling.
  - Off the leak, progress slips back at 0.08 per second.

### Water

- **Filling:** seeps in at 2.5% per second for ten seconds, then pours in at 7.5% per second. Left alone, it sinks the boat at twenty.
- **Bailing:** holding E beside the one bucket bails 4% per second. That holds the seep level and stretches the pouring stage to about 29 s. A patched boat drains 1.5% per second on its own.
- **Effects:** water adds weight, so the boat answers wind and paddles sluggishly, and it makes the deck slippery.

### Sinking and the dock

- **When it sinks:**
  - Everyone aboard goes into the water where they stand, counted as unplanned swims.
  - Every line is cut.
  - The tyre, magnet and boot are lost, and any crab goes down with the boat.
  - Two extra sharks hunt for 30 s.
- **While the boat is under:** there is no hull to hold and no safety rope, and anglers who are pulled under stay under until a boat is back.
- **Getting a new boat:**
  - The first swimmer within 1.6 m of the dock end takes a new boat, moored at the dock, and boards it.
  - That starts everyone else's twelve-second safety rope.
  - If nobody gets there within 30 s, the harbour master launches one anyway.
- **Lake edge:** swimmers can no longer leave the lake.

### Paddles (`paddles.ts`)

- **Taking one:** one paddle per rail, taken with P within 0.7 m of it, and never with a line out.
- **Losing it:** jumping, a crab pinch or going overboard drops it.
- **Strokes:**
  - W strokes forward and S back, with a thrust of 8 along the bow.
  - The torque comes from the rail, so a lone port paddler swings the bow to starboard at about 0.42 rad/s.
  - Paddlers on both rails go straight.
- **Other rules:** no casting while paddling. A pointed bow shows which way is forward.

### Critters and cannonballs

- **Driftwood:**
  - Two logs drift in from the shore across the boat's water.
  - Hitting one faster than 1.1 m/s rams it: the boat bounces and rocks, and a plank may crack.
  - Slower contact pushes the log along.
- **Seagulls:**
  - A seagull visits like the other wildlife.
  - While one is overhead, a landed catch is held for 1.6 s while it dives.
  - Anyone in the air scares it off and the catch scores; otherwise it flies away with the fish.
  - A catch still mid-dive at the buzzer counts.
- **Crabs (`crab.ts`):**
  - A quarter of landed fish bring one up out of the live well.
  - It chases the nearest angler and pinches: a 3.4 m/s hop with a 2.4 m/s shove away from its claws.
  - Pinched beside the rail, the angler goes over it, counted as an unplanned swim.
  - Landing a jump within 0.6 m of the crab punts it; otherwise it leaves after 40 s.
- **Cannonballs:**
  - A deliberate dive stuns perch and salmon within 4.5 m for 8 s.
  - A stunned fish stops swimming and cannot surge.
  - A hook landing beside one gets an instant bite.

### Renderer

- **Boat:** it sits lower as it fills, tilts, and goes under; a new boat pops up at the dock.
- **On deck:** water sloshing inside, a spraying leak with a pulsing ring, stowed paddles, the bucket, a paddle held by a stroking angler, and the crab.
- **Sea:** diving and fish-carrying gulls, drifting logs, and stunned fish floating belly up.
- **Dock:** a beacon and an arrow lead a swimmer to it.
- **Camera:** it follows your own swimmer when the boat is sunk or far away.

### HUD

- WATER and PATCH meters.
- Line-panel prompts for a leak, patching, bailing, paddling, a diving gull and a sunk boat.
- The Reel button becomes Patch or Bail, and a Paddle/Stow button (P) is added.
- New crew statuses: paddling, patching, bailing.
- The conditions list names seagulls, a crab and a leak.
- The results count sunk boats.
- The help dialog covers paddles, leaks and critters.

### Audio, analytics, migration and tests

- **Audio:**
  - The workshop catalogue has eleven new event cues: leak, patched, flooding, sink, launch, ram, gull, steal, crab, pinch and stomp.
  - It also has three new loops: leak, paddle and bail.
  - The leak, flooding, sink, ram and stomp events play shaped-noise stand-ins until real clips are generated.
- **Analytics:** `leak` and `sank` milestones and a `paddle` action.
- **Old host checkpoints:** every new field gets a default, and the world gains a gull and the driftwood.
- **Tests:** the existing test helpers switch leaks, driftwood and gulls off so their subjects stay isolated. The new hazards have their own file, `leaks-and-paddles.test.ts`.

## Validation

### Tests

All 57 Reel Problems tests pass. The 16 new ones cover:

- **Leaks:**
  - patch timing alone and in a pair
  - E patching rather than reeling, and progress slipping back slowly
  - an untouched leak pouring at ten seconds and sinking at twenty, with crew, lines, gear and the two wreck sharks
  - the timing rules for leaks
- **Water:**
  - a late patch saving a heavy boat that bailing then drains faster
  - bailing from the start buying time
- **Dock:**
  - the first swimmer to reach it boarding a new boat and restarting the rope
  - the harbour master's launch, with a pulled-under angler waiting for it
- **Paddles:**
  - the rules for taking one
  - a lone paddler turning while a pair goes straight, and back strokes reversing
- **Critters:**
  - driftwood rammed versus nudged
  - a gull stealing versus being scared off
  - a crab pinch over the rail, and the stomp
  - cannonball stuns and instant bites
- **Whole game:**
  - a full idle tournament with leaks and sinks replaying identically
  - an old checkpoint upgrading

### Repository checks

- Repository test run: 912 passed, none failed.
- TypeScript, the architecture check, oxlint on `games/reel-problems` and formatting of the changed files all pass.
- The changed files contain no control characters.

### Browser

Dev server, solo tournament. The pane was hidden, so it was driven by screenshot captures.

- **Leak:** a forced leak announced "Pop! The boat sprang a leak!".
  - LEAK appeared in the conditions list, with WATER and PATCH meters.
  - Standing on it relabelled the Reel button Patch.
  - Holding E finished the patch: "You patched the leak!".
- **Sinking:** filling the boat sank it.
  - The angler was swimming, the gear was cleared, and two wreck sharks were hunting.
  - The line panel read "The boat sank! Swim to the dock — follow the arrow".
- **Dock:** moving the swimmer to the dock launched the second boat at (0, 33.4) with the angler aboard, and the camera settled on it by the dock.
- **Paddle:** four captures of W on the port paddle turned the boat −0.55 rad and moved it 1.15 m.
  - The crew list said "paddling" and the button read Stow.
  - P put the paddle down.
- **Mobile (375×812):** seven dock buttons at 45 px each, with no clipping or overflow.
- **Console:** no errors.

## Scope of verification

- **Animations:** the hidden pane only draws on a capture, so these were not watched at frame rate:
  - the sinking slide
  - the gull's dive and getaway
  - the crab's punt
  - paddle strokes
- **Tuning:** leak frequency, flooding rates and paddle strength come from arithmetic and tests, not playtests. A real round with friends is the next check.
- **Bow:** the pointed bow is small from the default camera.
