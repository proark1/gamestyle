# Switchyard: extended team route

Switchyard is a 310 metre alternate Chain of Fools map for a four worker crew. The demolition map remains unchanged. Switchyard takes six minutes per attempt, with a full crew wipe returning everyone to its entrance.

## Route

| Distance from entrance | Challenge | Team decision |
| --- | --- | --- |
| 0–24 m | Two floor plates open the first gate | Split the chain without pulling a worker off a plate. |
| 24–85 m | Exposed girders, then four plates | Jump in order, rescue falls, and regroup on all four plates. |
| 85–163 m | Broken conveyor with two lane changes | Use the wide decks to change lanes before the narrow jumps. |
| 163–214 m | Rescue split and relay bank | Clip or brace near the gap, then bring three workers to the relay. |
| 214–224 m | Numbered relay | Press 2, then 1, then 3 with a different worker at each stage. Release a plate before charging the next stage. |
| 224–310 m | Anchor run and final crossing | Cross the alternating lanes and bring every worker over the finish line. |

## Rules and feedback

The first two gates latch after all their plates are held for 1.2 seconds. The relay records the IDs of workers who charged each stage and rejects reuse. A plate already held when its stage begins must be released and pressed again. The current relay plate glows blue; occupied plates turn green. Signs and HUD prompts show the required order and worker count. Gate, relay, and checkpoint state is shared through the existing peer world snapshot.

## Bot practice and verification

Bots stage at each bank, fill unoccupied crew plates, and assign a different available bot to each relay step. The lead bot aims for the next lane while still on a wide deck. Tests cover supported landings, gate blocking, relay order and distinct workers, simultaneous plate bypass, peer map selection, and a complete four bot run. Typecheck, lint, production build, and a browser render complete the release check.
