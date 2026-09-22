**Party mode: UI, UX and fun review — 22 September 2026**

**Verdict:** the core idea is good. Shared games, persistent party voice, silly physical challenges, a podium and a three-game vote can make a strong evening with friends. The current experience needs work on fairness, onboarding and continuity before it feels like a polished tournament. More games or more visual effects would have less impact than fixing those fundamentals.

The largest design mismatch is that the games now share one multiplayer world, while parts of the tournament experience still behave like a comparison of independent attempts. Cooperative rounds produce identical results, lobby bots do not compete for tournament points, and standalone game controls remain available inside the tournament.

This is a review of the current local working tree. I built the installed/web client and exercised the actual party components against the production party, peer and voice coordinators with isolated, in-memory storage. Desktop inspection used 1440 × 1000; phone inspection used Chromium emulation at 390 × 844, with additional entry/lobby/voting checks at 320 × 568 and 844 × 390. Four-person scoring, later-round and final-result scenarios used controlled fixtures. The recommendations about enjoyment are design judgments supported by these observations, rather than the result of a four-person playtest or a physical-phone performance test.

**What I would keep**

- The friendly clay characters, soft colors, clear primary buttons and playful game concepts.
- A room code and link that keep the group together through different games.
- The persistent party voice session and automatic return from games to the party.
- Three next-game candidates, visible selection and the ability to change a vote.
- Excluding already-played games from the ballot and resolving a tied vote together.
- A round podium followed by a tournament finale. Shared places are a sensible representation of real ties.

**Priority order**

| Priority | Change | Why it comes first |
| --- | --- | --- |
| P1 | Make points, forfeits and tournament controls fair | A championship needs credible results. |
| P1 | Give the party reliable recovery and a clear exit from failed loading | One missing person can hold the group up. |
| P1 | Consolidate the party and game controls | Current controls overlap and expose conflicting actions. |
| P2 | Shorten the mobile joining and lobby flow | Players should reach their friends and the start button quickly. |
| P2 | Teach the objective, controls and assigned role before each game | Automatic entry currently skips important explanation. |
| P2 | Curate round length and explain cooperative versus competitive scoring | Six games should have a predictable pace and purpose. |
| P2 | Improve voting and results for small screens | Choices and progress need to remain readable under time pressure. |
| P3 | Polish identity, wording, localization, keyboard behavior and party audio | These make the whole experience feel consistent. |

**1. Fix the scoring before polishing the podium**

Reproduced with the actual coordinator:

| Scenario | Current result |
| --- | --- |
| Four humans all give up a goal-based round | Everyone receives **5 points**. |
| One human with three lobby bots gives up a goal-based round | The human receives **10 points** and first place. |
| Two humans both fail the same cooperative goal with zero score | Each receives **8 points**. |
| Two humans both give up Crane Clash | Both receive zero, but the podium announces that they share first place. |

The first two are fairness defects. Awarding the same points for a shared cooperative failure is a design choice, but the current celebratory first-place presentation does not explain that choice. Ranking alone cannot tell the story of a cooperative outcome.

I would give an explicit forfeit zero points, distinguish “Round skipped” from a genuine draw, and show the result before the reward: for example, “3 bags approved — target missed” or “Blue team won 7–4 — +10 points.” Explain the tournament rules in the lobby and make them available from the standings.

Bots also need one consistent purpose. New tournaments award points to humans and omit bots from round podiums, yet bots vote and return in the final podium. In a zero-score final fixture, the heading said “Alex Wins!” while the podium said Alex and all three bots shared first place. My recommendation is to treat bots as clearly labeled game helpers, omit them from human standings and human voting, and describe a one-person session as practice. Alternatively, build actual bot tournament participation before presenting them as championship rivals.

