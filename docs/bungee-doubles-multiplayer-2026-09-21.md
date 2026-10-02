# Bungee Doubles multiplayer

The game already had a peer engine, but the screen only started a local match. Connect the screen to the existing shared room and peer features used by Load Bearing: `enterPeerRoom`, `PeerGameConnection`, `sessionStore`, invite-code parsing, and the toolbar's voice panel.

The Multiplayer button opens create/join controls. Online rooms use the existing four-player engine with balanced teams and NPC replacements. Input and actions go through the peer connection, and network snapshots drive the scene and HUD. Solo simulation stops when attaching and starts fresh when leaving. Invite links take precedence over unrelated saved rooms; reloading the current room restores the same player. Dialogs block local input while the online match continues.

No new multiplayer transport, backend endpoint, or game simulation was introduced. Existing unrelated workspace changes were preserved.

Validation includes the Bungee Doubles tests, shared session tests, peer invariants, TypeScript, targeted lint, four real WebRTC clients with direct audio and host handovers, and a desktop/mobile browser smoke test using the actual coordinator with isolated in-memory storage.

Run the browser check against the optimized client (use a second terminal for the test):

```powershell
npm run build:client
npx vite preview --config vite.client.config.ts --host 127.0.0.1 --port 5188
$env:SMOKE_URL='http://127.0.0.1:5188'
node --import tsx scripts/bungee-multiplayer-smoke.mjs
```

Run the transport check with `node scripts/peer-integration.mjs bungee-doubles`.

Results: 124 automated tests passed; typecheck, targeted lint, architecture checks and the production client build passed. The four-client WebRTC test passed movement, a shared serve, audio and abrupt/graceful host handovers. The browser smoke passed create, invite join, reload reconnect, leave to solo and invalid-room recovery on desktop/mobile viewports. For isolated browser testing without STUN, Chrome's mDNS address obfuscation is disabled in the test launcher; production networking is unchanged.

These changes are local and have not been deployed to the public website.
