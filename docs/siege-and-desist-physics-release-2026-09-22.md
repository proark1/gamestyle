# Siege and Desist physics release

Live: https://www.jumbleyard.com/siege-and-desist

- Source commit: `dc36582bbcd3b84a12924afe262e340ce1dc0e35`, pushed to `origin/main`.
- Railway deployment: `ba9c0537-a0ee-4dff-abbc-9561a4802da7`, status **SUCCESS**.
- Released with the normal guarded `scripts/deploy.mjs --detach` command from the clean isolated checkout `.tmp/siege-physics-release`, based on production commit `48ba840357ce648f055c9f659dbe3122a16a300d`.
- The release contains only the castle placement, physics solver, round simulation and regression-test changes. The shared working checkout was preserved.

Sleeping items and upper masonry now wake when their supports move or disappear. The rooster and cheese start on their supports. Destroyed objectives count toward victory, debris continues settling after the result, and rematches rebuild the solver and clear the previous winner.

The isolated release passed 60 Siege tests, TypeScript, targeted lint and formatting, and the Railway production build. Before release, local browser startup and a complete simulated round also passed.

At **07:11:56 UTC on 22 September 2026**, production health returned `status: ok`, the game page returned HTTP 200, all 60 referenced JavaScript chunks returned successfully, and the live game bundle contained the new support-tracking physics. Evidence: `.tmp/siege-physics-release/.tmp/release-logs/live-verification.json` and the build/test logs alongside it.

Existing game tabs should refresh to load the update.
