# Validation

Completed on 2026-09-06:

- 19 automated tests pass for the shared simulation and room service, including real support collapse, overhang instability, collision and jumping, drowning, teammate revival, win/restart, crane ownership, four-player admission under contention, private session tokens, and concurrent object grabs.
- Live HTTP integration test passes against the local Cloudflare development runtime and migrated D1 database: four clients in one room, shared authoritative movement, capacity, authentication, captain control, replay-safe actions, and origin validation.
- TypeScript passes and the production Worker/client build succeeds.
- WebMCP contract checked through the existing in-app browser: both tools register with the intended schemas and annotations, invalid practice input fails, valid practice starts the actual game, read-back confirms one player / 28 pieces / calm water, and starting a second run fails intentionally.

Scope limits: no broad browser UI or screenshot testing was requested. A four-person internet playtest has not been performed. Physics uses axis-aligned collision and gravity with support/overhang simulation, rather than a general rigid-body engine. Multiplayer uses HTTP snapshots and client movement prediction. Voice chat and automatic video clips are outside this first version.

The React, React DOM, React server components, Vinext, Vite, and RSC plugin versions were updated from the generated starter to the compatible patched releases. Some audit findings remain in Cloudflare's local development toolchain; those tools are not deployed in the Worker archive.
