# Jumbleyard monetization and returning-player plan

Date: 22 September 2026

Status: product plan requested by the user. The business direction below incorporates the user's decisions. Detailed rules identified as proposed defaults are recommendations for implementation; no application changes or payment activation are included in this document.

## 1. Product promise and confirmed decisions

Jumbleyard is a place where friends meet, dress their characters, play a collection of funny games, and build shared memories and achievements.

The user selected groups of friends as the primary launch audience and confirmed:

- Three excellent games available free.
- An approximately $5 individual full-game purchase. Each participant needs ownership to enter paid games; owning the game does not grant friends access.
- Standard cosmetic items around $0.99; special items around $1.99; discounted bundles around $5.
- Earnable items, purchasable items, and purchase-exclusive items.
- Persistent crew identity, game mastery challenges, weekly party challenges, and leaderboards with item rewards.
- A walkable 3D lobby where friends see outfits, wait for games, visit shops, try items, and buy them.

Use $4.99 as the proposed US full-game and bundle price. Display storefront-localized prices elsewhere. The former proposal for a $9.99 host purchase with free guests is superseded.

This is a program of several connected features. Implement it in the phases below, with a separate technical specification for each phase. Do not attempt one large rewrite.

## 2. Commercial offer

| Offer | Proposed US price | Contents |
| --- | ---: | --- |
| Free edition | Free | Three fixed games, the shared lobby, crews, starter outfits, progression and challenges in accessible games |
| Full game | $4.99 once | All launch games and their included maps/modes, full-catalog Party Mode when every participant owns it, mastery progression in those games |
| Standard cosmetic | $0.99 | One clearly previewed cosmetic item |
| Special cosmetic | $1.99 | One visibly more elaborate item, such as a detailed costume piece or supported celebration |
| Standard bundle | $4.99 | Six $0.99 items: $5.94 separately, saving $0.95 |
| Mixed themed bundle | $4.99 | Three standard and two special items: $6.95 separately, saving $1.96 |

All bundle contents are named and visible. A bundle means one $4.99 payment for those items, not a subscription or coin pack. At launch, offer at most two bundles, drawn from the same individually sold catalog. A practical opening catalog is nine standard and two special new premium items, arranged into the two non-overlapping bundles above.

Purchases are cosmetic. No paid strength, speed, score multipliers, ranked attempts, or better matchmaking. The full-game purchase must remain enjoyable without buying cosmetics.

Use three item acquisition classes:

1. Coin items: earned currency buys an attractive everyday wardrobe.
2. Achievement items: earned through mastery or verified challenge rewards; cannot be purchased.
3. Premium items: bought directly at the stated prices; cannot be earned through coins or leaderboard prizes.

Keep coins earnable only for the first release. A premium variant must have a distinct item ID and clear visual differences from its earned counterpart. Existing wardrobe items keep their acquisition routes. Paid exclusivity means purchase-only, not an artificial timer.

Proposed bundle ownership rule: show every owned item and the value of the unowned contents. If a bundle overlaps ownership, offer its unowned items individually instead of allowing a duplicate bundle purchase. A later cross-store-compatible completion discount can improve this.

The base license covers the launch catalog and updates to that catalog. Do not promise all future expansions forever. Additional paid games or map packs are outside this launch plan.

## 3. Free-to-paid journey

Provisional free-game shortlist: Stack or Sink, Crane Clash, and Court Clash. These are candidates for recognizable physics play, visible multiplayer interaction, and a clear sports objective, not a claim that they have already won a comparative playtest.

Before locking the three, test them alongside the strongest alternatives with new groups on desktop and phones. Select for successful first rounds, understandable controls, replay choice, reliability, and distinct experiences. Aim for 12-20 new groups in the initial qualitative pilot; this is enough to uncover problems, not establish statistically precise conversion rates.

The three free games remain available without an expiring trial or energy limit. Publish the final selection before selling access. Free players can earn useful items without needing paid games to finish every available goal.

Proposed party access rules:

- All players may join the same lobby, walk around, try outfits, and form a crew.
- The default playable list is the intersection of games everyone owns. A mixed group can always play the three free games.
- Locked game entrances remain visible with a preview, ownership requirement, and the full-game price. Do not reveal the restriction only after loading the game.
- Selecting a locked game explains that each participant needs the full game and offers either purchase or a return to shared free games. Do not identify or shame the non-buying friend in a public callout.
- Validate ownership on the server for invitations, direct game routes, room admission, party votes, and round start. UI locks alone are insufficient.
- Purchase confirmation refreshes access in the existing lobby. Nobody must recreate the party.
- A purchase being processed never marks a player ready. If the player declines or payment fails, the group can choose a free game immediately.
- An unlicensed late joiner stays in the lobby until an accessible round; reconnection to a licensed player's existing seat keeps its normal recovery behavior.
- A refunded base license blocks future paid rounds after verification; do not abruptly remove someone from a round already running.

