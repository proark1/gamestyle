# Shared game voice — September 6, 2026

## Behavior

Stack or Sink, Blend Business, Uphill Delivery and Tiptoe Thieves use `GameToolbar`. Voice, game sound, help and All games keep the same order, appearance and placement. Leave game appears during a session; existing sound workshops appear on the relevant start screens. Voice remains discoverable on menus and in solo practice and explains the multiplayer requirement.

The shared panel offers Join voice (explicit microphone permission and open conversation) and Listen only. It also provides mute, leave, microphone selection, push-to-talk, input level, incoming mute and per-player volume. Browser playback restrictions have a recovery button. Game sound is lowered during incoming speech in every game. Voice never affects the Giant's noise simulation or exposes Blend Business cow identities.

Session changes dispose the voice client. Pending joins can be cancelled, microphone release interrupts pending device changes, and focus loss stops transmission. Microphone permission denial leaves the listener connected. A failed device change stops the old microphone as well. New rooms use direct peer audio and browser-hosted simulation; existing server-hosted rooms retain LiveKit.

## Verified

- `npm test`: all 220 tests passed, including coordinator election with concurrent writes, skipping stale/unconnected successors, authenticated signalling, checkpoint recovery and encryption, all four simulation adapters, and microphone permission/device-switch races. Existing game and legacy voice tests remain passing.
- `PEER_TEST_URL=http://127.0.0.1:3003 npm run test:peer`: all four games passed against the running Node HTTP coordinator and SQLite database, with four native WebRTC clients per game. Each run established all six direct data-channel links, started a shared round, transmitted a generated 440 Hz audio signal between two players, abruptly disconnected the first host, recovered the saved round on the second player, verified audio continued through the same surviving connection, and gracefully handed hosting to the third player. Graceful transfer took roughly 0.9–1.3 seconds in that run. The Windows runner isolates native WebRTC teardown per game.
- HTTP responses for all four game pages and the health endpoint: 200.
- `npm run typecheck`: passed.
- Scoped lint covers the peer coordinator, transport, simulation adapter, voice client, tests and development/integration scripts. The wider game files contain pre-existing lint findings unrelated to this work.
- `npm run build`: production build passed.

## Remaining deployment and listening checks

The peer coordinator supports both Node/SQLite and Cloudflare/D1; new peer rooms do not depend on the legacy Cloudflare LiveKit restriction. The web application and coordinator must remain online independently of a player's PC. This work does not migrate the web server itself. See [host handover](host-handover.md) for the eight-second host lease, paused simulation time and possible rollback to the latest checkpoint.

No TURN relay is provisioned by this change. Default STUN supports direct connections, but restrictive networks need the runtime relay configuration in [sound and voice setup](audio-setup.md). Automated integration transmits and verifies generated audio through real WebRTC; it does not listen to physical microphones. A two-device/two-network listening test, including a mobile browser, remains necessary to assess echo, hardware selection and autoplay. Browser visual QA was not performed.

Transport behavior was checked against the [WebRTC peer connection guide](https://webrtc.org/getting-started/peer-connections), [replaceTrack reference](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack), and the [node-webrtc project](https://github.com/node-webrtc/node-webrtc). Legacy LiveKit behavior follows its [SDK event reference](https://docs.livekit.io/reference/client-sdk-js/enums/RoomEvent.html).

## Public release verification — September 6, 2026

After the user requested publication, checked the existing public Railway service. Its successful deployment `5e6662e9-73d0-4c84-8ce7-f04d5a7d27eb` already included the peer implementation through the concurrent Giant audio storage release. Compared the implementation and integration files with the frozen published source in `work/giant-audio-storage-fix-20260906`: the peer coordinator, recovery engine, transport, shared toolbar, game entry components and dependency versions match. Four connection/voice source files differ only in formatting and trailing commas. A duplicate deployment was unnecessary; the private Sites copy was left unchanged.

Ran `PEER_TEST_URL=https://stack-or-sink-production.up.railway.app npm run test:peer`. All four games passed with four real WebRTC clients each, six peer connections, generated audio, abrupt first-host recovery, preserved round state and surviving voice links, followed by a graceful handover to the third player. Graceful handovers took 697, 1518, 1124 and 960 milliseconds respectively. The coordinator and recovery writes ran through the live HTTPS service and its persistent database; the peers and generated audio ran locally. No physical microphone or restrictive-network listening test was performed.

The live application/database health check returned 200 and `PUBLIC_GAME_ORIGIN` matches the Railway HTTPS origin. TURN settings remain unconfigured, so the previously documented restrictive-network limitation still applies. Create a new room at [the public game](https://stack-or-sink-production.up.railway.app/stack-or-sink) to use peer-hosted gameplay and voice.
