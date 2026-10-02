# Flip Happens — live release

Published on 24 September 2026 at https://www.jumbleyard.com/flip-happens.

- Source: `060c878419b1f67fa0de578d3f90270ba94854a1`, merging [PR #54](https://github.com/proark1/gamestyle/pull/54).
- Railway deployment: `6974daf8-8831-4e98-81b5-916f9d76cc0e`, status **SUCCESS**.
- Deployed through `npm run deploy -- --detach` from the clean isolated checkout `.tmp/flip-happens`, matching `origin/main`. No force override was used. The merge has no source-tree differences from the tested implementation.
- Pre-release validation: all 1,987 tests, formatting, TypeScript, lint and architecture checks passed; website and installed-client builds passed.
- Public health, homepage, party page, game route, card image and Castle route returned HTTP 200. The homepage includes Flip Happens.
- Live desktop and emulated touch browsers completed an upright daily bottle landing, banked 10 points and advanced to the next object, without JavaScript errors, failed requests or horizontal overflow.
- Four real WebRTC clients against production verified shared aim, object selection, an upright washing-machine landing and banked score, generated voice audio, abrupt host recovery, preserved round and graceful host handover (877 ms).

The first concurrent network/browser test timed out on its narrow washer landing window and logged native/signalling warnings; all peer links were connected. A separate rerun passed the complete scenario. No application change was needed for the rerun; this does not establish the exact cause of the first miss. Physical phones and restrictive networks were not tested.

Live browser results, screenshots, Railway status and the successful network rerun are in `.tmp/flip-happens/.tmp/live-release/`.
