# Bouncy Castle Royale — live release

Published on 24 September 2026 at https://www.jumbleyard.com/bouncy-castle-royale.

- Source: `d14c33b`, following `cdf1dc3`, on the current production `main`.
- Railway deployment: `821aadb6-f307-4137-9e15-92f53a99628a` (SUCCESS).
- Isolated release checkout: `.tmp/bouncy-castle-live-release`. Existing unrelated working changes were preserved.
- Full check passed: formatting, TypeScript, lint, architecture and 1,963 tests. Production build passed.
- Public health, homepage, party page, game route and game thumbnail returned HTTP 200.
- Live desktop and emulated mobile browsers started the game and changed team air, with no page errors or horizontal overflow.
- Four real WebRTC clients against production verified movement, teams, air, jumping, generated voice audio, abrupt host recovery and graceful host handover.
- Physical mobile devices and restrictive networks were not tested.

Detailed logs and screenshots are in the release checkout's ignored `.tmp/release-logs` directory.
