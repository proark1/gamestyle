# Reel Problems 3 Fishing Guidance and Rod Polish

## Scope

Improve the fishing experience without changing the round rules. Replace the unclear first-person fishing rod and fragmented prompts with a polished rod model and one persistent, context-sensitive next-step guide. The result must teach the complete fishing loop during normal play on desktop and touch devices without opening a modal tutorial.

## Chosen direction

Use one compact **Next step** card near the bottom center. It always presents exactly one useful action derived from authoritative world and local-player state. It replaces the current generic interaction prompt and absorbs the separate held-item label so the interface never gives competing instructions.

The top-center round objective remains the strategic goal, and the contract list remains the mission summary. The new card explains only the immediate player action. This hierarchy is intentional:

- objective: what the crew is trying to achieve;
- contract: which catch counts;
- next step: what this player should do now.

## Fishing guidance state model

Create a pure presentation helper that receives the world, local player, current look target, and input mode. It returns a stable view model containing an identifier, eyebrow, primary instruction, optional supporting text, control label, urgency, and optional world target.

During fishing, the normal sequence is:

1. **Get a rod** — point the player to a loose rod or rod rack and show `E` / `USE`.
2. **Get bait** — point to the bait bucket or bait station when bait is missing.
3. **Reach the fishing ground** — explain that the helm must enter the marked fishing area; do not instruct the player to cast while the boat is outside it.
4. **Cast** — show `F` / `FISH` and a short aim instruction when a baited rod is held inside the fishing ground.
5. **Wait for a bite** — tell the player to watch the rod tip; do not show a control that currently has no effect.
6. **Hook now** — switch to an urgent coral treatment during the valid bite window and show `F` / `FISH`.
7. **Reel safely** — show `Hold R` / `REEL` and explain that the player must release when line tension enters the red range.
8. **Recover after a snap or miss** — state what happened and return to the next valid step instead of displaying a generic error.
9. **Pick up the landed fish** — point to the loose catch and show `E` / `USE`.
10. **Store the catch** — point to the ice hold and show `E` / `USE`; only secured fish complete contract progress.

Outside this loop, higher-priority safety actions may temporarily replace the normal instruction: rescue a nearby player, respond to critical hull/bilge incidents, or return dropped mission equipment. A valid object under the crosshair may replace the supporting line with its immediate interaction, but it must not erase an urgent bite, dangerous tension, or safety instruction.

The helper must have deterministic priority rules and no timers or React state of its own. Existing localized input names are used where available. Desktop and touch receive different control labels from the same semantic action.

## HUD design

The next-step card uses the existing Reel Problems 3 clay-nautical palette and type system. It is a compact dark-teal deck label with a warm paper inset, a small nautical icon, an explicit `NEXT STEP` eyebrow, one strong action line, and a physical amber keycap. Urgent states use coral only for the card edge, keycap, and a short pulse; the rest of the HUD stays quiet.

The card is wide enough for a readable instruction but must not cover the crosshair, hands, touch controls, or tension meter. On narrow screens it sits above the touch action row and shortens supporting copy before truncating the main instruction. Keyboard focus remains visible, motion respects reduced-motion preferences, and the card remains pointer-transparent.

A small world-space marker may identify the required rod, bait, loose fish, or station. It uses one anchor-shaped or diamond marker with distance falloff and restrained vertical motion. There are no large arrows, trails, or through-wall clutter. Only the current next-step target is marked.

The separate current prompt and held-item badge are removed after their information is represented in the next-step view model. The help dialog remains as a complete reference but is no longer necessary to understand ordinary fishing.

## Rod and first-person presentation

Replace the current rod's large brass torus guides with a recognizable stylized fishing rod in the established handcrafted clay style:

- tapered dark graphite/wood blank with a slight authored curve;
- warm cork grip and dark butt cap;
- reel seat, compact spool housing, side crank, and handle;
- four small metal line guides aligned along the blank;
- a thin line routed from the spool through the guides to the rod tip;
- restrained material variation and bevel-like forms so it reads cleanly at game distance.

Use the same model factory for deck and held versions, with view-specific transforms rather than duplicated geometry. The first-person rod sits to the lower right, is held by the existing avatar hands, leaves the center view open, and changes pose for idle, casting, waiting, hooking, and reeling. Guide rings must never appear as detached floating objects. The fishing line begins at the rod tip in both world and first-person presentations.

## Architecture and performance

Keep guidance derivation in `presentation.ts` and render it from `Game.tsx`. The helper remains pure and unit-testable. Static icon and copy mappings live at module scope. Do not introduce per-frame React state or effects: the existing bounded HUD update cadence supplies the view model, while Three.js continues handling visual animation.

Refactor rod construction into a focused scene/model helper if that prevents `scene.ts` from accumulating more geometry detail. Reuse shared materials and primitive geometries where practical. Update existing held-item transforms and fishing-line endpoints without allocating new geometry every frame.

## Error handling

Rejected fishing actions should return actionable language that matches the guide, such as `Pick up a rod first`, `The boat must be inside the fishing ground`, or `Wait for the rod tip to dip`. Transient errors may appear above the next-step card but must not permanently cover it. When player or legacy snapshot data is incomplete, fall back to the safest valid phase instruction without throwing.

## Verification

Add presentation tests for every step and priority transition, including missing player data, desktop/touch labels, bite urgency, red tension, landed catch pickup, and ice-hold storage. Extend fishing and rendering tests for rod-line attachment and state transitions.

Run the full Reel Problems 3 test set, lint, TypeScript, and production build. Use a local production-mode browser check at desktop and mobile sizes to complete one full flow from rod pickup through securing a fish. Review screenshots of the deck rod, first-person rod, normal next-step card, urgent hook state, safe/unsafe reeling state, and mobile layout. Confirm there is no HUD overlap, detached guide geometry, console error, failed request, or material frame-rate regression.

## Out of scope

This pass does not rebalance fish difficulty, contracts, bot behavior, round duration, boat physics, or multiplayer rules. Publishing is a separate action and requires an explicit request after the validated implementation.
