# Reel Problems 2 production release

Date: 22 September 2026

Live game: https://www.jumbleyard.com/reel-problems-2

Source commit: `f1e33cd` on `origin/main`, built from production predecessor `d3b99cc` in `work/reel-problems-2-release`. Unrelated working-tree changes were excluded.

Railway deployment: `463b9ed7-8c2b-4f00-94ea-e1f8040a9e23` — SUCCESS.

Validation: production build, TypeScript, scoped lint, architecture checks, and all 1,624 repository tests passed. Live health, homepage, original Reel Problems, and Reel Problems 2 returned HTTP 200. Live two-player room creation/join and explicit cleanup passed. Chrome loaded the public game, started First Delivery solo, and used the Fish course control without JavaScript errors.

Use the www domain above. During verification the bare jumbleyard.com domain resolved to a different server and returned 404; the www and Railway service domains worked. DNS configuration was not changed.

This release is the first campaign mission. Further chapters and 2v2 remain planned.
