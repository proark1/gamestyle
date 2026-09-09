import { audioAdminFetch } from './audio-admin-request.mjs';
import assert from 'node:assert/strict';
import { TokenVerifier } from 'livekit-server-sdk';
const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3012';
async function post(path, body, requestOrigin = origin) {
  return audioAdminFetch(origin + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: requestOrigin,
    },
    body: JSON.stringify(body),
  });
}
const counts = { 'stack-or-sink': 121, 'act-natural': 76 };
const rooms = [];
try {
  for (const game of ['stack-or-sink', 'act-natural']) {
    const api = game === 'stack-or-sink' ? '/api/rooms' : '/api/act-natural';
    assert.equal(
      (await audioAdminFetch(`${origin}/${game}/admin`)).status,
      200,
    );
    const library = await (
      await audioAdminFetch(`${origin}/api/audio/${game}`)
    ).json();
    assert.equal(library.cues.length, counts[game]);
    const manifest = await (
      await audioAdminFetch(`${origin}/api/audio/${game}?manifest=1`)
    ).json();
    assert.equal('keySaved' in manifest, false);
    assert.equal('prompt' in manifest, false);
    assert.equal(
      (
        await post(
          `/api/audio/${game}`,
          {
            op: 'volume',
            cueId: 'event.ui',
            volume: 0.3,
          },
          'https://untrusted.example',
        )
      ).status,
      403,
    );
    const cue = library.cues.find((c) => c.id === 'event.ui');
    assert.equal(
      (
        await post(`/api/audio/${game}`, {
          op: 'volume',
          cueId: cue.id,
          volume: cue.volume,
        })
      ).status,
      200,
    );
    assert.equal(
      (await audioAdminFetch(`${origin}/api/audio/${game}/file/not-a-file`))
        .status,
      404,
    );
    const response = await post(api, { op: 'create', name: 'Audio check 1' });
    assert.equal(response.status, 200);
    const created = await response.json(),
      sessions = [created.session];
    rooms.push({ api, sessions });
    for (let i = 2; i <= 4; i++)
      sessions.push(
        (
          await (
            await post(api, {
              op: 'join',
              code: created.session.code,
              name: `Audio check ${i}`,
            })
          ).json()
        ).session,
      );
    const names = new Set();
    for (const session of sessions) {
      const res = await post('/api/voice/token', { ...session, game });
      assert.equal(res.status, 200);
      const voice = await res.json();
      assert.equal(voice.configured, true, voice.message || voice.error);
      const grants = await new TokenVerifier(
        process.env.LIVEKIT_TEST_KEY || 'devkey',
        process.env.LIVEKIT_TEST_SECRET || 'secret',
      ).verify(voice.token);
      names.add(grants.video.room);
      assert.equal(grants.sub, session.id);
      assert.deepEqual(grants.video.canPublishSources, ['microphone']);
      assert.equal(grants.video.canPublishData, false);
      assert.ok(grants.exp - grants.nbf <= 120 && grants.exp - grants.nbf > 0);
      assert.equal(
        (await post('/api/voice/token', { ...session, game, token: 'forged' }))
          .status,
        401,
      );
      assert.equal(
        (
          await post('/api/voice/token', {
            ...session,
            game: game === 'stack-or-sink' ? 'act-natural' : 'stack-or-sink',
          })
        ).status,
        401,
      );
    }
    assert.equal(names.size, 1);
    assert.ok([...names][0].startsWith(`gamestyle-${game}-`));
    assert.equal(
      (await post(api, { op: 'leave', ...sessions[3] })).status,
      200,
    );
    assert.equal(
      (await post('/api/voice/token', { ...sessions[3], game })).status,
      401,
    );
    sessions.pop();
    console.log(
      `${game}: passwordless workshop, ${counts[game]} prompts, origin checks and four signed LiveKit microphone grants verified.`,
    );
  }
  assert.equal(
    (await audioAdminFetch(`${origin}/api/audio/unknown`)).status,
    404,
  );
} finally {
  for (const { api, sessions } of rooms)
    for (const session of sessions)
      await post(api, { op: 'leave', ...session });
}
console.log(
  'Audio integration passed. This does not record or validate microphone audio.',
);
