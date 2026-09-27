# Reel Problems 3 Arcade Fishing Implementation Plan

## Goal

Deliver the approved hold-to-charge arcade fishing loop with visible casts, tension-driven rod flex, clearer controls, richer fish behavior and landing, polished deck catches, and fully hidden secured fish. Preserve deterministic multiplayer outcomes and stable mobile frame pacing.

## Task 1: Add authoritative cast charging and durable cast timing

**Files:**

- `games/reel-problems-3/types.ts`
- `games/reel-problems-3/fishing.ts`
- `games/reel-problems-3/simulation.ts`
- `games/reel-problems-3/fishing.test.ts`

**Steps:**

1. Extend player fishing state with an optional cast-charge start and extend a casting line with start position, start time, and duration data required by presentation.
2. Add focused failing tests for charge start, charge cap, cancellation without bait loss, release power bounds, single bait consumption, and a casting phase that persists until its duration elapses.
3. Implement `beginCast`, `cancelCast`, and `releaseCast` around the existing eligibility checks. Resolve power from authoritative elapsed time and pass the bounded result into `castLine`.
4. Keep `castLine` as the single place that consumes bait, increments cast statistics, and emits the cast event.
5. Change `stepFishing` so `casting` transitions to `waiting` only after the stored cast duration, not on the next simulation step.
6. Add simulation actions for cast start, release, and cancellation while accepting safe fallback behavior for older cast actions or incomplete snapshots.
7. Run the fishing and simulation tests before continuing.

## Task 2: Implement press/hold/release input on keyboard and touch

**Files:**

- `games/reel-problems-3/Game.tsx`
- `games/reel-problems-3/style.css`
- `games/reel-problems-3/presentation.ts`
- `games/reel-problems-3/presentation.test.ts`

**Steps:**

1. Split the current one-shot fishing action into semantic press and release handlers.
2. On `F` keydown, continue to hook or untangle immediately when appropriate; otherwise begin charging. On `F` keyup, release a pending charge exactly once.
3. Replace the touch `FISH` click with a holdable contextual button using pointer down, up, cancel, and lost-pointer handling so a cancelled gesture cannot leave Charging active.
4. Keep `R` as a held keyboard control and add a dedicated held `REEL` touch action with matching cancel behavior.
5. Update the next-step state model for Charging and rewrite desktop copy to say `F key` and `R key` explicitly. Use `CAST`, `HOOK`, and `REEL` for touch.
6. Add presentation tests for English, German, keyboard, touch, charging, release, safe reeling, and dangerous tension.
7. Verify that menu focus, browser shortcuts, and existing movement controls remain unaffected.

## Task 3: Make cast trajectory and line motion visible

**Files:**

- `games/reel-problems-3/rendering/fishing-line.ts`
- `games/reel-problems-3/rendering/fishing-line.test.ts` (new)
- `games/reel-problems-3/scene.ts`

**Steps:**

1. Add pure helpers that derive normalized cast progress, eased rig position, line sag, and cast lift from the authoritative timestamps.
2. Write tests proving exact endpoints, bounded arcs, no invalid values, and correct low-/high-tension sag.
3. During `casting`, interpolate the float or rig from the rod tip to its destination instead of rendering it immediately at the endpoint.
4. Route the reusable line buffer from the visible rod tip through the moving rig. Preserve the waiting sag, bite twitch, hooked tension, and landing lift.
5. Add a pooled splash/ripple event when the rig reaches the water. Prevent repeated effects when snapshots repeat or reconnect.
6. Use lower line sample and particle counts in reduced quality modes while keeping identical gameplay timing.

## Task 4: Add articulated rod flex and reel feedback

**Files:**

- `games/reel-problems-3/scene.ts`
- `games/reel-problems-3/rendering/rod-pose.ts` (new)
- `games/reel-problems-3/rendering/rod-pose.test.ts` (new)

**Steps:**

1. Refactor rod construction so the blank has a small fixed segment chain or curve samples, with grip, reel, and guides attached to appropriate anchors.
2. Create a pure rod-pose sampler for idle, charge, unload, wait, bite, safe reel, overload, tangle, and landing states.
3. Test that the grip remains stable, curvature increases toward the tip, maximum bend stays bounded, and the tip recovers smoothly.
4. Drive first-person and remote-player rods from the same semantic pose. Blend charge, cast unload, authoritative tension, and short deterministic fish-burst impulses.
5. Animate the reel crank only while retrieval is effective; make the rod deeply bent and tip vibration visible during dangerous pulls.
6. Keep all meshes, curve samples, and buffers reusable so no geometry is allocated in the render loop.

## Task 5: Enrich fish fight behavior without adding controls

**Files:**

- `games/reel-problems-3/content/fish.ts`
- `games/reel-problems-3/fishing.ts`
- `games/reel-problems-3/fishing.test.ts`
- `games/reel-problems-3/bots.ts`
- `games/reel-problems-3/bot-behavior.test.ts`

**Steps:**

