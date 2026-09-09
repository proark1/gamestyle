import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3117';
const sessions = [];
async function request(path, body, headers = {}) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
try {
  const created = await request('/api/handwerker/rooms', {
    op: 'create',
    name: 'Growth check',
    format: 'inspection',
    daily: '2026-09-06',
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  sessions.push(created.data.session);
  assert.equal(created.data.snapshot.world.party.format, 'inspection');
  const host = created.data.session;
  const denied = await request('/api/handwerker/builds', {
    ...host,
    token: 'invalid',
    title: 'Denied',
  });
  assert.equal(denied.status, 401);
  const cross = await request(
    '/api/handwerker/builds',
    { ...host, title: 'Denied' },
    { origin: 'https://unrelated.invalid' },
  );
  assert.equal(cross.status, 403);
  const save = await request('/api/handwerker/builds', {
    ...host,
    title: 'A reusable test build',
  });
  assert.equal(save.status, 201, JSON.stringify(save.data));
  assert.ok(save.cookie);
  const shelf = await request('/api/handwerker/builds', undefined, {
    cookie: save.cookie,
  });
  assert.equal(shelf.data.builds[0].id, save.data.id);
  const anonymous = await request('/api/handwerker/builds');
  assert.equal(anonymous.data.builds.length, 0);
  const page = await fetch(base + save.data.url),
    html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes('A reusable test build'));
  assert.ok(!html.includes(host.token));
  assert.ok(!html.includes(host.code));
  assert.ok(!html.includes('partyPrivate'));
  for (const mode of ['try', 'explore', 'remix']) {
    const copy = await request('/api/handwerker/rooms', {
      op: 'create',
      name: 'Copy check',
      buildId: save.data.id,
      buildMode: mode,
    });
    assert.equal(copy.status, 200, JSON.stringify(copy.data));
    sessions.push(copy.data.session);
    assert.notEqual(copy.data.session.code, host.code);
    assert.equal(copy.data.snapshot.world.sharedFrom, save.data.id);
    assert.equal(
      copy.data.snapshot.world.mode,
      mode === 'try' ? 'job' : 'sandbox',
    );
    assert.equal(copy.data.snapshot.world.party.daily.date, '2026-09-06');
  }
  const remixSave = await request(
    '/api/handwerker/builds',
    { ...sessions.at(-1), title: 'Remix check' },
    { cookie: save.cookie },
  );
  assert.equal(remixSave.status, 201);
  const remixPage = await fetch(base + remixSave.data.url);
  assert.ok((await remixPage.text()).includes(`/build/${save.data.id}`));
  const unchanged = await fetch(base + save.data.url);
  assert.ok((await unchanged.text()).includes('A reusable test build'));
  const start = await request('/api/handwerker/rooms', {
    op: 'action',
    ...host,
    seq: 1,
    actionId: crypto.randomUUID(),
    roundId: created.data.snapshot.world.party.roundId,
    action: { type: 'party', op: 'start' },
  });
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const call = await request('/api/handwerker/rooms', {
    op: 'action',
    ...host,
    seq: 2,
    actionId: crypto.randomUUID(),
    roundId: start.data.snapshot.world.party.roundId,
    action: { type: 'party', op: 'inspect' },
  });
  assert.equal(call.status, 200);
  const rescue = await request('/api/handwerker/rooms', {
    op: 'sync',
    ...host,
  });
  assert.equal(rescue.data.snapshot.world.party.phase, 'rescue');
  assert.ok(
    rescue.data.snapshot.world.party.deadline - rescue.data.snapshot.now <=
      20000,
  );
  console.log(
    'PASS: authenticated saving, shelf isolation, public preview privacy, three independent copy modes, remix attribution, daily preservation and server-driven rescue.',
  );
} finally {
  await Promise.all(
    sessions.map((session) =>
      request('/api/handwerker/rooms', { op: 'leave', ...session }),
    ),
  );
}
