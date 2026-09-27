# Course Correction: Rear Wall and Spectator Seating

**Date:** 2026-09-27

## Goal

Keep balls inside the playable course when they reach the far end, and make the bench crowd read clearly as seated spectators. Spectators who are not seated must stand beside a bench rather than behind it.

## Scope

- Add a physical bounce at the rear course boundary.
- Preserve the existing side-wall feel by retaining approximately 74% of the ball's incoming speed.
- Place seated spectators so their hips rest on the bench seat instead of floating above it.
- Place standing spectators beyond the short ends of benches, never behind the backrest.
- Add focused automated coverage and visually verify the result in the running game.

No course redesign, camera changes, new character models, or UI changes are included.

## Rear Boundary Collision

Physics will clamp the ball center to `course.length - ball.radius` when it crosses the rear edge. Its forward velocity will be reflected toward the course using the same 0.74 restitution as the side walls. The collision will emit the standard impact event so existing audiovisual feedback continues to work.

The rear collision must run before out-of-bounds recovery. A ball that reaches the back edge therefore bounces instead of leaving the course and being reset. Existing side, front, obstacle, cup, and recovery behavior remains unchanged.

## Bench and Spectator Placement

The bench seat top will be represented by one shared layout constant derived from the bench geometry. Seated spectator root height will be calculated from:

`seat top - scaled avatar hip height`

This keeps each spectator's pelvis on the seat even though the crowd uses small scale variations. Their existing seated limb pose and animation remain in place.

Standing spectators will use the same lateral corridor as their associated bench and be offset beyond one of its two short ends along the course axis. They will no longer be offset farther away from the course behind the bench backrest. Alternating the selected end retains visual variety while keeping paths and sightlines readable.

## Validation

Focused tests will verify that:

- a ball crossing the rear limit is clamped inside the course and receives a negative forward velocity;
- the bounce uses the intended restitution and does not trigger recovery;
- seated root height resolves from the shared seat-top and scaled hip measurements;
- standing crowd anchors are beside bench ends and not behind the benches.

After automated checks, the production-sized scene will be inspected to confirm that spectators visibly contact the seats and that standing spectators appear only beside benches. The build will then be deployed and smoke-tested at the public Course Correction URL.

## Acceptance Criteria

- Hard shots at the far end visibly bounce back into play.
- No rear-edge shot escapes solely because the rear wall lacks collision.
- Seated spectators no longer float above the bench surface.
- Standing spectators are positioned at bench sides/ends, not behind backrests.
- Existing controls, camera views, course interactions, and game flow continue to work.
