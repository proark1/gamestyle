# Course Correction Backyard Open Redesign

## Goal

Bring Course Correction into the same visual and interaction language as the other Jumbleyard games. The course becomes part of a lively outdoor mini-golf venue, the visible players gain an audience and a believable place to play, the camera presents the action more clearly, and the HUD adopts the shared house system. The existing simulation, physics, scoring, multiplayer protocol, and course geometry remain authoritative and unchanged.

## Chosen direction

The selected setting is **Backyard Open**: a compact garden-club tournament built from the same friendly, low-poly materials and shared character language as the rest of the collection.

The current blue void is replaced by a complete world around the playable lane:

- a grass and worn-earth ground plane beneath the course;
- a small clubhouse or garden shed behind the far end;
- fencing, gates, benches, planters, equipment, signage, paths, and low barriers;
- trees, shrubs, bunting, flags, and other soft skyline framing;
- a dedicated spectator edge that never overlaps the playable corridor;
- warm daylight, contact shadows, and restrained atmospheric depth matching the collection.

The course remains the visual priority. Large scenery pieces sit behind or below the lane, foreground elements stay low, and the cup, walls, bridge, platform, balls, aim guide, and four golfers remain readable at all supported aspect ratios.

## Camera presentation

The default view becomes a lower three-quarter broadcast angle. It shows more of the character silhouettes and surrounding venue while retaining an unobstructed read of the full putting route.

Camera behavior uses three presentation states:

1. **Aim:** a stable full-course framing used while the local player aims or waits. No automatic drift is allowed during pointer input.
2. **Follow:** a restrained target shift toward the active rolling action. The camera keeps the full important route visible instead of tightly following a single ball.
3. **Celebrate:** a brief cup-biased composition for cup and multi-cup events, then a smooth return to the stable aim view.

State transitions use bounded easing and retain the existing impact impulse. Reduced-motion mode removes automatic follow and celebration movement while preserving the improved static composition. Portrait layouts use a higher field of view and a slightly more elevated base angle rather than cropping the course.

## Spectators

The venue includes roughly eight to twelve shared Jumbleyard spectators, depending on the active quality profile. They reuse the shared avatar and wardrobe construction rather than introducing a second character style.

Spectators are arranged in small groups on benches and behind low barriers. Their clothing uses the collection palette with enough variation to avoid duplicated rows. Static spectators are batched where practical; only a staggered subset keeps animated limbs.

Audience presentation has three levels:

- gentle idle shifts and occasional waves during ordinary play;
- short local reactions to rotating walls, tipping bridges, near misses, and hard platform movement;
- a stronger synchronized cheer for cups, assists, chain events, and Everybody In.

Reactions are driven by already-authoritative event IDs and never affect gameplay timing. Reduced-motion mode replaces repeated movement with simple held poses. Mobile and lower quality profiles keep the crowd silhouette but reduce animated spectators and small prop detail.

## HUD and interaction design

Course Correction adopts the shared house HUD language from `shared/styles/game-ui.css`:

- translucent cream cards with a fine neutral edge and soft green-tinted shadow;
- dark green ink, amber interaction accents, and the canonical player colors;
- Fredoka for short display values and DM Sans for labels and supporting text;
- the shared toolbar, dialog, button, focus, keyboard-key, and status treatments.

The in-game information hierarchy is:

1. A compact centered match card containing hole number, hole name, timer, and round progress.
2. Compact player score cards containing the player color/portrait, name, total strokes, and current state. The local player remains unmistakable without a heavy outline.
3. A bottom-center shot card containing the power meter and one contextual instruction. It stays visually lighter than the current dark panel so it does not cover the course.
4. Short event messages near the play area for wall turns, bridge tips, assists, and cups. These do not duplicate persistent scoreboard information.

Desktop keeps the score cards in a readable edge stack. Narrow layouts collapse them into a compact horizontal strip and shorten secondary copy. Touch targets retain safe-area spacing and at least the existing usable size. Dialogs, results, room controls, errors, and focus states use the shared components rather than bespoke navy/orange chrome.

## Architecture

The scene presentation is split into focused modules:

- `environment.ts` constructs the terrain, clubhouse, fencing, vegetation, benches, signage, bunting, and other static venue details. Static meshes are batched where appropriate and expose no gameplay state.
- `spectators.ts` constructs and animates the audience, maps course events to reaction intensity, handles quality reductions, and disposes its resources.
- `camera-presentation.ts` contains pure state selection and target calculation for aim, follow, and celebrate framing. It keeps camera policy testable without a renderer.
- `scene.ts` owns these presentation modules, forwards snapshots and new events, and blends their output with the existing impact camera effect.
- `Game.tsx` keeps the current game lifecycle and peer behavior while rendering the revised semantic HUD structure.
- `style.css` consumes the shared HUD tokens and supplies only Course Correction-specific layout and player-color rules.

No scenery, spectator, or camera state is added to checkpoints, snapshots, peer messages, or simulation objects.

## Performance and lifecycle

The environment is mostly static and created once per scene. Repeated primitives share geometry or are batched. Shadows are limited to the course, principal characters, and major venue forms. Small vegetation and audience details do not cast expensive dynamic shadows.

Quality profiles control crowd count, animated fan count, small prop density, shadow detail, and optional atmospheric layers. The four playable characters, core course materials, and gameplay effects remain present at every profile.

All constructed Three.js resources are owned by their presentation module and disposed with the scene. Course rebuilds update hole-specific dressing without duplicating the persistent venue or audience.

## Error handling and fallback behavior

Environment or spectator decoration must not prevent the playable course from loading. Optional presentation construction is isolated so the scene can continue with the course, golfers, and HUD if a decorative group fails.

Camera calculations clamp invalid or missing targets to the established base framing. HUD state continues to derive from the latest snapshot and uses the existing room and lifecycle error paths.

## Testing and acceptance criteria

Pure tests cover camera state selection, framing target clamping, event-to-crowd reaction mapping, event deduplication, and quality-profile crowd/detail limits.

Existing Course Correction simulation, physics, multiplayer, presentation, and character tests must remain unchanged and green. Typecheck, focused lint, formatting, and production build must pass.

Browser QA covers:

- lobby/opening state and all four golfers;
- simultaneous opening shots and independent follow-up shots;
- rotating wall, tipping bridge, hard platform movement, near miss, cup, assist, and multi-cup reactions;
- stable aiming during pointer drag and smooth recovery after follow/celebrate views;
- desktop, portrait mobile, narrow landscape, and reduced-motion layouts;
- room controls, help, results, reconnecting/error states, and keyboard focus;
- no spectator, scenery, or HUD obstruction of the playable route.

The redesign is successful when Course Correction reads immediately as part of the same game collection: visible characters play in a complete world, spectators react to the shared chaos, the field view feels intentionally broadcast, and the HUD uses the same recognizable house language as the other games.

## Non-goals

- No physics, scoring, aiming, shot timing, course geometry, or multiplayer changes.
- No spectator collisions, networking, names, or independent simulation.
- No new avatar framework or wardrobe catalog.
- No free camera, player-controlled orbit, replay editor, or cinematic cutscene system.
- No new holes or obstacle mechanics in this pass.
