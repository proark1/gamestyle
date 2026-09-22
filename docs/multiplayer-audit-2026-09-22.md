# Multiplayer release — 22 September 2026

This release completes the multiplayer audit on top of the existing voice release and Reel Problems 2 launch. It preserves all currently published games and unrelated local work.

The current production branch already contains the shared room controls and all ten game integrations, including Bungee Doubles. This release adds the final fixes:

- Zorb Clash accepts friends during a match and retains balanced four-player teams through departures.
- Sample Stampede replaces departing crew with bots and resets the full world for rematches while keeping the room crew.
- Slow browser reloads use the existing suspended-player grace period.
- Drive-Thru routes its existing pour-drink action through multiplayer. The unrelated local Drive-Thru Rush redesign is not included.
- The regression tests and shared real-WebRTC/browser test runners cover these behaviors.

The earlier local audit covered all 24 game identities. Desktop/mobile room flows passed for the nine newly connected screens; four-client networking, generated audio and host recovery passed for all peer adapters. Physical devices and restrictive external networks were not tested.

Release validation and the production deployment result are recorded in the task's release report.
