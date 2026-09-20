# Wardrobe fitting and interaction repair

Approved in conversation on 2026-09-20.

Preserve Nico's recognizable fringe and side curls when wearing hats. Replace
the blanket crown deletion with a compact hairstyle and share hat seating
measurements between the hair builder and item fitter. Small crown accessories
sit higher than enclosing hats. Keep the bare avatar unchanged.

Retain the cream/forest palette and Fredoka/DM Sans typography. Repair thumbnail,
badge and label styles. Use explicit Item/Avatar view controls, Try on/Undo try-on
actions, and separate Equip/Take off actions. Selection follows actions. Clearing
or committing a slot clears its temporary override. Keep a stable, still preview
by default with accessible motion controls and responsive scrolling.

Implementation: shared hat profiles, geometry regression checks, preview-state
helpers and tests, wardrobe controls/styles, browser verification of hats and
all catalog categories at desktop and mobile sizes. Run scoped tests, typecheck,
lint and formatting checks. Do not deploy or alter unrelated working changes.

## Validation

- 28 avatar, cosmetic and wardrobe tests passed. The fringe test raycasts the
  foremost surface at 21 forehead samples for each of the ten hats, preventing
  hidden hair inside a hat or skull from passing the regression check.
- Changed TypeScript files passed oxlint; formatting and diff whitespace checked.
- Local browser confirmed the Party Cone and Viking Helmet retain visible front
  curls, correctly aligned item/category labels, contained status badges, and
  the still preview with accessible rotation controls.
- Full mobile and remaining visual catalog review was interrupted by browser
  connection loss (in-app browser disappeared; Chrome recovery timed out).
- Repository typecheck remains blocked by unrelated errors in Wrong Floor and
  Zorb Clash. No errors were reported in the changed wardrobe/avatar files on
  the final typecheck run. No deployment performed.

## Production release validation

The isolated release checkout preserves the latest main branch and excludes
unrelated working changes. Production build, full TypeScript, lint, architecture
and formatting checks passed. All 1,447 tests passed before final main sync.
