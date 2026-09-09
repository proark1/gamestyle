# Permit Pending construction controls

The building kit now closes after selecting a part with a click, tap, or number shortcut. Closing the kit leaves building mode active. Build reopens the kit; Walk exits building mode. Escape closes an open kit before exiting the tool. Selecting another part cancels a pending placement and walking job.

On desktop, the room badge, building modes, object actions, camera/crane utilities, floor selector, and selected-part controls share a narrow right column. The catalog uses a three-column grid and scrolls within the available height. The selected-part card retains the actual target floor, rotation, placement feedback, and an entry point for changing parts. Sound and settings move into the same tool group. Voice and clips stay with crew information on the left. Touch layouts retain the bottom HUD and gain the same selection dismissal behavior.

Native button, tab, and select key events inside the construction toolbar no longer trigger the scene's Enter, Space, or arrow-key actions. Other game shortcuts remain available. After dismissing the kit, focus returns to the selected-part or paint controls.

## Release isolation

- Source changes: `games/chaos/Game.tsx`, `BuildKit.tsx`, `ActiveBuildPart.tsx`, `SiteTools.tsx`, `workspace-ui.css`.
- Staging: `.tmp/permit-workspace-ui-release-20260908`.
- Source manifest: `.tmp/permit-workspace-ui-release-manifest.json`, 562 verified files.
- Production baseline: `3c282e89-36f0-44f6-ba80-600ef34fa87b`, from `work/load-crane-release-20260908`.
- Only two existing files differ from that baseline; the three new UI files are added. The concurrent Stack or Sink cargo crane and the earlier Permit Pending overhead-reach and floor-preview fixes are preserved. The in-progress repository refactor and unrelated checkout changes are excluded.

## Validation

- Workspace TypeScript and lint of the four affected TSX files: passed.
- Staged release TypeScript and production build: passed.
- Complete staged game/database suite: 552 passed, zero failures.
- Local production `/chaos` request on port 3118: HTTP 200 with Permit Pending HTML and the new CSS reference.
- `.tmp/verify-workspace-ui-release.mjs`: source-manifest integrity, exact change scope, compiled toolbar/selected-part controls, sidebar CSS, and previous floor fixes passed.
- Browser interaction and screenshot checks were not run. Validation used code review, the existing test suite, the production build, and HTTP/asset checks.

## Production

- Railway deployment `24f25167-1bea-404b-a538-9b79b68cd6de`: SUCCESS.
- Public URL: https://jumbleyard.up.railway.app/chaos.
- `.tmp/verify-workspace-ui-live.mjs`: public health and game routes passed; the live page references the new tool-board client. The published sidebar stylesheet and the unchanged scene/build-rule assets match the validated local bytes. The concurrent Stack or Sink cargo-crane rendering is retained.
- Public verification record: `.tmp/workspace-ui-live-verification.json`.
- The local production smoke server was stopped after verification.
