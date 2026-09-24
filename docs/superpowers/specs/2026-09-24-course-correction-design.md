# Course Correction

Course Correction is a three-hole simultaneous mini-golf game for one to four players. Every shot can alter the hole for everyone: walls rotate, bridges tip, the cup platform moves, and balls redirect one another. The primary shareable moment is one player accidentally banking several or all four balls into the cup.

This design adds the game to the Jumbleyard collection as a standalone room and a Party Mode round. Empty seats are filled by bots. A complete match should last five to seven minutes.

## Match and shot flow

Each match contains three authored holes. A hole opens with a six-second group aiming window; all ready shots launch together when that window ends. After the opening volley, a player may aim and shoot independently whenever their own ball has stopped. The host accepts only one current shot intent per player and validates that the player's ball is stationary before applying it.

Pointer and touch input use pull-back aiming. Keyboard input uses A/D or the arrow keys to aim and hold-and-release Space to set power. Controller input follows the collection's shared bindings. The interface exposes the same aim, power, ready, and rest-state information on every input method.

The three holes introduce one rule at a time:

1. **Pivot Alley** — ball impacts rotate hinged wall sections. A bank can open a shorter route while closing the route another player lined up.
2. **Tipping Point** — rotating walls remain and a bridge tilts according to the side, location, and force of impacts.
3. **Moving Target** — the previous systems combine with a cup platform that slides along a constrained track after a sufficiently hard impact.

Course mutations remain in place until the hole ends. Balls collide with other balls and with course objects. Cones, boots, pans, and the washing machine from Flip Happens return as physical obstacles with Course Correction-specific behavior and presentation.

## Scoring and recovery

Each ball retains its owner regardless of who last touched it. The owner records the number of strokes taken when the ball enters the cup. If another player's ball supplied the last meaningful touch, that player receives one assist star. Hole placement sorts first by strokes and then by assist stars; a star never beats a strictly lower stroke count.

An out-of-bounds ball returns to its most recent valid lie and adds one penalty stroke. A valid lie is recorded only while the ball is on a stable playable surface and outside the cup trigger. Each hole has a 100-second limit. Any unfinished player receives the worst completed stroke count plus two; if nobody finishes, the baseline is the highest stroke count already taken plus two. The match result orders players by total strokes, then total assist stars, then shared placement for an exact tie.

Players whose balls are already holed continue watching and may use reactions, but cannot shoot again on that hole. Between holes, a short result card shows strokes, assists, and the course changes that mattered.

## Simulation and networking

Course Correction owns a serializable deterministic simulation under `games/course-correction/`. Modules are separated by purpose: types and snapshots, course definitions, fixed-step simulation, controls, bots, peer adapter, Three.js scene, game UI, audio, analytics, avatar metadata, and focused tests.

The authoritative peer host advances physics at a fixed step. Clients send bounded aim angle, power, and shoot intent rather than positions or collision results. The host resolves ball collisions, obstacle impulses, course mutations, cup entry, last-touch attribution, assists, penalties, and phase changes once and broadcasts compact snapshots.

Peer checkpoints include:

- Match, hole, phase, authoritative clock, random seed, and fixed-step remainder.
- Every ball's position, velocity, owner, stroke count, rest state, last valid lie, and last meaningful touch.
- Every rotating wall angle and angular velocity.
- Bridge angle and angular velocity.
- Cup-platform offset and velocity.
- Scores, assist stars, timers, bounded event history, and consumed action identifiers.

This state is sufficient for the shared peer engine to recover a new host during aiming, active motion, or a hole transition without resetting the course.

Inputs must be finite, clamped, current for the player's ball, and idempotent. The simulation caps linear velocity, angular velocity, per-step mutation, accumulated catch-up time, event history, and entity count. A ball with invalid numeric state or a position outside the recovery envelope returns to its last valid lie and receives the normal out-of-bounds penalty. Repeated invalid inputs are ignored without poisoning the room.

## Flip Happens reuse

The completed `codex/flip-happens` branch is integrated before Course Correction. Generic deterministic impulse and damped-motion helpers are extracted into `shared/physics`; both games consume those helpers while retaining their own state and rules. Neither game imports from the other's implementation.

Reusable helpers cover bounded impulses, damped angular springs, stable-rest checks, and finite-state guards. Course Correction separately owns sphere collision response, rolling resistance, wall pivot constraints, bridge torque, cup-platform travel, safe-lie recovery, and golf scoring. This keeps the shared layer genuinely game-independent and avoids duplicating the proven host-safe motion behavior.

