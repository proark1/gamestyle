# Sound release — 8 September 2026

Published the complete One More Button game and its original sound bank to `https://jumbleyard.up.railway.app/one-more-button`.

Railway deployment `84357c17-f14c-43e8-bebc-996c1cfb53ba` succeeded. The 836-file frozen source and SHA-256 manifest are in `.tmp/one-more-button-live`. It starts from the successful Giant release, adds only One More Button and its necessary registrations/workshop support, and preserves concurrent game work in the shared checkout.

- All 691 tests in the scoped release pass, alongside formatting, TypeScript, lint, architecture checks and the Node production build.
- All 28 original stereo sound files pass duration/header, distinctness, audible energy, peak headroom and loop-seam checks. The director passes event deduplication, four simultaneous impacts, hazard activation/windup/fire, movement, door and countdown/music transition checks.
- An instrumented Web Audio check passes gesture unlock, four simultaneous continuous layers, voice ducking to 35%, four independent team impacts, mute/unmute, reset, menu return and disposal. This checks playback wiring; it is not a physical-device listening test.
- Live checks pass 12 routes, 77 referenced assets, and exact hashes for all 28 sound files. The authenticated workshop reports all 28 included sounds ready. All 686 prior audio mappings and settings across seven libraries are unchanged.
- Four actual local WebRTC clients pass against both the isolated coordinator and production `/api/peer`: shared host/guest presses, prize and hazards, STOP, direct audio transmission, abrupt host recovery, intact winnings/hazards, surviving voice links and graceful handover. Production graceful handover completed in 963 ms.

No provider credits were needed. The original music and Foley are synthesized locally from the checked-in script. Browser interaction/screenshot QA and listening across physical devices or restrictive networks were not performed. The shared local preview on port 3016 remains running.