1. Add bounded species presentation/gameplay parameters for burst cadence, burst strength, swimming amplitude, and recovery character.
2. Write deterministic tests covering a light school fish, a fragile fish, and the storm tuna across safe retrieval, burst overload, release recovery, snapping, and successful exhaustion.
3. Blend deterministic pull bursts into fish movement and tension while preserving the existing safe-tension contract.
4. Tune retrieval so holding `R` clearly gains line in safe windows and releasing it clearly lowers danger. Avoid unavoidable snap sequences.
5. Update bots to use imperfect charge strengths and human-like reel/release pauses based on the same tension rules, without perfect frame reactions.
6. Confirm all species remain catchable within contract time and net-required fish still require assistance.

## Task 6: Polish landing and loose fish on deck

**Files:**

- `games/reel-problems-3/fishing.ts`
- `games/reel-problems-3/items.ts`
- `games/reel-problems-3/scene.ts`
- `games/reel-problems-3/fishing.test.ts`
- `games/reel-problems-3/items.test.ts`

**Steps:**

1. Keep landing authoritative, but enrich its data with enough progress and impact context for presentation.
2. Test that landing targets stay inside the authored deck catch zone and that each landed fish creates exactly one loose item.
3. Improve procedural fish models with species-specific body proportions, fins, accent markings, eye placement, weight scaling, and wet material response.
4. Animate the landing arc over the rail, an impact squash, tail/body flop, and short damped settle. Add pooled droplets and a subtle deck impact.
5. Clamp loose-fish deck motion and collision footprint so catches cannot fall through the hull, jitter indefinitely, or obstruct the boarding path.
6. Preserve clear interaction highlighting and pickup behavior after the settle animation.

## Task 7: Make ice-hold storage visually and logically complete

**Files:**

- `games/reel-problems-3/scene.ts`
- `games/reel-problems-3/items.ts`
- `games/reel-problems-3/items.test.ts`
- `games/reel-problems-3/simulation.test.ts`

**Steps:**

1. Add failing tests proving one storage interaction secures one fish, awards progress once, survives repeated interaction, and remains correct after snapshot replay.
2. Remove `secured` fish from the scene's visible item set instead of scaling them down.
3. Give the ice hold a named lid anchor and animate a short open/bump/close response from the `fish-secured` event.
4. During storage presentation, move the carried model below the rim and hide it before the lid closes. Contract state retains the secured catch without a visible renderable.
5. Verify reconnects and late snapshots cannot resurrect, duplicate, or expose secured fish.

## Task 8: Integrate feedback, audio, accessibility, and responsive HUD

**Files:**

- `games/reel-problems-3/Game.tsx`
- `games/reel-problems-3/style.css`
- `games/reel-problems-3/audio.ts`
- `games/reel-problems-3/presentation.ts`

**Steps:**

1. Add restrained cues for charge, line release, water impact, bite, reel movement, tension warning, deck impact, and storage confirmation using existing audio infrastructure.
2. Ensure the next-step card and tension meter communicate the same state and never show contradictory instructions.
3. Add a compact charge indicator as secondary confirmation, while keeping rod bend as the primary cue.
4. Confirm touch buttons do not overlap movement/look zones at supported portrait and landscape sizes.
5. Respect reduced motion by removing camera impulse and aggressive shake while preserving rod, line, and HUD state changes.
6. Ensure tension danger is indicated by wording, shape, and motion as well as color.

## Task 9: End-to-end validation and release handoff

**Files:**

- `games/reel-problems-3/*.test.ts`
- `docs/superpowers/validation/2026-09-28-reel-problems-3-arcade-fishing/` (new evidence)

**Steps:**

1. Run the focused Reel Problems 3 tests, formatting check for touched files, TypeScript, lint, architecture check, and production build.
2. Start a local production preview and complete the full loop with keyboard: charge, cast, bite, hook, safe reel, overload release, landing, pickup, carry, and storage.
3. Repeat the loop using touch emulation at phone portrait and landscape sizes.
4. Capture evidence for charged rod, visible cast, bite, safe and dangerous tension, fish coming over the rail, loose deck fish, carrying, and closed empty-looking ice hold after storage.
5. Inspect console, failed requests, rendering stability, and frame pacing. Verify no line teleport, detached guides, fish clipping, duplicate scoring, stuck held input, or secured fish visibility.
6. Record any unrelated existing repository failures separately; do not hide or overwrite them.
7. Commit the validated implementation. Publishing to `jumbleyard.com` happens only after an explicit user request.

## Completion criteria

- `F` hold/release produces a readable, power-dependent cast on keyboard and touch.
- The rod visibly charges, unloads, bends with tension, and recovers without unstable physics.
- The line connects continuously from rod to rig/fish throughout cast, fight, and landing.
- `R` is unmistakably a held keyboard key, with an equivalent held touch control.
- Species feel different but every encounter remains fair and recoverable.
- The fish visibly reaches the deck, settles cleanly, and can be carried.
- A secured fish is counted once and is never visible outside the ice hold.
- Desktop and mobile flows pass tests, visual QA, performance checks, and production build.
