import { waitFor } from '../../shared/rooms/wait-for';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShelfConnection } from './connection';
import type { Input, Snapshot, SnapshotTiming } from './types';

void test('Input changes wake an idle connection and coalesce behind an in-flight poll', async () => {
  const original = globalThis.fetch;
  const requests: { input: Input; resolve: (response: Response) => void }[] =
    [];
  const timings: SnapshotTiming[] = [];
  globalThis.fetch = ((_url: unknown, options: RequestInit) =>
    new Promise<Response>((resolve) => {
      const body = JSON.parse(
        typeof options.body === 'string' ? options.body : '{}',
      ) as { input: Input };
      requests.push({ input: body.input, resolve });
    })) as typeof fetch;
  const connection = new ShelfConnection(
    { code: 'ABC234', id: 'you', token: 'test' },
    (_s, timing) => {
      if (timing) timings.push(timing);
    },
    () => {},
  );
  const reply = (index: number) =>
    requests[index].resolve(
      new Response(
        JSON.stringify({ snapshot: { version: index + 1 } as Snapshot }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
  try {
    const first = connection.poll();
    connection.move({ x: 1, z: 0 });
    connection.move({ x: 0, z: -1 });
    assert.equal(requests.length, 1, 'never overlap movement polls');
    reply(0);
    await first;
    assert.ok(
      await waitFor(() => requests.length === 2),
      'the queued move follows once the floor elapses',
    );
    assert.equal(
      requests[1].input.z,
      -1,
      'send the newest direction immediately after the outstanding reply',
    );
    reply(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.move({ x: 0, z: 0 });
    assert.equal(
      requests.length,
      3,
      'do not wait for the next timer to send a key release',
    );
    assert.equal(requests[2].input.x, 0);
    assert.equal(requests[2].input.z, 0);
    assert.ok(requests[2].input.seq > requests[1].input.seq);
    connection.stop();
    reply(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(timings.length, 2, 'stopped connections ignore late replies');
    for (const timing of timings) assert.ok(timing.receivedAt >= timing.sentAt);
  } finally {
    connection.stop();
    globalThis.fetch = original;
  }
});
