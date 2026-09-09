# Reel Problems

Approved by the user on 8 September 2026: implement the proposed one-to-four-player fishing game in Jumbleyard. Five-minute tournaments on one lake, with a shared tiny boat, physical fish pull, tangled lines, accidental teammate hooks, overboard rescues, and recovered junk that becomes equipment. Solo practice uses the same rules and a smaller target.

## Experience

Toy-like timber boat, turquoise water, coral and saffron equipment, pine shore, chunky anglers. Retain Fredoka and DM Sans and the shared game toolbar. The lake occupies the working surface. A compact tournament clock, shared catch score, tension meter, gear list, and action dock explain the moment-to-moment choices.

WASD/arrows move around the deck or swim. Click the water to cast at a chosen location; Space casts toward a nearby available catch. Hold E to reel, release during visible fish surges, hold Shift to brace, Q cuts free, R loosens nearby tangled lines, F rescues or boards. Touch offers a joystick and corresponding actions. Lost swimmers recover on a safety rope after twelve seconds so everyone remains in play.

Twelve fish/junk entities use eight catch types. Each catch contributes to the crew score. Tyre outriggers reduce roll, a magnet increases the bite radius, and a lucky boot increases stamina depletion. A large fish exerts much stronger pull. Time expires with a win when the target is met, or a retry result otherwise; the crew can continue fishing after reaching the target until the timer ends.

## Boundaries

New game owns its rules, renderer, audio and UI in games/reel-problems. Shared room coordinator, authentication, WebRTC transport, voice and host recovery are reused through a game adapter. No schema migration. State remains serializable for host handover, held inputs reset after recovery, actions are validated and deduplicated. The initial renderer loads dynamically and has explicit disposal. Existing games and their current edits must be preserved.

## Validation

Check line tension and catchability, physical boat response and weight shift, crossed lines, junk effects, teammate hooks/rescues, round timeout, host-only start and restart, checkpoint restoration, and four real WebRTC clients including voice and host departure. Run project formatting, types, lint, tests and production builds. Keep the result available as a local preview; publication uses the established project workflow and authorized audience.
