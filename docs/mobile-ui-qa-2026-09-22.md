# Mobile UI/UX validation — 2026-09-22

Deployment follow-up: the release blockers described below were resolved in the [complete production release](all-current-release-2026-09-22.md). Commit `7c9aed4` is live; physical-device coverage limits still apply.

## Changes

- Shared game toolbar: secondary controls collapse into a labelled settings panel on phones and touch devices. Primary controls remain reachable. The same control instances are retained across viewport changes. Outside taps and Escape dismiss the panel. The trigger explicitly receives focus on tap so Escape also works in Safari/WebKit.
- Graphics settings: accessible icon, bounded panel, full-size select fields, readable mobile labels.
- Multiplayer and Sample Stampede headers: icon-sized mobile controls with accessible labels, avoiding clipped help/settings buttons.
- Forms and dialogs: page zoom enabled, readable touch-device input sizes, larger close/menu targets, dynamic viewport sizing for the wardrobe, compact wardrobe header on short screens.
- Four Brain Cells: all four limb controls fit 320px screens.
- Load Bearing and Court Clash: gameplay fits short mobile viewports; movement controls remain in view after rotation. Court Clash now has the missing movement joystick, and movement/shooting share one input pipeline so dragging does not release a held shot.
- Crane Clash: touch joystick, swing/crane mode switch, hoist/lower hold buttons, and grab/release. Movement uses the existing scene input and multiplayer pipeline. Release, cancellation, blur, orientation changes and unmount clear held controls.
- Installed construction games: apply the same scoped construction theme and wrapper as their web routes.

## Verified

- Chrome mobile emulation: all 24 game routes checked at 320×568 portrait and 844×390 landscape. No detected horizontal control overflow, undersized text inputs, offscreen tested touch buttons, or JavaScript exceptions in the final layout checks.
- 19 games exercised via their solo/practice/start buttons; Bungee Doubles and Panic Curling run automatically. Chaos, First Person and Shelf Control were checked at their offline entry screens; their online gameplay was not exercised by this pass.
- Panic Curling's first screenshot timed out while waiting for fonts; its complete route check passed on retry.
- Shared browser checks: homepage headers at 320/390/430/768px, sign-in form input and dismissal, wardrobe scrolling and dismissal, English/German switching, party entry layout, graphics preferences, mobile settings dismissal, joystick touch/release, crane control mode and landscape buttons. Account availability is mocked; no email is sent.
- Desktop regression: toolbar controls remain directly accessible at 1280×800.
- 41 targeted tests passed: Court Clash and Crane Clash simulation/input pipelines, plus shared input gestures/gamepad tests.
- The mobile files passed targeted formatting and lint checks. The voice type errors seen during the first pass have since been resolved; the follow-up full-project TypeScript check passed.
- Production client build passed. A transient syntax error from a concurrent edit to `shared/peer/mesh.ts` was corrected by that work; this mobile pass did not alter the networking file.

## Release follow-up

- Railway production build passed, including a second build from an isolated source copy at `.tmp/mobile-release-validation/`. The copy prevents concurrent builds from replacing assets beneath the test server.
- The isolated copy passed TypeScript, lint, architecture checks and all **1,695 tests**. The earlier shared-checkout run passed 1,693 tests; concurrent work added two before the copy was taken.
- Chrome and WebKit checked all 24 route layouts at 320×568 and 844×390. WebKit's Carry On Carnage check initially reached settings before the onboarding dialog had appeared; waiting explicitly for that dialog made the complete route check pass. No remaining layout failures or JavaScript errors were detected in these checks.
- The shared UI suite passed against the isolated production server in both engines, including the Safari focus fix, settings, forms, wardrobe, language switching, desktop toolbar, touch controls and landscape controls. Chromium exercises a continuous touch drag; WebKit exercises native touch press/release. Render diagnostics also verify that new scene frames are drawn before gameplay screenshots.
- Local four-client WebRTC integration passed for Court Clash and Crane Clash: gameplay, generated audio, abrupt recovery, round preservation and host handover.
- Local browser voice integration passed microphone mute/re-enable, incoming mute, per-player volume, playback recovery, rejoin, keyboard/touch push-to-talk, release, cancellation and blur. Microphone hardware and storage are substituted; these are not physical microphone or production network tests.
- One WebKit run was invalidated by a concurrent build deleting the running server's assets. Its apparent input-size/loading failures were not reproduced on the isolated build. No input-size code change was needed.
- WebKit on this Windows host omits the WebGL scene from some Low-quality screenshots. Direct framebuffer readback confirms varied scene pixels with no WebGL error at Auto, Low and High; the shared suite now checks actual pixel variation as well as frame counts. Screenshot compositing remains unverified on real iOS hardware. This resembles [a reported Playwright WebKit screenshot limitation](https://github.com/microsoft/playwright/issues/586), but that report does not establish the cause of this particular result. No speculative renderer workaround was added.
- **Not deployed.** `npm run check` stopped at repository-wide formatting issues in 138 files. Targeted formatting for the mobile changes passes. `npm run deploy` separately refused the shared checkout because it contained 401 uncommitted changes. The deployment script requires a clean commit synchronized with `origin/main`; no force override, broad commit, stash or push was performed.
- Android tools found no connected devices and no configured emulator. This Windows host cannot run the iOS Simulator. Physical-device validation remains pending.

## Repeat

Run the client development server with `npx vite --config vite.client.config.ts --host 127.0.0.1 --port 4175 --strictPort`, then:

```powershell
node scripts/mobile-ui-smoke.mjs
node scripts/mobile-shared-smoke.mjs
node scripts/test.mjs games/basketball games/crane-clash shared/input
npm run typecheck
```

Set `SMOKE_URL` to use another local development/preview server. Set `SMOKE_ENGINE=webkit` to exercise WebKit (install its matching binary with `npx playwright install webkit`); Chromium is the default. Both browser scripts reject non-local destinations and block external traffic. Screenshots and JSON reports are written to `.tmp/mobile-audit/chromium/` and `.tmp/mobile-audit/webkit/`. The game suite also fails on failed local JavaScript or stylesheet requests.

## Coverage limits

These are browser-emulation and local integration checks. WebKit on Windows is not iPhone Safari. Physical iOS/Android devices, native keyboard/notch behavior, live authentication, physical microphone permissions and multiplayer across real mobile networks still require device/backend validation. The checks do not establish perfection across every device or network condition.
