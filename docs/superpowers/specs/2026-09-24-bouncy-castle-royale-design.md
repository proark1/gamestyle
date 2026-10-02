# Bouncy Castle Royale

The user selected research concept 6 and authorized implementation, prioritizing reuse. Concept 10, Flip Happens, is next; this change implements 6.

## Play

One to four humans play 2v2 volleyball; bots occupy remaining seats and are replaced by joining friends. First to seven wins, with a three-minute limit and a draw if scores are tied. Each serve launches automatically after a short countdown. The ball touching the floor loses the point for that side; an out-of-bounds shot loses the point for its last hitter. Three contacts per team, no consecutive contacts by the same player. A landing creates a visible travelling floor wave that can launch other players. Bracing reduces the launch. Players can be bounced across the net and recover to their own half.

Each team has one leaking air reservoir split between floor, walls and bumpers. Three presets redistribute a fixed total: higher jumps, stronger containment, or powerful side bumpers. Changing a preset smoothly deflates the other components. Holding Pump beside the marked pump station replenishes air at the cost of covering the ball. The UI shows the tradeoff and low-air warnings. Empty teams' bots understand pumping, coverage and hitting.

Controls: WASD/arrows or shared joystick move in screen directions; Space jumps; F volleys; Shift braces; E pumps beside the station; Q cycles air allocation. Touch buttons expose the same actions. Court camera keeps both halves visible at desktop and phone sizes. Keyboard shortcuts yield to dialogs and text inputs; held controls clear on blur, pointer cancellation and menus.

## Reuse and ownership

Reuse `usePeerRoom`, `PeerRoomControls`, peer authority/checkpoints, voice via `GameToolbar`, standard touch input, gamepad keyboard mapping, session/invite behavior, analytics, party results, language selection, shared renderer/lifecycle/quality/lighting/disposal, Nico avatars and wardrobe, primitive meshes, instanced rendering, and existing Zorb Clash audio files at their original paths. The party-cone wardrobe model decorates the court. Do not import another game's implementation. The game owns only volleyball rules, bounce/pressure behavior, bots, court geometry, camera framing and its compact UI. No new service, database schema, library or paid media generation.

Alternatives considered: clone the existing tennis game (too much tether-specific behavior); generalize all sports into a new engine (unnecessary migration); compose shared infrastructure around a small dedicated simulation (selected).

## Implementation and verification

- [x] Implement bounded serializable simulation, bots and peer adapter.
- [x] Build castle scene from shared primitives and avatars; reuse sound assets.
- [x] Compose shared room, toolbar, touch, analytics and party UI.
- [x] Register web/installed routes, collection card, party guide, audio workshop and admin avatars.
- [x] Test scoring, contacts, air conservation, waves/bracing, malformed controls, bot matches, four humans and host recovery.
- [x] Run repository checks and production build. Inspect desktop and mobile gameplay in browser, create a real gameplay card, and verify peer play.

## Validation

- All 1,924 repository tests pass, including 15 new castle rule/input/peer tests. Architecture boundaries pass.
- TypeScript and repository lint pass. Formatting passes for all 35 touched code paths; the combined `npm run check` stops at existing formatting differences in 132 unrelated files, which were preserved.
- `npm run build:railway` and `npm run build:client` pass. Existing Vite warnings concern config import attributes and large shared chunks.
- The production browser check passes at 1440×1000 and touch-emulated 390×844: starting, movement, jump/volley, air selection, hold controls, help, no horizontal overflow, zero page errors and zero failed requests. Screenshots and diagnostics are in `.tmp/castle/`.
- Four real local WebRTC clients verify balanced teams, synchronized movement, team air, jumping, synthetic voice transmission, abrupt host recovery and graceful handoff.
- The collection image is captured from the actual 3D game with the page HUD hidden. It is stored at `public/images/party-gameplay/bouncy-castle-royale.webp`.
- The shared instancing helper reduces scene draw calls from 225 to 181 without shadows (435 to 347 with shadows). A normal headless Chrome capture at 1000×880 measured 50 FPS over 200 frames; forced-software browser runs are for behavior checks, not physical phone performance. Physical devices and restrictive external networks were not tested.

The runnable local production preview is `/bouncy-castle-royale`. No deployment or remote publication was requested.

The working tree already contains substantial unrelated work; preserve it. Implementation is directly in that checkout so its current shared infrastructure is reused.
