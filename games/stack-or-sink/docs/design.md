# Stack or Sink

The approved concept is a cooperative survival game for up to four players. A rising flood forces the crew to build and climb a tower from a finite supply of salvage. Removing a supporting object destabilizes pieces above it. The crew wins by reaching a suspended rescue platform, and loses when everyone is down. Solo practice uses the same mechanics without rising water.

The visual direction follows the supplied chaos game: flat-shaded rounded geometry, warm sunlight, muted green salvage yard, turquoise water, cream paper controls, mustard machinery, Fredoka display text and DM Sans interface text. The live 3D yard fills the first screen; a compact game menu sits on the left.

The game has room-code multiplayer, authoritative shared state with optimistic database concurrency, player movement and jumping, grab/rotate/place, a shared crane, teammate revival, reconnect handling, and restart. A deterministic simulation is shared by local practice mode and server. The normal round lasts approximately ten minutes; the first minute is a grace period. The rescue height is 13.5 metres.

Validation covers player movement and collision, unsupported stacks, win/loss and rescue, room authentication, four-player admission and concurrent updates, then TypeScript and the production build. A local preview is opened before the complete game is published privately through Sites. Public sharing can be enabled after the user reviews the game.
