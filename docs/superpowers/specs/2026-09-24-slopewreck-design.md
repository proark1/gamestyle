# Slopewreck

Slopewreck is a one-to-four-player downhill snowboard race. Each run lasts at most 60 seconds. The first rider across the finish wins; if time runs out, the rider farthest down the course wins. Empty seats use bots, so the full race works solo. A race can be restarted from the result screen.

## The signature mechanic

Riders steer, tuck to accelerate, brake, and jump. While airborne, they can choose a ramp trick or a rail trick. A completed spin earns style points and a small speed boost. The landing leaves that feature behind on the shared course for trailing players. A mistimed trick still creates a more powerful but narrower, riskier feature and causes the rider to wipe out and lose speed. Ramps launch a follower; rails reward a centered approach with a speed boost. Natural kickers across the mountain give every rider chances to trick without having to plan a jump from flat snow.

All four riders see the same features and results. Course state is bounded and old features expire to keep long sessions and peer snapshots small. A fall at the edge costs speed but does not eliminate a rider. The camera follows each player's rider down one long slope.

## Integration

The game owns its simulation, peer adapter, scene, controls, audio mapping, analytics, and avatar pose under `games/slopewreck/`. It reuses the shared Nico avatar and wardrobe, renderer, peer rooms and voice, game toolbar, touch joystick, sound workshop, analytics, and party results. The standalone page is `/slopewreck`; the collection and installed app both include it. The party playlist treats it as an individual race.

The distinctive visual treatment is a bright winter-sports broadcast: pale snow and sky, deep blue score panels, orange speed accents, teal course edges, and a large clear finish arch. The interface keeps movement and trick controls visible without covering the riders.

## Checks

Simulation tests cover clean tricks, wild features, feature use by a trailing rider, race completion, and input/host validation. The shared peer-invariant suite covers checkpoint serialization and host handover. The four-client WebRTC check covers steering, a shared trick-built ramp, voice, and host recovery. Desktop and mobile browser checks cover loading, controls, overflow, and browser errors.
