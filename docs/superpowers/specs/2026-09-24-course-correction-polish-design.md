# Course Correction — Polish Design

**Date:** 2026-09-24  
**Status:** Approved design, pending implementation plan

## Objective

Raise Course Correction from a functional party-game prototype to a production-quality experience without changing its established visual identity, deterministic physics rules, three-hole structure, or multiplayer protocol. The polish pass must improve both presentation and game feel while keeping ordinary play readable and reserving spectacle for meaningful chain reactions.

## Direction

Keep the existing bright Jumbleyard palette, rounded forms, roadside mini-golf framing, and HUD layout. Do not replace the art direction with neon, realism, or a different theme. Add depth through materials, construction details, course-specific dressing, motion, audio layering, and clearer event hierarchy.

Feedback follows a **dynamic but clean** rule:

- Ordinary contacts stay restrained.
- Course-changing impacts are unmistakable.
- Assists and chain reactions receive stronger attribution.
- Three- or four-ball cup sequences become the signature shareable moment.

## Course Presentation

### Surface and construction detail

- Add subtle turf color variation, mowing bands, and restrained surface texture.
- Add seams, fasteners, bevels, and contact shadows to course rails.
- Give rotating walls readable hinges, joint caps, and impact markings.
- Give bridges a visible pivot, warning stripes, and a moving underside shadow.
- Give the cup platform rollers or a guide rail so its movement reads mechanically.
- Improve the cup with a rim highlight, deeper socket, responsive flag, and subtle target marking.
- Improve household props with stronger silhouettes and material differentiation while preserving their existing collision footprints.

### Course identity

Each of the three holes receives a small, distinct dressing set:

- **Pivot Alley:** hinge signage, directional arrows, scuffed gate zones, and a roadside hole marker.
- **Tipping Point:** bridge warning marks, balance indicators, support hardware, and nearby workshop clutter.
- **Moving Target:** platform guide rails, motion arrows, cable or roller details, and a more deliberate final-green composition.

Decorative density stays near boundaries and landmarks. The shot corridor remains visually quiet enough to track four balls simultaneously.

## Game Feel

### Feedback tiers

1. **Minor contact** — rail or static prop:
   - Small dust or spark impulse.
   - Light material-specific sound.
   - No meaningful camera movement.

2. **Course-changing contact** — rotating wall or bridge:
   - Short joint recoil or spring response.
   - Local orange impulse ring.
   - Brief, low-amplitude camera bump.
   - Contextual message naming the changed object.

3. **Major contact** — moving cup platform:
   - Stronger floor pulse and mechanical response.
   - Short zoom punch.
   - Clear low-frequency sound layer.
   - Stronger but still bounded camera reaction.

4. **Player interaction** — ball-to-ball hit:
   - Color-coded contact flash using both involved player colors.
   - Short directional trails that clarify transfer of momentum.
   - Attribution remains visible long enough to understand a later assist.

### Cup and scoring response

- A ball visibly drops into the cup instead of disappearing immediately.
- The flag and cup rim react to entry.
- The owning score row animates once, without moving the entire scoreboard.
- Assists briefly name the assisting player at the cup and in the scoreboard.
- Repeated cup events escalate visually without replaying old network events.

### Signature multi-cup moment

Presentation aggregates cup events occurring within 1,200 milliseconds of the
first cup. When that window contains three or four different balls:

- Briefly slow presentation time without changing authoritative simulation time.
- Pull the camera toward the cup with a bounded cinematic move.
- Emit a larger confetti burst and combined player-color trails.
- Show a single clear callout: **EVERYBODY IN!** for four balls and a smaller chain-reaction callout for three.
- Play a dedicated layered celebration cue.
- Return control promptly; the celebration must not delay hole completion or network progress.

This aggregation is presentation-only. It does not widen the simulation's cup
collision rules or change authoritative timestamps.

## HUD and Communication

- Preserve the current top-center hole card, left scoreboard, top-right utilities, and bottom shot control.
- Clarify each score row with player color, strokes, assist count, and state: aiming, moving, or holed.
- Keep the local player visually dominant without reducing the legibility of other players.
- Animate changed numeric values rather than the whole row.
- Add a clearly marked optimal band to the power meter and improve its charge/release response.
- Replace the persistent generic status line with short event-specific messages.
- Show a two-second hole-introduction card explaining the active course-changing mechanic.
- Expand hole results with one contextual award such as Best Bank, Biggest Assist, or Course Changer.

Copy remains concise, active, and readable in English and German.

## Audio

- Keep the existing audio catalog and playback lifecycle.
- Layer new short cues for turf, rail, household prop, hinge, bridge, platform, cup drop, assist, and multi-cup celebration.
- Use intensity tiers so ordinary collisions do not become noisy during four-ball play.
- Continue to deduplicate events across snapshots and reconnects.
- Reuse existing recorded assets where they fit; missing polish cues may use generated workshop replacements later.

## Technical Design

### Simulation boundary

The deterministic simulation remains authoritative. No visual effect changes ball velocity, course state, timers, scoring, checkpoint serialization, or peer action formats.

Presentation derives from the existing event stream plus small, presentation-only event metadata where needed. Any metadata added to serialized events must remain deterministic, bounded, and backward-safe within the current game version.

### Presentation systems

- Add a bounded effect manager for particles, impact rings, trails, cup responses, and callouts.
- Pool reusable Three.js objects instead of allocating on every collision.
- Use instancing where repeated decorative geometry materially reduces draw calls.
- Keep fixed limits for simultaneous particles, trails, labels, and confetti.
- Drive camera impulses through one controller that combines bumps, zoom punches, and the multi-cup move without accumulating unbounded offsets.
- Make presentation time scaling local-only and never pause the peer engine.

### Accessibility and performance

- Respect `prefers-reduced-motion`: disable shake, presentation slow motion, and strong trails; retain readable flashes and text.
- Reduce effect counts and camera amplitude on narrow/mobile viewports.
- Preserve keyboard, pointer, and touch controls.
- Maintain visible focus states and adequate contrast.
- Target stable play with four moving balls on the existing supported mobile profile.

## Failure and Recovery Behavior

- Effect-pool exhaustion drops the least important new effect rather than allocating more objects.
- Missing audio falls back silently without affecting gameplay.
- Reconnects skip stale presentation events and render the current authoritative state.
- If reduced-motion preference changes during play, active camera effects settle immediately.
- Presentation exceptions must not stop the simulation loop.

## Testing and Acceptance

### Automated verification

- Existing deterministic physics and checkpoint tests remain unchanged and passing.
- Add tests for feedback-tier classification and bounded effect requests.
- Add tests for three- and four-ball multi-cup classification.
- Add tests proving visual slow motion does not alter authoritative world time.
- Add tests for reconnect event deduplication and reduced-motion behavior.
- Run TypeScript, lint, architecture checks, focused peer invariants, and production builds.

### Visual QA

Verify lobby, opening volley, ordinary contact, each movable obstacle, assist attribution, single cup, multi-cup, hole result, and match result at desktop and mobile sizes. Confirm that:

- Four balls remain easy to follow.
- Course-changing objects are identifiable before impact.
- Decorative details do not obstruct aiming.
- Camera movement never hides the local ball or HUD.
- Reduced-motion mode remains complete and understandable.
- The existing style is recognizably preserved.

## Out of Scope

- New holes or new gameplay rules.
- Physics retuning beyond fixes required to preserve current behavior.
- Replay recording or video export.
- A new art direction or global collection redesign.
- Changes to the party protocol, room model, scoring ownership, or entitlement model.
