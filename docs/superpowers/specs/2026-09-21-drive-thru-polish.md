# Drive-Thru polish

Approved direction: retain Jumbleyard's clay cartoon characters and four-role diner game; overhaul the sedan, handling and presentation together.

## Design and implementation plan

1. Use one clockwise heading convention for driving, local passenger reach, rendering and camera. Integrate driving in bounded steps; reverse changes steering direction; opposite pedal brakes before reversing. Resolve the oriented car footprint against the pole and lane boundaries.
2. Build a teal and ivory rounded sedan with a hollow cabin, seats, window pillars, round animated wheels, lights and trim. Seat the existing avatars facing forward, transform their offsets with the car, and remove stale role models.
3. Open the service side of the diner so the kitchen is visible. Add tiled floors, awnings, menu and pickup signs, landscaping and a marked stopping bay. Palette: teal #377f7b, ivory #fff1cf, tomato #be4d3c, mustard #efbd58, asphalt #59686b, foliage #719565. Keep the existing Fredoka / DM Sans typography. Signature: a small clay diner and two-tone family sedan.
4. Smooth the camera with elapsed-time damping and wider framing. Cache tray geometry by contents and dispose replaced meshes. Clear input on blur, role changes and restart; support arrows, WASD and held touch buttons. Add a paused opening/help panel and driving guidance.
5. Verify physical turn direction, braking, rotated reach, collisions, keyboard mapping, bot delivery and model dimensions with focused regressions; run typecheck, lint and browser checks on desktop and mobile.

Existing uncommitted edits, including avatar migration and disposal support in this game, must be preserved. No hosting change is part of the implementation.
