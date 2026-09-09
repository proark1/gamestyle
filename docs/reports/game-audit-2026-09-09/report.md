# Jumbleyard — audio, NPC and lobby audit

Follow-up: the four requested libraries have since been generated and published. See the [completed audio expansion and updated eleven-game table](../audio-expansion-2026-09-09/report.md). The findings below preserve the original pre-expansion snapshot.

Audited 9 September 2026. Public manifest snapshot: 2026-09-09T02:10:01.340Z. Scope: all **11 games** in the current collection working tree, compared with the published audio APIs at [Jumbleyard](https://jumbleyard.up.railway.app).

**Not every game has enough audio.** Five have broad recorded coverage, two have smaller complete core libraries, two rely on thin synthesized feedback, Wrong Floor has a richer procedural sound system, and Brick by Hand has no published audio or fallback. File availability is a coverage measure; this report does not certify listening quality.

**NPC totals:** **5/11** games implement computer-controlled player slots. **8/11** contain non-player characters when reactive enemies, gameplay wildlife and the scripted inspector are included. NPC slot behavior and lobby capabilities below are verified in current source and focused local tests, not an eleven-game live multiplayer playtest.

## Game-by-game comparison

“Files” counts distinct published playback URLs per game, including selected bundled defaults and explicitly used shared cues. A cue is a named sound event/slot, not necessarily a separate recording. Procedural audio is listed separately and counts as zero files.

| Game | Files | Recorded / bundled | Covered / current cues | NPC player slots | Assessment |
| --- | --- | --- | --- | --- | --- |
| Wrong Floor | 0 | 0 / 0 | 0 / 26 | Yes — automatic fill, up to 3 | Functional synthesized coverage; recorded library empty |
| One More Button | 28 | 0 / 28 | 28 / 28 | No | Enough for the current core design |
| Four Brain Cells | 0 exposed* | 0 / 0 | 0 / 11 | Yes — add/remove/fill, up to 3 | Thin fallback; live audio library unavailable |
| Reel Problems | 0 | 0 / 0 | 0 / 13 | No | Basic fallback; audio needs expansion |
| Stack or Sink | 121 | 121 / 0 | 121 / 121 | No | Broad coverage; enough assets on paper |
| Blend Business | 77 | 76 / 1 | 77 / 77 | Yes — add/remove/fill, up to 3 cows | Broad coverage; enough assets on paper |
| Shelf Control | 15 | 10 / 5 | 15 / 15† | Yes — add/remove; fill-and-start, up to 3 | Core covered, but small and shared |
| Uphill Delivery | 74 | 74 / 0 | 74 / 74 | Yes — add/remove/fill, up to 3 | Broad coverage; enough assets on paper |
| Tiptoe Thieves | 70 | 65 / 5 | 70 / 70 | No NPC thief teammates | Broad coverage; enough assets on paper |
| Permit Pending | 344 | 344 / 0 | 344 / 344 | No NPC builder teammates | Broadest library; enough assets on paper |
| Brick by Hand | 0 | 0 / 0 | 0 / 61 | No | Critical audio gap |

*Four Brain Cells returned **404 “Game not found”** for its live audio endpoint. Its 11-cue catalog exists locally; storage contents cannot be inferred from that failure. Wrong Floor, Reel Problems and Brick by Hand returned successful but empty manifests.

†Shelf Control has no independent workshop catalog. The denominator is its **15 runtime-relevant cues**: 5 bundled entries, 9 farm gameplay effects, and the shared player’s UI click. All 10 borrowed recordings are also counted under Blend Business.

There are **719 distinct published audio URLs across the collection**. Per-game totals sum to 729 because Shelf Control reuses 10 farm recordings. This measures distinct paths, not unique acoustic content; separately saved files may still sound alike. The checkout has 41 bundled audio files and 70 locally stored generated Stack or Sink files. Local disk counts alone therefore substantially understate production audio. Two bundled backups are superseded by generated recordings in the current manifests.

## What those files cover

These are available cue slots by the catalog’s categories, with material and event combined as effects. Farm/giant footsteps and some physical sounds are classified as events in the code. Zeros here refer to published files, not synthesized audio.

| Game | Effects | Ambience | Music | Speech | Procedural sound when files are absent |
| --- | --- | --- | --- | --- | --- |
| Wrong Floor | 0 | 0 | 0 | 0 | 26 layered Foley recipes + room ambience |
| One More Button | 22 | 3 | 3 | 0 | No general procedural fallback identified |
| Four Brain Cells | 0 | 0 | 0 | 0 | 11 event kinds; short synthesized tones |
| Reel Problems | 0 | 0 | 0 | 0 | 13 event kinds; tones and weather/wildlife noise |
| Stack or Sink | 102 | 4 | 8 | 7 | No general procedural fallback identified |
| Blend Business | 61 | 4 | 5 | 7 | No general procedural fallback identified |
| Shelf Control | 14 | 0 | 1 | 0 | No general procedural fallback identified |
| Uphill Delivery | 62 | 4 | 5 | 3 | No general procedural fallback identified |
| Tiptoe Thieves | 45 | 3 | 6 | 16 | No general procedural fallback identified |
| Permit Pending | 285 | 8 | 15 | 36 | No general procedural fallback identified |
| Brick by Hand | 0 | 0 | 0 | 0 | No general procedural fallback identified |

## Per-game findings

**Wrong Floor: Functional synthesized coverage; recorded library empty.** All 26 catalogued effects have layered procedural Foley: carpet/metal/wood steps, knocks, handles, machinery, breathing, pulse and chase events. A procedural room bed supplies atmosphere. This is substantially more complete than a few fallback beeps. Judge positional clues, repeat fatigue and horror timing by listening before deciding how many recordings to add. No catalogued music or narrator is automatically a defect here. Evidence: [games/wrong-floor/audio.ts](../../../games/wrong-floor/audio.ts); [captured public response](wrong-floor-manifest.json).

**One More Button: Enough for the current core design.** 22 effects, 3 hazard ambience loops and 3 music cues cover button presses, gloves, movement, warnings, audience reactions, escape and results. All 28 are bundled WAVs; paid generation is not needed for baseline sound. More files are lower priority than checking repetition, cue balance and music transitions. No narrator is required for the current design. Evidence: [games/one-more-button/audio.ts](../../../games/one-more-button/audio.ts); [captured public response](one-more-button-manifest.json).

**Four Brain Cells: Thin fallback; live audio library unavailable.** Local code defines 11 event cues for steps, grabbing, cooking, serving, spills, falls and results, with short synthesized tone fallbacks. The public audio API returned HTTP 404 with “Game not found.” This proves the live audio namespace is unavailable, not that private storage has zero files or that the entire game page is missing. Resolve the backend/catalog mismatch, then supply the cooking and robot Foley. Add a quiet kitchen bed and optional music after the essential actions. Evidence: [games/four-brain-cells/audio.ts](../../../games/four-brain-cells/audio.ts); [captured public response](four-brain-cells-manifest.json).

**Reel Problems: Basic fallback; audio needs expansion.** All 13 recording slots are empty. Basic oscillator cues and filtered-noise weather/wildlife effects still provide feedback. Supply distinct cast, bite, reel/tangle/snap, catch, splash and rescue recordings first. The current catalog has no continuous lake/boat ambience or music; adding water laps, hull creaks, line strain and changing weather beds would improve the world beyond merely filling the 13 slots. Evidence: [games/reel-problems/audio.ts](../../../games/reel-problems/audio.ts); [captured public response](reel-problems-manifest.json).

**Stack or Sink: Broad coverage; enough assets on paper.** 121 of 121 cues are published, spanning materials, movement, crane, water, coastal details, 8 music cues and 7 speech cues. The runtime uses positional attenuation, variations, scene-dependent layers and music transitions. Existing library depth is sufficient; prioritize a full-round mix/loop check over adding more files. Evidence: [games/stack-or-sink/sound.ts](../../../games/stack-or-sink/sound.ts); [captured public response](stack-or-sink-manifest.json).

**Blend Business: Broad coverage; enough assets on paper.** 77 of 77 cues are published: 76 generated recordings and 1 selected bundled fence fallback. Footsteps, herd sounds, foliage, items, fence, ambience, music and dialogue are represented. Cow-seat NPC controls apply to player-farmer server rooms; old peer rooms do not expose those controls. Sound routing must continue to avoid revealing hidden player identities. Evidence: [games/act-natural/sound.ts](../../../games/act-natural/sound.ts); [captured public response](act-natural-manifest.json).

**Shelf Control: Core covered, but small and shared.** 15 relevant file paths: 5 showroom files plus 10 borrowed Blend Business cues. The shared cues comprise 9 gameplay interactions and the common UI click. Counting the full 77-cue farm manifest as Shelf Control audio would overstate its usable library. It has one showroom music track and four step takes, but no dedicated ambience or speech. Add showroom/security ambience and round-transition sounds if a fuller identity is wanted. Its workshop edits the farm library, so changes can affect both games. Evidence: [games/shelf-control/audio.ts](../../../games/shelf-control/audio.ts); [captured public response](shelf-control-manifest.json).

**Uphill Delivery: Broad coverage; enough assets on paper.** 74 of 74 cues are published. Coverage includes carried-sofa movement and surfaces, player movement, bridge creaks, goat footsteps/bells, birds, gates/doors, 4 ambience beds, 5 music cues and 3 speech cues. The sound director follows movement and load rather than only button presses. Prioritize audibility while several humans/NPCs carry the sofa. Evidence: [games/uphill-delivery/audio.ts](../../../games/uphill-delivery/audio.ts); [captured public response](uphill-delivery-manifest.json).

**Tiptoe Thieves: Broad coverage; enough assets on paper.** 70 of 70 current cues are published: 65 generated plus 5 selected bundled files. This supersedes older documentation listing 65 catalog cues. Giant breathing/waking, surfaces, objects, stealth/escape warnings, 6 music cues and 16 speech cues are represented. Urgent warnings interrupt incidental speech. Listen for warning intelligibility and balance against the sleeping/angry giant. Evidence: [games/dont-wake-the-giant/sound.ts](../../../games/dont-wake-the-giant/sound.ts); [captured public response](dont-wake-the-giant-manifest.json).

**Permit Pending: Broadest library; enough assets on paper.** 344 of 344 cues are published, including 216 material cues, 69 events, 8 ambience cues, 15 music cues and 36 speech cues. The library includes variations and multiple modes, so its size is not a target for every small game. It already covers join/ready/voice events more fully than the rest. Its published narrator voice selection differs from the four main narrated libraries. Evidence: [games/chaos/audio-director.ts](../../../games/chaos/audio-director.ts); [captured public response](chaos-manifest.json).

**Brick by Hand: Critical audio gap.** The public manifest is valid but empty: 0 of 61 cues. No bundled files or procedural fallback were found in this game. Its player deliberately stays silent when clips are missing, so construction, footsteps, mixer, warnings, music and narration have no audio source in the inspected live configuration. Start with the 36 material/event cues and 3 ambience cues, then music and the 17 speech cues. Evidence: [games/first-person/Game.tsx](../../../games/first-person/Game.tsx); [captured public response](first-person-manifest.json).

## NPCs and the shared lobby experience

All 11 game components use the same [shared/ui/GameToolbar.tsx](../../../shared/ui/GameToolbar.tsx): Voice, sound toggle, help, All games and Sound workshop. All implement room creation/joining and an invite link/code. That gives the collection a common foundation, but the complete flow and functionality are not uniform.

| Game | Lobby / invite / start behavior | NPCs beyond human players | Voice support in source |
| --- | --- | --- | --- |
| Wrong Floor | Check in → share code/link → host enters elevator; empty seats fill automatically | Computer guests and the pursuing apparition | Yes; no speaking-to-game-audio ducking hook |
| One More Button | Create a show → invite → host starts; separate solo shortcut | No NPC player or character simulation found; automated hazards and audience sounds | Yes; game loops duck for voice |
| Four Brain Cells | Start a kitchen → choose limbs/add NPCs → invite → host starts; practice also opens a lobby | NPCs control unfilled robot limbs | Implemented for peer rooms; no speaking-to-game-audio ducking hook |
| Reel Problems | Launch a boat → invite → captain starts; separate solo shortcut | Fish plus shark and jellyfish hazards | Yes; no speaking-to-game-audio ducking hook |
| Stack or Sink | Create crew → invite/explore yard → host starts flood; solo practice available | No NPC player or character simulation found | Yes; game loops duck for voice |
| Blend Business | Create farm → choose player/computer farmer → invite/NPC cows → host starts | NPC cow players, background herd and optional computer farmer | Yes in supported room modes; game loops duck for voice |
| Shelf Control | Create room → invite/add NPCs → exactly four seats → start; fill-and-start is combined | NPC guards/mannequins and background mannequins | Unavailable; toolbar opens an explanation |
| Uphill Delivery | Create crew → invite/add NPCs → host starts delivery; solo shortcut starts immediately | NPC carriers and moving goats | Yes; game loops duck for voice |
| Tiptoe Thieves | Create crew → invite → host starts heist; solo practice available | The giant is a reactive enemy character | Yes; game loops duck for voice |
| Permit Pending | Mode-dependent; Crew Jobs has its own lobby/readiness flow, building modes differ | Scripted customer/inspector walks and inspects in Crew Jobs | Crew Jobs only; separate voice panel and ducking |
| Brick by Hand | Open/join saved building site → invite → each player enters the site; no common host-start lobby | No NPC player or character simulation found | Unavailable; toolbar opens an explanation |

The five games with NPC player slots are **Wrong Floor, Four Brain Cells, Blend Business, Shelf Control and Uphill Delivery**. Each supports up to three computer players alongside one human, subject to its game mode. Four provide manual NPC management; Wrong Floor fills automatically at start and replaces departed witnesses during a round. Shelf Control requires four occupied seats and combines fill with start. Four Brain Cells permits NPC management in local practice; Uphill Delivery’s solo shortcut starts immediately without its multiplayer crew setup. Sources: [games/wrong-floor/simulation.ts](../../../games/wrong-floor/simulation.ts), [games/four-brain-cells/npcs.ts](../../../games/four-brain-cells/npcs.ts), [games/reel-problems/chaos.ts](../../../games/reel-problems/chaos.ts), [games/act-natural/bots.ts](../../../games/act-natural/bots.ts), [games/shelf-control/bots.ts](../../../games/shelf-control/bots.ts), [games/uphill-delivery/npcs.ts](../../../games/uphill-delivery/npcs.ts), [games/dont-wake-the-giant/giant-motion.ts](../../../games/dont-wake-the-giant/giant-motion.ts), [games/chaos/party-view.ts](../../../games/chaos/party-view.ts).

The broader eight-game count adds **Reel Problems** (gameplay wildlife), **Tiptoe Thieves** (giant) and **Permit Pending** (scripted inspector). It excludes decorative crowd audio, automated machinery and references to an off-screen inspector.

Specific consistency gaps:

- **Voice:** 8 games expose their room voice integration; Permit Pending restricts voice to Crew Jobs; Shelf Control and Brick by Hand have no in-game voice. A visible Voice button is not evidence of working microphone transport.
- **Sound around friends joining:** shared players trigger a generic UI click, but there is no complete common set for create/join, friend arrival/departure, invite copied, readiness, start and reconnect. Permit Pending has dedicated join/ready/voice cues that most games lack. Wrong Floor, Four Brain Cells and Reel Problems do not even define the shared `event.ui` cue in their local catalogs.
- **Conversation balance:** One More Button, Stack or Sink, Blend Business, Uphill Delivery and Tiptoe Thieves pass speaking state to lower background loops. Permit Pending does so through its separate panel. Wrong Floor, Four Brain Cells and Reel Problems have no equivalent hook in their game components.
- **Invites:** all games copy links/codes. Native mobile sharing is explicitly implemented for Stack or Sink and Permit Pending. Nine games use `?room=`; the two construction games use `?raum=`. Preserve existing invite formats when consolidating the interface.
- **Audio ownership:** Shelf Control’s Sound workshop opens Blend Business’s editor. It has no independent control over the shared sound library. Permit Pending also uses a different saved narrator voice from Stack or Sink, Blend Business, Uphill Delivery and Tiptoe Thieves.
- **NPC controls and start:** automatic fill, manual add/fill, fill-and-start, and solo shortcuts differ. A reusable four-seat lobby could standardize visible occupancy, host authority, add/remove NPCs, invitation feedback and start conditions while retaining each game’s rules.

## Recommended work, in order

| Priority | Work | Completion criterion |
| --- | --- | --- |
| 1 | Restore Brick by Hand’s sound coverage | The 61 intended cues have playable sources or explicit substitutes; brick placement, footsteps, mixer and error feedback are audible in a real round. |
| 1 | Resolve Four Brain Cells’ live audio namespace | Its public manifest recognizes the game; all 11 essential event cues can load and play. |
| 2 | Improve Reel Problems and Four Brain Cells beyond beeps | Distinct physical action sounds, a quiet environmental bed, and clear success/failure feedback; optional music chosen for each game. |
| 2 | Unify lobby, NPC and voice behavior | The same invite/copy feedback, human/NPC seat presentation and predictable start flow; resolve or clearly communicate the two missing voice implementations and mode restrictions. |
| 2 | Verify published-file delivery and device playback | Repeat file availability checks under normal site conditions, then test unlock, mute, background tabs, reconnect, transitions and four-player speech intelligibility. |
| 3 | Give Shelf Control more independent audio identity | Dedicated showroom/security ambience and end-of-shift feedback, plus independent editing for its own sounds. |
| 3 | Listen before expanding strong libraries or Wrong Floor | Use repeated play to identify masking, harsh peaks, bad loop seams and repetitive footsteps; generate only sounds that address a demonstrated gap. |

“Enough audio” should mean that important actions are distinguishable, hazards and outcomes communicate clearly, the environment supports the game’s identity, repetition is tolerable, and friend voice remains understandable. A common minimum file count would penalize procedural games and reward oversized libraries without establishing quality.

## Verification and limits

- Imported actual current catalogs and traced runtime usage, rather than relying on older documentation counts. Captured all 10 independent public audio API responses; Shelf Control reuses the farm endpoint. Nine independent libraries returned HTTP 200 and Four Brain Cells returned HTTP 404.
- Verified the 41 bundled files exist locally, are nonempty, and are distinct by SHA-256 within each game’s bundled folder. Counted the 70 local generated files without reading provider credentials or room/user data.
- Ran **217 focused tests: 217 passed, 0 failed** (188 audio/game/NPC tests plus 29 farm/showroom NPC and connection tests). These cover event triggers, motion and replay behavior, procedural hotel sound generation, playback lifecycle, NPC control/occupancy and relevant simulations. See [test results](tests.txt) and [additional NPC results](npc-tests.txt). No new tests or gameplay changes were introduced for this audit.
- A full live audio-file HEAD sweep stalled after reporting 450 completed requests, and was stopped. A smaller follow-up sample also had repeated timeouts; even subsequent plain GETs to a manifest, a WAV and a game page timed out. The cause is undetermined. Some sampled files returned 200; one WAV used application/octet-stream. These observations do **not** establish that the other files are missing or corrupt. File counts in this report are the successfully captured manifest snapshot, **not 719 individually validated downloads**. See [partial sample evidence](file-sample-progress.json) and [availability note](availability-note.json).
- Live page/toolbar verification did not complete after those timeouts. The lobby, NPC and voice comparison therefore describes inspected source, with local test evidence; it does not certify that every current source feature is deployed. The Four Brain Cells API mismatch is a specific observed deployment discrepancy.
- No full acoustic listening review, real browser round across all games, phone/headphone/speaker comparison, or physical-device microphone test was performed. “Broad coverage” means adequate assets and code paths on paper, not final audio sign-off.

All counts, cue IDs, public playback paths, missing slots, category splits and local file hashes are retained in [inventory.json](inventory.json). Assessment metadata is in [assessment.json](assessment.json).
