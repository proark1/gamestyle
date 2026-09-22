# Approved collection improvements

The user approved the complete voice/multiplayer/efficiency audit with “Ok do all”. Implement within the existing architecture. Preserve unrelated working-tree changes.

Use small shared components rather than an engine rewrite or per-game copies. A rewrite increases migration risk; isolated per-game fixes would leave the common defects and duplicate maintenance. The chosen approach upgrades the shared runtime, transport and party composition, then applies measured rendering improvements.

## Implementation checklist

- [x] Frame deadline pacing, refresh-aware quality, whole-frame instrumentation and early visual scheduling.
- [x] Public invitation builder used by all share paths, including party/build links.
- [x] Ordered action execution separated from batched durable acknowledgement.
- [x] Voice expiry recovery preserving browser fencing, bounded ICE recovery, devices/output/test controls and telemetry.
- [x] Recipient-isolated snapshot baselines/deltas, missing-baseline recovery and compatibility versions; remove proven redundant clones.
- [x] Authenticated party round assignments, explicit game entry/start, shared party voice and bounded requests.
- [x] Rendering/resource improvements for measured heavy scenes and frame/physics regression coverage.
- [x] Current load/voice/peer CI checks, bandwidth budgets and forced-relay configuration.
- [x] Available local validation and implementation report with measured results and remaining physical-device/network limits.

## Contracts

An action is acknowledged only after its receipt is durable. Checkpoints and deltas are versioned, scoped to an epoch and recipient, and recover with a complete baseline after loss. Old clients receive an update-required response rather than interpreting a new schema. Voice signaling recovery never overrides a newer browser instance or revoked game pass; microphone activation remains user controlled. Party membership authorizes exactly one seat in the current game round, and the party owns its voice session across rounds. Server-authoritative games remain authoritative. Visual scheduling must not suppress game input or networking.

## Validation

Test simulated display rates and stalls, stale/superseded voice sessions, delayed checkpoint commits, lost/reordered snapshots, incompatible versions, concurrent party entry and host transfer. Run existing unit/type/lint/architecture gates, sequential production builds, browser startup and local multi-client integration. Compare actual encoded byte sizes and render submissions before/after. Physical phones, Bluetooth devices and external relay reachability require available hardware/configuration; do not represent local synthetic checks as those measurements.

The writing-plans skill is not installed. This checked implementation sequence supplies the execution plan. The prior audit and user approval supply scope and design approval.
