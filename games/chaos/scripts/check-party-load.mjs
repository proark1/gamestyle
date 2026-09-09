import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = new URL(process.argv[2] || 'http://127.0.0.1:3001').origin;
const seconds = Number(process.argv[3] || 900),
  groups = Number(process.argv[4] || 10);
if (
  !Number.isFinite(seconds) ||
  seconds < 1 ||
  !Number.isInteger(groups) ||
  groups < 1 ||
  groups > 10
)
  throw new Error('Usage: check-party-load.mjs URL seconds groups (1–10)');
const sessions = [],
  samples = [],
  faults = [],
  accepted = new Map();
const tasks = new Map();
let success = 0,
  requests = 0;
async function request(body, measured = false) {
  const began = performance.now();
  const response = await fetch(base + '/api/handwerker/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (measured) {
    requests++;
    samples.push(performance.now() - began);
    if (response.ok) success++;
    else faults.push({ status: response.status, error: data.error });
  }
  if (!response.ok) throw new Error(`${response.status}: ${data.error}`);
  return data;
}
try {
  for (let room = 0; room < groups; room++) {
    const first = await request({
      op: 'create',
      mode: 'sandbox',
      name: `Load-${room}-0`,
    });
    const roundId = first.snapshot.world.party.roundId;
    for (let i = 0; i < 4; i++) {
      const data = i
        ? await request({
            op: 'join',
            code: first.session.code,
            name: `Load-${room}-${i}`,
          })
        : first;
      const session = { ...data.session, index: i, seq: 0, roundId };
      sessions.push(session);
      if (i < 2) {
        const taken = await request({
          ...session,
          op: 'action',
          seq: ++session.seq,
          actionId: crypto.randomUUID(),
          position: { x: i ? 1.6 : 4.6, z: 7.15, angle: 0 },
          action: { type: 'party', op: 'role', role: i },
        });
        tasks.set(session.id, taken.snapshot.world.party.task);
      } else tasks.set(session.id, data.snapshot.world.party.task);
    }
  }
  const started = performance.now();
  const progress = setInterval(
    () =>
      console.log(
        JSON.stringify({
          elapsedSeconds: Math.round((performance.now() - started) / 1000),
          requests,
          failed: requests - success,
        }),
      ),
    30000,
  );
  try {
    await Promise.all(
      sessions.map(async (session) => {
        while (performance.now() - started < seconds * 1000) {
          const before = performance.now(),
            phase = Math.floor((before - started) / 2200) % 2;
          const task = tasks.get(session.id),
            role = task.roles.indexOf(session.id);
          let action =
            session.index < 2
              ? { type: 'party', op: 'drive', x: phase ? 1 : -1, z: 0, turn: 0 }
              : undefined;
          if (session.index < 2) {
            if (task.damage > 0) {
              action =
                role >= 0
                  ? { type: 'party', op: 'release' }
                  : session.index === 0 && !task.roles.some(Boolean)
                    ? { type: 'party', op: 'recover' }
                    : undefined;
            } else if (role < 0)
              action = { type: 'party', op: 'role', role: session.index };
          }
          const position =
            session.index < 2
              ? {
                  x:
                    task.x +
                    Math.cos(task.angle) * (session.index ? -1.5 : 1.5),
                  z:
                    task.z -
                    Math.sin(task.angle) * (session.index ? -1.5 : 1.5),
                  angle: 0,
                }
              : undefined;
          if (action?.op === 'recover') Object.assign(position, task.origin);
          try {
            const data = await request(
              {
                ...session,
                op: action ? 'action' : 'sync',
                ...(position ? { position } : {}),
                ...(action
                  ? {
                      action,
                      seq: ++session.seq,
                      actionId: crypto.randomUUID(),
                    }
                  : {}),
              },
              true,
            );
            const s = data.snapshot;
            tasks.set(session.id, s.world.party.task);
            assert.equal(s.world.partyPrivate, undefined);
            assert.equal(s.players.length, 4);
            assert.ok(Number.isFinite(s.world.party.task.x));
            assert.ok(s.version >= (accepted.get(session.id) || 0));
            accepted.set(session.id, s.version);
            if (action) assert.equal(s.actionSeq, session.seq);
          } catch (error) {
            try {
              const refreshed = await request({ ...session, op: 'sync' }, true);
              tasks.set(session.id, refreshed.snapshot.world.party.task);
            } catch {}
            if (!String(error).match(/4\d\d:|5\d\d:/))
              faults.push({ error: String(error) });
          }
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.max(0, 220 - (performance.now() - before)),
            ),
          );
        }
      }),
    );
  } finally {
    clearInterval(progress);
  }
  samples.sort((a, b) => a - b);
  const report = {
    date: new Date().toISOString(),
    base,
    groups,
    players: sessions.length,
    seconds,
    requests,
    success,
    failed: requests - success,
    assertionOrNetworkFaults: faults.length - (requests - success),
    p50Ms: Math.round(samples[Math.floor(samples.length * 0.5)] || 0),
    p95Ms: Math.round(samples[Math.floor(samples.length * 0.95)] || 0),
    maxMs: Math.round(samples.at(-1) || 0),
    faultExamples: faults.slice(0, 5),
    transport: 'HTTP 220 ms; two moving carriers per room',
  };
  await mkdir('outputs', { recursive: true });
  await writeFile('outputs/party-load.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.ok(
    faults.length / Math.max(1, requests) < 0.01,
    'More than 1% failed requests/invariants',
  );
  assert.ok(report.p95Ms < 250, 'p95 exceeded 250 ms');
} finally {
  await Promise.allSettled(
    sessions.map((session) => request({ ...session, op: 'leave' })),
  );
}
