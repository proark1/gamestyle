# Shared voice release

Prepared from current origin/main with the shared voice repair, push-to-talk, Chaos consolidation, and voice support in Brick by Hand and Shelf Control. Includes the existing room integrations needed by ten games to reach shared voice. Unfinished Drive-Thru Rush and Scaffold redesign changes were excluded.

Production has 23 registered games; the earlier 24-game workspace count includes the unpublished Reel Problems 2 experiment. The coverage test passes for every production game.

Release checkout validation: TypeScript, architecture boundaries, scoped lint, 17 shared voice tests, and the real two-Chrome direct-peer audio/PTT test passed. The 59 other peer and Chaos tests passed before the room wiring was applied; shared voice coverage was rerun successfully afterward. The production build passed. Original workspace LiveKit checks passed for Chaos, Brick by Hand and Shelf Control.
