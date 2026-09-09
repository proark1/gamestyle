# Shelf Control: shared Jumbleyard style

The user's requested correction makes Shelf Control look like the other games, both before and during a round. Blend Business is the reference. This replaces the original separate blue-and-orange branding, split marketing page, dark HUD and cinematic illustration.

## Changes

- Reuse `GameToolbar`, `setup-card`, `primary-button`, `secondary-button`, `eyebrow` and `map-badge`. Match Fredoka/DM Sans typography, cream panels, sage ink and mustard actions.
- Use the same left-aligned title and compact setup form over a full 3D world as Blend Business. Joining opens a cream room-code dialog; invite links open it with the code populated.
- Keep room roster, host NPC invitation/removal and fill-and-start controls in a cream lobby panel over the showroom. Restyle results, instructions, role/timer/objective HUD, touch controls and guard's hiding screen consistently.
- Match Blend Business's ACES filmic exposure, warm hemisphere and sun, soft shadows, pastel background, matte low-poly materials and rounded toy proportions. Use sage shelving, cream signs, honey wood and terracotta details. Preserve opaque shelf collision footprints exactly.
- Replace the collection illustration with a warm cutaway toy showroom. Built-in imagegen, one request, no retries. Exact prompt/tool provenance is in `shelf-control-style-art.txt`; published asset is `public/images/shelf-control.png`.

## Gameplay boundaries

The menu scene contains fixed anonymous display props generated from the static layout. It ignores room snapshots and does not show a room's players, equipment locations or activity. Starting a round destroys that scene and constructs the playing scene from private server snapshots. The guard's 15-second cover remains fully opaque.

Room, simulation, navigation, bot, connection, layout and audio source files are unchanged from the preceding live NPC release. Player models remain identical across human mannequins and NPCs. Guard view range, shelf occlusion, hider privacy, controller directions and actions are unchanged. The shared toolbar truthfully indicates that in-game voice is unavailable here; existing group calls remain the way to talk.

## Validation

The isolated release is based on the preceding live NPC version (518 hash-verified source files), with only Shelf Control's presentation, collection image reference and documentation changed. It contains 520 source files.

- Type checking and focused lint passed; all 480 release tests passed.
- Railway production build passed. Production HTTP checks confirmed the shared menu/toolbar markup and working collection art.
- Four independent human sessions passed authentication/origin checks, capacity, hiding phase, private snapshots, pose changes and departure cleanup.
- A human with three NPCs completed an escape. A separate NPC-guard round passed with a human teammate, host transfer, seat management and NPC credential rejection.
- Versioned the art URL because public images cache for one hour; existing browsers will request the replacement immediately.
- No browser interaction or screenshot QA is claimed. Source/style comparison and inspection of the replacement illustration were performed.

Published successfully to https://jumbleyard.up.railway.app/shelf-control on 2026-09-08. Railway deployment `903aaf49-b344-4017-8a80-b4deb4ac2980` reported `SUCCESS`.

Live verification passed: shared menu/toolbar markup, versioned collection image with exact asset hash, four human sessions, hidden starts, NPC escapes and NPC guard with human teammate. All temporary test rooms were cleaned up. All seven game pages and health checks returned HTTP 200; all four sound manifests (336 recordings and their settings) remained identical to their pre-release versions.

Release source manifest: `work/shelf-control-style-release-manifest.json`. This final live-status note is a post-deployment audit addition; the deployed source snapshot retains the pre-deployment validation note.
