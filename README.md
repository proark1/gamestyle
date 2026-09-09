# Jumbleyard

**Jumbleyard** is a collection of eleven matching browser party games, all served by a single application at [jumbleyard.up.railway.app](https://jumbleyard.up.railway.app). The landing page at `/` offers illustrated cards for every game. Old Stack or Sink and Handwerker root invite links still work.

## The eleven games

Every game has its own folder under `games/` holding the simulation, scene, rooms and tests. The matching folder under `app/` holds only the thin route. Several routes keep their original slug for invitation compatibility, so the display name and the folder name differ — the table below is the authoritative mapping.

| Game | Play at | Game code | Route |
| --- | --- | --- | --- |
| Stack or Sink | `/stack-or-sink` | `games/stack-or-sink/` | `app/stack-or-sink/` |
| Blend Business | `/act-natural` | `games/act-natural/` | `app/act-natural/` |
| Uphill Delivery | `/uphill-delivery` | `games/uphill-delivery/` | `app/uphill-delivery/` |
| Tiptoe Thieves | `/dont-wake-the-giant` | `games/dont-wake-the-giant/` | `app/dont-wake-the-giant/` |
| Permit Pending | `/chaos` | `games/chaos/` | `app/(handwerker)/chaos/` |
| Brick by Hand | `/first-person` | `games/first-person/` | `app/(handwerker)/first-person/` |
| Wrong Floor | `/wrong-floor` | `games/wrong-floor/` | `app/wrong-floor/` |
| One More Button | `/one-more-button` | `games/one-more-button/` | `app/one-more-button/` |
| Four Brain Cells | `/four-brain-cells` | `games/four-brain-cells/` | `app/four-brain-cells/` |
| Reel Problems | `/reel-problems` | `games/reel-problems/` | `app/reel-problems/` |
| Shelf Control | `/shelf-control` | `games/shelf-control/` | `app/shelf-control/` |

Ten of the eleven have a sound workshop at `<route>/admin`; Shelf Control has none. See [naming](docs/naming.md) for the approved display names.

## Wrong Floor

Play at `/wrong-floor`. Four guests escape through five shuffled hotel stops. Each guest sees a different carpet, portrait, door, or clock. Inspect a private clue, share the finding, then meet at the far-end elevator panel. Advance when everything is normal; retreat if anyone finds an anomaly. Human votes decide by majority, with tied or missing votes retreating when the 90-second timer ends.

A wrong call starts a 12-second run to the brass elevator. Only one guest sees the pursuing entity. One human reaching the elevator saves the crew and retries the stop with new evidence; three wrong calls or nobody escaping ends the stay. Empty places become computer guests that inspect and report their own evidence. Solo practice needs no room database.

WASD/arrows move, Shift sprints, E inspects, R shares a finding, 1 votes advance, 2 votes retreat, and V switches first-person/follow cameras. Drag to look; touch movement and actions are included. Guests sprint automatically during escapes. Room codes, direct voice, host handover, and `/wrong-floor/admin` use the shared infrastructure. Immediate synthesized sounds work before any optional workshop recordings are generated.

Run `node scripts/test.mjs games/wrong-floor` for the full solo playthrough, rules and privacy checks, and `node scripts/peer-integration.mjs wrong-floor` for four real WebRTC guests inspecting, reporting, voting, escaping, sharing voice and recovering the host. See [Wrong Floor design and validation](games/wrong-floor/docs/design-and-validation.md).

## Load Bearing

Play at `/load-bearing`. One to four wreckers have three minutes to bring a condemned two-storey house down. The client's upright piano stands on the upper floor and has to survive. Parts hold each other up: cut what a floor rests on and everything above it drops at once, piano included. A beacon marks the piano through the walls so the crew can plan around it.

WASD/arrows move, Space jumps, E swings the sledgehammer at whatever you are aiming at, Q sprays a mark so the crew can agree a plan, F digs out a teammate caught by debris, C takes the shared wrecking ball, and V changes the camera. Walls take three blows and columns five; the ball ignores that and destroys anything it touches. On the crane, WASD swings the hoist, R raises, Z lowers and X parks it. Drag to orbit, scroll to zoom, and touch devices get the shared joystick and action dock.

The crew wins when nothing is left standing and the piano still has integrity. Destroying the piano, or running out the clock with the house up, ends the job. Solo practice runs the same rules without a database and without the timer. Rooms, six-character invitations, direct crew voice, host recovery and the sound workshop at `/load-bearing/admin` use the collection's existing infrastructure.

Run `node scripts/test.mjs games/load-bearing` for the structure, rules and physics tests. See [Load Bearing design](games/load-bearing/docs/load-bearing-design.md) and [validation](games/load-bearing/docs/load-bearing-validation.md).

## One More Button

Play at `/one-more-button`. One to four contestants share a toy game-show room. Every press adds an increasing prize and a permanent hazard: conveyor floors, giant boxing gloves, soap spills, and spinning sofas. The button recharges for 2.2 seconds and each press locks the exit for five seconds. Sixteen presses reach the $38,000 fictional jackpot. Players have three chances; dazed contestants can be helped by friends.

WASD/arrows move, Space jumps, E presses the nearby button, Q shouts STOP, F helps a nearby dazed friend, X cashes out at the back exit, and V changes the camera. The first cash-out or the three-minute show timer starts a final 25-second escape. Each contestant banks the pot divided by the starting crew size when they leave; later presses cannot take away already banked money or extend the escape deadline. Solo practice uses the same rules and awards the full pot.

Rooms, six-character invitations, direct crew voice, touch controls, host recovery, rematches, and `/one-more-button/admin` use the collection's existing infrastructure. Synthesized cues work immediately, with optional workshop recordings replacing them. Run `node scripts/test.mjs games/one-more-button` for rules/checkpoint checks and `node scripts/peer-integration.mjs one-more-button` for four real local WebRTC clients with voice and host recovery.

## Four Brain Cells

Play at `/four-brain-cells`. Four players share one clumsy robot, with one colored limb per player. Cook three pancakes and fill the coffee cup within six minutes. Coordinate steps, carry the pan, and try to pour while a friend kicks the table. The ceiling fan throws cookware, spills make the floor slippery, and conflicting footsteps cause tumbles.

WASD/arrows move the selected limb, R/F raise or lower a hand, E grabs/releases, Space cooks/flips/serves/pours with a hand or kicks with a foot, Shift moves carefully, Q centers the limb, and 1–4 selects a free limb. Touch controls, crew voice, host recovery and `/four-brain-cells/admin` use the shared infrastructure. Solo practice supports the complete order without a database; an empty partner foot follows when walking. Immediate synthesized effects work before optional workshop recordings are generated.

Run `node scripts/test.mjs games/four-brain-cells` for rules and a complete solo input playthrough, and `node scripts/peer-integration.mjs four-brain-cells` for four real WebRTC clients controlling individual limbs, moving the table, carrying voice and recovering from host loss.

## Reel Problems

Play at `/reel-problems`. One to four anglers share a tiny boat in a five-minute fishing tournament. Fish pull the boat, crew position changes its balance, crossed lines tangle, and hooks can catch teammates. Land eight kinds of catches including a giant fish, tyre outriggers, a lucky magnet and an old boot that improve the crew's equipment. The catch target scales with the starting crew size. Solo practice runs the same rules without a database.

Cast onto a friend's fish to pull together: every line adds force and tires the fish, the crew scores a catch once, and all attached anglers receive catch credit. Losing one line leaves the others attached. Steep decks cause real slides and falls overboard; brace and move uphill to keep your balance. Gusts, slippery rain and thunderstorms alternate with calm spells. Sharks occasionally bump the hull, while glowing jellyfish snag nearby hooks. Weather and encounters stay synchronized through host recovery.

WASD/arrows move; click the water to aim and cast, or Space casts near an available catch. Hold E to reel, release when a fish surges or line tension goes red, Shift braces, Q cuts free, R untangles, and F rescues or boards. Overboard anglers can swim back, be reeled in, or return by safety rope after twelve seconds. Touch controls, direct crew voice, host recovery, and the sound workshop at `/reel-problems/admin` use the collection's shared infrastructure. Immediate synthesized cues work before workshop recordings are generated. Rooms are isolated by the `reel-problems` game identifier under the shared peer coordinator.

Run `node scripts/test.mjs games/reel-problems` for rules and checkpoint tests, and `node scripts/peer-integration.mjs reel-problems` for four real local WebRTC clients, voice, and host recovery.

## Shelf Control

Play at `/shelf-control`. One guard hunts three mannequins among eighteen identical showroom figures in a furniture store, for one to four humans plus invited NPCs. Fifteen seconds of hiding while the guard waits in the office are followed by a three-minute hunt. Guard assignment rotates each round. Furniture blocks both movement and sight; the guard has a forward viewing area and a small nearby area, each blocked by shelving.

Space poses, WASD/arrows or touch move, E interacts, and Q drops. Two keys open the loading door and a ladder reaches a service hatch, but both routes need the security switch off. Inspection requires proximity, line of sight and a cooldown; five wrong inspections end the hunt, while successful catches cost nothing. The mannequins win if at least one escapes before time runs out. Snapshots contain only locally visible characters, items and nearby action sounds, so no hidden ownership or offscreen action reaches the guard. Rooms use a separate `shelf:` namespace, and captured or escaped players get a waiting screen rather than a free spectator camera.

Run `node games/shelf-control/scripts/shelf-control-integration.mjs` for the four-client check and `node games/shelf-control/scripts/shelf-control-bots-integration.mjs` for the NPC seats. See [Shelf Control design](games/shelf-control/docs/shelf-control-design.md) and [validation](games/shelf-control/docs/shelf-control-validation.md).

## Code structure

All eleven games live in their own folder under `games/`, listed in the table above. Reusable infrastructure lives in `shared/` (audio, browser, http, input, math, peer, physics, rendering, rooms, styles, ui, voice); `platform/` composes game catalogs, and `app/` contains thin routes. Permit Pending and Brick by Hand sit in the `app/(handwerker)/` route group, which does not change their public URLs. See the [architecture and contributor guide](docs/architecture.md) for ownership rules, shared interfaces, and how to add a game. Run `npm run check` for types, lint, dependency boundaries, and the complete test suite.

## Handwerker: Permit Pending and Brick by Hand

The Handwerker code is now included here. **Permit Pending** runs at `/chaos`: build and furnish a house with up to four friends, carry crew deliveries, operate the crane, and save or remix builds. **Brick by Hand** runs at `/first-person`: gather materials, mix mortar, and build a house brick by brick in first person. Each retains its own audio workshop under its `/admin` route.

Both use the shared persistent database through separate `handwerker_*` tables and `/api/handwerker/` endpoints. No additional Railway service is needed. The source checkout and its existing deployment are untouched; existing Handwerker production data and generated audio were not copied. See [integration details and validation](docs/handwerker-integration.md).

## Tiptoe Thieves

Play at `/dont-wake-the-giant`. Two to four tiny thieves share an eight-minute cottage heist, with solo practice available. Collect 120 gold, carry valuables to the glowing door to bank them, and escape before the giant catches you. His breathing belly and shifting arm are moving platforms. Noise causes clearly warned arm shifts and sneezes; tickling his foot deliberately provokes a sneeze. Waking or sunrise starts a 25-second escape, and banked gold stays safe.

WASD/arrows move, Space jumps, Shift creeps, E grabs/banks/passes/helps, Q places tools, R rotates the teaspoon bridge, F tickles, H helps a dazed friend, X exits at the door, and V changes the camera. High falls and dropped objects are louder; cups, crowns and the metal spoon make loaded landings especially risky. At a ledge, E quietly passes to an empty-handed teammate below when both have steady footing. Pillows cushion impacts. At full wakefulness the giant sits up, then stands on the bed during the escape. Touch controls and optional existing voice chat are supported. The game has immediate synthesized audio; game noise never depends on the microphone. Room state is isolated under `giant:`. Run `node games/dont-wake-the-giant/scripts/giant-integration.mjs` for a four-client check (defaults to port 3003; override `GAME_TEST_URL`).

## Uphill Delivery

Four friends. One sofa. No elevator. Carry a single physical sofa up a switchback mountain village, across a swaying rope bridge, through a gated alley, over a broken path, and up icy stairs while goats get in the way. The sofa supports players, spans the gap, and bounces falling friends from its cushions. Drops remain where gravity takes them; there are no automatic checkpoints. Open the customer's outward-swinging door, bring the entire sofa inside, and release it on the rug to complete the delivery.

WASD / arrows move, Space jumps, E grabs/releases a corner, Q releases, R turns the sofa, F operates a nearby gate or door, and V cycles player/sofa/overview cameras. Drag to orbit and scroll to zoom. Touch controls are included. Create a crew for up to four players, or try the complete route solo with extra lifting assistance. The game uses the existing room database with a separate `delivery:` namespace. Voice chat and the sound workshop at `/uphill-delivery/admin` use the same setup as the other games; new sound prompts must be generated before those clips are audible.

Run `node games/uphill-delivery/scripts/uphill-delivery-integration.mjs` against a running server (defaults to port 3002; override with `GAME_TEST_URL`). Physics, persistence, room authorization, and route traversal are covered by `games/uphill-delivery/uphill-delivery.test.ts`.

## Blend Business

One farmer watches up to three friends disguised as cows among an 18-cow herd. Cows graze, pause and wander independently, with different directions, speeds and timing. Blend in near other cows and sneak away to steal both gate keys and cut the fence power. A visible, slower ladder provides an alternative route over the east fence. Three-minute rounds rotate the farmer; the farmer gets five inspections. Solo practice includes a computer farmer that treats ordinary movement and grazing as normal.

WASD / arrows move, Space toggles grazing, E interacts or inspects, and Q drops an item. Farmer players can click a cow to select it. Touch devices have a joystick and action dock. Create a farm and share the room link for two to four players. This game uses the same Three.js helpers and room database as Stack or Sink, with separate room namespaces and private role snapshots.

Run the four-client farm check against a running server with `node games/act-natural/scripts/act-natural-integration.mjs` (defaults to port 3001; override with `GAME_TEST_URL`).

## Stack or Sink

A browser game for one to four players. Stack a limited supply of salvage, climb to a suspended rescue platform, and keep the crew above a rising flood. Built in Three.js and React, with a shared authoritative simulation and persistent multiplayer rooms.

## Local development

Ten of the eleven games include an ElevenLabs sound workshop. Generate and preview sounds, tune their volume, or regenerate outdated clips without replacing working files on failure. New multiplayer rooms use player-hosted simulation and direct WebRTC voice, with the same top-right Voice menu everywhere. The earliest-joined connected player takes over if the host leaves. Voice includes microphone selection, push-to-talk and participant volume. See [sound and voice setup](docs/audio-setup.md), [host handover](docs/host-handover.md) and the [complete prompt catalog](docs/audio-prompts.md). Generated game sounds require a provider key; peer voice does not require LiveKit.

Node 22.13+ and npm are required.

```sh
npm install
npm run db:local
npm run dev -- --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000`. Solo practice needs no database. For multiplayer, create a crew and share the six-character code with up to three other players. Join before the captain starts the flood. Local-network friends can use the host computer's LAN address and port 3000 when the firewall permits it. Internet play requires deploying the app to a shared host.

For a Node preview with a separate database, use `npm run dev:peer -- --port 3012`. Microphones require HTTPS or localhost; plain HTTP over a LAN address cannot enable them. Configure TURN for restrictive networks as described in the sound and voice setup.

## Controls

- WASD / arrow keys: camera-relative movement
- Space: jump
- E: pick up nearby salvage, or place carried salvage at the green preview
- R: rotate carried or crane-held salvage
- C: take the crane for the selected piece, or release it
- Crane: WASD moves, Q raises, Z lowers, E drops the load
- F: rescue a nearby downed teammate
- G: call teammates over
- V: switch overview / follow camera
- Mouse drag: orbit; wheel: zoom; click: select salvage
- Touch: movement joystick, jump button, and action dock

Normal rounds give 60 seconds to prepare, followed by a flood rising 1.5 metres per minute. The rescue platform is 13.5 metres high. One teammate reaching it wins for the crew; everyone drowning ends the run. Practice has no flood.

## Validation and deployment

```sh
npm test
npm run test:peer
npm run typecheck
npm run build
```

The shared room coordinator uses compare-and-swap writes for membership, host election and recovery checkpoints. Crew tokens are hashed in storage and excluded from public snapshots. New games exchange inputs and authoritative snapshots directly over WebRTC; existing sessions retain HTTP synchronization. Rooms are intended for small private groups. Cannon rigid-body physics runs at 60 steps per second, with shared compound collision shapes, mass, gravity, friction, rotation and persistent sleep state. Removing a support wakes the stack. Placement commits the exact preview pose or rejects an obstruction, and aiming at salvage snaps to its center.

Sites deployment is configured in `.openai/hosting.json`. A private deployment is visible only to its owner until sharing is enabled. The local preview and game state tests do not substitute for a real four-person internet playtest. WebMCP exposes read-state and start-practice tools when the browser supports it.

## Railway

[Play Jumbleyard](https://jumbleyard.up.railway.app) · [Railway project](https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88)

Railway uses the Dockerfile and `railway.json`. The Node build selects the SQLite room adapter while retaining the existing game rules. Attach a persistent volume at `/data`; `DATABASE_PATH` defaults to `/data/stack-or-sink.sqlite` in the container. Schema migrations run before the server starts. Use one service replica, since the SQLite volume belongs to a single instance. The health check at `/api/health` confirms that the room database can be read.

Set `PUBLIC_GAME_ORIGIN` to the game's public HTTPS origin so same-origin room requests work behind Railway's proxy. The server listens on Railway's injected `PORT` (8080 for this deployment); the domain must target that port.

Sound editing and paid generation require `AUDIO_ADMIN_PASSWORD` (16–256 characters); playback stays public. See [sound setup](docs/audio-setup.md) and the [security and performance audit](docs/security-performance.md) for runtime limits, validation, and the local load-test command.

For a local production check:

```sh
npm run build:railway
npm run start:railway
node games/stack-or-sink/scripts/integration.mjs
node --import tsx games/stack-or-sink/scripts/physics-integration.mjs
```

The default local database is `data/stack-or-sink.sqlite`. For a deployed integration test, set `GAME_TEST_URL` to the Railway HTTPS origin. Railway deployment uploads exclude local databases, outputs, dependencies, and environment files.

Redeploy from this linked directory with `npx --yes @railway/cli up --service stack-or-sink --environment production --detach`. CLI uploads deploy the current source; GitHub automatic deployment is not configured.
