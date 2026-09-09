import assert from 'node:assert/strict';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';

const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3012';
const verifier = new TokenVerifier(
  process.env.LIVEKIT_TEST_KEY || 'devkey',
  process.env.LIVEKIT_TEST_SECRET || 'secret',
);
const provider = new RoomServiceClient(
  process.env.LIVEKIT_TEST_URL || 'http://127.0.0.1:18880',
  process.env.LIVEKIT_TEST_KEY || 'devkey',
  process.env.LIVEKIT_TEST_SECRET || 'secret',
);
const routes = {
  'stack-or-sink': '/api/rooms',
  'act-natural': '/api/act-natural',
  'uphill-delivery': '/api/uphill-delivery',
  'dont-wake-the-giant': '/api/dont-wake-the-giant',
};
async function post(path, body, requestOrigin = origin) {
  return fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify(body),
  });
}
for (const [game, api] of Object.entries(routes)) {
  const sessions = [];
  let voiceRoom;
  try {
    assert.equal((await fetch(`${origin}/${game}`)).status, 200);
    for (let i = 0; i < 4; i++) {
      const response = await post(
        api,
        i
          ? { op: 'join', code: sessions[0].code, name: `Voice check ${i + 1}` }
          : { op: 'create', name: 'Voice check 1' },
      );
      assert.equal(response.status, 200);
      const { session } = await response.json();
      assert.ok(session);
      sessions.push(session);
    }
    for (const session of sessions) {
      const response = await post('/api/voice/token', { ...session, game });
      assert.equal(response.status, 200);
      const voice = await response.json();
      assert.equal(voice.configured, true, voice.message || voice.error);
      const grants = await verifier.verify(voice.token);
      voiceRoom ??= grants.video.room;
      assert.equal(grants.video.room, `gamestyle-${game}-${session.code}`);
      assert.equal(grants.video.room, voiceRoom);
      assert.equal(grants.sub, session.id);
      assert.equal(grants.video.canSubscribe, true);
      assert.equal(grants.video.canPublish, true);
      assert.deepEqual(grants.video.canPublishSources, ['microphone']);
      assert.equal(grants.video.canPublishData, false);
      assert.ok(grants.exp - grants.nbf <= 120);
      assert.equal(
        (await post('/api/voice/token', { ...session, game, token: 'forged' }))
          .status,
        401,
      );
      for (const other of Object.keys(routes).filter(
        (other) => other !== game,
      )) {
        assert.equal(
          (await post('/api/voice/token', { ...session, game: other })).status,
          401,
        );
      }
    }
    const rooms = await provider.listRooms([voiceRoom]);
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].maxParticipants, 4);
    assert.equal(
      (
        await post(
          '/api/voice/token',
          { ...sessions[0], game },
          'https://untrusted.example',
        )
      ).status,
      403,
    );
    const departing = sessions.at(-1);
    assert.equal((await post(api, { ...departing, op: 'leave' })).status, 200);
    assert.equal(
      (await post('/api/voice/token', { ...departing, game })).status,
      401,
    );
    console.log(
      `${game}: four microphone/subscription grants, provider room, origin protection, game isolation and departed-player rejection passed.`,
    );
  } finally {
    for (const session of sessions)
      await post(api, { ...session, op: 'leave' });
    if (voiceRoom) await provider.deleteRoom(voiceRoom).catch(() => {});
  }
}
console.log(
  'All four games passed voice service integration. Physical microphone and cross-network audio require a separate listening test.',
);