The commercial hypothesis is that friends will buy to access the full catalog together. The competing risk is that the group leaves or stays with the free games. Measure both; increased checkout clicks alone are not success.

## 4. Walkable 3D lobby and shops

Build a compact clay-style plaza as the default social waiting space. Proposed first scope: a private instance for the current party of up to four players, reusing the existing party membership and voice system. The world feels like a small shopping street rather than requiring a public population.

| Place | Player activity |
| --- | --- |
| Central gathering space | See friends, outfits and readiness; invite and regroup |
| Clothing shop | Inspect displayed clothes and open the catalog |
| Accessories stall | Discover hats, shoes and glasses |
| Featured collection stand | Preview the two current paid bundles |
| Fitting area | Rotate the avatar, try items, compare with the equipped look |
| Crew clubhouse corner | See crew name, shared trophies and records |
| Challenge board and podium | View weekly goals, mastery progress and leaderboards |
| Game entrances | Browse free/owned/locked games and enter Party Mode |

Keep every essential activity within a few seconds of spawning. Provide direct Play, Wardrobe, Shop, Crew and Challenges buttons as equivalent shortcuts for accessibility, controllers and repeat visits. Walking is an enjoyable option, not a prerequisite for every purchase or game.

Shopping flow: approach a display, inspect the item and actual price, try it on, confirm the purchase in the platform checkout, then equip after verified success. Previewing never charges or grants ownership. Launch with local fitting previews; only owned/equipped changes broadcast to friends. Temporary previews must not leak into games as owned equipment.

Walking through a doorway or clicking a mannequin must never purchase automatically. A visible preview label distinguishes trying from owning. The shop remains available to free users, and cosmetic purchases never imply ownership of the full game.

A player fitting clothes remains in the party and voice conversation. Shop overlays capture controls, suppress movement inputs, and require closing before readiness. Players who are ready can unready while someone shops. Returning from a game restores the party to the plaza and shows the recap.

Reuse Three.js, shared avatars, wardrobe item models, touch/controller controls, adaptive rendering, and party recovery. Stream/lazy-load displays and previews rather than loading every full-detail item at entry. Only one owned preview renderer runs at a time. Release scene resources during transitions.

A public hub with strangers is a later product, requiring moderation, population management and broader networking. It is not required for this first shop world. The previous illustrated-clubhouse design remains useful for the landing page; this plan replaces its approach specifically for the social lobby.

## 5. Persistent crews

Proposed first release: one primary crew per account, up to eight members, with four active players per game party. A crew and a room are separate: the crew persists when the room closes, and members can still play casually with other friends.

Include a crew name, preset emblem, member list, invitations, owner/member roles, shared trophy shelf, best supported team records, and a one-action invitation back into a party. Crew leadership can be transferred. Leaving a crew never removes personal items or mastery.

Use preset emblems and the existing voice system first. New text chat, uploaded logos, large guild systems and crew economies are outside this scope.

Trophies record the crew and qualifying roster at the time of the run. A new member does not inherit historical personal prize items. A dissolved crew retains an archived competition identity for historical results, while personal earned items remain owned.

## 6. Mastery and progression

Each released game gets a short mastery track with three tiers:

- Bronze: demonstrate understanding and finish the core objective.
- Silver: achieve a meaningful performance or teamwork goal.
- Gold: complete a difficult, repeatable challenge under specified rules.

Write the exact predicates against each game's real mechanics when implementing its track. Distinguish solo practice, human multiplayer and supported bot-assisted play. Do not use one generic win-count rule across games with different objectives.

Mastery awards medals, titles and exclusive cosmetics. Start with all three free games plus three paid showcase games, then cover the full launch catalog before describing mastery as universal. Account progress persists across sessions; unrelated games never lose progress when the player changes crew.

Offer a modest completion coin reward plus smaller performance bonuses. A provisional cadence is one useful cosmetic choice in the first session and a modest coin purchase after two or three normal sessions. Calculate exact coin amounts from measured session lengths and existing item prices; do not simply reward elapsed idle time.

The result screen shows what the player earned, their selected next goal, the crew result, and a quick way to play again. Include funny noncompetitive awards and a shareable group image after a party. Keep sharing voluntary.

## 7. Weekly challenges and leaderboards

There are two complementary reasons to participate: achievable completion rewards and competitive records.

Proposed weekly setup:

- A Monday 00:00 UTC reset, displayed in the player's local time.
- One free-access challenge drawn from the three free games, always open to both free and paid accounts under identical rules.
- One full-game challenge on a paid game, with its own board and rewards.
- Reuse existing games with tested objectives or modifiers; start with a prepared four-week schedule.
- Completion goals reward coins or an earned item. Ranked placement awards different earned cosmetics or titles.
- Paid-only items never appear in prize tables. Buying the full game broadens available content, not the power or score of an entry.

