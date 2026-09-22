# Party Mode implementation — 22 September 2026

The improvements approved in the [UX audit](party-mode-ux-audit-2026-09-22.md) are implemented in the local working tree. The flow now follows: invitation → compact crew → ready → game briefing → shared play → explained results → human vote → next briefing → recap and rematch.

| Area | What changed |
| --- | --- |
| Fairness | Forfeits receive zero. Cooperative success gives participating finishers a shared +6 bonus; failed goals give zero. Team win/draw/loss gives +10/+6/+3. Only successful finishes rank in individual rounds. Helpers neither vote nor appear in human standings. Solo sessions are labeled practice. |
| Joining | Invitations lead directly to joining; an explicit new invitation takes precedence over a saved room. Host and join forms share identity controls and submit with Enter. Colors have accessible names and selection states. Invitations support native sharing and a copy fallback. |
| Lobby | Compact roster, visible connection/readiness, and a persistent primary action. Every connected human must be ready. Empty seats are clearly described as game helpers. Narrow and landscape layouts handle long names. |
| Pacing | Quick Party offers three existing shorter games; Classic offers six. Duration estimates and complexity are shown. Openers are easy to learn, and voting avoids consecutive tricky selections. Shared breaks freeze between-round timers. |
| Teaching | Each round explains the objective, scoring, actual team/role, and controls before play. Everyone gets at least five seconds to read and explicitly readies up. Round assignment order rotates, including teams and Four Brain Cells limb roles. Help remains available during the game. |
| Shared play | One compact party bar owns voice, standings, help, recovery and confirmed forfeiting. Conflicting game setup/reset/team actions are hidden and blocked by the engine. The clock waits for game connections. Controller input goes to the active game or party dialog. |
| Recovery | Authenticated heartbeats show missing players after 20 seconds, transfer party leadership and preserve seats and points. A 60-second reconnect grace prevents indefinite round waits. Party voice also retains membership through brief loading interruptions. Failed launches show a bounded retry path. Removed guests return to entry. Expired game authority no longer immediately destroys a party host’s seat. |
| Voting | Three readable choices with mode, estimated duration and complexity; human votes only. The 15-second window remains, with optional unanimous lock-in after five seconds. Overall standings stay visible. The selected game leads directly into its briefing. |
| Results | Skipped rounds and failed goals receive truthful headings. Team scores and goal results explain awarded points, totals and rank movement. The game ending remains visible briefly before returning. The finale includes round recaps and rematch interest. Exit to collection goes to `/`. |
| Polish | Consistent lightweight character portraits, English/German party copy, focus management, reduced motion, and quiet audio cues honoring the site volume. Party analytics record progression, votes, missed votes, help, retries, forfeits, completion and rematch intent through the existing anonymous tracker. |

The phone-sized lobby now fits a 390 × 844 viewport, compared with the audit’s 1,858-pixel-tall lobby. Entry, in-game party controls and results also fit that viewport. All three voting choices are visible together; the full voting page measured 848 pixels tall. The longer briefing and finale scroll, with the primary action kept accessible. A separate check confirmed the final expanded result can be read above the rematch footer.

## Verification

| Check | Result |
| --- | --- |
| Targeted automated tests | **159 passed, 0 failed** across party flow/scoring/presence, peer and voice recovery, game controls, result contracts, invitation URLs, controller routing, Four Brain Cells roles and analytics catalog. |
| TypeScript, lint and architecture | Passed. Architecture inspection covered 1,148 files, 4,019 local imports and 89 client entries. |
| Production client build | Passed. Existing large-chunk and wardrobe import warnings remain nonfatal. |
| Complete party walkthrough | Passed on desktop and a 390 × 844 browser viewport: invitation, Enter submission, readiness gate, briefing, shared break/resume, shared game, party menu from the embedded collection link, cancel/confirm forfeit, zero-point results, three-card voting, lock-in, next briefing, failed-launch recovery, another invitation, finale, rematch interest and collection exit. No JavaScript exceptions or horizontal overflow. |
| Current game catalog | All **21 games** entered the shared round in the matrix; 20 returned successfully in that run. Zorb’s screenshot step timed out after entry. Its dedicated two-browser integration subsequently passed entry, shared state, reload and return, giving successful entry/return coverage for all 21 across runs. Wrong Floor also passed a final repeat after its standalone Leave control was removed. |
| Voice continuity | Dedicated Crane Clash and Zorb Clash integrations passed cross-frame push-to-talk, host game reload and keeping both browser voice identities into intermission. The final Zorb run logged three expected requests rejected after forfeiting; no unexpected errors. |
| Edge cases and layout | Passed 320 × 568 and 844 × 390 long-name lobby checks without horizontal overflow; manual keyboard/touch help switching; four-human raw-score recap and rank movement; offline feedback and removed membership. German entry was checked at 320 pixels wide. All 21 briefing/vote image paths exist. |

Browser tests used the production client bundle and production party, peer and voice coordinators with isolated in-memory storage. Later rounds, final standings and failure states included controlled fixtures. Phone-sized Chromium windows establish layout behavior; they are not physical-device tests. The game matrix and focused integrations are separate runs, not one uninterrupted green batch.

The repeatable two-browser test is [party-browser-integration.mjs](../scripts/party-browser-integration.mjs). Local walkthrough scripts and detailed logs are in the ignored `.tmp/party-ux-audit/` and `.tmp/party-improvements/` directories.

## Screenshots

- [Invitation](party-mode-implementation-2026-09-22/01-invite-phone.png) and [compact lobby](party-mode-implementation-2026-09-22/02-lobby-phone.png)
- [Single party bar during play](party-mode-implementation-2026-09-22/05-game-phone.png) and [all three vote choices](party-mode-implementation-2026-09-22/07-vote-phone.png)
- [Actionable launch failure](party-mode-implementation-2026-09-22/08-launch-recovery.png)
- [Final standings](party-mode-implementation-2026-09-22/finale-top.png) and [expanded round recap](party-mode-implementation-2026-09-22/finale-details.png), using a four-person fixture

## Remaining real-world validation

Automated checks establish behavior and layout, not whether a group finds an evening fun. Playtest novice groups of two, three and four people, including mixed physical phones and computers and different networks. Observe invitation-to-first-action time, requests for instructions, missed votes, quits, completion, session length and rematch interest. Use those observations to tune the Quick Party pool and the duration estimates.

Physical touch ergonomics, real controllers, real microphone quality and Internet NAT/TURN behavior still need that device testing. Browser game checks exercise entry, shared state and return; they do not play every game to natural completion or establish frame-rate performance on phones.

## Review locations

- [Party flow and UI](../app/party/PartyClient.tsx), [screens](../app/party/PartyScreens.tsx), [results and briefing details](../app/party/PartyDetails.tsx)
- [Coordinator and presence](../platform/party/coordinator.ts), [scoring](../platform/party/scoring.ts), [round assignments](../platform/party/flow.ts), [game guides](../platform/party/guides.ts)
- [Shared game bridge](../shared/ui/PartyRibbon.tsx), [party regression tests](../platform/party/improvements.test.ts), [two-browser integration test](../scripts/party-browser-integration.mjs)

No deployment or commit was made. Existing unrelated working-tree changes were preserved.
