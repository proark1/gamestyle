# Jumping, and jumping into the lake — 13 September 2026

Implemented from the user's request that an angler can jump, and can jump from
the boat into the water.

## Changes

- A new `jump` action on J, on a Jump button in the action dock, and on the
  shared touch JUMP button, which the game used to hide. Space still casts, so
  the existing controls are unchanged. Take-off at `JUMP_SPEED` (4.2 m/s) under
  `GRAVITY` (9.8) gives about 0.9 m and 0.86 s of air. It only works with both
  feet on the deck; mid-air and in the water it does nothing.
- In the air an angler has no footing to slip on and puts no weight on the deck.
  Landing kicks the boat's roll and pitch by 0.15·x and 0.1·z, so a hop is felt
  without throwing anyone over.
- Below `RAIL_CLEARANCE` (0.5 m; the rail top is 0.51 m above the deck) the
  gunwale still holds you in. Above it, travelling past the hull's outer edge is
  a dive: the line is cut and the angler lands `DIVE_REACH` (2 m) beyond that side
  of the hull, outside `GRAB_REACH`, so they swim instead of latching straight
  onto the hull. It announces "jumped in" through the existing `splash` event, so
  the splash sound plays, but it does not count toward the results' "unplanned
  swims". Sharks, jellyfish, the climb and the twelve-second safety rope apply
  exactly as they do after a fall.
- Only a jump that starts within about 1.3 m of the deck's edge while walking
  outward clears the rail. Straight up at the rail, or a run-up from mid-deck,
  lands back aboard.
- The renderer lifts the angler with the jump, tucks the legs and throws the free
  arm out, and pitches a dive in head first instead of the sideways tumble of a
  fall. The audio director plays a heavier deck step on landing.
- The movement hint and help dialog explain jumping. The dock's Jump is hidden on
  touch screens, where the JUMP button stacked above the joystick does the job.
  Analytics counts `jump`. Old host checkpoints default `y` and `vy` to 0, and
  the renderer tolerates snapshots from a host that sends neither.

## Validation

- All 41 Reel Problems tests pass, four of them new: a hop lands on the spot it
  left and cannot be repeated mid-air or from the water; a jump at each of the
  four rails of a yawed boat dives in past that side, cuts the line, is not
  counted as a splash, leaves the swimmer free of the hull, and lets them swim
  straight back to grab it; straight up at the rail and a run from mid-deck both
  stay aboard; and the landing thud plays on landing, not on take-off. The
  legacy-checkpoint test now also removes `y` and `vy`. Repository run: 896
  passed, none failed. TypeScript, the architecture check, oxlint on
  `games/reel-problems` and formatting of the changed files pass.
- Browser, dev server at `http://127.0.0.1:3107/reel-problems`, solo tournament:
  holding A to the port rail and pressing J put the angler in the lake off that
  side with the "jumped in" notice, the crew list showing `swimming`, `splashes`
  still 0 and Jump disabled. A standing J read 0.86 m one frame later and came
  down on the same spot. No script errors; the only failed requests were the
  worktree's font 403s and the local `/api/analytics` and audio manifest 503s.
- Mobile preset (375×812, coarse pointer): the JUMP button sits above the
  joystick and overlaps none of the joystick, line panel, camera button, dock,
  weather badge or notice, and the dock's own Jump is hidden.

## Scope of verification

The Browser pane ran hidden, so the page only drew when a screenshot forced
frames, and each capture moved the game on by several hundred milliseconds. The
mid-air tuck and the head-first dive were therefore not watched at frame rate.
Heights and positions were read from the running game; the poses come from
reading the rendering code.
