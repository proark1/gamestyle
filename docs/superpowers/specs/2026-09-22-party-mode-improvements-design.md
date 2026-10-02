# Party Mode implementation

The user approved all recommendations in `docs/party-mode-ux-audit-2026-09-22.md` with “ok do all”. This is the implementation specification for that approved design.

## Experience

Invitation → shared identity → compact crew → ready → objective, controls and assignments → play → explain the result → human vote → next briefing → recap and rematch interest.

Keep Jumbleyard's clay characters, Fredoka display and DM Sans body type. Use forest #193d36, teal #247d69, paper #fff9e9, gold #f3bf50, coral #d26b54 and ink #17372f. The distinctive element is the crew lineup, using the same lightweight character portraits on entry, standings and results. Quiet surroundings and one clear primary action.

## Decisions

- Quick Party: three rounds from a curated pool of existing short objectives; Classic: six rounds from the complete catalog. Show estimates, not guarantees. Avoid long or complex openers. Do not cut a running game off arbitrarily.
- Human tournament standings only; solo is practice. Co-op success is +6 for each participating finisher, failure or forfeit +0. Versus win/draw/loss is +10/+6/+3; individual goal rankings include successful finishers only. All forfeits receive zero, with no invented winner. Legacy saved rooms retain their old scoring contract.
- Five-second minimum briefing followed by explicit readiness from every connected human and a short shared launch countdown. Show objective, scoring, input-specific guidance and actual seat/team assignment before play. Assignment order rotates between rounds.
- Authenticated party heartbeats, a 20-second disconnect threshold, a 60-second reconnect grace, automatic leadership transfer and visible recovery actions. Preserve disconnected identities and scores. Missing players eventually forfeit the active round. Explicit invitations take precedence over another saved room.
- One compact parent party bar with persistent voice, standings, help and a confirmed forfeit. Embedded game controls retain sound/camera/help; room creation and team/reset controls are unavailable in tournament games. Guard mutations in the shared simulation engine as well as hiding UI.
- Compact mobile lobby and three readable vote options. Human-only voting retains 15 seconds, with optional unanimous lock-in after five seconds. Merge winner announcement into the next briefing. A shared break freezes between-round timers.
- Explain each report, awarded points, totals and rank movement. Show a round recap and rematch interest; collection exit navigates to `/`.
- EN/DE copy, keyboard forms, labeled color choices, native sharing plus clipboard fallback, focus management, reduced motion and quiet audio cues respecting the site volume.

## Verification checklist

- [x] Scoring, authorization, readiness, voting, pause, presence and rotation regressions
- [x] Party runtime action locks and expired-seat recovery
- [x] Desktop/phone-sized entry, lobby, briefing, game, results, vote and finale
- [x] Different invite, removed membership, failed launch and reconnection
- [x] All 21 current catalog entries across runs; persistent voice and cross-frame push-to-talk
- [x] Typecheck, relevant tests, lint, architecture and production client build
- [x] Document remaining physical-device and human group-play validation

Results and evidence: [implementation report](../../party-mode-implementation-2026-09-22.md).
