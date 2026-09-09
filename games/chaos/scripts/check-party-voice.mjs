import assert from 'node:assert/strict';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
const base = process.argv[2] || 'http://127.0.0.1:3001';
const key = process.env.LIVEKIT_API_KEY || 'devkey',
  secret = process.env.LIVEKIT_API_SECRET || 'secret';
const verify = new TokenVerifier(key, secret),
  sessions = [];
async function request(path, body, status = 200) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  assert.equal(res.status, status, JSON.stringify(data));
  return data;
}
try {
  const first = await request('/api/handwerker/rooms', {
    op: 'create',
    name: 'Voice host',
    mode: 'job',
  });
  sessions.push(first.session);
  for (let i = 1; i < 4; i++)
    sessions.push(
      (
        await request('/api/handwerker/rooms', {
          op: 'join',
          code: first.session.code,
          name: `Voice ${i}`,
        })
      ).session,
    );
  const grants = await Promise.all(
    sessions.map((s) => request('/api/handwerker/voice/token', s)),
  );
  for (const [i, grant] of grants.entries()) {
    assert.equal(
      grant.configured,
      true,
      'Configure the local LiveKit environment before this check.',
    );
    const claims = await verify.verify(grant.token);
    assert.equal(claims.sub, sessions[i].id);
    assert.equal(
      claims.video.room,
      `chaos-${first.snapshot.world.party.roomId}`,
    );
    assert.deepEqual(claims.video.canPublishSources, ['microphone']);
    assert.equal(claims.video.canPublishData, false);
    assert.ok(claims.exp - claims.nbf <= 120);
  }
  await request(
    '/api/handwerker/voice/token',
    { ...sessions[0], id: sessions[1].id },
    401,
  );
  await request(
    '/api/handwerker/voice/token',
    { ...sessions[0], token: 'invalid' },
    401,
  );
  const api = new RoomServiceClient(
    grants[0].url.replace(/^ws/, 'http'),
    key,
    secret,
    { requestTimeout: 3 },
  );
  const names = await api.listRooms([
    `chaos-${first.snapshot.world.party.roomId}`,
  ]);
  assert.equal(names.length, 1);
  assert.equal(names[0].maxParticipants, 4);
  await request('/api/handwerker/rooms', { op: 'leave', ...sessions[3] });
  await request('/api/handwerker/voice/token', sessions[3], 401);
  sessions.pop();
  await api.deleteRoom(names[0].name);
  console.log(
    'PASS: real local LiveKit service, four signed microphone-only grants, isolated room, forged identity and post-leave rejection. Media quality is not exercised by this API test.',
  );
} finally {
  await Promise.allSettled(
    sessions.map((s) =>
      request('/api/handwerker/rooms', { op: 'leave', ...s }),
    ),
  );
}
