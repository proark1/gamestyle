# Implementation plan

1. Add persisted intermission phases, pure time/randomness-injectable voting rules, and atomic coordinator progression. Expose an authenticated vote action and server time. Keep the old advance endpoint from bypassing votes.
2. Build a reusable four-seat podium and vote cards. Preserve the existing sage (#e7e9d6), forest (#294a43), cream (#f4f5ea), gold (#f3bf50), and orange (#ca8038) palette, Fredoka headings, and DM Sans text. The signature is the rising four-step podium; use the same warm, chunky forms for game cards. Keep animations local to the intermission component.
3. Connect automatic return from completed games, refresh-safe polling, final standings, and undecided future playlist labels.
4. Test rules and coordinator races, run existing party tests and static checks, then inspect mobile/desktop UI and synchronized clients where the local runtime permits.

The referenced writing-plans skill is absent from installed skills; this file records the implementation sequence for the approved spec.

## Validation completed

- 39 party, round-reporting, and party-mode tests passed, including vote authentication, replacement, majority/tie resolution, concurrent writes/reads, departures, final-round behavior, and the six-round lifecycle.
- Type checking, scoped lint/format checks, and the repository architecture check passed.
- Used two independent browser sessions against the existing localhost development server. Both displayed the same candidates, submitted different votes, displayed the same tie-break winner (Wrong Floor), and automatically launched that game for round two. Both returned to the party flow after giving up that round.
- Checked the four-place podium, shared places, and three vote cards at desktop and 390px phone width. Enlarged the fourth pedestal to contain all score text and tightened mobile spacing. Reloading the mobile ballot retained its saved vote and deadline.
- Browser fixture setup only edited the newly created local test party UVAFXJ. Some visual inspection phases used extended deadlines; the production phase durations remained 4/15/4/2 seconds. Finished the local fixture after inspection.
- A transient Vite duplicate-React hook error occurred during development reloads; the page subsequently restored and the browser flow above completed. Reduced-motion styling is implemented but was not separately emulated in the browser.
- No deployment was performed. Other concurrent workspace changes were left in place.
