# Wrong Floor

Four guests compare incompatible perceptions in a toy-scale boutique hotel and clear five elevator stops. This extends Jumbleyard's Three.js scenes, Fredoka/DM Sans typography, illustrated cards, room codes, voice toolbar, local practice and sound workshop.

## Horror and sound revision (2026-09-08)

The corridor now uses darker ambient light, deeper fog, warm pools of light and a vignette. Haunted private views get irregular, separated power dips and recurring sightings starting within eight seconds. The elongated guest has a tilted pale head, dark eye sockets and dangling arms, turns toward the witness, and remains private during the chase. Emergency red light marks an escape while the brass elevator stays lit. The help menu offers a saved steady-light/gentler-motion setting; the system reduced-motion preference also suppresses lighting dips and decorative motion.

`horror.ts` derives encounter timing, moving clue states and sound keys from the existing private snapshot. Normal views never gain supernatural clues, and host recovery reconstructs the same timeline. The wet footprint sequence sounds once per new footprint; three door knocks match door movement, followed by a turning handle; the backward clock ticks once per hand movement. The portrait creaks as its frame tilts. Neither voting nor the five-stop/three-chance rules change.

`foley.ts` provides immediate procedural sound using layered noise, friction and resonant impacts, with restrained corridor reverberation and a compressor. It includes carpet, wooden-floor and elevator-metal footsteps; wet prints; electrical crackle; door hardware; elevator doors and motor; notebook and radio handling; distant pipes; close breathing; pursuit footsteps; heartbeat; and a catch impact. These are synthesized Foley, not newly generated provider recordings. Existing published recordings still replace matching effects; the old three-knock cue keeps its identifier and a separate single-impact cue drives the synchronized knocks.

Every human and computer guest emits footsteps from actual travelled distance, with faster sprint cadence. Stationary input, walls, floor resets and large network corrections stay silent. Position, distance and camera direction determine the mix; ongoing synthesized sounds also pan when the camera turns. The building hum quiets during power dips. Muting, leaving, hiding the page and disposal stop effects, and keyboard/pointer gestures unlock audio after a restored session. Rendering and audio run outside React's throttled HUD updates.

Validation: 29 Wrong Floor tests pass, including seven new checks for private horror timing, quiet normal floors, synchronized clue sounds, surface footsteps, spatial mixing, audible bounded fallback samples and audio cleanup. The existing four-client real WebRTC integration passes private inspection, reporting, wrong votes, a single-witness pursuer, elevator rescue, direct voice and both host recovery paths. The local route returns HTTP 200. Browser interaction, subjective listening and physical cross-network play were not performed. This revision is local until explicitly published.

The final repository check also passes formatting, TypeScript, lint, architecture boundaries and all 755 tests. Both Node/Railway and Worker production builds pass. Logs are retained in `.tmp/wrong-floor-horror-check.log`, `.tmp/wrong-floor-horror-build.log` and `.tmp/wrong-floor-horror-worker-build.log`. The existing local preview is at `http://127.0.0.1:3033/wrong-floor`.

### Public horror release

The horror and sound revision is live at https://jumbleyard.up.railway.app/wrong-floor. Railway deployment `832d054b-543c-4df0-b3f5-6452be189edc` reached `SUCCESS` on 2026-09-08. The release preserves the concurrent Shelf Control audio deployment `d2331718-7ad5-4614-a088-9c5f24af001f` and the existing production service and persistent volume.

Its frozen 864-file source passed the complete 723-test release suite, formatting, TypeScript, lint, architecture checks and the Node production build. Public verification passed 13 routes and 119 assets, including the new horror scene, gentle-light controls and procedural audio. All 714 existing recordings/settings across nine audio libraries and the Shelf Control WAV files were preserved. Four actual WebRTC clients using the production coordinator passed private inspections, reporting, wrong voting, the single-witness pursuer, elevator rescue, direct voice, abrupt recovery and graceful host handover; temporary guests disconnected afterward. Physical cross-network devices and subjective browser listening remain untested.

Release metadata, source hashes, build/check logs and live verification are retained in `.tmp/wrong-floor-horror-live/`. The public verifier follows single-, double- and backtick-quoted lazy imports emitted by the Linux build.

## Rules

- A stay shuffles three haunted and two normal stops. Stations rotate between guests after a correct decision; a rescued mistake rerolls that stop's evidence and whether it is haunted.
- Every guest owns one private station: moving wet footprints, a smiling portrait with following eyes, knocking and a turning door handle, or backwards clock hands. Other guests render that station's normal version. A selected human alone sees the running apparition on haunted floors and during an escape.
- Inspect within three metres, then explicitly share the finding. Inspection alone does not publish it. Normal baselines are stated in the help and individual observations. Written reports make audio clues playable with sound muted.
- Advance if all evidence is normal; retreat if any anomaly is reported. Votes require being within four metres of the far-end panel. All human votes resolve immediately; the 90-second deadline resolves submitted votes. Ties or no votes retreat. NPCs inspect and report but do not outvote humans.
- Wrong calls cost a chance and trigger a 12-second chase. Movement automatically sprints, and the camera turns toward the elevator. One human inside the narrow elevator saves everyone. No human survivor, or three mistakes, loses. A successful escape retries the same stop. Five correct decisions wins. The host can start another stay after a result.
- Empty places become NPCs at start. A departed human becomes an NPC with the same station and existing evidence. Remaining completed votes resolve without waiting for an absent voter.

## Implementation

