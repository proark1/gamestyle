# Party round podium and next-game voting

Approved direction: after each round, celebrate the round standings, vote among three random games, resolve ties with a shared animated selector, and automatically start the selected game.

## Scope and existing behavior

Party mode currently runs a six-game playlist. Games report local results, the coordinator awards round points, and the party page shows an intermission. Only the tournament finish currently has a podium. Preserve the existing result reporting, scoring rules, six-round length, and random first game.

This change adds game voting to the shared party flow. Map and challenge variants are outside this implementation because the party catalog currently identifies games rather than selectable variants.

## Player experience

1. Once a round is scored, show a four-second podium celebration. Render every participant on a pedestal, with first highest, then second, third, and fourth. Show names, round points, and cumulative party points. Use a brief pedestal rise and winner celebration consistent with the existing party styling.
2. Rank by this round's awarded points. Preserve shared places when scores tie, including team results; stable seat order determines visual positioning only. Do not present an arbitrary sole winner for a shared first place.
3. For rounds one through five, reveal three distinct random game cards together and open voting for 15 seconds. Choose from games not yet played in this tournament. Display game names, descriptions, current counts, and the player's selection.
4. Each human has one vote and may change it until the deadline. Bots each receive one server-generated random vote when voting opens. Missing human votes are abstentions. Keep the full voting window even if everyone votes early.
5. The highest vote count wins. If several cards tie for the highest count, cycle a highlight exclusively among those cards for four seconds, decelerating to a uniformly random winner. A three-way tie, including no votes, follows the same rule.
6. Reveal the winning game for two seconds, then use the existing four-second launch countdown. Advancement is automatic and does not require the host to press Next Round.
7. After round six, show the round podium followed by the overall tournament podium, with all participants included and shared places represented. There is no next-game vote after the final round.

## State and implementation boundaries

The coordinator owns candidates, ballots, phase deadlines, tied candidate IDs, and the selected winner. Persist them with the party room. Never choose candidates or resolve a tie independently in browsers.

Use an explicit intermission phase record for podium, voting, tie-break, and reveal. Persist absolute phase timestamps so polling, refreshes, and reconnects reconstruct the current phase without restarting it. A server time reference lets clients align visual timers. Server deadlines decide whether votes are accepted.

Resolve transitions through the existing room mutation mechanism, including on room reads where necessary; avoid reliance on an in-memory timer or an individual player's browser. Concurrent reads or actions must not score a round, resolve a ballot, or advance twice. Persist the random outcome once. Clients derive the same highlight sequence from persisted timing and outcome, with the animation landing on the authoritative winner.

Replace the next playlist entry with the selected game before launch. Future unplayed playlist entries must not be advertised as decided. Candidate generation excludes completed games, not provisional future playlist entries.

Keep candidate selection, vote tallying, and phase transitions in focused party modules with injectable time and randomness for tests. Extend party action types, authenticated API handling, and the client helper for vote submission. Extract reusable podium and voting UI from PartyClient rather than growing its existing conditional views substantially.

## Resilience and accessibility

Validate the party pass, round, phase, deadline, and candidate on each ballot. Stale or invalid ballots cannot mutate results. A changed ballot replaces the previous choice. A departing player's ballot is removed while voting is open; after resolution, the outcome remains fixed. Host handover does not reset the intermission.

Retain the existing mechanisms for unfinished gameplay and closing a round; the celebration starts only after scoring. Restore persisted intermission state on reconnect. Older rooms without the new phase data need a safe initialization path when their intermission is next processed.

Use keyboard-operable vote buttons, visible selected states, readable counts, mobile layouts, and polite announcements for phase changes and the winner. Reduced-motion mode suppresses pedestal movement and cycling while still displaying the tied choices and final selection for the same phase durations. Brief connection failures show retry feedback without discarding authoritative state.

## Validation

Add meaningful coordinator and pure-logic tests covering distinct unplayed candidates, changed votes, pass validation, stale rounds, deadlines, majority wins, two-way and three-way ties, zero human votes, bots, player departure, host changes, repeated/concurrent progression, reconnect timing, and the final round. Confirm existing scoring and party tests still pass.

Run type checking and relevant lint/format checks. Inspect the UI at mobile and desktop widths, including four participants, shared ranks, voting selection, a decelerating tie-break, reduced motion, and the final podium. Check two browser clients see the same candidates and winner and reach the same next game.

## Review

Self-review completed: no placeholders; timing, ranking ties, ballot ties, bot behavior, scope, and server ownership are defined. This document records the approved direction with implementation defaults for written-spec review.
