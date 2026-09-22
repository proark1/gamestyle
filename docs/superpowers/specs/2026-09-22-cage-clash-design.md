# Cage Clash

Approved in conversation: copy the useful On the Ropes foundation into a separate
game; 1v1 and solo against a bot; private boxer, kickboxer, jiu-jitsu and MMA choices;
an octagonal cage; arcade striking, clinches, takedowns, guard, mount, reversals and
submissions. Preserve the collection's avatars, renderer policy, wardrobe, room and
voice infrastructure. No deployment requested.

Three 60-second rounds. Health persists with a small recovery between rounds;
stamina recovers. KO, submission or points decision ends the match. Score actual
damage, successful takedowns and positional advances; display the calculation.
Knockdowns briefly allow a grapple follow-up, otherwise the fighter stands again.
Defense, escapes and submission progress are timed rather than button-mashing.

Every style has every action, with distinct efficiency, damage and grappling
bonuses. Jiu-jitsu is strongest at submissions/reversals; MMA at takedowns. Bot
choices are fixed before human choices. Commit/reveal binds each human choice to
the match and player with SHA-256 and a random nonce. Commitments cannot change;
reveals are accepted only after both commits. No unrevealed style or nonce appears
in snapshots. Disconnect during selection resets selection; during combat a bot
continues. New humans join between matches. Reconnect and host recovery retain
combat, score and selection commitments. Selection timeout resets an abandoned
lock, so nobody waits indefinitely.

Own folder games/cage-clash, thin route app/cage-clash, isolated rooms/audio IDs.
Modules: styles/types, selection, combat, grappling, physics, simulation, bots,
controls, models/scene, Game, peer, audio, analytics, avatar and focused tests.
Copy local boxing presentation helpers; never import another game's implementation.
Exclude from four-player party rotation because the approved mode has two seats.

Implementation sequence:
1. Types, private selection, fixed-step octagon movement, striking and grappling.
2. Round flow, style-aware bots, peer adapter and two-seat room capacity.
3. Copied clay visual foundation adapted to cage, kicks and paired ground poses.
4. Style cards, contextual desktop/touch actions, HUD, help, results and rematches.
5. Register routes, installed client, collection, audio, analytics and avatars.
6. Test commit/reveal integrity, all match endings, transitions, octagon boundaries,
   two-client recovery, bot play and registry integration; typecheck, lint, build,
   and inspect desktop/mobile browser gameplay.
