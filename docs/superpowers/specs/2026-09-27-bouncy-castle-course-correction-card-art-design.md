# Bouncy Castle Royale and Course Correction card artwork

## Goal

Replace the Bouncy Castle Royale gameplay screenshot and the Course Correction SVG placeholder on the homepage with finished raster illustrations that match the established all-boy clay collection artwork.

## Shared art direction

- Create one full-bleed 3:2 landscape illustration for each game at 1536×1024.
- Match the premium handcrafted 3D clay style and reuse the same four recognizable boys shown throughout the current collection.
- Keep all four faces, distinct hairstyles, body poses, and the central action readable at small card sizes and inside the collection's wider crop.
- Use bright daytime lighting, tactile matte clay, rounded silhouettes, cheerful saturated colors, and playful physical-comedy energy.
- Do not include titles, lettering, logos, interface elements, player labels, borders, watermarks, extra people, duplicate characters, or unrelated props.

## Bouncy Castle Royale scene

Show the four boys split into red and blue teams inside the inflatable castle volleyball arena. Two players are airborne around one volleyball while a third player's landing visibly deforms the bouncy floor and launches a teammate. Preserve the recognizable red and blue castle halves, central net, inflatable corner towers, soft walls, floor seams, and air-pump equipment. The action must read as buoyant team volleyball rather than an ordinary rigid court.

## Course Correction scene

Show all four boys as visible mini-golfers on the sunny Backyard Open course. They putt simultaneously while four colored golf balls interact with the changing route: a hinged wall is visibly rotating, the bridge is tipping, and the cup platform is sliding. Preserve the course's artificial turf, painted plywood, visible hinges, ruler markings, safety accents, garden clubhouse, low spectator edge, and collection palette. The course mechanics must remain legible without making the composition cluttered or shrinking the boys into background figures.

## Integration

- Save both final images as new assets under `public/images/court-cast-v1/boys/`.
- Update only the Bouncy Castle Royale and Course Correction homepage card image paths and alternative text.
- Keep Party Mode gameplay screenshots unchanged because they intentionally show live gameplay.
- Keep the existing source screenshot and SVG files unless they are proven unused; do not delete unrelated assets.

## Verification

- Inspect both generated images for cast consistency, gameplay fidelity, coherent anatomy, clean crop safety, and forbidden text or UI.
- Confirm both public asset paths resolve and the homepage cards use them.
- Run TypeScript and production/client build checks.
- Visually inspect the rendered homepage and show both completed cards to the user.
