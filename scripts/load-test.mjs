import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { sealCheckpoint } from '../shared/peer/crypto.ts';

// Intentionally local-only: use a separate database, never a public game server.
const origin = new URL(process.env.LOAD_TEST_URL || 'http://127.0.0.1:3057');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
  throw new Error('Load tests require an isolated local server.');
const roomsPerGame = Number(process.env.LOAD_TEST_ROOMS || 4);
const seconds = Number(process.env.LOAD_TEST_SECONDS || 30);
if (
  !Number.isInteger(roomsPerGame) ||
  roomsPerGame < 1 ||
  roomsPerGame > 8 ||
  !Number.isFinite(seconds) ||
  seconds < 5 ||
  seconds > 300
)
  throw new Error('Use 1–8 rooms per game and 5–300 seconds.');
const games = [
  ['stack-or-sink', '/api/peer', 1000],
  ['act-natural', '/api/peer', 1000],
  ['uphill-delivery', '/api/peer', 1000],
  ['dont-wake-the-giant', '/api/peer', 1000],
  ['shelf-control', '/api/shelf-control', 65],
  ['chaos', '/api/handwerker/rooms', 220],
  ['first-person', '/api/handwerker/first-person/rooms', 220],
];
const players = [],
  loops = [],
  samples = [],
  failures = [];
let running = true,
  measuring = false;
async function request(path, body, game, record = measuring) {
  const start = performance.now();
  const response = await fetch(new URL(path, origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: origin.origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (record)
    samples.push({
      game,
      ms: performance.now() - start,
      status: response.status,
      bytes: Buffer.byteLength(text),
    });
  if (!response.ok)
    throw new Error(
      `${game} ${body.op}: HTTP ${response.status} ${text.slice(0, 150)}`,
    );
  return JSON.parse(text);
}
async function poll(player) {
  let seq = 0;
  while (running) {
    const start = performance.now();
    try {
      const extra = player.peer ? { instance: player.instance, epoch: 1 } : {};
      await request(
        player.path,
        {
          ...player.session,
          ...extra,
          op: player.peer ? 'poll' : 'sync',
          ...(player.game === 'shelf-control'
            ? {
                input: {
                  x: Math.sin(seq / 10),
                  z: Math.cos(seq / 10),
                  seq,
                  jump: false,
                },
              }
            : {
                position: {
                  x: Math.sin(seq / 10),
                  y: 1.8,
                  z: 5,
                  angle: 0,
                  jump: 0,
                  yaw: 0,
                  pitch: 0,
                },
              }),
        },
        player.game,
      );
      if (player.peer && player.host) {
        // A valid encrypted synthetic 48 KB payload (~64 KB on the wire) per second.
        const checkpoint = await sealCheckpoint(
          { payload: 'x'.repeat(48_000) },
          player.key,
          `${player.game}:${player.session.code}`,
          1,
          seq,
        );
        await request(
          player.path,
          {
            ...player.session,
            ...extra,
            op: 'checkpoint',
            checkpoint,
            open: true,
          },
          player.game,
        );
      }
      seq++;
    } catch (error) {
      if (measuring) failures.push(error.message);
      else throw error;
    }
    await sleep(Math.max(0, player.interval - (performance.now() - start)));
  }
}
const stats = (values) => {
  const sorted = values.map((v) => v.ms).sort((a, b) => a - b);
  const percentile = (p) =>
    +(
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0
    ).toFixed(2);
  return {
    requests: values.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: percentile(1),
    errors: values.filter((v) => v.status !== 200).length,
  };
};
try {
  await Promise.all(
    games.map(async ([game, path, interval]) => {
      for (let room = 0; room < roomsPerGame; room++) {
        let code;
        for (let index = 0; index < 4; index++) {
          const created = await request(
            path,
            {
              game,
              op: index ? 'join' : 'create',
              code,
              name: `Load ${index}`,
              mode: 'sandbox',
            },
            game,
            false,
          );
          code = created.session.code;
          const player = {
            game,
            path,
            interval,
            session: created.session,
            peer: path === '/api/peer',
            instance: crypto.randomUUID(),
            host: index === 0,
            key: created.view?.key,
          };
          players.push(player);
          if (player.peer)
            await request(
              path,
              { ...player.session, op: 'hello', instance: player.instance },
              game,
              false,
            );
          loops.push(
            poll(player).catch((error) => {
              failures.push(error.message);
              running = false;
            }),
          );
        }
        if (game === 'shelf-control')
          await request(
            path,
            {
              ...players.find(
                (p) => p.game === game && p.session.code === code && p.host,
              ).session,
              op: 'action',
              requestId: crypto.randomUUID(),
              action: { type: 'start' },
            },
            game,
            false,
          );
      }
    }),
  );
  measuring = true;
  const start = performance.now();
  console.log(
    JSON.stringify({
      event: 'started',
      rooms: roomsPerGame * games.length,
      players: players.length,
      seconds,
    }),
  );
  for (let elapsed = 0; elapsed < seconds && running; elapsed += 5) {
    await sleep(Math.min(5, seconds - elapsed) * 1000);
    console.log(
      JSON.stringify({
        event: 'progress',
        seconds: Math.round((performance.now() - start) / 1000),
        ...stats(samples),
      }),
    );
  }
  const duration = (performance.now() - start) / 1000;
  measuring = false;
  console.log(
    JSON.stringify({
      event: 'result',
      durationSeconds: +duration.toFixed(2),
      rooms: roomsPerGame * games.length,
      players: players.length,
      requestsPerSecond: +(samples.length / duration).toFixed(1),
      ...stats(samples),
      byGame: Object.fromEntries(
        games.map(([game]) => [
          game,
          stats(samples.filter((s) => s.game === game)),
        ]),
      ),
      failures: failures.slice(0, 10),
      failureCount: failures.length,
    }),
  );
  if (failures.length || samples.some((sample) => sample.status !== 200))
    process.exitCode = 1;
} finally {
  running = false;
  await Promise.allSettled(loops);
  // Do not burst past the production request budget during teardown.
  for (const player of players)
    await request(
      player.path,
      {
        ...player.session,
        op: 'leave',
        ...(player.peer ? { instance: player.instance, epoch: 1 } : {}),
      },
      player.game,
      false,
    ).catch(() => {});
}
