# Reel Problems 2 rebuilding marker fix

The player mistook the harbour gate ring for the raft assembly target. The actual assembly target was reachable on the floating platform but visually blended into its yellow wood. Recovery movement deliberately keeps the player on that platform.

The build target now has a dark outline and BUILD HERE label, the gate marker is hidden during recovery, instructions say to stay on the platform, and the unavailable work button retains carry guidance. No jumping or swimming is required to assemble the raft.

Implementation: `1b9746b`. Release: `48ba840`, including latest production changes. Railway deployment `6faae3d1-4f55-403c-b377-1ec621db22b0` succeeded. The subsequent main commit `dc36582` retains the fix.

Validation: TypeScript, production build, 157 game/shared-peer tests; Chrome keyboard pickup, walking, all four installations and raft launch from a wreck near the harbour; visually inspected outlined assembly area and hidden gate; live health, solo start and delivered BUILD HERE marker/instruction code verified without page errors. An initial browser pickup test was too short during startup; a settled scene and longer input hold passed the complete sequence.
