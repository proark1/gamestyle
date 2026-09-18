# Jumbleyard names

Approved on 2026-09-07:

| Game                             | Display name    | Existing route / internal ID |
| -------------------------------- | --------------- | ---------------------------- |
| Cooperative flood survival       | Stack or Sink   | `/stack-or-sink`             |
| Blend in and escape              | Blend Business  | `/act-natural`               |
| Cooperative sofa delivery        | Uphill Delivery | `/uphill-delivery`           |
| Cooperative stealth and theft    | Tiptoe Thieves  | `/dont-wake-the-giant`       |
| Chaotic cooperative construction | Permit Pending  | `/chaos`                     |
| First-person construction        | Brick by Hand   | `/first-person`              |

Added 2026-09-09:

| Game                                  | Display name      | Route / internal ID |
| ------------------------------------- | ----------------- | ------------------- |
| Cooperative medieval siege            | Siege and Desist  | `/siege-and-desist` |
| Competitive crane stacking party game | Crane Clash       | `/crane-clash`      |
| 2v2 street basketball party game      | Court Clash       | `/basketball`       |
| 2v2 tethered tennis doubles mayhem    | Bungee Doubles    | `/bungee-doubles`   |
| Fast-food drive-thru co-op mayhem     | Drive-Thru Static | `/drive-thru`       |

Crane Clash is a 2v2 physics party game where 2 cranes and 4 players swing, grab, and stack crates as high as possible. The display name, route, game identifier, and room namespace are `crane-clash`.
Court Clash is a 2v2 street basketball party game in the Stack or Sink style with super jumps and combo dunks. The display name is `Court Clash`, the route and game identifier are `basketball`.
Bungee Doubles is a 2v2 tethered tennis doubles party game where teammates are linked by an elastic bungee cord for slingshot smashes and slapstick collisions. The display name, route, and game identifier are `bungee-doubles`.
Drive-Thru Static is a frantic fast-food drive-thru co-op and party game featuring a scrambled intercom speaker box, chaotic kitchen grill assembly, clumsy sedan driving, and the ragdoll Short Stop window reach. The display name is `Drive-Thru Static`, and the route and game identifier are `drive-thru`.

Added 2026-09-18:

| Game                                     | Display name   | Route / internal ID |
| ---------------------------------------- | -------------- | ------------------- |
| Co-op obstacle course on one safety line | Chain of Fools | `/chain-of-fools`   |

Chain of Fools is a one-to-four player co-op obstacle course where the whole crew is clipped to one unbreakable safety line across a demolition site. The display name is `Chain of Fools`, and the route, game identifier and audio namespace are `chain-of-fools`.

The platform is **Jumbleyard**, with this exact spelling. Blend Business and
Tiptoe Thieves are deliberately independent of a particular animal, disguise,
map, or opponent. Current game descriptions still describe their playable maps;
these names do not imply that additional maps have been implemented.

Use these names for page titles, navigation, in-game branding, sound workshops,
sharing, downloaded media, and documentation. The audio catalogs expose the
display-name mappings for their respective game families.

Existing routes, API paths, source module paths, database game IDs, voice-room
names, browser storage keys, and saved-build cookies remain stable so invitations,
saved builds, generated audio, and returning players retain compatibility.
Historical migration fixtures and ordinary construction terms retain their
original meaning. The workspace directory and hosting service identifiers are
infrastructure identifiers, not display names.

## Validation

- Type checking and the Railway production build passed.
- HTTP checks passed for the landing page, all six game names, twelve game and
  sound-workshop page titles, and all six card illustrations.
- Existing collection checks passed for invite redirects, game and admin routes,
  static assets, audio namespaces, and request-origin protection.
- Checked against a local production server with a separate test database.

## Live deployment — 2026-09-07

Published the naming update to the existing Railway production service at
https://stack-or-sink-production.up.railway.app. Deployment
`51ab7985-c50a-49cd-a718-c53b1fd53c53` reached `SUCCESS`.

Live checks passed for the Jumbleyard landing page, all six game names, twelve
game/workshop titles, and all six card images. The existing service domain,
game routes, and persistent database volume were retained.

The platform spelling was corrected to **Jumbleyard** and published in deployment
`f54c3992-da74-4b7d-9a0e-bd7bf74b5e4f`, which reached `SUCCESS`. Live checks
confirmed the corrected platform name on the landing page and all twelve game
and workshop page titles, with all six game names and card images intact.

## Current public URL — 2026-09-07

The Railway service domain was renamed in place to
**https://jumbleyard.up.railway.app**, still targeting port 8080.
`PUBLIC_GAME_ORIGIN` was updated to the same HTTPS origin. The previous
`stack-or-sink-production.up.railway.app` address is a historical address;
use the new domain for shared game invitations.

Checks at the new domain passed for all game/workshop titles and card images,
the database health endpoint, and all six room APIs accepting the new origin
while rejecting unrelated origins. No game source or persistent data needed
to change for this domain update.
