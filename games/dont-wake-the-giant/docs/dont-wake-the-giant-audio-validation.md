# Giant audio workshop verification — 2026-09-06

Rechecked production before implementation: `/dont-wake-the-giant/admin` returned 404 and its audio library had zero cues. A read of the existing shared narrator confirmed The Chaos Commentator, owned by Stack or Sink, with the same voice selected in the live Stack or Sink library.

Added the shared admin route and menu link, 65 Giant-specific editable cues (44 effects including footstep variations, 14 speech lines, 2 ambience loops and 5 music cues), inheritance of the saved collection narrator, inclusion in future collection voice selections, and playback through the common audio engine. Exported all four prompt catalogs.

Validation completed:

- Full regression suite at the initial implementation checkpoint: 179 passing tests.
- Six new focused Giant audio tests pass after the final edits. They cover catalog/provider limits, all treasure/tool and surface types, actual pickup/banking/sneeze/tickle simulation transitions, quiet join/reconnect/restart handling, rescue/contact/outcome distinctions, music/breathing lifecycle, and shared voice/key ownership with mocked audio generation and persisted publication.
- Existing narrator and player regressions also pass (nine focused tests together).
- Final TypeScript and targeted lint pass. A type-only `Member | undefined` annotation fixed an inference error in the concurrently added peer coordinator; no coordinator behavior was changed.
- Cloudflare/Sites production build passed; final Node/Railway production build passed. Existing chunk-size, config-loader and route-classification warnings remain.
- Local development admin route returned 200 and the API loaded all 65 cues.
- A separate Node production server on port 3021, using isolated `work/giant-audio-review.sqlite`, passed `node --import tsx games/dont-wake-the-giant/scripts/giant-audio-integration.mjs`: game/admin routes, catalog IDs, editable speech text, volume persistence without replacing files, foreign-origin rejection, invalid-file rejection and omission of workshop metadata from public playback manifests. The script restores its edited cue.

No provider voice was created and no paid clips were generated. No credentials were copied into the local preview. Production publication and generation of the 65 new clips remain pending. Missing clips are silent, as in the other managed libraries. No acoustic listening or physical device/browser visual QA was performed.

The existing development server remains available at `http://127.0.0.1:3003/dont-wake-the-giant/admin`; the temporary production verification server is stopped after checks.

## Public release — 2026-09-06

After the user requested publication, froze the current source into `work/giant-audio-release-20260906` so further edits in the shared workspace could not alter the upload. That exact release copy passed TypeScript, all 189 tests, the Node production build, the Giant audio HTTP integration, and the Giant/Uphill Delivery four-client integrations on an isolated local production server. The temporary verification server was stopped afterward.

Railway deployment `e437976e-de8c-44e1-beb9-8c0fd1ff9829` reached `SUCCESS` on the existing production service and persistent `/data` volume. The workshop is live at https://stack-or-sink-production.up.railway.app/dont-wake-the-giant/admin.

Read-only live checks confirmed a healthy application/database, HTTP 200 for all four game and admin routes, all 65 Giant cues, The Chaos Commentator as the inherited default voice, matching the shared saved voice ID, and access to its existing source account key without copying any credentials. These checks did not exercise Node audio-file writes. Public playback manifests still omit workshop metadata. No paid generation was performed; all 65 Giant clips remained ready to generate in the workshop.

## Giant file-storage fix — 2026-09-06

The first real generation exposed a missed Node storage restriction: `storage-node.ts` listed only the original three game IDs in its file-path validator. The provider response therefore could not be saved under `dont-wake-the-giant/…mp3`. The live menu-button cue held the reported storage error, and a valid missing Giant file URL returned 503 instead of 404.

The storage adapter now uses the shared `isGameId` validation while retaining the two-component path and immutable MP3 filename restrictions. The regression test failed against the old validator, then passed after the fix. It covers file write/read/delete for every game, duplicate-write protection, invalid paths, and generation of a Giant effect and speech clip through the real disk adapter with a mocked provider, including library publication and lease release.

The fix was staged from the exact latest deployed source (`82da5767-244b-4b86-9221-f5979461e776`) in `work/giant-audio-storage-fix-20260906`. Only the Node audio storage implementation and its regression test differ. Type checking, targeted lint, all 27 audio/Giant audio tests, and the Node production build passed. An isolated production server returned the seeded Giant audio bytes with HTTP 200 and audio/mpeg, returned 404 for an absent valid file, and loaded the admin route. The temporary server was stopped afterward.

Railway deployment `5e6662e9-73d0-4c84-8ce7-f04d5a7d27eb` reached `SUCCESS`. Live verification now returns 404 for a valid absent Giant file. Retried exactly the failed `event.ui` menu-button sound through the production generation endpoint using the user's existing settings. It generated successfully, cleared the saved error, appeared in the playback manifest, and served an 8,821-byte MP3 with HTTP 200. Saved settings and all cue prompts were unchanged. The library now has one generated clip and 64 missing clips; the rest of the batch was not started. No acoustic listening test was performed.
