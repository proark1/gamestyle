# Code organization

Each game owns its implementation in `games/<id>/`. The folder identifiers match existing routes and saved room identifiers, so the displayed names can change without invalidating invitations, recordings, or database rows.

| Folder                      | Game            | Route                  |
| --------------------------- | --------------- | ---------------------- |
| `games/stack-or-sink`       | Stack or Sink   | `/stack-or-sink`       |
| `games/reel-problems`       | Reel Problems   | `/reel-problems`       |
| `games/wrong-floor`         | Wrong Floor     | `/wrong-floor`         |
| `games/four-brain-cells`    | Four Brain Cells | `/four-brain-cells`   |
| `games/act-natural`         | Blend Business  | `/act-natural`         |
| `games/shelf-control`       | Shelf Control   | `/shelf-control`       |
| `games/uphill-delivery`     | Uphill Delivery | `/uphill-delivery`     |
| `games/dont-wake-the-giant` | Tiptoe Thieves  | `/dont-wake-the-giant` |
| `games/one-more-button`     | One More Button | `/one-more-button`     |
| `games/load-bearing`        | Load Bearing    | `/load-bearing`        |
| `games/chaos`               | Permit Pending  | `/chaos`               |
| `games/first-person`        | Brick by Hand   | `/first-person`        |

## Ownership and dependencies

```text
app/                  Framework routes, collection page, site layout
games/<id>/           Game rules, UI, scene, models, connection, styles
  audio/              Game catalogs, prompts, playback policies
  peer.ts             Adapter for games supporting peer simulation
  server.ts or server/ HTTP composition and game-specific server behavior
  *.test.ts           Tests alongside the behavior they verify
  scripts/            Integration checks and production tools for this game
  docs/               Game designs, plans, and validation history
shared/               Reusable code independent of game implementations
  audio/              Playback, sound workshop UI, provider and storage adapters
    construction/     Shared construction-game audio contract and playback
  browser/            Browser subscriptions
  http/               Origin checks, bounded JSON reading, room route handling
  input/              Touch controls, pointer ownership, gestures
  math/               Common numeric contracts and helpers
  peer/               WebRTC transport, coordination, generic simulation host
  physics/            Geometry reused by multiple games
  rendering/          Primitive meshes, common models, rendering instrumentation
  rooms/              Persistence contracts, sessions, token hashing
  styles/             Shared game UI and construction theme
  ui/                 Common toolbar
  voice/              Shared voice clients and membership authorization
platform/             Composition that explicitly knows about multiple games
db/                   Database contracts, Node and Worker adapters, schema
drizzle/              Application migrations, kept in their original order
scripts/              Repository-wide development, tests, and build tools
public/               Stable public asset URLs
```

Games may import `shared/`, database contracts, and existing UI primitives. A game must not import another game's implementation. Shared code must not import `games/`, `platform/`, or `app/`. Only routes and `platform/` compose multiple games. Integration tests may cross these boundaries to verify isolation and compatibility.

Use direct imports. Avoid a barrel exporting every game, renderer, simulation, and server handler: it obscures dependencies and can pull unrelated worlds into the browser bundle. Keep heavy Three.js scenes behind the existing dynamic imports. Full navigation between games is intentional so each WebGL/audio lifecycle is disposed with its page.

`npm run check:architecture` checks static imports, re-exports, and dynamic imports for unresolved paths and boundary violations. It also runs automatically before `npm test`.

## Shared behavior

The shared peer engine owns action validation, idempotency, input ordering, host recovery, and checkpoints. Each supported game injects its own adapter for player creation/removal, controls, simulation, and private snapshots. Connections dynamically import their local adapter; they do not load a registry containing every simulation. The platform registry exists for integration tests and server composition.

The audio player accepts an `AudioProfile`. Game-specific acoustics, preload policies, bundled fallback cues, and music behavior stay with the game. Catalog registries live in `platform/audio`; catalogs and material prompts live with their games. Shelf Control intentionally reuses published material clips from the farm workshop while owning its event mapping and acoustic policy.

The two audio contracts remain separate because the construction games support variations, recording capture, and different storage/API conventions. Their common encryption, cancellation handling, errors, and prompt limits are consolidated. Combining their public APIs or persistent data would require a separate compatibility migration.

Room routes share origin validation, streaming request-size enforcement, JSON-object validation, error translation, and no-store responses. Game rules remain in each game's room handler. Game-specific membership lifetimes and action behavior are intentionally preserved.

Public assets retain their existing URLs. Game assets already have directories such as `public/first-person` and `public/audio/act-natural`; collection illustrations belong to the site collection. Runtime SQLite files and generated recordings are data, not source modules, and must never move with a source refactor.

## Adding or changing a game

1. Create `games/<id>/` and keep its simulation, types, scene, UI, styles, tests, and game tools together.
2. Add a thin `app/<route>/page.tsx` importing that game's component. Add API route re-exports only when needed.
3. Extract a helper to `shared/` when multiple callers actually need the same behavior. Pass differing policies as explicit parameters; preserve each game's rules.
4. For peer play, implement the local adapter contract in `shared/peer/engine.ts` and pass a lazy loader to the shared connection. Hidden-role games should retain server authority when a player host would reveal secrets.
5. For generated audio, keep the catalog and profile inside the game and register the catalog in the appropriate platform registry.
6. Run `npm run check` and the relevant production build. Tests are discovered recursively, so new game tests do not need another glob in `package.json`.

```sh
npm run check
npm test -- games/act-natural
npm run build
npm run build:railway
```

The linter checks maintained application code. Installed `components/ui` primitives are checked by TypeScript/builds rather than rewritten to satisfy application lint preferences. The two legacy imperative WebGL host components explicitly opt out of experimental React compiler analysis; hook ordering and dependency checks remain enforced. Their valid `nickname` autocomplete tokens and styled ARIA live regions have documented, local lint exceptions.

## Refactor validation

The starting working tree passed 502 tests and TypeScript, but failed lint. The refactor preserves the existing game rules, URL routes, database schema, storage keys, audio identifiers, and published asset URLs. Added HTTP tests cover invalid payloads, UTF-8 byte limits, origin rejection before database access, and game-error propagation. Existing simulation, privacy, host succession, physics, audio, database, and connection tests remain in the suite.

Final validation on 2026-09-08:

- `npm run check`: TypeScript, lint, architecture boundaries, and all 506 tests pass.
- Both Worker (`npm run build`) and Node/Railway production builds pass.
- Four real local WebRTC clients per supported game pass abrupt host loss, checkpoint recovery, graceful handover, and continuing direct voice.
- Local Node production smoke checks pass for 16 routes, 72 referenced assets, and both legacy invite redirects.
- Multiplayer HTTP checks pass for all seven games, including capacity, authentication, origin rejection, shared state, and game-specific actions; Brick by Hand passes all 26 integration assertions.

These checks use isolated local data. Existing deployments and production data are unchanged.

The subsequent [security and performance audit](security-performance.md) adds administrator authentication, common HTTP resource limits, client/server import checks, manifest caching and shared durable database commits. That document records the expanded validation suite and measured mixed-game load results.
