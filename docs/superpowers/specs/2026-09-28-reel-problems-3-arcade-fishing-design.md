# Reel Problems 3 Arcade Fishing Skill Loop

## Scope

Turn the existing one-tap fishing interaction into a readable arcade skill loop while preserving Reel Problems 3's first-person party-game pace. The player must see the rod load, the cast travel, the fish fight the line, the catch come over the rail, and the fish enter the ice hold. The result should feel physically believable without becoming a simulation or compromising mobile performance.

This pass also removes the current storage defect: once a fish is secured, no part of its model may remain visible outside the ice box.

## Chosen direction

Use a hybrid presentation model. The authoritative fishing state continues to decide casts, bites, tension, stamina, landing, and scoring. A controlled rod-and-line presentation derives from that state to create believable flex, line shape, impact, and fish movement. Full rope physics is intentionally avoided because it would reduce control, determinism, and mobile performance.

The skill loop is based on two simple controls:

- hold and release `F` to charge and cast;
- hold `R` to reel, then release it when the line is overloaded.

Touch uses equivalent holdable `CAST` and `REEL` buttons. No mouse click is required for either action.

## Fishing state model

The complete player-facing sequence is:

1. **Ready** — a baited rod is held inside a valid fishing area.
2. **Charging** — holding `F` builds cast power over a short, capped interval.
3. **Casting** — releasing `F` sends the rig through a visible arc.
4. **Waiting** — the float settles and the rod rests with slight line sag.
5. **Biting** — the float dips, the rod tip twitches, and the hook window becomes urgent.
6. **Hooked** — pressing `F` sets the hook and starts the fight.
7. **Fighting** — holding `R` retrieves line while safe; releasing `R` protects the line during strong pulls.
8. **Landing** — an exhausted nearby fish is swung over the rail into an authored deck landing zone.
9. **Deck catch** — the landed fish gives a short wet flop and can be picked up.
10. **Carried** — the player transports the catch to the ice hold.
11. **Secured** — the ice-hold lid reacts, the catch disappears fully inside, and contract progress is awarded.

Charging must be an explicit persistent state rather than a transient animation guess. Cast strength is clamped so short holds remain useful and maximum-power casts cannot leave the valid fishing volume. Cancelling or losing eligibility while charging returns safely to Ready without consuming bait.

## Cast presentation

The first-person rod communicates charge without relying on a detached power meter. While `F` is held, the hands brace, the rod draws backward, and the blank develops a controlled curve. A small contextual card may show charge progress, but the rod remains the primary cue.

On release, the rod unloads from handle to tip, the line pays off the spool, and the float or lure follows a clear parabolic path. The cast remains visible for roughly half a second before the float settles with a splash, rings, and short line oscillation. Cast distance follows charge power and camera aim but remains bounded by gameplay constraints.

The camera should receive only a restrained impulse; the player must retain orientation and avoid motion sickness. Reduced-motion mode removes the camera impulse while preserving rod and line readability.

## Hybrid rod and line simulation

The rod is represented by a small articulated chain or sampled curve from grip to tip. Its authored base pose is combined with three controlled influences:

- charge bend during the backswing;
- forward unload during casting;
- tension bend during a hooked fight.

Tension bend follows smoothed authoritative tension, with a quick secondary tip response for fish bursts. The grip stays stable in the hands while curvature increases toward the tip. This prevents the entire rod from rotating like a rigid stick.

The line is a lightweight sampled curve from the rod tip to float or fish. Low tension adds visible sag; high tension straightens the curve. During a cast, the same line follows the moving rig rather than teleporting to its destination. Samples and effects are capped and reused to avoid per-frame allocations.

## Fight and species behavior

The fight remains timing-based and does not add directional counter-steering. Holding `R` shortens the line and drains fish stamina while tension is safe. Strong fish pulls raise tension and temporarily slow or reverse retrieval. Releasing `R` allows tension to recover.

Species vary within readable limits by:

- stamina and weight;
- pull strength;
- burst duration and cadence;
- swimming amplitude and surface disturbance;
- landing scale and deck-flop character.

