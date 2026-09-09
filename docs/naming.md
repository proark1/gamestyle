# Jumbleyard names

Approved on 2026-09-07:

| Game | Display name | Existing route / internal ID |
| --- | --- | --- |
| Cooperative flood survival | Stack or Sink | `/stack-or-sink` |
| Blend in and escape | Blend Business | `/act-natural` |
| Cooperative sofa delivery | Uphill Delivery | `/uphill-delivery` |
| Cooperative stealth and theft | Tiptoe Thieves | `/dont-wake-the-giant` |
| Chaotic cooperative construction | Permit Pending | `/chaos` |
| First-person construction | Brick by Hand | `/first-person` |

Added 2026-09-09:

| Game | Display name | Route / internal ID |
| --- | --- | --- |
| Cooperative medieval siege | Siege and Desist | `/siege-and-desist` |

Siege and Desist is a Medieval Empires-themed mini game. The display name, route,
game identifier, audio namespace and room namespace are all `siege-and-desist`,
so nothing here needed a compatibility alias.

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
