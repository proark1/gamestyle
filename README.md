# Stack or Sink

A browser game for one to four players. Stack a limited supply of salvage, climb to a suspended rescue platform, and keep the crew above a rising flood. Built in Three.js and React, with a shared authoritative simulation and D1-backed rooms.

## Local development

Node 22.13+ and npm are required.

```sh
npm install
npm run db:local
npm run dev -- --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000`. Solo practice needs no database. For multiplayer, create a crew and share the six-character code with up to three other players. Join before the captain starts the flood. Local-network friends can use the host computer's LAN address and port 3000 when the firewall permits it. Internet play requires deploying the app to a shared host.

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
npm run typecheck
npm run build
```

Room state uses compare-and-swap writes to preserve concurrent actions and enforce four-player capacity. Crew tokens are hashed in storage and excluded from public snapshots. Rooms use HTTP synchronization; this initial version is intended for small private groups, and simulation is deliberately simplified to axis-aligned salvage with gravity, support checks, and unstable overhangs.

Sites deployment is configured in `.openai/hosting.json`. A private deployment is visible only to its owner until sharing is enabled. The local preview and game state tests do not substitute for a real four-person internet playtest. WebMCP exposes read-state and start-practice tools when the browser supports it.