Evidence: [a quit earning +10 points](party-mode-ux-audit-2026-09-22/16-solo-quit-reward.png), [contradictory final winners](party-mode-ux-audit-2026-09-22/24-zero-score-bots-finale.png). Sources: [round scoring](../platform/party/coordinator.ts#L447), [goal ranking](../platform/party/scoring.ts), [podium](../app/party/PartyPodium.tsx), [finale](../app/party/PartyClient.tsx#L830).

**2. Lock actions that can invalidate a tournament round**

Bungee Doubles still displays **Switch Team** and **Reset** while playing a party round. An engine reproduction with party mode active let a guest switch from the losing blue side to red with the score at 6–1, then reset the score to 0–0. These are accepted actions, not merely decorative buttons.

Lock teams and restarts for an active tournament round in the game rules as well as the UI. Allow an intentional group/host restart only through the party flow, with a clearly defined effect on scoring. Set and reveal partners before the round. The current shared-game adapters generally assign sides by joining order; the legacy partner-rotation helper is not used by the new scoring path. Deliberately rotating partners and asymmetric roles would provide more variety.

Evidence: [Bungee controls inside party mode](party-mode-ux-audit-2026-09-22/game-bungee-doubles-mobile.png). Sources: [Bungee actions](../games/bungee-doubles/simulation.ts#L276), [Bungee UI](../games/bungee-doubles/Game.tsx#L683), [party scoring path](../platform/party/coordinator.ts#L515).

**3. Make failure and recovery part of the party flow**

Several important states currently have no useful next step:

- A forced round-session failure leaves a large **0** and “Launching game for all 4 players…” on screen. The client records the connection error but does not render it in this view.
- Taking a lobby offline leaves the lobby looking connected. Its retry message is only passed to the intermission component.
- Opening an invitation to room B with an existing room-A session restores A. I reproduced a room code on screen that did not match the invitation URL.
- Removing a guest leaves that guest looking at the old lobby. Clicking Ready produces “Rejoin from the party page,” even though they are already on the party page.
- The party coordinator transfers leadership on explicit Leave, but has no equivalent party-presence recovery when a host simply disappears. A guest who has reported a result can remain waiting for that host; only the host has the close-round control. The game's own host recovery does not resolve that separate party state.

Use a shared connection/status area in every phase, a bounded loading/rejoin path, visible player presence, and automatic party leadership transfer after a reconnect grace period. Distinguish loading, disconnected and finished players. Preserve the seat and score when reconnecting. If continuing is impossible, offer a concrete action such as “Retry round” or “Return to lobby.” A new invitation should take precedence over silently restoring a different room.

The live entry sweep also stalled on Panic Curling and Zorb Clash. Panic Curling passed on retry; Zorb Clash again failed the 25-second startup-overlay check and returned expired-connection/pass responses. This is a repeatable failure in the local mixed desktop/mobile test setup. Its cause is not isolated, so it should be investigated without assuming the same performance on a physical phone or a deployed server.

Evidence: [failed launch with no visible error](party-mode-ux-audit-2026-09-22/23-launch-error-hidden.png). Sources: [restoring sessions](../app/party/PartyClient.tsx#L125), [countdown view](../app/party/PartyClient.tsx#L780), [party departure](../platform/party/coordinator.ts#L224), [waiting for results](../platform/party/coordinator.ts#L547).

**4. Give the player one coherent set of party controls**

The parent party page has “Give up round · Back to party.” The embedded game adds its own tournament ribbon with another Give Up button and Standings, followed by the game's own toolbar, room controls and HUD. The inner Give Up asks for a second tap; the outer one immediately forfeits. Those two actions look related but behave differently.

Some games also expose their separate game-room invite code and “Leave room · Play solo.” These are confusing inside an already established party, and party-reserved rooms reject ordinary joining. Every invite action during a tournament should share the party invitation.

Use one compact party bar with round progress, standings, voice and an options menu. Put a single, clearly confirmed forfeit action in that menu. Keep camera, sound and contextual game actions accessible without placing another toolbar over them. Game-specific room creation, invitation and solo-exit controls should not appear in the tournament.

The phone shell currently reserves **116 pixels** above the game. The second ribbon then occupies roughly another 80 pixels and overlaps the game's top controls. At 390 × 844, this is a major cost to the play area. I observed this across several games, not only Crane Clash.

Evidence: [Crane Clash on a phone](party-mode-ux-audit-2026-09-22/09-game-mobile.png). Sources: [outer game shell](../app/party/PartyClient.tsx#L481), [inner party ribbon](../shared/ui/PartyRibbon.tsx), [shell spacing](../app/party/party.css#L611), [standalone room controls](../shared/peer/PeerRoomControls.tsx).

**5. Make joining and readiness much simpler on phones**

An invitation pre-fills the room code, but still leads with the large Create a Waiting Room panel. At 390 × 844 the actual Join button is below the first screen. The host lobby measured **1,858 pixels tall**: four vertically stacked player cards and six round-preview tiles push Start Tournament near the bottom. The two bottom actions wrap into bulky, adjacent blocks.

The additional 320-pixel lobby check with long names expanded the page to 328 pixels; the 844 × 390 landscape lobby required 1,273 pixels of vertical content. The layout needs explicit narrow-phone and landscape treatment as well as the compact 390-pixel redesign.

For an invitation, show “Join Alex's party,” the player's identity and one Join button. On the general entry page, show a simple Host/Join choice with one shared identity editor. In the lobby, use compact rows or a two-column roster, a smaller invite area and a persistent primary action. Replace five identical “You decide by vote” tiles with one short explanation.

Readiness also needs an honest contract. The copy requires four players; the start button and server require only two occupied seats and fill the remainder with bots. An unready guest does not prevent starting. A host already marked ready is told to wait for “the host.” I would require every connected human to be ready, explain that empty places are filled automatically, and let the host's primary action read “Start with 2 players + 2 bots.” If readiness is only informational, remove the implication that it gates entry.

Evidence: [mobile invitation](party-mode-ux-audit-2026-09-22/04-invite-mobile.png), [mobile host lobby](party-mode-ux-audit-2026-09-22/06-lobby-host-mobile.png). Sources: [entry and lobby](../app/party/PartyClient.tsx), [start conditions](../platform/party/coordinator.ts#L358), [mobile roster layout](../app/party/party.css#L262).

**6. Introduce each game before starting its clock**

The party intro provides the game name and “Starting match…”. The shared party stylesheet suppresses many normal game-start screens. The outer countdown offers a tagline, but no consistent win condition, role explanation or controls lesson. A newcomer must learn a different control scheme while the round is already running.

Add a short, consistent briefing that answers four questions: **What am I trying to do? Who am I playing with or against? What are my main actions? How does this round award points?** Show the actual touch, keyboard or controller inputs in use. Give everyone a brief shared preparation window, with a quicker Ready option for groups who already know the game. Keep Help reachable during play.

For role-based games, explicitly introduce the job: “You operate the crane; Sam grabs the crates,” or “You control the robot's right hand.” A title and a picture cannot explain those assignments. A small first-action prompt would help more than a longer rules paragraph.

Sources: [party intro](../shared/ui/PartyRibbon.tsx#L350), [suppressed start screens](../shared/ui/party-ribbon.css#L3), [game-role assignment](../games/crane-clash/peer.ts#L41).

**7. Design the pace of an evening**

The selection includes three-minute games, **six-minute Four Brain Cells**, **eight-minute Tiptoe Thieves**, **five-minute Reel Problems**, multi-stage Wrong Floor and score-limited matches. There is no displayed total-duration expectation or short-party option. “Six mini-games” can therefore mean a substantial commitment with repeated learning breaks.

Between rounds the scheduled sequence takes **25 seconds**, or **29 seconds with a tied vote**: four-second podium, fifteen-second vote, optional four-second tie resolution, two-second reveal and four-second countdown. Across five transitions that is 125–145 seconds before actual game-loading time. The fifteen-second voting window is intentional and useful for reading; the extra ceremony around it is where I would first look for duplication.

I would offer a small, curated Quick Party and retain the six-round session as the longer option. Quick versions need genuinely shorter objectives, not just abrupt cutoffs. Show approximate duration and complexity when choosing games. Avoid strings of mechanically demanding games and make the first game easy to understand. Combine the winning-game reveal and launch countdown with the briefing, and provide a shared break between rounds.

Keep cooperative games in the mix for relief and shared laughs, but label their points as a shared challenge bonus. Competitive rounds can then clearly determine individual standings. A successful or failed shared world should not pretend to establish an individual skill ranking. Choose partners and roles deliberately across the session.

Sources: [intermission durations](../platform/party/intermission.ts#L5), [Six-minute breakfast](../games/four-brain-cells/types.ts#L4), [eight-minute night](../games/dont-wake-the-giant/types.ts#L101), [five-minute fishing](../games/reel-problems/types.ts#L5), [game catalog](../platform/party/playlist.ts).

**8. Make voting a fair, informed choice**

The three-card structure is good. However, the mobile voting page measured 972 pixels tall, so the third card's full content is below an 844-pixel screen while the fifteen-second timer is running. The voice button overlaps the round badge. At a 112-pixel thumbnail width, full-screen gameplay images with tiny HUD text communicate relatively little.

Bots vote immediately. In the two-human session, one game already had two votes before either human voted; the counts did not identify those as bot votes. This lets arbitrary bot choices oppose the friends' preference. Let human votes decide; use randomness when nobody chooses.

Make all three options easy to compare in one phone viewport, keep the timer visible, and show a compact mode/duration/complexity label. Use a clearer gameplay crop that emphasizes the activity. Keep vote confirmation obvious and announce the chosen game. If speeding up unanimous voting, offer an explicit lock-in after a minimum reading period so late readers do not lose their chance to choose.

Some descriptions should be corrected immediately:

| Game | Current party description | Better explanation |
| --- | --- | --- |
| One More Button | Reactor sabotage and quick reflexes | Press for a bigger prize, survive the added hazards and cash out. |
| Reel Problems | Dockside crane fishing | Fish together from an unstable boat; reel, untangle and rescue friends. |
| Zorb Clash | Bumper sumo | Bumper football: score with the ball while knocking opponents around. |
| Four Brain Cells | Breakfast with clumsy tools | Four players control different limbs of one robot cooking breakfast. |
| Load Bearing | Precision demolition | Bring down the building while keeping the piano intact. |

The first three misdescribe the activity; the last two omit the mechanic that makes the game interesting.

Evidence: [mobile voting](party-mode-ux-audit-2026-09-22/14-voting-mobile.png). Sources: [voting UI](../app/party/PartyIntermission.tsx), [bot votes](../platform/party/intermission.ts#L79), [party descriptions](../platform/party/playlist.ts).

**9. Make the results tell a story**

Currently the podium emphasizes placement and points, with cumulative totals in small text. It does not explain the underlying game result, the assigned teams or how overall positions changed. The game is removed as soon as the report is saved, so its own ending can disappear before the group understands what happened. The round celebration lasts only four seconds, including its entrance animation.

Show a concise result line, points earned, the new total and movement in the tournament. Carry a compact overall leaderboard into voting so players can still read it. Use the established characters or light avatar portraits instead of replacing players with generic lobby icons and different smiley shapes on the podium. Let non-winners receive occasional truthful highlights such as a rescue or close finish, where the game actually tracks them.

For the finale, add a small round-by-round recap and clear rematch intent from the whole group. The current “Exit to Collection” button only clears the local party state and shows the party creation screen; it does not navigate to the collection. Fix the destination or rename the button. “Play Rematch (New 6 Games)” returns to the lobby, so “Back to lobby for a rematch” would be more accurate.

Evidence: [current mobile finale](party-mode-ux-audit-2026-09-22/18-finale-mobile.png). Sources: [automatic result return](../shared/ui/PartyRibbon.tsx#L285), [podium](../app/party/PartyPodium.tsx), [final actions](../app/party/PartyClient.tsx#L863).

**10. Finish the small details that repeatedly interrupt the experience**

- Use “6-character code,” because generated codes contain digits. Provide native sharing or a QR option for people sitting together, plus a clipboard-failure fallback.
- Make Enter submit the host/join form. Give the color choices meaningful labels and a programmatically exposed selected state. Let guests choose their appearance without using the Create panel; both ordinary test players otherwise defaulted to the same gold color.
- Translate the whole party flow using the existing language preference. Currently the mascot copy can be German while headings, actions, errors, voting and results remain English.
- Reset the inherited heading tracking and alignment for party screens. The broad game `h1` rule contributes very tight lettering and left alignment even inside intended centered layouts.
- Keep the good keyboard focus styles and reduced-motion treatment in voting; extend reduced-motion support to the countdown and ribbon animations, and manage focus/announcements when screens change.
- Add restrained vote, countdown, result and victory sounds that honor the existing mute setting. The party components currently provide no dedicated party sound cues. Keep voice clear during those moments.

Sources: [entry controls](../app/party/PartyClient.tsx#L550), [global heading rule](../shared/styles/game-ui.css#L58), [party animation styles](../shared/ui/party-ribbon.css), [intermission accessibility](../app/party/PartyIntermission.tsx).

**The experience I would aim for**

Join friends → see a compact roster and expected session length → ready together → learn the next objective and role → play → understand the result and points → vote → continue → see a useful tournament recap and choose a rematch together.

I would implement the fairness and recovery work first, then the single party bar and compact mobile lobby, then the briefing/results/pacing changes. Character reactions and extra celebration should come after the group can reliably get in, understand the rules and trust the winner.

To validate enjoyment, run novice groups of two, three and four humans, including a mixed phone/desktop group. Measure invitation-to-first-action time, how often someone asks what to do, missed votes, quits per game, total session length, completion and rematch intent. Observe whether players laugh at the game or spend their time explaining the interface. Those observations would decide the final quick-party length and starter-game pool.

**Verification and coverage**

- Fresh client production build completed successfully.
- All **40** targeted party, intermission, shared-round and result-contract tests passed.
- All **20** catalog entries were attempted in the browser matrix. **18 passed on the first sweep**; Panic Curling passed on retry, giving **19 successful entry/return flows across runs**. Zorb Clash stalled on both attempts with session-expiry responses. The two initial failures did not produce JavaScript exceptions.
- The dedicated two-browser Crane Clash integration passed shared human seats, cross-frame push-to-talk, reloading the host's game and keeping the voice session into intermission. An earlier run overlapping the heavier game sweep failed its two-human checkpoint assertion; the isolated repeat passed. This is evidence across runs, not a claim of an uninterrupted green integration batch.
- Browser walkthrough covered collection entry, creation, invitation, two-human start with an unready guest, automatic game entry, giving up, waiting, podium and voting on desktop and phone-sized screens.
- Controlled fixtures covered all six tournament round transitions, final standings, exit behavior, removed membership, opening a different invitation, a missing host, offline lobby and failed round-session loading.
- Narrow-screen and landscape checks confirmed the long lobby/voting layouts. Keyboard Enter did not submit the host form, selected colors lacked an exposed pressed state, and German preference produced mixed German/English party copy.
- Coordinator reproductions established the forfeit-point cases; the Bungee engine reproduction established active-round team switching and guest resetting.
- The game-entry matrix used two independent browser contexts per game, one desktop and one phone-sized. It checks entry, visible game UI and return to the podium. It does not establish that all twenty games were played to completion, that every mechanic feels good, or that physical-device/network performance is acceptable.
- Application source was not changed for this review. Reproduction scripts and raw browser observations are in the ignored `.tmp/party-ux-audit/` folder; selected screenshots are alongside this report.
