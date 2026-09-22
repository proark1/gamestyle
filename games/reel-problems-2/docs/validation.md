# Reel Problems validation — 8 September 2026

Implemented at `/reel-problems`, with an illustrated collection card and sound workshop at `/reel-problems/admin`.

## Completed checks

- `npm run check`: formatting, TypeScript, lint, architecture boundaries, and all 671 project tests passed.
- Sixteen new rules/checkpoint tests cover all eight catch types, careful versus reckless reeling, fish-driven boat motion, crew-weight roll, tyre stability, crossing lines, untangling/cutting, teammate hooks, rescues, safety-rope recovery, round outcomes, fixed-step timing, input/action validation, player removal, and host checkpoint restoration.
- Four real local WebRTC clients passed round start, direct audio, abrupt host loss, retained tournament progress, uninterrupted surviving voice links, and a second graceful host handover.
- The collection smoke check passed the eight game cards, shared toolbar/workshop links, existing invitation redirects, game/admin routes, static assets and origin isolation.
- Worker and Node/Railway builds compiled the new game and workshop routes. The final Worker build is recorded in `work/reel-problems-worker-build.log`; the Node build is recorded in `work/reel-problems-node-build.log`.

## Scope of verification

The game uses the existing authenticated peer room coordinator, voice transport and storage without a database migration. Immediate synthesized sound cues work without generated recordings; the workshop can publish replacements. No paid sound generation was requested.

The playable local preview uses the already-running development server at `http://127.0.0.1:3016/reel-problems`. Browser interaction/visual QA and physical mobile-device testing were not performed.

## Live release

Published to [Jumbleyard](https://jumbleyard.up.railway.app/reel-problems) on 8 September 2026. Railway deployment `639ef064-2e4f-400a-9a79-fb7ff8230932` completed successfully on the existing production service, retaining its `/data` volume.

- Public HTTP verification passed 11 routes and 73 referenced assets, including the collection card, game, workshop, and health endpoint.
- All 681 previously published recording URL mappings across six existing sound libraries were preserved. The new sound manifest is available, and administrator/origin protection checks passed.
- Four real local WebRTC clients using the live production room coordinator passed round start, direct audio, abrupt host recovery, retained tournament progress, uninterrupted surviving voice links, and a second graceful host handover in 595 ms. This does not cover physical devices or restrictive networks.
- The frozen upload contained 786 source files; hashes were rechecked after deployment. Release inventory and HTTP verification results are retained locally in `.tmp/reel-live/`.
