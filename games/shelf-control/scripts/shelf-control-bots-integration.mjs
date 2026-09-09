import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const origin = process.argv[2] ?? 'http://127.0.0.1:3026';
if (
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname) &&
  !(
    origin === 'https://jumbleyard.up.railway.app' &&
    process.argv.includes('--live')
  )
)
  throw new Error(
    'Use a local preview or the exact public Jumbleyard origin with --live.',
  );
const sessions = [];
async function request(body) {
  const r = await fetch(`${origin}/api/shelf-control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { status: r.status, ...(await r.json()) };
}
async function create(name) {
  const r = await request({ op: 'create', name });
  assert.equal(r.status, 200);
  sessions.push(r.session);
  return r.session;
}
async function action(session, type, target, requestId = crypto.randomUUID()) {
  return request({
    op: 'action',
    ...session,
    requestId,
    action: { type, ...(target ? { target } : {}) },
  });
}
async function leave(session) {
  await request({ op: 'leave', ...session });
  sessions.splice(sessions.indexOf(session), 1);
}
function privateView(s) {
  assert.ok(!('botBrains' in s));
  assert.ok(!JSON.stringify(s).includes('suspects'));
  assert.ok(!JSON.stringify(s).includes('routeGoal'));
  for (const f of s.figures) {
    assert.ok(!('bot' in f));
    assert.ok(!('playerId' in f));
  }
  if (s.you.role === 'guard' && s.phase === 'hiding') {
    assert.equal(s.figures.length, 0);
    assert.equal(s.items.length, 0);
    assert.equal(s.events.length, 0);
  }
}
try {
  const page = await fetch(`${origin}/shelf-control`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /1–4 players \+ NPCs/);
  const human = await create('NPC verification');
  const add = await action(human, 'add-bot', undefined, 'add-once');
  assert.equal(add.status, 200);
  assert.equal(add.snapshot.players.filter((p) => p.bot).length, 1);
  const replay = await action(human, 'add-bot', undefined, 'add-once');
  assert.equal(replay.snapshot.players.length, 2);
  const bot = add.snapshot.players.find((p) => p.bot);
  assert.equal(
    (
      await request({
        op: 'sync',
        code: human.code,
        id: bot.id,
        token: human.token,
      })
    ).status,
    401,
  );
  assert.equal(
    (await action(human, 'remove-bot', bot.id)).snapshot.players.length,
    1,
  );
  const start = await action(human, 'fill-start');
  assert.equal(start.status, 200);
  assert.equal(start.snapshot.you.role, 'guard');
  assert.equal(start.snapshot.players.filter((p) => p.bot).length, 3);
  const deadline = Date.now() + 195000;
  let escaped = false,
    checks = 0,
    nextUpdate = Date.now() + 15000;
  while (Date.now() < deadline) {
    const reply = await request({
      op: 'sync',
      ...human,
      input: { x: 0, z: 0, seq: 1 },
    });
    assert.equal(reply.status, 200);
    const s = reply.snapshot;
    privateView(s);
    assert.equal(s.players.length, 4);
    checks++;
    if (s.escaped > 0) {
      escaped = true;
      break;
    }
    if (s.phase === 'guard-win') break;
    if (Date.now() >= nextUpdate) {
      console.log(
        `NPC shift running: ${s.phase}; ${checks} private snapshot checks.`,
      );
      nextUpdate = Date.now() + 15000;
    }
    await sleep(160);
  }
  assert.equal(
    escaped,
    true,
    'The NPC crew should complete an escape against an idle guard.',
  );
  await leave(human);
  console.log(
    'PASS: one human + three NPCs complete a live escape with private snapshots.',
  );
  // Keep an NPC in the first seat while passing hosting to a human, so this shift tests the guard role too.
  const creator = await create('Host transfer');
  await action(creator, 'add-bot');
  const joined = await request({
    op: 'join',
    code: creator.code,
    name: 'NPC teammate check',
  });
  assert.equal(joined.status, 200);
  const teammate = joined.session;
  sessions.push(teammate);
  assert.equal((await action(teammate, 'add-bot')).status, 400);
  await leave(creator);
  const guarded = await action(teammate, 'fill-start');
  assert.equal(guarded.status, 200);
  assert.equal(guarded.snapshot.host, teammate.id);
  assert.equal(guarded.snapshot.you.role, 'mannequin');
  assert.equal(guarded.snapshot.players.filter((p) => p.bot).length, 3);
  const ready = Date.now() + 19000;
  let playing = false;
  while (Date.now() < ready) {
    const r = await request({ op: 'sync', ...teammate });
    assert.equal(r.status, 200);
    privateView(r.snapshot);
    if (r.snapshot.phase === 'playing') {
      playing = true;
      break;
    }
    await sleep(170);
  }
  assert.equal(playing, true);
  await leave(teammate);
  console.log(
    'PASS: NPC guard, human teammate, host transfer, NPC auth rejection, seat management and cleanup.',
  );
} finally {
  for (const session of sessions)
    await request({ op: 'leave', ...session }).catch(() => {});
}