Use separate leaderboards for each challenge, rule version, game mode and human team size. Keep friend/crew views alongside the global view. Never add raw basketball points, building heights and fishing scores into one lifetime leaderboard.

Proposed ranked rules: unlimited practice and up to five ranked starts per account per challenge per week, with the best verified result counting. In a team run, a ranked start consumes one attempt for every participant. There are no purchasable attempts. Fix seed, duration, physics/rules version and allowed roster configuration for comparable runs. If repeatable simulation or reliable verification is unavailable for a game, it is not eligible for prize ranking yet.

Disconnecting allows the normal recovery grace; quitting a valid run consumes that attempt. A confirmed service failure voids the run and restores its attempts once. Resubmitted results, reconnects and host changes must never create extra attempts or rewards.

Suggested pilot prize structure: verified completion earns the participation reward; top 10% earns a special achievement cosmetic; top 1% earns an additional title or cosmetic variant. Enable percentile awards only once a board has at least 100 distinct eligible accounts, or 100 distinct eligible crews for a crew board. Smaller boards still show records and completion rewards but no percentile award. Treat exact ties equally and include all ties at the cutoff. Publish these rules before the weekly challenge opens.

For crew rankings, use one best eligible run per crew and team-size bracket, with a frozen roster for that week's challenge. Players can represent only one crew per challenge. Award personal ranked items only to the qualifying roster, not everyone who later joins.

Finalize results after a proposed 24-hour review window, then deliver rewards automatically to inventory exactly once. Show provisional scores and the expected finalization time. Define the primary score and any tie-breaker before launch; if no valid tie-breaker exists, share the rank.

The current party protocol includes player-reported results and peer-hosted gameplay. Agreement between peers is not sufficient proof against coordinated cheating. A prize-enabled game needs server-authoritative scoring or independently verifiable simulation/replay evidence, plus replay prevention, attempt validation and anomaly review. A replay is not automatically trustworthy simply because it was uploaded. Build verification for the first ranked game before promising global prize competition across all games.

## 8. Account, payment and ownership foundation

Current reusable components include shared/accounts, shared/wardrobe, platform/party, shared avatar rendering, analytics and installed-client packaging. The wardrobe currently stores coins and unlocks in localStorage, and its catalog distinguishes coin prices from achievement goals. These are useful prototypes, not a verified paid inventory.

Build server-owned records for base-game access, inventory grants, coin transactions, purchase receipts, refunds, bundle grants, reward claims, crew membership, challenge runs and finalized rankings. Keep stable item and offer IDs and a purchase audit trail. Local state becomes a cache and offline preview, not authority for premium ownership.

Each provider adapter verifies the transaction with its platform before granting items. Transaction IDs are unique; repeated callbacks are safe. Declined, pending and interrupted purchases have distinct UI states. Restore purchases, device changes, linked accounts and refund/revocation handling must work before launch. Production coin/item administration is authenticated and audited on the server.

Proposed cross-platform policy: linked accounts share verified cosmetic inventory and progression, and the full-game entitlement is recognized in connected clients where store integration permits. Do not advertise buy-once-everywhere until the applicable storefront integration has been validated. Unlinked purchases remain restorable through their original storefront identity. Account linking must not let one receipt grant unrelated accounts access.

Plan mobile as a free download with a non-consumable full-game unlock and cosmetic purchases. For Steam, compare a free client with a permanent paid content unlock against a paid full client plus demo. Prefer one free client/one entitlement model if Steam review supports the packaging, because free and paid friends share the same lobby. Do not assume standard demo matchmaking integrates automatically with the paid application.

Use Steam's supported purchase flow for Steam in-game sales and Apple's supported in-app purchase flow for iOS, considering the applicable storefront rules. Web checkout is a separate adapter selected after confirming its fees at these small transaction sizes.

Migration proposal: preserve existing cosmetic selections and legacy coin-item unlocks in a separate legacy namespace where necessary; never promote arbitrary local data into premium ownership or ranked achievements. New ranked and mastery records require verified runs. Inventory/coin migration must be idempotent. Publish the free-to-paid transition and full-game access policy for existing testers before activation; existing access is not silently revoked by deploying the lobby.

## 9. Delivery sequence and acceptance gates

