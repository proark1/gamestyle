# Ranked Stack or Sink release

This release adds an opt-in ranked lane to the existing server-verified Stack or Sink challenge. The ordinary verified challenge remains unlimited and still awards its weekly and mastery coins. Ranked rooms are free; no paid attempts exist.

## Player rules

- Each signed-in account has five ranked **starts** per UTC week. Creating or joining a lobby costs nothing. Starting a ranked room consumes one attempt for every player present, in the same transaction as the room transition. Replays and reconnects do not consume more.
- Team-size boards are separate for one, two, three, and four players. Only a completed server-simulated round that reaches that week's settled-tower target qualifies. The score is the highest settled tower height, rounded down to centimeters. Each account's best eligible run appears once per bracket.
- Leaving after the start consumes the attempt and makes that room's result ineligible. The roster is frozen at the start, and players cannot join mid-round. A failed database transaction consumes no attempts.
- Each team-size bracket has a **Players** board and a **Crews** board. A crew result counts only when every ranked room participant belongs to the same active persistent crew at the start. The run's account roster is frozen. Each crew contributes its best eligible run per bracket, even if its membership or name changes later. An account may represent only one crew per challenge week; a later run for a different crew can still enter the Players board. Joining a qualifying crew afterward never confers its past prize.
- Boards use stable randomly generated public builder and crew tags, not account or user-entered crew names, email addresses, or room codes. Current-week results are provisional.
- After Monday 00:00 UTC, a 24-hour review window runs. The next authenticated leaderboard read finalizes due boards. A Players bracket needs 100 distinct eligible accounts; a Crews bracket needs 100 distinct eligible crews. Rank uses competition ranking, so every entry tied at the top-10% cutoff receives the Tower Ace Helmet and every entry tied at the top-1% cutoff also receives the Skyline Crown. A crew prize is granted only to the accounts in that crew's selected best run. Both items are server-awarded and cannot be bought with coins or imported from legacy local state.

## Operations and limits

Finalization is idempotent and uses separate unique `(week, team_size)` markers for Players and Crews, with commit-gated wardrobe grants. Review an anomalous entry before the 24-hour deadline by setting its `ranked_attempts.eligible` to `0`; this must be done through trusted database administration, never a player endpoint. Voiding any member of a crew's run makes that whole crew run ineligible. A finalized board must not be modified without an explicit correction process. Because finalization is demand-driven, a board with no subsequent leaderboard read may award later than the 24-hour deadline. The UI reports that scores stay provisional for at least that review period.

Automated service-failure voids and staff review tooling remain follow-up work. No card checkout is enabled by this release.

The SQLite migrations are `0008_ranked_stack.sql` and `0009_ranked_crews.sql`. The former keeps existing grant rows while widening their source constraint for `reward`; migrations run in a transaction before the app accepts requests. The test suite exercises start/replay/limit behavior, roster departure, mixed crews, crew changes, threshold/tie prizes, frozen winner rosters, delayed finalization, and duplicate-read idempotency.
