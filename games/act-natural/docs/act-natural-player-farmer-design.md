# Act Natural: two farmer modes

Approved in conversation on 2026-09-08. Implement for separate player devices, the recommended setup. A cow's personal view must not be shared with the farmer; a dedicated shared-TV/controller interface is outside this change.

- Escape the computer: one to four cow players, existing computer behaviour, practice still available offline.
- Player farmer: two to four players, one rotating farmer and up to three cows among eighteen. Host chooses mode before a round; switching during a round is rejected.
- New rooms use the existing server room handler, so the host does not receive the full simulation as a peer authority. Existing peer sessions remain compatible.
- Farmer snapshots omit cows outside seven-metre forward vision (with 1.2 metres of nearby awareness), including behind solid hay stacks. Shock exposure is the existing five-second exception. Inspection requires actual line of sight and proximity even for an exposed cow.
- Keys and sabotage progress are private to their owner. Visible cows can briefly bend to interact; ladders remain conspicuous inside sight. Item sounds are short-lived nearby clues with an action location, never a holder identity. Global power/gate outcomes remain public.
- Human-mode hay footprints control both rendering, occlusion and collision. Ordinary cows also wander to objective areas. Computer-mode layout and AI are preserved.
- Rematches reset role assignments, clues and exposure. Disconnect and authentication rules continue to apply. Farmer selection cannot target hidden cows. Rendering clears vanished actors and selections rather than retaining stale positions.

Validation: simulation tests for both modes, role rotation, cooperative AI, privacy/occlusion, witnessed clues, collision, inspection authorization and fence exposure; room tests for authentication and mode selection; renderer checks through type checking, focused lint and production builds. No deployment is requested by this implementation approval.
