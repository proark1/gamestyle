# Jumbleyard audio completion report

Verified 9 September 2026 against [live Jumbleyard](https://jumbleyard.up.railway.app). **All 182 requested recordings are generated, saved, and published.** Four Brain Cells, Reel Problems, Wrong Floor, and Brick by Hand each have a complete current catalog with no missing recordings, stale recordings, or outstanding generation errors.

The three expanded games gained **71 sound slots**. Brick by Hand received recordings for all 61 of its existing slots. The original seven games' published recording URLs were preserved; Shelf Control's five bundled files also match their previous hashes.

## The four requested libraries

| Game | Previous catalog | Expanded catalog | Generated files | Effects / materials | Ambience | Music | Speech | Missing / stale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Four Brain Cells | 11 | 36 | **36** | 24 | 4 | 5 | 3 | 0 / 0 |
| Reel Problems | 13 | 39 | **39** | 24 | 7 | 5 | 3 | 0 / 0 |
| Wrong Floor | 26 | 46 | **46** | 39 | 2 | 5 | 0 | 0 / 0 |
| Brick by Hand | 61 | 61 | **61** | 36 | 3 | 5 | 17 | 0 / 0 |
| **Total** | **111** | **182** | **182** | **123** | **16** | **20** | **23** | **0 / 0** |

All four had zero published recordings before this work. Previous catalog counts refer to the audited local source; the deployed Four Brain Cells audio namespace was missing and Reel Problems exposed an older catalog. The release brought those workshops up to date before generation.

**Four Brain Cells:** added robot footstep variations, batter and coffee refills, pancake-ready and burning feedback, utensil landings, stove/brewer/servo/kitchen layers, lobby arrival/departure sounds, a last-minute warning, five score states, and start/win/loss narration. Movement follows actual foot activity; cooking audio follows utensil state.

**Reel Problems:** added deck footsteps, untangling, gear fitting, hull creaks, wind/rain/water/reel/line-strain/wake/swimming layers, lobby sounds, a last-minute warning, five score states, and start/win/loss narration. Footsteps follow distance travelled, and weather/line/boat state controls the continuous layers.

**Wrong Floor:** generated the existing private clue and physical Foley library, added nine surface footstep variations, hotel/elevator ambience, lobby feedback, and five music states. Private encounters still use the individual player's snapshot. Missing-recording procedural fallback remains available.

**Brick by Hand:** generated its own material handling, construction, footsteps, mixer, warning, ambience, music, and 17 speech recordings. Its saved construction account and narrator were reused through an authenticated server operation; credentials were not returned to the client.

The three expanded games now lower background audio when friends speak. Their sound directors suppress repeated snapshot events and rebase after reconnect gaps. Existing room, invite, host, and NPC rules were retained.

## Updated comparison of all 11 games

“Files” counts distinct playback URLs used by that game. It includes bundled files and explicitly used shared sounds. A complete catalog measures asset coverage; judging the final mix also requires listening during play.

| Game | Audio files | Catalog / used slots | NPC player slots? | Other non-player characters | Coverage assessment |
| --- | ---: | ---: | --- | --- | --- |
| Wrong Floor | **46** | 46 | Yes | Pursuing apparition | Expanded and fully recorded; private clues, surfaces, atmosphere and score covered |
| One More Button | 28 | 28 | No | None found in character simulation | Complete compact core library |
| Four Brain Cells | **36** | 36 | Yes | NPCs control robot limbs | Expanded and fully recorded; kitchen actions, movement and round feedback covered |
| Reel Problems | **39** | 39 | No | Fish, shark, jellyfish | Expanded and fully recorded; boat actions, weather and wildlife events covered |
| Stack or Sink | 121 | 121 | No | None found in character simulation | Broad recorded coverage |
| Blend Business | 77 | 77 | Yes | Herd and optional computer farmer | Broad recorded coverage |
| Shelf Control | 15 | 15 | Yes | Background mannequins | Complete compact used set; five bundled files plus ten shared farm recordings |
| Uphill Delivery | 74 | 74 | Yes | Goats | Broad recorded coverage |
| Tiptoe Thieves | 70 | 70 | No | Reactive giant | Broad recorded coverage |
| Permit Pending | 344 | 344 | No | Scripted customer/inspector | Broad coverage across construction and multiple modes |
| Brick by Hand | **61** | 61 | No | None found in character simulation | Previously empty library is now fully recorded |

**NPC totals: 5 of 11 games have computer-controlled player slots.** Counting reactive enemies, wildlife, and the scripted inspector, **8 of 11 games contain NPCs**. These source-based classifications are unchanged by the audio release.

All 11 use the shared toolbar and implement room creation/joining plus invite links/codes. The complete lobby flow still varies by game: limb selection, NPC filling, minimum crew requirements, solo shortcuts, host start, and mode-specific readiness differ. Voice remains unavailable in Shelf Control and Brick by Hand; Permit Pending supports it in Crew Jobs. This work added themed lobby sounds and voice ducking to the three expanded libraries; it did not redesign those flows. The [original audit](../game-audit-2026-09-09/report.md) records each game's lobby behavior.

## Verification and listening notes

- **761 tests passed**, including catalog/provider limits, state-driven audio, duplicate/reconnect suppression, private hotel audio, and secure construction-account reuse. TypeScript, lint, architecture checks, and the production build passed.
- The live administrator libraries and public manifests agree on **182 current recordings**. All four generation leases are released and every cue has a saved file without an error.
- **182/182 MP3s downloaded and decoded successfully**, with finite, non-silent PCM samples. Total decoded duration is approximately **17 minutes 12 seconds**, using **15.91 MiB** of MP3 data. No file exceeded the automated threshold of 0.5% near-full-scale samples.
- One Four Brain Cells music request received an ElevenLabs HTTP 500. The server's terminal error and released lease were confirmed before a new request; the retry succeeded. All completed recordings were preserved.

Seven clips measured below −45 dBFS full-file RMS: Four Brain Cells `event.step.1`; Brick by Hand `ambience.site`, `ambience.trees`, and `event.error`; Reel Problems `ambience.strain`; Wrong Floor `event.correct` and `event.step.2`. Full-file RMS includes pauses and natural decay. These deserve an in-game listening check against the music and voice mix, especially Reel Problems' line-strain layer at approximately −60.7 dBFS. Automated decoding does not establish artistic quality, speech delivery, seamlessness, or perceptual mix balance; a full listening/playtest was not performed.

Evidence: [final inventory](inventory.json), [per-file media measurements](media-quality.json), [generation journal](generation-journal.json), [test output](tests.txt), and [release source hashes](release-source-manifest.json). Live release: `816f36f8-3869-48e4-afc0-498f24f2f0d9`. Media decoder: [Miniaudio's official documentation](https://github.com/irmen/pyminiaudio).
