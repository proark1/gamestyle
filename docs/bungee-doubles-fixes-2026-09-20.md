# Bungee Doubles repairs — 20 September 2026

Implemented the fixes approved from `bungee-doubles-audit-2026-09-20.md`. The fixes are prepared for production in an isolated checkout based on the latest main branch.

## What changed

1. **Repeated hits:** authoritative hit cooldown and team-possession checks prevent an NPC or its teammate from striking the outgoing ball again. The reported reproduction now yields one hit instead of six in 100 ms. Bots choose one receiver, and keyboard repeat does not repeatedly dispatch actions.
2. **Touch movement:** shared pointer-owned joystick supplies camera-relative analog movement; a separate action cluster provides hit, smash, dive, and jump. Buttons also work with mouse and keyboard activation.
3. **Responsive layout:** removed the 600px minimum height, separated touch and desktop action layouts, reserved space for controls and safe-area insets, and fit the camera to court bounds at every angle. Restored the court viewport after adaptive renderer changes. Compact toolbar controls remain reachable.
4. **Team switching:** rebalances to 2v2, preserves unique NPC IDs, resets court positions/tethers, and assigns a valid server without awarding a point. Team display comes from simulation state.
5. **Frame-rate consistency:** solo and peer play use the same 120 Hz simulation runner. Drag, player damping, and bot decision probabilities account for elapsed time. Motion matches across 30/60/120/144 Hz rendering rates.
6. **Event IDs:** physics and scoring share one allocator; restarts preserve its monotonic sequence. Snapshots are detached from the mutable simulation.
7. **Collision ordering:** floor, glass, side-wall, and net contacts resolve in time order. Floor-then-glass stays live; glass-first faults once. A shot landing on its own side before reaching the opponent loses the point.
8. **Point/match lifecycle:** dead balls and phase checks freeze scored/ended gameplay. Simulation owns the 1.8-second point pause, including in the peer adapter. Restart clears transient state. A completed match cannot award further points.
9. **Audio:** procedural effects have a managed gain tied to shared volume and game mute. Visibility changes suspend/resume audio. Unmount unregisters listeners/subscriptions/timers and closes audio contexts; finished oscillators disconnect.
10. **Input lifecycle:** blur and visibility changes release held input; canceled/lost canvas pointers do not hit the ball. Camera gestures track their owning pointer; editable fields and dialogs do not receive game shortcuts.
11. **Opening serve:** humans and bots occupy separate slots, the ball starts at the named server, and only that player can serve. Peer joins use the correct team slot.
12. **Retention/help/resources:** retain at most 128 events, dispose removed player models and owned scene resources, identify the local player with a pale ring, and provide English/German help with a focus-managed modal that pauses local play.

## Verification

- **109 tests passed:** Bungee Doubles plus related input, rendering, and peer suites. Includes 36 game-specific tests (the 22 existing tests plus 14 new regressions/audio checks).
- **TypeScript:** `tsc --noEmit --pretty false` passed.
- **Lint:** `oxlint games/bungee-doubles` passed.
- **Architecture:** import-boundary check passed.
- **Client production build:** Vite client build passed. It reports existing shared bundle-size warnings.
- **Browser:** loaded the client preview in Chrome, served and observed score progression, exercised the joystick and HIT control, switched teams, opened/closed help, and checked desktop plus 390×844, 844×390, and 360×640 layouts.
- At **844×390**, document height was 390 and all action controls fit on-screen. At **360×640**, document dimensions were exactly 360×640 and no visible game buttons were outside the viewport.
- **Full match:** a seeded solo/auto-serve simulation finished at 0–7 after approximately 79 simulated seconds. Extra stepping did not change the result. Long NPC rallies kept event history at 128 entries.
- Audio tests verify graded/zero volume, mute, event deduplication, visibility suspension, and disposal. Browser console inspection found extension warnings, with no game errors in that sample.

## Remaining validation boundaries

The normal server dev command could not start because this workspace's Miniflare installation lacks `workers/kv/namespace.worker.js`. Browser verification used the existing client Vite configuration instead; backend routes were not validated through that preview.

Real iPhone Safari/Android Chrome multitouch, mobile audio policies, safe areas, and device performance still require physical-device checks. The peer adapter is regression-tested, but the existing page remains solo; this repair does not add a new multiplayer lobby. Deployment status is recorded separately after Railway verification.

## Production release validation

The isolated release passed all 1,479 repository tests, TypeScript, lint, architecture checks, and the full Railway production build. The release includes only the Bungee changes and required touch-control, lifecycle, and resource-disposal helpers, on top of current main.
