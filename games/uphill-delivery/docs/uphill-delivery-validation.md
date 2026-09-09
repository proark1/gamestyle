# Uphill Delivery validation — 2026-09-06

Implemented the third illustrated collection card, `/uphill-delivery`, the mountain scene, solo and 1–4 player room flows, keyboard/mouse and touch controls, player/cargo/overview cameras, voice membership, and `/uphill-delivery/admin`.

The game reuses the existing worker meshes, compound sofa geometry, materials, fonts, renderer helpers, room database, voice panel and sound workshop. The sofa remains a dynamic Cannon body while carried, dropped, stood on, bounced from or struck by the door. Solo assistance supplies lifting/balancing forces without teleporting cargo. Rendered roads, bridge planks, stairs, gates and door share the simulation's geometry and poses.

## Automated checks

- `npm test`: **111 passing tests**, including 13 delivery tests and the existing games, storage, audio and voice regressions.
- `npm run typecheck`: passed.
- Targeted Oxlint on the new game, routes, tests and integration script: passed.
- `npm run build`: Cloudflare/Sites production build passed.
- `npm run build:railway`: Node production build passed.
- `node games/uphill-delivery/scripts/uphill-delivery-integration.mjs`: passed against the local server with four concurrent clients. Checks all three landing links, game/admin routes, artwork, four-player capacity, authentication, host-only start, distinct grabs, shared cargo movement, release replay and snapshots.

## Mechanics exercised

The tests verify depot stability, four independent grips, free-hand gates, carrying and release continuity, falling to the bottom through room serialization, cushion catches and bounces, the sofa spanning the gap, the outward door transferring momentum, whole-sofa delivery bounds and settling, ice friction, host reassignment, stale input ordering and voice namespace isolation.

Each unbroken route segment is traversed with normal movement. Separate assisted carrying checks traverse the short turns, bridge, alley, stairs and summit approach. These exposed and corrected lips at junctions, sideways ramp inclination and excess friction from compound stair contacts. The deliberate gap remains a sofa/jump obstacle; goats can interrupt a run.

## Scope of verification

No paid audio was generated: the new catalog is available in the sound workshop and uses an existing approved narrator when configured. The new clips need generation before playback. Tests cover the catalog, prompt limits and audio storage namespace. Real microphones, a four-person human internet playtest, and visual browser/device QA were not performed. Initial local routes returned HTTP 200.

## Railway release

At the user's request, deployed the collection to the existing `stack-or-sink` production service. Railway deployment `13dc693b-491c-4f54-a68e-5fa4be6251f7` reported `SUCCESS` on 2026-09-06. The existing `/data` volume and public domain were preserved.

- Public collection: https://stack-or-sink-production.up.railway.app
- New game: https://stack-or-sink-production.up.railway.app/uphill-delivery
- Live Uphill Delivery integration passed: all three cards, game/admin routes, artwork, four concurrent clients, shared carrying, release replay, capacity and authentication.
- Live Stack or Sink integration passed: room creation, four clients, capacity, authentication, host controls, movement, idempotency and request-origin validation.
