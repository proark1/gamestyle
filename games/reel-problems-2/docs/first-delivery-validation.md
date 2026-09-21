# First Delivery — implementation and validation

Date: 22 September 2026

## Implemented

Milestone A of the approved Reel Problems 2 plan is playable at `/reel-problems-2`. The menu defaults to First Delivery and retains Classic tournament as a separate mode.

- Eight-minute, three-fish delivery contract with six-crate storage (three on the raft).
- Assisted routes to fishing grounds, café delivery berth, and repair slip; physical paddling remains available.
- A single teaching leak after the second catch, dock repairs, existing patching/bailing, and optional solo deckhand.
- Sinking spills recoverable cargo. Rescue takes the crew to the repair dock, where they carry and attach two deck sections, barrels, and a paddle before launching a raft. The mission and its timer continue.
- Authoritative timed work, interrupted holds, exclusive material ownership, disconnected-carrier recovery, cargo expiry, and checkpoint restoration.
- Mission panel, dock/construction/cargo models, keyboard/controller work binding and touch work button; local completion, best-time, and medal data.

Cargo, navigation, and rebuilding rules are grouped in `campaign.ts` and `mission.ts` rather than split into the plan's suggested smaller modules.

## Checks completed

- `node scripts/test.mjs games/reel-problems-2`: **85 passed**, including ten campaign scenarios and the 75 inherited regression tests.
- TypeScript project check: passed.
- Scoped lint: passed. Architecture check: passed (1,058 files / 3,638 local imports at validation time).
- Headless Chrome, actual Three scene and keyboard events: walk to four components, pick up, carry, attach, and launch the raft. No JavaScript errors.
- Chrome at a 390 × 844 touch viewport: menu, solo start, course button and mission layout checked; desktop construction and raft screenshots reviewed.
- Four real Chrome WebRTC clients against a local instance of the existing peer coordinator: catch cargo, unload, catch again, sink, rescue, move a guest, attach a deck, and lose the host while it carries another component. The remaining peers elected a host, preserved the delivered fish and installed deck, and released the disconnected carrier's material.
- Browser checks used isolated local bundles of the actual game/peer code. Rendering checks blocked unrelated account/platform HTTP calls. Multiplayer used the real peer coordinator with an in-memory test store and local WebRTC connections.

## Remaining gates and scope

This is a first playable mission, not the full standalone campaign. Human solo/two-player fun and onboarding tests, physical gamepad/device testing, cross-network sessions with latency/loss, and production deployment verification remain outstanding. Later chapters and 2v2 are not implemented.

The native Windows `wrtc` harness was unreliable (invalid ICE candidate indices); its failures are not counted as successful validation. The four-client result above used Chrome's actual WebRTC implementation. The game-owned `scripts/peer-scenario.mjs` is also wired into the shared peer harness for environments where the native binding works.

Local UI screenshots are temporary development evidence in `.tmp/reel2-qa/`; the automated rule tests and peer scenario are retained in this folder. No deployment was performed.
