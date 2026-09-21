# Push-to-talk validation

The shared voice panel now offers Push to talk and Open mic before joining. Push to talk is the initial default; mode and the selected T, V, or B shortcut persist locally. Joining in push-to-talk mode prepares a silent microphone. A hold button stays available in the panel and beside the gameplay toolbar, with a Talking state during transmission. Switching modes requires explicitly enabling the microphone again.

The peer voice client retains a disabled microphone track between holds, avoiding repeated hardware acquisition. Disabling voice or leaving releases the microphone. Legacy LiveKit rooms use their existing SDK microphone lifecycle and retain the selected device.

## Checks completed

- `node scripts/test.mjs shared/voice`: 14 passing tests, including silent preparation, repeated holds with one acquisition, immediate release, permission/leave races, overlapping inputs, repeat/modifier suppression and focus loss.
- `npm run test:voice:browser -- --ui`: passed in two isolated real Chrome contexts with generated microphone tones and measured remote playback. Covers two-way audio, silent push-to-talk join, keyboard and mouse hold/release, overlapping inputs, blur, changed shortcuts, focused-button Space activation, typing/modifier exclusions, persistent gameplay controls, and touch hold/cancellation. Silence assertions require a continuous quiet interval.
- `npm run typecheck`: passed.
- Scoped oxlint, formatting and diff whitespace checks: passed.
- Visually inspected desktop (1280×720) and narrow (390×844) screenshots. The panel scrolls for secondary controls; primary talk controls remain accessible. No horizontal overflow at the narrow width.

Reproduce with `npm run test:voice:browser -- --ui`. Screenshots are written to `.tmp/voice/push-to-talk-desktop.png` and `.tmp/voice/push-to-talk-mobile.png`.

These are local tests of the real shared React panel, browser WebRTC and Web Audio output graph, using an in-memory coordinator. Physical microphones/speakers and separate networks were not tested. This change has not been deployed.