The rod curve, tautness of the line, fish wake, reel motion, sound, and HUD meter all describe the same tension value. In the safe range the reel feels productive. Near danger, the rod is deeply bent and the instruction explicitly changes to releasing `R`. A snapped line returns to a recoverable state with a clear reason.

## Landing and deck fish polish

When stamina reaches zero and the fish is close enough, landing becomes a short authored event. The fish rises from the water, passes over the rail in a readable arc, lands in a clear deck zone, and produces a wet impact, small splash droplets, and a brief body-and-tail flop.

The deck catch uses species-specific proportions, fins, color variation, wet highlights, and weight-scaled motion. Collision and damping keep it on the deck without allowing it to jitter, clip through the hull, or block navigation. The loose catch remains visibly interactive until picked up.

## Ice-hold storage

Approaching the ice hold with a carried fish presents one unambiguous store action. On activation, the lid opens or bumps, the carried fish moves below the rim, and the secured fish renderable is removed or hidden before the lid closes. A score and contract confirmation follows.

Secured fish must never use a merely reduced visible model. Rendering code must exclude secured fish entirely, while authoritative inventory and contract state retain the catch. Repeated interaction, late snapshots, and reconnects must not resurrect or duplicate the hidden model.

## Contextual controls and copy

The existing next-step card remains the sole immediate instruction surface and uses literal input language:

- `Hold F — charge cast`
- `Release F — cast`
- `Press F — hook the fish`
- `Hold the R key — reel in`
- `Release R — lower line tension`
- `Pick up the landed fish`
- `Carry the fish to the ice hold`
- `Store fish in the ice hold`

German copy explicitly says `F-Taste gedrückt halten`, `F loslassen`, `R-Taste gedrückt halten`, and `R loslassen`. Touch copy names `CAST`, `HOOK`, and `REEL` buttons. The interface must never imply that desktop reeling requires a mouse click.

## Architecture and synchronization

Authoritative fishing logic owns the durable state and timings. Presentation code consumes normalized phase, cast power, cast progress, line length, tension, fish stamina, fish position, and landing progress. Rendering interpolates these values without changing outcomes.

Input handling needs edge-aware press, hold, and release semantics for `F`, while `R` remains a held action. Network actions carry the resolved release power rather than frame-by-frame charge messages. Bots may choose plausible charge values and reeling pauses, but they use the same authoritative transitions as players.

Legacy or incomplete snapshots fall back to safe existing phases. A missing presentation field must not crash the scene, duplicate a fish, or leave the player stuck in Charging.

## Performance and accessibility

The rod and line use fixed-size reusable buffers. Water rings, droplets, wakes, and impact effects are pooled and capped. Lower quality modes reduce line samples and particle counts without changing the interaction. No React state is updated per animation frame.

Touch targets remain large enough for a held gesture and cannot overlap movement or look controls. Keyboard prompts remain readable without color alone. Reduced-motion mode limits camera impulse, screen shake, and aggressive HUD pulses.

## Verification

Automated coverage must verify:

- charging starts on press, caps correctly, cancels safely, and releases one cast with bounded power;
- casts stay visible long enough for presentation and transition correctly to Waiting;
- reeling reduces line and stamina only under valid conditions;
- overload recovery, missed hooks, snaps, and landing transitions remain recoverable;
- species parameters stay within playable bounds;
- secured fish are absent from rendering while still counted by contracts;
- reconnects and repeated storage do not duplicate catches;
- desktop and touch guidance uses the correct literal controls.

Visual QA must complete the full flow at desktop and mobile sizes and capture charge, release, float splash, bite, safe tension, dangerous tension, landing, deck fish, carrying, and closed ice-hold states. Validate stable frame pacing, no detached line guides, no line teleport, no fish clipping, no visible secured fish, and no console or network errors.

## Out of scope

This pass does not add directional counter-pulls, free-form mouse casting, new contracts, additional fishing equipment, a fish inventory screen, or full rope physics. Production publishing remains a separate action after implementation and validation.
