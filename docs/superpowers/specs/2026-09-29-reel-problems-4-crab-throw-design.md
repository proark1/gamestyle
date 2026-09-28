# Reel Problems 4 Crab Pickup and Throw

## Goal

Give every voyage an immediate physical interaction: a crab begins on the deck, a player can pick it up, carry it, and throw it overboard.

## Gameplay

- Each new Reel Problems 4 voyage starts with one crab on the deck.
- A player within grabbing distance presses `C` to pick it up.
- The carried crab is shown in the player's hands and cannot move or pinch.
- The carrier can walk normally but cannot start another contextual `C` interaction until the crab is released.
- Pressing `C` again throws the crab over the nearest side of the boat. The client shows a short outward arc and splash, while the authoritative simulation removes the crab immediately.
- Jump-stomping remains a second, less controlled way to remove a loose crab.
- Later catches may still bring another crab aboard through the existing random event.

## Multiplayer State

The existing crab state gains an optional carrier player ID. The host validates pickup range and ownership. A carried crab follows its carrier in authoritative snapshots, so all clients render the same result and two players cannot grab it simultaneously.

If the carrier leaves, falls overboard, becomes downed, or the boat sinks, the crab is released. It returns to the deck when that is still valid; otherwise it is removed with the wreck.

## Controls and Feedback

`C` remains the contextual interaction key:

- Near a loose crab: **Pick up crab**
- While carrying it: **Throw crab**
- Otherwise: the existing trader, repair, salvage, and module interactions

The action dock and keyboard hint expose the current crab action. Pickup and throw announcements use the existing crab audio family; throwing uses the current overboard crab animation plus a splash.

## Compatibility

The change is isolated to Reel Problems 4. Reel Problems 1 physics and behavior remain unchanged. Fishing, helm, paddle, repair, crafting, salvage, and rescue controls keep their current mappings.

## Verification

- A fresh voyage always contains a loose crab.
- Only a nearby player can pick it up, and only one player can carry it.
- The crab cannot pinch or wander while carried.
- `C` throws the carried crab overboard and clears authoritative ownership.
- Disconnect, overboard, and sinking cases cannot leave a stuck carrier reference.
- Checkpoint migration accepts older crab state without a carrier field.
- Simulation, snapshot, multiplayer invariant, type, lint, and browser interaction checks pass.
