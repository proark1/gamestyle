# Stack or Sink island validation — 2026-09-06

- All 64 tests pass, including three new checks for visible terrain versus physical footing, inward shoreline progression and reduced-motion behavior.
- TypeScript and the Node production build pass. The new coast module and its tests pass focused Oxlint. Existing unused-variable findings remain in the original scene/object files.
- The built game passed the Stack or Sink four-client HTTP suite and the physical placement suite: a bathtub is placed at its exact preview position on a crate and remains there for another client. The collection/Blend Business suite also passes, including independently moving cows and private role data.
- The island uses the existing physical ground height and boundary. Trees and rocks sit outside the build area. The surface follows the actual water level; shoreline foam disappears once the island is submerged. Practice retains calm water, and reduced motion freezes ambient animation.
- The existing mobile controls, collection and latest Blend Business behavior are included in this release. No browser screenshots, browser interaction test or physical-device visual/performance test was performed for this environment change.

Railway deployment `a115da47-4780-40a8-ad21-7d4655c9e8c6` reached `SUCCESS` at https://stack-or-sink-production.up.railway.app/stack-or-sink. The public page returns 200 and the new “SALVAGE ISLAND” caption. Both games' public four-client integration suites pass, and the health endpoint returns `ok`.