| Phase | Deliverable | Completion evidence |
| --- | --- | --- |
| 1. Commercial foundation | Accounts, verified inventory and base ownership, catalog offer types, migration design, sandbox checkout and access checks | Repeated receipts grant once; purchases restore; refunds reconcile; direct URLs cannot bypass paid multiplayer admission; guest play remains possible |
| 2. Playable social plaza | Private four-player 3D lobby, shared outfits, fitting, shops, game entrances and existing voice/readiness | Two to four clients can browse, buy in sandbox, equip, launch, reconnect and return without losing the party; usable touch/controller/keyboard shortcuts |
| 3. Returning-group features | Persistent crews, trophy display, first six mastery tracks, progression and recap | Progress survives devices and reconnects; crew changes preserve personal rewards; all goals match observed game events |
| 4. Weekly competition | Scheduled free/full challenges, first verifiable ranked game, friend/global boards and automatic prizes | Fixed rules; invalid/replayed results rejected; attempts remain consistent; small boards and ties handled; weekly rollover grants exactly once |
| 5. Commercial launch | Chosen free trio, full launch entitlement, two paid bundles, store packaging, remaining declared mastery coverage | Real-device and release checks; platform sandbox flows; localized prices and product copy; operating and support costs measured |

Launch priorities are ownership and a small complete plaza first, then crews/mastery, then verified competition. Do not spend the first phase building a large public town. Payments can remain in sandbox while the player-facing experience is polished; monetization is activated only after the full purchase and restoration path passes release checks.

For implementation, create focused plans in this order: commercial data/access, lobby/shopping, crews/mastery, weekly ranking/rewards, platform release. Each plan names its changed modules, migrations, security boundaries and meaningful tests. The roadmap itself is not an instruction to implement every system in one turn.

Verification should cover the mixed-free/paid party matrix, storefront failure and restore paths, account linking, preview/equip ownership, concurrent grants, reward duplication, reconnects, host transfer and challenge rollover. Visually inspect lobby and fitting on narrow phones and desktop. Confirm actual device frame rate, loading time and thermal behavior; browser emulation alone does not establish mobile quality.

## 10. Business validation and sustainable operation

Low development expense makes low prices more plausible, but gross receipts are not profit. Track platform/payment deductions, refunds, hosting, voice/relay traffic, support, cosmetic production and acquisition costs. Fixed per-transaction fees can matter at $0.99; use verified provider terms before selecting web checkout. Bundles can improve transaction economics while keeping individual items available.

Illustrative sales cohort, not a forecast or monthly revenue promise:

- 1,000 full-game purchases at $4.99 = $4,990.
- 300 standard-item purchases at $0.99 = $297.
- 100 special-item purchases at $1.99 = $199.
- 100 bundle purchases at $4.99 = $499.
- Total gross receipts = $5,985 before deductions and costs. Transactions may come from overlapping buyers; count bundle contents only as bundle revenue.

Measure invitation-to-round success, first-party completion, seven/thirty-day group return, mixed-party abandonment at an ownership gate, full-game conversion, item/bundle conversion, refunds, net receipts, and cost per active group. Compare cohorts before and after the access change. More blocked invitations without higher retained paid groups is a failed monetization result.

A north-star measure is weekly returning crews that complete a party. Report it alongside net revenue and operating cost. Treat one-off purchases as one-off sales; new buyers and optional repeat cosmetic sales must sustain future revenue.

Launch acquisition focuses on short real gameplay clips, a clear three-game free invitation, a Steam presence when packaging is ready, and creator playtests that show the group experience. Ask testers for feedback rather than paid positive reviews. Expand paid acquisition only after retained buyer value and acquisition cost can be measured.

Operationally, prepare four weekly challenges in advance, reuse a tested modifier pool, and release new cosmetic collections at a sustainable pace based on demand. Subscriptions, paid battle passes, loot boxes, paid ranked attempts and interrupting ads are outside the launch scope.

## 11. Sources and repository evidence

Official platform references checked 22 September 2026:

- [Steam in-game purchases](https://partner.steamgames.com/doc/features/microtransactions): Steam Wallet integration requirements and purchase security responsibilities.
- [Steam demos](https://partner.steamgames.com/doc/store/application/demos): demo/full-game matchmaking limitations.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): digital purchases, restoration and multiplatform access, with storefront-specific exceptions.

Repository evidence reviewed:

- shared/wardrobe/catalog.ts and wardrobe-state.ts: coin/goal catalog, browser-local inventory and rewards.
- shared/wardrobe/WardrobeView.tsx: existing fitting, buying, equipping and operator controls.
- shared/accounts: existing account and session foundation.
- platform/party/types.ts, playlist.ts and coordinator.ts: party lifecycle, game roster, reports and admission.
- docs/party-mode-implementation-2026-09-22.md: implemented voting, readiness, recovery and recap flow.
- docs/superpowers/specs/2026-09-20-cross-platform-runtime-design.md: shared runtime, packaging and real-device constraints.

The game shortlist, reward cadence, private lobby scope, crew limits, competition limits and launch catalog size are proposed defaults. They are sufficiently concrete to estimate and specify; playtest evidence and storefront feasibility should resolve them before release promises.
