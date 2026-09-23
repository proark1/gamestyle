# Nonpayment monetization status — 23 September 2026

This records the state of the approved 22 September roadmap after the current implementation work. Payment checkout, receipt restoration and live purchases are deliberately deferred. The inactive paid-game gate must remain off until those flows and the free-game pilot are complete.

## Implemented and checked

- Server-owned account inventory, grants, coin ledger, premium offer metadata and purchase verification boundary exist. Existing coin wardrobe, fitting previews and private party plaza are usable. Checkout remains outside this work.
- Persistent crews, invitations, leadership, party link and archived identity exist. The clubhouse shelf now reads verified Stack or Sink ranked runs, best settled tower and finalized crew prize placements from server records. A voided run disappears from the shelf.
- Direct game pages, direct room creation/join and party round selection have an opt-in server-side full-game access boundary. Mixed parties retain shared free games. The switch `PAID_GAME_ADMISSION_ENABLED` defaults off and is not a launch switch to flip without release validation.
- Stack or Sink has one server-verified weekly challenge, three mastery predicates, separate player/crew ranked boards, five weekly starts, a 24-hour review period and idempotent prizes. A trusted review command now records a review void or a confirmed pre-completion service failure; the latter restores ranked starts once.
- The production process runs ranked finalization on startup and hourly thereafter, independent of leaderboard reads. Stack player boards can also show the viewer's current crew mates at their global places without exposing account IDs.
- The Party Mode finale offers a voluntary, locally generated PNG of the group scores and game list. Its lighthearted awards derive from completed rounds and exclude bots; no image is uploaded to the server.
- The 12–20 group free-game pilot is prepared in `docs/free-game-pilot-2026-09-23.md`. The project owner can recruit the groups. Stack or Sink, Crane Clash and Court Clash remain provisional candidates.

## Still required before declaring the nonpayment roadmap complete

1. Run the new-group pilot on phones, desktop and mixed devices. Use its observations to choose and publish the final three free games. Test the access matrix again with that final list.
2. Add authenticated, server-verifiable result paths to the other launch games before granting their account mastery, coin rewards, earned cosmetics or ranked prizes. Peer-host reports and browser progress are not reward evidence. Then implement the first six distinct three-tier mastery tracks and continue through the catalog; the present verified track covers Stack or Sink only.
3. Expand the four-week challenge rotation beyond Stack or Sink when another game has a verifier. The paid challenge lane needs a verified paid game and remains unavailable while paid admission is dormant.
4. Decide whether to keep the current nine-piece premium catalog (two standard accessories and seven special pieces, including five costumes) or adjust it toward the proposed nine standard/two special mix. Two non-overlapping bundles and distinct 3D previews now exist on `origin/main`. Release-test localized product copy and bundle value before selling; this branch does not turn checkout on.
5. Validate native-client access, account changes, revocations, mixed parties, full room recovery, phone controls and performance against the final gate. Keep the gate off until the deferred payment and restoration path can actually let an owner enter a paid game.

Deploying these code paths does not enable live charges or paid admission. Both production switches remain off pending the separate payment and free-game release gates.
