# Reel Problems 2 — hands-on crew jobs

Approved in conversation: secure the landed giant, carry repair planks, and operate a harbour winch while the crew rows through. This document records that approved scope and its execution plan.

Rope and timber have separate marked deck stations. Hold C to collect one item; carry it to the giant or leak and hold C to complete the job. Carrying prevents reeling/rowing. Returning an item, going overboard, sinking, or leaving returns it to the supply station. Stocks are renewable so required jobs cannot become impossible. Existing raft parts keep their separate exclusive ownership rules.

The caught giant remains visibly alive on deck. Its first flop is delayed ten seconds and telegraphed three seconds ahead. Subsequent flops occur every twelve seconds until secured or lost. Nearby unbraced crew are shoved; unsecured ordinary cargo can spill. A secured giant resists wave cargo loss but still floats away if the boat sinks. Salvaging it requires tying it again.

A plank seals a leak at its location; bailing at the bucket only removes water. Rowing no longer silently patches a crack through the old held-E interaction. Walking between stations does not steer unless the player is actively reeling/rowing with empty hands.

At the harbour, a marked bow winch opens the gate after a two-second hold. A crew member can keep holding it while others row. Releasing gives a short grace period; with only one player, a fourteen-second latch permits switching to rowing. Escape needs roughly three seconds of rowing through the open gate with everyone aboard. There is no automatic C-to-win action in new missions.

Persist all item ownership, fish state, gate opening/latch and crossing progress in the host checkpoint. Legacy checkpoints without jobs retain their legacy finish behaviour. New starts/restarts use the new jobs. On restored checkpoints, input/interaction holds clear as before; disconnected inventories are returned.

Implementation units: deck-jobs.ts authoritative rules and NPC objectives; deck-jobs-scene.ts deck props/carried items/fish/rope/winch; survival.ts and mission.ts narrow integration; HUD prompts and task states. Tests cover location checks, held work interruption, simultaneous users, material return, legacy/restart, solo and crew gate crossings, fish hazards and secure protection, and host restore. Browser checks use the real scene and keyboard/touch actions. Existing survival and classic tests remain required.

No new game modes, currency, crafting economy or deployment are implied by this change.
