# Ranked Stack or Sink release

This release adds an opt-in ranked lane to the existing server-verified Stack or Sink challenge. The ordinary verified challenge remains unlimited and still awards its weekly and mastery coins. Ranked rooms are free; no paid attempts exist.

## Player rules

- Each signed-in account has five ranked **starts** per UTC week. Creating or joining a lobby costs nothing. Starting a ranked room consumes one attempt for every player present, in the same transaction as the room transition. Replays and reconnects do not consume more.
- Team-size boards are separate for one, two, three, and four players. Only a completed server-simulated round that reaches that week's settled-tower target qualifies. The score is the highest settled tower height, rounded down to centimeters. Each account's best eligible run appears once per bracket.
- Leaving after the start consumes the attempt and makes that room's result ineligible. The roster is frozen at the start, and players cannot join mid-round. A failed database transaction consumes no attempts.
- Boards use stable randomly generated public builder tags, not account names, email addresses, or room codes. Current-week results are provisional.
- After Monday 00:00 UTC, a 24-hour review window runs. The next authenticated leaderboard read finalizes due boards. A bracket must have at least 100 distinct eligible accounts for percentile prizes. Rank uses competition ranking, so every account tied at the top-10% cutoff receives the Tower Ace Helmet and every account tied at the top-1% cutoff also receives the Skyline Crown. Both are server-awarded wardrobe items and cannot be bought with coins or imported from legacy local state.

## Operations and limits

Finalization is idempotent and uses a unique `(week, team_size)` marker and commit-gated wardrobe grants. Review an anomalous entry before the 24-hour deadline by setting its `ranked_attempts.eligible` to `0`; this must be done through trusted database administration, never a player endpoint. A finalized board must not be modified without an explicit correction process. Because finalization is demand-driven, a board with no subsequent leaderboard read may award later than the 24-hour deadline. The UI reports that scores stay provisional for at least that review period.

This initial board ranks individual account results by human team size. A crew-identity board, crew roster locks, automated service-failure voids, and staff review tooling remain separate follow-up work. No card checkout is enabled by this release.

The SQLite migration is `0008_ranked_stack.sql`. It keeps existing grant rows while widening their source constraint for `reward`; the migration runs in a transaction before the app accepts requests. The test suite exercises start/replay/limit behavior, roster departure, threshold/tie prizes, delayed finalization, and duplicate-read idempotency.