The game also composes the existing shared peer coordinator, connection lifecycle, room and voice controls, renderer lifecycle, device quality tier, wardrobe-aware worker avatars, input utilities, GameToolbar, analytics tracker, admission boundary, audio service, and Party Mode result reporting.

## Bots

Bots participate through the same aim and shoot interface as players. They evaluate a small deterministic set of direct, bank, and obstacle-changing candidate shots against the current snapshot. Aim quality varies by bot skill and seeded error; bots do not inspect future random values or bypass collision rules.

On the opening volley, bots submit within the shared aiming window. During independent play, they wait for their ball to stop, briefly telegraph their aim, then shoot. A bot reevaluates after every course mutation instead of following a route computed at hole start. Candidate count and prediction depth are capped to keep host work bounded.

## Visual and interaction design

The setting is a slightly neglected roadside mini-golf course rebuilt by an overconfident maintenance crew. Painted plywood, visible hinges, ruler markings, safety tape, artificial turf, and repurposed household objects make every moving part legible.

The palette is:

- Fairway green `#3FA66C`
- Pool-tile blue `#72CDE3`
- Safety orange `#F26A3D`
- Scorecard yellow `#F5D85C`
- Deep navy `#17354A`
- Chalk white `#F7F4E8`

Fredoka carries the title, hole labels, and large score numerals. DM Sans carries controls, status, and explanatory text. The camera uses a high three-quarter view that keeps the active route visible, eases toward important collisions and cup entries, and avoids placing scenery between the player and their aim line.

The signature visual is the course visibly correcting itself. Hinges snap, painted arrows rotate with wall sections, the bridge groans to a new angle, and the cup platform slides past ruler markings. A shot that holes at least three balls triggers a brief overhead celebration with colored trajectory lines and a `COURSE CORRECTION!` card. Reduced-motion mode replaces the camera ease and freeze with a static overhead framing and a simple result banner.

The HUD reserves the center of the screen for the course. Hole and timer sit at top center, four compact player scorecards occupy the top edge, and aim/power controls occupy the bottom edge. Mobile uses safe-area insets and thumb-reachable controls without covering the local ball. Visible focus, non-color status cues, accessible labels, and the shared graphics and audio controls are required.

## Audio and feedback

Audio uses the existing game audio infrastructure with a Course Correction catalog and profile. Required cues distinguish ball contact, wall pivot, bridge movement, platform movement, cup entry, out-of-bounds recovery, opening volley, assist, multi-ball finish, hole result, and match result. Pitch variation may add energy but must not obscure the mechanical distinction between a wall, bridge, and platform response.

Haptics use the shared capability boundary: a light pulse for charge-lock and contact, a medium pulse for a local cup entry, and one stronger pulse for a multi-ball finish. Audio and haptics respect saved preferences.

## Collection integration

The game receives a thin `app/course-correction/page.tsx` route and registrations in the canonical game identity, collection cards, installed app, peer engine, Party Mode guide and playlist, analytics, audio, and admin avatar catalogs. It includes English and German card copy, instructions, status text, and result text. The Party Mode guide marks it as an individual, medium-complexity, non-quick round lasting six minutes.

Standalone rooms support one to four humans, bot replacement, voice, reload rejoin, host succession, rematch, and the existing admission rules. Party Mode starts the same three-hole ruleset, reports ordered individual results, and returns through the shared intermission flow.

## Verification

Focused simulation tests cover:

- Synchronized opening shots and independent follow-up eligibility.
- Ball-ball collision, last-touch attribution, multi-ball cup entry, and assist stars.
- Wall rotation, bridge tipping, cup-platform travel, damping, constraints, and stable rest.
- Stroke totals, penalties, hole timeouts, match ordering, and exact ties.
- Safe-lie selection and recovery from out-of-bounds or invalid numeric state.
- Deterministic bot decisions and reevaluation after course changes.
- Finite input validation, action idempotency, speed caps, bounded events, and catch-up limits.
- Checkpoint restoration and host migration in every match phase.

Peer invariants include Course Correction through the platform entry point. A four-client scenario verifies simultaneous launch, continued play after host loss, voice continuity, and final result agreement. Browser checks cover desktop pointer and keyboard play, emulated touch play, controller bindings, narrow portrait and landscape layouts, reduced motion, help, rematch, and collection navigation.

The release gate is the focused test set, architecture check, typecheck, lint, complete test suite, browser smoke checks, four-client peer scenario, production web build, and installed-client build. Existing unrelated working-tree changes are preserved.

## Release boundary

The first release contains exactly three authored holes and the standalone and Party Mode flows described above. It does not include a course editor, procedural holes, public matchmaking, progression economy, global leaderboard, spectator controls beyond watching a finished hole, or publishing/deployment. Publishing remains a separate user-authorized action.