`types.ts` owns shared game constants and contracts; `simulation.ts` owns deterministic movement, floor generation, evidence, votes, NPCs and transitions; `peer.ts` injects that simulation into the shared peer engine. `models.ts` and `scene.ts` own the dynamically loaded Three.js hotel, private object variants, camera, keyboard and touch input lifecycle. `Game.tsx` owns React overlays and connection/practice lifecycle. `audio.ts` supplies immediate synthesized cues and the optional workshop catalog.

Snapshots omit the random seed, future floor deck, floor plan, raw inputs and other guests' unshared observations. A guest receives their own visual/audio flags and observation, plus explicitly shared reports. Only the elected host has the authoritative simulation and encrypted recovery checkpoint. This is cooperative friend-room privacy, not protection from a modified hosting client inspecting its own memory.

The environment uses batched static scenery, one shadow-casting light, a capped device pixel ratio, and a reused vector pair in the render loop. The HUD updates at roughly 10 Hz while movement and camera rendering run independently. Listeners, observers, WebGL resources, voice links and audio contexts are released when leaving the page. Solo time uses capped real frame deltas to prevent catch-up bursts after a suspended tab.

The default camera is first person at the guest's eye level. Dragging supports both yaw and pitch; walking remains horizontal. The optional close follow camera casts against hotel geometry so walls, closed doors, elevator jambs and ceilings shorten its distance instead of letting it move outside. Stop changes and escape turns reset the view inside the character. The hotel has a ceiling, and the avatar models use the same rounded, faceted heads, full coats, short limbs and shared mustard/teal/coral/lilac colors as the other games. The camera button names the active mode.

## Visual direction

Petrol walls `#285053`, plum carpet `#723f52`, brass `#e8bd73`, paper `#fcf1da`, teal `#73bbb2`, coral `#ed9b83`. The signature is a hotel key and framed illustration around an otherwise familiar Jumbleyard game menu. The playable world uses chunky matte guests, brass sconces, room doors, a clock, a framed portrait, carpet prints and the elongated hotel guest pursuer. Desktop and touch layouts share the same actions; smaller viewports collapse crew reports into an expandable panel. Reduced motion removes decorative ring/spinner movement while preserving gameplay cues.

Artwork is an original generated asset at `public/images/wrong-floor.png`; exact prompt and provenance are in `art-provenance.txt`.

## Validation (2026-09-08)

- 17 focused tests pass, including an entire five-stop solo playthrough driven by movement, inspection and only visible reports; vote ties/deadlines; normal/haunted decisions; rescue and loss; NPC navigation and truthful reports; privacy; restart; movement bounds; departure; checkpoint recovery; input rejection; action deduplication; and audio provider limits.
- Four real local WebRTC clients pass private inspection, explicit report sharing, a wrong majority vote, a single visible pursuer, actual movement back into the elevator, retry, direct audio samples, abrupt host recovery and graceful join-order handover. The shared integration script also runs against a supplied HTTP coordinator with `PEER_TEST_URL`.
- `npm run check` passes: repository formatting, TypeScript, lint, architecture boundaries and all 714 tests. Node and Worker production builds passed as part of the combined checkout validation; the final Node build includes the portrait-eye and keyboard-focus refinements.
- Repeating the four-client integration against the running HTTP coordinator on port 3016 passes the same gameplay, private-snapshot, voice and host recovery checks. The collection check passes all 11 cards and game routes, consistent toolbars, workshop routes, artwork, invite redirects, audio namespaces and origin checks. Browser interaction/screenshots were not requested or run; physical four-device internet play and restrictive NAT networks remain untested.

No paid sound generation was run. The initial addition and camera revision were validated locally; the public release is recorded below.

## Camera and avatar revision validation

- The 17 gameplay tests and five new camera regression tests pass (22 total). Camera checks cover default eye-level view, vertical look with horizontal movement, exit-facing reset, elevator back walls, both side walls, closed doors, ceilings and releasing the follow camera after an obstruction clears.
- Wrong Floor formatting and lint pass; repository TypeScript and architecture checks pass. The revised Node production build passes (`.tmp/wrong-floor-camera-build.log`).
- The updated local route at `http://127.0.0.1:3016/wrong-floor` compiles and returns HTTP 200. Browser interaction testing was not requested or performed. This revision changes presentation and camera controls; hotel movement speed, clue privacy, vote rules and chase timing stay as validated above.

## Public release (2026-09-08)

Wrong Floor is live at https://jumbleyard.up.railway.app/wrong-floor with the first-person default camera, vertical looking, constrained optional follow view, and rounded guest avatars.

- Railway deployment `5b1ff32b-d598-469a-b0da-08d2e13d9699` reached `SUCCESS` on the existing service and persistent volume.
- The release extends the verified One More Button release with 16 game files and nine narrow integration changes. Its frozen 852-file source passed formatting, TypeScript, lint, architecture checks, all 713 tests and the Node production build.
- Live verification passed 13 routes and 86 assets, including the current interface and lazy-loaded first-person scene. All 714 existing cue mappings and settings across eight audio libraries were preserved.
- Four actual WebRTC clients against the production coordinator passed private inspections, explicit reports, wrong voting, a single-witness pursuer, movement into the elevator, retry, direct audio, abrupt host recovery and graceful handover. Temporary verification clients left afterward. This uses four local clients with the public coordinator; physical cross-network devices remain untested.
- Exact source hashes, build/check logs, live reports and release metadata are retained in `.tmp/wrong-floor-live/`. Railway's Linux build emits different chunk hashes from the Windows build; live verification follows the public imports and confirms the current scene rather than assuming local chunk filenames.
