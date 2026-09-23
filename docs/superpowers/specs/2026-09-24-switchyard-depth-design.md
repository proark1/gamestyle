# Switchyard: station challenges

Switchyard is a 310 metre alternate Chain of Fools map for a four worker crew. The demolition map remains unchanged. Each six minute attempt starts at the entrance after a full crew wipe.

## Route

| Distance from entrance | Station challenge                    | Clue and team decision                                                                                   |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0–24 m                 | Two floor plates open the first gate | Split the chain across two pads without pulling a worker away.                                           |
| 24–85 m                | Exposed girders, then four plates    | Clip and haul at the gaps, regroup, then put all four workers on separate pads.                          |
| 85–120 m               | Three step climb                     | Jump up each rising crate onto the elevated conveyor.                                                    |
| 120–163 m              | High conveyor with a lane swap       | Cross two breaks on the left, change lanes on the wide deck, then cross two on the right.                |
| 163–175 m              | Three level descent                  | Step down in sequence to the entrance to the lower road.                                                 |
| 175–195 m              | Lower rescue station and two plates  | Drop to the low catwalk, clear its gap, rescue fallen workers, then hold both low plates simultaneously. |
| 195–214 m              | Numbered relay                       | Climb out, then press 2, 1, 3 with three different workers, releasing each plate before the next step.   |
| 214–274 m              | Anchor run and powered bridge        | Cross two gaps, split onto two plates, and raise the missing bridge for the crew.                        |
| 274–310 m              | Alternating final crossing           | Regroup and bring every worker across the final break and finish line.                                   |

## Rules and feedback

The four simultaneous gates latch after their own pads are held for 1.2 seconds. The lower station checks the worker's height so standing directly above a plate cannot charge it. The bridge is absent from rendering and collision until its two plates open the fifth gate. The numbered relay records workers who charged each stage and rejects reuse. A plate already held when its stage begins must be released and pressed again. Its current target glows blue; occupied plates turn green. Each distinct station has a sign and localized HUD hint. Gate, relay, bridge, and checkpoint state is shared through the existing peer world snapshot.

## Bot practice and verification

Bots stage at each bank, fill unoccupied crew plates, and assign a different available bot to each relay step. They navigate the climb and descent with level aware jump decisions, then wait to work the bridge before crossing. Tests cover low plate height, bridge collision state, gate blocking, relay order and distinct workers, simultaneous plate bypass, peer map selection, and a complete four bot run. Typecheck, lint, production build, and a browser render complete the release check.
