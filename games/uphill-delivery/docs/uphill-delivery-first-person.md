# Uphill Delivery: first person and shared audio

The requested design reuses the game's rendering, controls, multiplayer physics and sound workshop. First person is the default during a delivery, at 1.65 m eye height, with a level horizon and no head bob. Mouse capture is optional; mouse/touch dragging and IJKL work without it. WASD and the joystick move relative to horizontal view direction. V cycles all four cameras. The depot retains its mountain overview. Help, blur, hidden tabs and camera changes release controls and mouse capture.

The sound workshop is linked from the depot and in-game help. It retains voice design, speech, sound generation, previews, music, mixing and the collection narrator. A reuse action imports only missing, unedited compatible cues from another game's saved library. Shared music and matching effects reuse existing MP3s without a provider request. Speech is reused only if its words and voice match. Existing delivery edits and generated files are preserved. Each imported cue records the source prompt and file so previews, playback and later regeneration remain accurate.

Validation covers view-relative walking, bounded pitch, camera switching, desktop/touch play, frame timing, reuse without generation, preserved edits, source-file playback and all existing game checks.

## Verified on 6 September 2026

- Full suite: 149 tests passed. Type checking, targeted lint and Railway production build passed.
- All four game HTTP integration scripts passed against the production build. An earlier check ran while another workspace build replaced the running server's chunks; restarting against the completed build resolved the missing-module errors.
- Production browser checks: solo and multiplayer first-person carrying, joystick movement and release, horizontal/vertical drag look, immediate IJKL taps, all four camera modes, help and room cleanup.
- At 390 × 844: 60 FPS, 16.8 ms p95 frame interval, 3.2 ms p95 work, zero frames over 34 ms in a 600-frame carrying sample. Desktop multiplayer at 1280 × 720: 60 FPS, 16.8 ms p95 interval, 2.4 ms p95 work and zero long frames. These are in-app browser measurements, not physical-phone guarantees.
- Camera diagnostics confirmed eye height of 1.65 m above the displayed player's feet, the local avatar hidden in first person and restored in follow mode. The perspective uses the existing buffered physics poses without extra position lag or head bob.
- The production page reported no browser errors. A development ResizeObserver warning during viewport changes was fixed by deferring canvas resizing to the next animation frame.
- Mouse capture is optional and has a drag fallback; actual pointer capture was not reported by the in-app automation, so captured physical-mouse movement was not hardware-verified. Drag look and keyboard look were verified.
- Workshop UI reuse returns its result without starting generation. Unit tests verify actual shared source-file URLs, unchanged existing edits, rejection of unrelated speech, repeat-call idempotency and an active-generation lock.
- Before deployment, the live Uphill Delivery library already contained all 30 saved, current clips and a selected voice. No generation or replacement of these files was performed.

Railway deployment: `c4dab73d-61d1-4db5-b832-df18405cc552`, verified **SUCCESS**. Image digest: `sha256:8c23b413e90aa25ee327c66d51197c8e446eb77e7ec62719f9d0ef3f111bb54a`.

Live verification: all four game integration scripts passed and cleaned up their rooms. The live workshop showed 30/30 current clips, the selected collection narrator and the reuse controls. Speech, play music and wood-footstep URLs returned HTTP 200 with audio/mpeg content. First-person carrying and drag look on the live page measured 60 FPS, 16.8 ms p95 interval, 3.3 ms p95 work and zero long frames over 600 frames at 1280 × 720. No browser errors were reported. Only temporary local servers created for this task were stopped; the existing development server was left running.
