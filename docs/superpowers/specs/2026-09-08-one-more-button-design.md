# One More Button

The user's brief is a four-player game-show room where pressing one shared button adds both money and an increasingly absurd physical hazard. Implement it as another Jumbleyard game, retaining toy proportions, teal/mustard/terracotta/purple colors, Fredoka and DM Sans, illustrated collection card, shared toolbar and crew flow.

The round lasts three minutes, followed by 25 seconds to escape. The first contestant cashing out can start that escape early. Each press adds $500 plus $250 per previous press, creates one hazard, and locks the exit for five seconds. A 2.2-second recharge prevents repeated inputs from skipping consequences. The sixteen-press cap is $38,000. These are fictional prizes.

Hazards cycle through conveyor, boxing glove, soap and spinning sofa, using additional positions each cycle. They remain visible for the rest of the round. Yellow lanes telegraph gloves; their rendered path is shared with collision rules. Gloves launch everyone in their path, conveyors push, soap reduces traction, and sofas sweep the floor. Jumping clears sofas. Players have three lives, brief collision immunity, visible daze, and a nearby help action. A punch and its immediate resulting fall cost one life together.

Players move to the exit and explicitly cash out. Their winnings are the current pot divided by the original crew size. Banked shares remain safe, even if a banker disconnects. Eliminated or stranded contestants forfeit their shares. The final clock cannot be extended by another press. Show outcomes include per-player winnings, total banked, press count and last presser; only the host can start and restart.

WASD/arrows move, Space jumps, E presses, Q shouts STOP, F helps, X exits, and V switches camera. Touch joystick and actions provide the same controls. Solo practice uses the same simulation with one player; online rooms support up to four human contestants and the existing direct voice panel.

Keep code in `games/one-more-button`, routes in `app/one-more-button`, and register the peer adapter and sound catalog in platform composition. Use shared room identity, peer transport, host checkpoints, toolbar, touch gestures and rendering primitives. No schema changes or external services. Dynamically load the scene and adapter. Batch static scenery; dispose renderer and local resources on unmount. Limit HUD updates independently of animation.

Validate actual button risk, proximity and host permissions, all four hazards, a four-person glove launch, locomotion to a real cash-out, timer/exit interactions, stable banked amounts, jump/help, reset, deterministic frame stepping, checkpoint/idempotency and four real WebRTC clients with direct voice and host recovery. Preserve other tasks' changes in the shared checkout. Production publishing is separate from this existing-site implementation request.
